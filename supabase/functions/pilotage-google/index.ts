import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json; charset=utf-8" };
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const REQUIRED_SCOPES = [
  "openid",
  "email",
  DRIVE_SCOPE,
  CALENDAR_SCOPE,
  CALENDAR_EVENTS_SCOPE,
  CALENDAR_LIST_SCOPE,
];
const OAUTH_SCOPES = REQUIRED_SCOPES.join(" ");
const FOLDER_MIME = "application/vnd.google-apps.folder";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
function safeUrl(value: string | null | undefined) {
  try {
    const u = new URL(String(value || ""));
    return ["https:", "http:"].includes(u.protocol) ? u.toString() : null;
  } catch { return null; }
}
function bytesToB64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function b64ToBytes(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function encryptionKey() {
  const secret = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY") || "";
  if (!secret) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY manquant");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptToken(value: string | null | undefined) {
  if (!value) return { encrypted: null, iv: null };
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { encrypted: bytesToB64(new Uint8Array(encrypted)), iv: bytesToB64(iv) };
}
async function decryptToken(encrypted: string | null, iv: string | null) {
  if (!encrypted || !iv) return null;
  const key = await encryptionKey();
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(iv) }, key, b64ToBytes(encrypted));
  return new TextDecoder().decode(clear);
}
function googleConfig() {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || `${supabaseUrl}/functions/v1/pilotage-google/callback`;
  return { clientId, clientSecret, redirectUri, configured: Boolean(clientId && clientSecret && Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY")) };
}
function dbClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
async function currentMember(req: Request, db: ReturnType<typeof dbClient>) {
  const header = req.headers.get("authorization") || "";
  const jwt = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!jwt) return null;
  const { data: userData, error: userError } = await db.auth.getUser(jwt);
  if (userError || !userData?.user) return null;
  const { data: member } = await db.from("team_members")
    .select("id,client_key,display_name,role,active,profile_id")
    .eq("profile_id", userData.user.id).eq("active", true).maybeSingle();
  return member ? { ...member, email: userData.user.email || null } : null;
}
async function ensureIntegration(db: ReturnType<typeof dbClient>, memberId: string, provider: string) {
  const { data: existing } = await db.from("integrations").select("*")
    .eq("owner_member_id", memberId).eq("provider", provider).maybeSingle();
  if (existing) return existing;
  const configuration = provider === "google_drive"
    ? { root_folder_id: null, root_folder_name: null, drive_id: null, include_subfolders: true, include_shared_drives: true, sync_mode: "read_only", scope_rule: "selected_root_only" }
    : provider === "google_calendar"
      ? { multi_calendar: true, selected_calendar_ids: [], default_sync_mode: "read_only", meet_enabled: true }
      : { sync_mode: "polling", poll_interval_seconds: 60, project_links: true };
  const { data, error } = await db.from("integrations").insert({ owner_member_id: memberId, provider, status: "disconnected", configuration }).select().single();
  if (error) throw error;
  return data;
}
async function setGoogleConnected(db: ReturnType<typeof dbClient>, memberId: string, email: string | null) {
  for (const provider of ["google_drive", "google_calendar"] as const) {
    const integration = await ensureIntegration(db, memberId, provider);
    await db.from("integrations").update({
      status: "connected",
      last_error: null,
      configuration: { ...(integration.configuration || {}), google_email: email || null },
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id);
  }
}
async function markIntegrationError(db: ReturnType<typeof dbClient>, integrationId: string, error: unknown) {
  // Une erreur de synchronisation ne déconnecte pas le compte OAuth.
  // On garde donc le statut de connexion et on expose seulement l'erreur.
  await db.from("integrations").update({
    last_error: error instanceof Error ? error.message : String(error),
    updated_at: new Date().toISOString(),
  }).eq("id", integrationId);
}
async function getAccessToken(db: ReturnType<typeof dbClient>, memberId: string) {
  const cfg = googleConfig();
  if (!cfg.configured) throw new Error("Configuration Google OAuth incomplète");
  const { data: cred, error } = await db.from("google_credentials").select("*").eq("owner_member_id", memberId).maybeSingle();
  if (error) throw error;
  if (!cred) throw new Error("Compte Google non connecté");
  const expiresAt = cred.access_token_expires_at ? new Date(cred.access_token_expires_at).getTime() : 0;
  if (cred.encrypted_access_token && expiresAt > Date.now() + 60_000) {
    const token = await decryptToken(cred.encrypted_access_token, cred.access_iv);
    if (token) return token;
  }
  const refreshToken = await decryptToken(cred.encrypted_refresh_token, cred.refresh_iv);
  if (!refreshToken) throw new Error("Jeton de renouvellement Google indisponible. Reconnecte Google.");
  const form = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const tokenData = await tokenResp.json();
  if (!tokenResp.ok || !tokenData.access_token) throw new Error(tokenData.error_description || tokenData.error || "Renouvellement Google refusé");
  const encrypted = await encryptToken(tokenData.access_token);
  const expiry = new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000).toISOString();
  await db.from("google_credentials").update({
    encrypted_access_token: encrypted.encrypted,
    access_iv: encrypted.iv,
    access_token_expires_at: expiry,
    scope: tokenData.scope || cred.scope,
    updated_at: new Date().toISOString(),
  }).eq("owner_member_id", memberId);
  return tokenData.access_token as string;
}
function ignoredDrivePath(path: string) {
  const normalized = `/${String(path || "").replaceAll("\\", "/").toLowerCase()}/`;
  return normalized.includes("/node_modules/");
}

async function googleFetch(token: string, url: string, init: RequestInit = {}) {
  const resp = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error?.message || data?.error_description || `Google HTTP ${resp.status}`);
  return data;
}
async function projectAccess(db: ReturnType<typeof dbClient>, member: any, projectClientKey: string | null | undefined) {
  if (!projectClientKey) return null;
  const { data: project } = await db.from("projects").select("id,client_key").eq("client_key", projectClientKey).maybeSingle();
  if (!project) throw new Error("Projet introuvable");
  if (member.role !== "admin") {
    const { data: membership } = await db.from("project_members").select("project_id")
      .eq("project_id", project.id).eq("member_id", member.id).maybeSingle();
    if (!membership) throw new Error("Accès projet refusé");
  }
  return project;
}
async function taskAccess(db: ReturnType<typeof dbClient>, member: any, taskClientKey: string | null | undefined) {
  if (!taskClientKey) return null;
  const { data: task } = await db.from("tasks").select("id,client_key,project_id").eq("client_key", taskClientKey).maybeSingle();
  if (!task) throw new Error("Tâche introuvable");
  if (member.role !== "admin" && task.project_id) {
    const { data: membership } = await db.from("project_members").select("project_id")
      .eq("project_id", task.project_id).eq("member_id", member.id).maybeSingle();
    if (!membership) throw new Error("Accès tâche refusé");
  }
  return task;
}


async function memberEmail(db: ReturnType<typeof dbClient>, memberId: string) {
  const { data: row } = await db.from("team_members").select("profile_id").eq("id", memberId).maybeSingle();
  if (!row?.profile_id) return null;
  const { data, error } = await db.auth.admin.getUserById(row.profile_id);
  if (error) return null;
  return data?.user?.email || null;
}

async function notifyMember(
  db: ReturnType<typeof dbClient>,
  recipientMemberId: string,
  input: {
    clientKey: string;
    severity?: "info" | "action" | "warning" | "error";
    type: string;
    title: string;
    message: string;
    actionType?: string;
    projectId?: string | null;
    taskId?: string | null;
    groupKey?: string | null;
    internalTag?: string | null;
    count?: number;
  }
) {
  const row = {
    client_key: input.clientKey,
    recipient_member_id: recipientMemberId,
    severity: input.severity || "info",
    type: input.type,
    title: input.title,
    message: input.message,
    action_type: input.actionType || "read",
    project_id: input.projectId || null,
    task_id: input.taskId || null,
    group_key: input.groupKey || null,
    internal_tag: input.internalTag || null,
    count: Math.max(1, Number(input.count || 1)),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("notifications").upsert(row, {
    onConflict: "client_key",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

function grantedScopeSet(scope: string | null | undefined) {
  return new Set(String(scope || "").split(/\s+/).map(x => x.trim()).filter(Boolean));
}

async function listGoogleCalendars(token: string) {
  let pageToken = "";
  const items: any[] = [];
  do {
    const params = new URLSearchParams({ maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleFetch(token, `https://www.googleapis.com/calendar/v3/users/me/calendarList?${params}`);
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return items;
}

async function ensurePrimaryCalendarSource(
  db: ReturnType<typeof dbClient>,
  memberId: string,
  token: string
) {
  const integration = await ensureIntegration(db, memberId, "google_calendar");
  const calendars = await listGoogleCalendars(token);
  const primary = calendars.find((c: any) => c.primary) || calendars[0];
  if (!primary?.id) throw new Error("Aucun agenda Google disponible pour créer la réunion.");

  const row = {
    integration_id: integration.id,
    external_calendar_id: primary.id,
    name: primary.summary || primary.id,
    description: primary.description || null,
    timezone: primary.timeZone || "Europe/Paris",
    access_role: primary.accessRole || null,
    is_primary: Boolean(primary.primary),
    selected: true,
    shared_with_team: false,
    sync_mode: "two_way",
    background_color: primary.backgroundColor || null,
    foreground_color: primary.foregroundColor || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("calendar_sources")
    .upsert(row, { onConflict: "integration_id,external_calendar_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function meetUrlFromEvent(event: any) {
  return event?.hangoutLink
    || event?.conferenceData?.entryPoints?.find((p: any) => p?.entryPointType === "video")?.uri
    || null;
}

async function persistCalendarEvent(
  db: ReturnType<typeof dbClient>,
  source: any,
  event: any,
  projectId: string | null,
  taskId: string | null
) {
  const row = {
    calendar_source_id: source.id,
    project_id: projectId,
    task_id: taskId,
    external_event_id: event.id,
    status: event.status || "confirmed",
    summary: event.summary || "Réunion",
    description: event.description || null,
    location: event.location || null,
    start_at: event.start?.dateTime || null,
    end_at: event.end?.dateTime || null,
    start_date: event.start?.date || null,
    end_date: event.end?.date || null,
    all_day: Boolean(event.start?.date && !event.start?.dateTime),
    html_link: event.htmlLink || null,
    organizer_email: event.organizer?.email || null,
    meet_url: meetUrlFromEvent(event),
    conference_id: event.conferenceData?.conferenceId || null,
    attendees: Array.isArray(event.attendees) ? event.attendees : [],
    updated_remote_at: event.updated || null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("calendar_events")
    .upsert(row, { onConflict: "calendar_source_id,external_event_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createMeetEventForMember(
  db: ReturnType<typeof dbClient>,
  member: any,
  token: string,
  input: {
    title: string;
    description?: string | null;
    start_at: string;
    end_at: string;
    timezone?: string | null;
    attendee_emails?: string[];
    project_id?: string | null;
    task_id?: string | null;
  }
) {
  const start = new Date(input.start_at);
  const end = new Date(input.end_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("Créneau de réunion invalide.");
  }

  const source = await ensurePrimaryCalendarSource(db, member.id, token);
  const timezone = input.timezone || source.timezone || "Europe/Paris";
  const attendeeEmails = [...new Set((input.attendee_emails || [])
    .map(x => String(x || "").trim())
    .filter(Boolean))];

  const eventBody = {
    summary: String(input.title || "Réunion SpeedArti").slice(0, 240),
    description: input.description || undefined,
    start: { dateTime: start.toISOString(), timeZone: timezone },
    end: { dateTime: end.toISOString(), timeZone: timezone },
    attendees: attendeeEmails.map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const remote = await googleFetch(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.external_calendar_id)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventBody),
    }
  );

  const stored = await persistCalendarEvent(
    db,
    source,
    remote,
    input.project_id || null,
    input.task_id || null
  );

  return {
    event: stored,
    google_event_id: remote.id,
    meet_url: meetUrlFromEvent(remote),
    html_link: remote.htmlLink || null,
    calendar_source_id: source.id,
  };
}

async function syncGoogleChat(
  db: ReturnType<typeof dbClient>,
  member: any,
  token: string
) {
  const integration = await ensureIntegration(db, member.id, "google_chat");
  let pageToken = "";
  const remoteSpaces: any[] = [];

  do {
    const params = new URLSearchParams({ pageSize: "200" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleFetch(token, `https://chat.googleapis.com/v1/spaces?${params}`);
    remoteSpaces.push(...(data.spaces || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken && remoteSpaces.length < 1000);

  const { data: existingRows } = await db.from("google_chat_spaces")
    .select("*").eq("integration_id", integration.id);
  const existing = new Map((existingRows || []).map((r: any) => [r.external_space_name, r]));
  const now = new Date().toISOString();

  if (remoteSpaces.length) {
    const spaceRows = remoteSpaces.map((space: any) => ({
      integration_id: integration.id,
      external_space_name: space.name,
      display_name: space.displayName || (space.spaceType === "DIRECT_MESSAGE" ? "Message direct" : space.name),
      space_type: space.spaceType || null,
      space_uri: space.spaceUri || null,
      project_id: existing.get(space.name)?.project_id || null,
      last_seen_at: existing.get(space.name)?.last_seen_at || null,
      last_notified_at: existing.get(space.name)?.last_notified_at || null,
      unread_count: Number(existing.get(space.name)?.unread_count || 0),
      last_synced_at: now,
      updated_at: now,
    }));
    const { error } = await db.from("google_chat_spaces")
      .upsert(spaceRows, { onConflict: "integration_id,external_space_name" });
    if (error) throw error;
  }

  const { data: spaces } = await db.from("google_chat_spaces")
    .select("*")
    .eq("integration_id", integration.id)
    .order("display_name", { ascending: true });

  let unreadTotal = 0;
  let newMessages = 0;

  for (const space of (spaces || []).slice(0, 40)) {
    const params = new URLSearchParams({
      pageSize: "50",
      orderBy: "createTime DESC",
      showDeleted: "true",
    });
    const data = await googleFetch(
      token,
      `https://chat.googleapis.com/v1/${space.external_space_name}/messages?${params}`
    );
    const messages = data.messages || [];
    const rows = messages
      .filter((m: any) => m?.name && m?.createTime)
      .map((m: any) => ({
        space_id: space.id,
        external_message_name: m.name,
        thread_name: m.thread?.name || null,
        sender_user_name: m.sender?.name || null,
        sender_display_name: m.sender?.displayName || null,
        text: m.text || "",
        formatted_text: m.formattedText || null,
        create_time: m.createTime,
        update_time: m.lastUpdateTime || null,
        deleted: Boolean(m.deleteTime),
        last_synced_at: now,
        updated_at: now,
      }));

    if (rows.length) {
      const { error } = await db.from("google_chat_messages")
        .upsert(rows, { onConflict: "space_id,external_message_name" });
      if (error) throw error;
    }

    const newestTime = rows.reduce((max: string | null, row: any) => {
      if (!max || new Date(row.create_time) > new Date(max)) return row.create_time;
      return max;
    }, null);

    const notifyAfter = space.last_notified_at ? new Date(space.last_notified_at).getTime() : null;
    const fresh = notifyAfter
      ? rows.filter((row: any) => new Date(row.create_time).getTime() > notifyAfter && !row.deleted)
      : [];

    if (fresh.length) {
      newMessages += fresh.length;
      const latest = fresh.sort((a: any, b: any) =>
        new Date(b.create_time).getTime() - new Date(a.create_time).getTime()
      )[0];
      const hash = await sha256Hex(latest.external_message_name);
      await notifyMember(db, member.id, {
        clientKey: `google-chat-${hash.slice(0, 32)}`,
        severity: "info",
        type: "google_chat_message",
        title: `Nouveau message · ${space.display_name || "Google Chat"}`,
        message: `${latest.sender_display_name || "Google Chat"} : ${String(latest.text || "Nouveau message").slice(0, 280)}`,
        actionType: "read",
        projectId: space.project_id || null,
        groupKey: `google-chat-${space.id}`,
        internalTag: "PILOT-GOOGLE-CHAT-NEW",
        count: fresh.length,
      });
    }

    const seenAt = space.last_seen_at ? new Date(space.last_seen_at).getTime() : null;
    const unread = seenAt
      ? rows.filter((row: any) => new Date(row.create_time).getTime() > seenAt && !row.deleted).length
      : Math.max(0, Number(space.unread_count || 0) + fresh.length);
    unreadTotal += unread;

    await db.from("google_chat_spaces").update({
      last_remote_message_at: newestTime || space.last_remote_message_at || null,
      last_notified_at: newestTime || space.last_notified_at || null,
      unread_count: unread,
      last_synced_at: now,
      updated_at: now,
    }).eq("id", space.id);
  }

  await db.from("integrations").update({
    status: "connected",
    last_synced_at: now,
    last_error: null,
    updated_at: now,
  }).eq("id", integration.id);

  const { data: freshSpaces } = await db.from("google_chat_spaces")
    .select("id,external_space_name,display_name,space_type,space_uri,project_id,last_remote_message_at,last_seen_at,unread_count,last_synced_at")
    .eq("integration_id", integration.id)
    .order("last_remote_message_at", { ascending: false, nullsFirst: false });

  const projectIds = [...new Set((freshSpaces || []).map((s: any) => s.project_id).filter(Boolean))];
  const { data: linkedProjects } = projectIds.length
    ? await db.from("projects").select("id,client_key").in("id", projectIds)
    : { data: [] };
  const projectKeys = new Map((linkedProjects || []).map((p: any) => [p.id, p.client_key]));

  return {
    spaces: (freshSpaces || []).map((space: any) => ({
      ...space,
      project_client_key: space.project_id ? projectKeys.get(space.project_id) || null : null,
    })),
    unread_total: unreadTotal,
    new_messages: newMessages
  };
}

async function callback(req: Request, db: ReturnType<typeof dbClient>) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (!state) return response({ error: "state manquant" }, 400);
  const stateHash = await sha256Hex(state);
  const { data: stored } = await db.from("google_oauth_states").select("*").eq("state_hash", stateHash).maybeSingle();
  if (!stored || new Date(stored.expires_at).getTime() < Date.now()) return response({ error: "state expiré ou invalide" }, 400);
  await db.from("google_oauth_states").delete().eq("state_hash", stateHash);
  const redirect = new URL(stored.return_url);
  if (oauthError || !code) {
    redirect.searchParams.set("google", "error");
    redirect.searchParams.set("reason", oauthError || "missing_code");
    return Response.redirect(redirect.toString(), 302);
  }
  const cfg = googleConfig();
  if (!cfg.configured) return response({ error: "Configuration Google OAuth incomplète" }, 500);
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: "authorization_code" }),
  });
  const tokenData = await tokenResp.json();
  if (!tokenResp.ok || !tokenData.access_token) return response({ error: tokenData.error_description || tokenData.error || "Échange OAuth refusé" }, 400);

  const { data: existing } = await db.from("google_credentials").select("*").eq("owner_member_id", stored.member_id).maybeSingle();
  const access = await encryptToken(tokenData.access_token);
  const refresh = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;
  let googleEmail: string | null = existing?.google_email || null;
  try {
    const info = await googleFetch(tokenData.access_token, "https://www.googleapis.com/oauth2/v2/userinfo");
    googleEmail = info.email || googleEmail;
  } catch { /* Le mail est informatif, pas bloquant. */ }
  const row = {
    owner_member_id: stored.member_id,
    google_email: googleEmail,
    encrypted_access_token: access.encrypted,
    access_iv: access.iv,
    access_token_expires_at: new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000).toISOString(),
    encrypted_refresh_token: refresh?.encrypted || existing?.encrypted_refresh_token || null,
    refresh_iv: refresh?.iv || existing?.refresh_iv || null,
    scope: tokenData.scope || existing?.scope || OAUTH_SCOPES,
    updated_at: new Date().toISOString(),
  };
  const { error: upsertError } = await db.from("google_credentials").upsert(row, { onConflict: "owner_member_id" });
  if (upsertError) return response({ error: upsertError.message }, 500);
  await setGoogleConnected(db, stored.member_id, googleEmail);
  redirect.searchParams.set("google", "connected");
  return Response.redirect(redirect.toString(), 302);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const db = dbClient();
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/callback")) return callback(req, db);
  if (req.method !== "POST") return response({ error: "Méthode non supportée" }, 405);

  const member = await currentMember(req, db);
  if (!member) return response({ error: "Session Pilotage requise" }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "status");
  const cfg = googleConfig();

  try {
    if (action === "status") {
      const { data: integrations } = await db.from("integrations").select("provider,status,configuration,last_synced_at,last_error")
        .eq("owner_member_id", member.id).in("provider", ["google_drive", "google_calendar"]);
      const { data: cred } = await db.from("google_credentials")
        .select("google_email,access_token_expires_at,updated_at,scope")
        .eq("owner_member_id", member.id).maybeSingle();
      const granted = grantedScopeSet(cred?.scope);
      const missingScopes = REQUIRED_SCOPES.filter(scope => !granted.has(scope));
      return response({
        configured: cfg.configured,
        integrations: integrations || [],
        account: cred ? {
          google_email: cred.google_email,
          access_token_expires_at: cred.access_token_expires_at,
          updated_at: cred.updated_at,
        } : null,
        required_scopes: REQUIRED_SCOPES,
        missing_scopes: missingScopes,
        needs_reconnect: Boolean(cred && missingScopes.length),
        redirect_uri: cfg.redirectUri
      });
    }

    if (!cfg.configured) return response({ error: "Google OAuth n’est pas encore configuré côté serveur.", code: "google_not_configured", redirect_uri: cfg.redirectUri }, 503);

    if (action === "start_oauth") {
      const returnUrl = safeUrl(body?.return_url);
      if (!returnUrl) return response({ error: "URL de retour invalide" }, 400);
      const state = crypto.randomUUID() + crypto.randomUUID();
      const stateHash = await sha256Hex(state);
      await db.from("google_oauth_states").delete().lt("expires_at", new Date().toISOString());
      const { error } = await db.from("google_oauth_states").insert({
        state_hash: stateHash,
        member_id: member.id,
        return_url: returnUrl,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw error;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", cfg.clientId);
      authUrl.searchParams.set("redirect_uri", cfg.redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", OAUTH_SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("state", state);
      return response({ authorization_url: authUrl.toString(), redirect_uri: cfg.redirectUri });
    }

    if (action === "disconnect") {
      await db.from("google_credentials").delete().eq("owner_member_id", member.id);
      await db.from("integrations").update({ status: "disconnected", last_error: null, updated_at: new Date().toISOString() })
        .eq("owner_member_id", member.id).in("provider", ["google_drive", "google_calendar"]);
      return response({ ok: true });
    }

    const token = await getAccessToken(db, member.id);

    if (action === "list_drive_roots") {
      const root = await googleFetch(token, "https://www.googleapis.com/drive/v3/files/root?fields=id,name,mimeType,driveId&supportsAllDrives=true");
      const drives = await googleFetch(token, "https://www.googleapis.com/drive/v3/drives?pageSize=100&fields=drives(id,name)");
      return response({ roots: [
        { id: root.id || "root", name: root.name || "Mon Drive", drive_id: null, kind: "my_drive" },
        ...((drives.drives || []).map((d: any) => ({ id: d.id, name: d.name, drive_id: d.id, kind: "shared_drive" }))),
      ] });
    }

    if (action === "list_drive_folder") {
      const parentId = String(body?.parent_id || "root");
      const driveId = body?.drive_id ? String(body.drive_id) : null;
      const params = new URLSearchParams({
        q: `'${parentId.replaceAll("'", "\\'")}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
        pageSize: "1000",
        orderBy: "name",
        fields: "files(id,name,mimeType,driveId,parents,webViewLink)",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (driveId) { params.set("corpora", "drive"); params.set("driveId", driveId); }
      const data = await googleFetch(token, `https://www.googleapis.com/drive/v3/files?${params}`);
      return response({ folders: data.files || [] });
    }

    if (action === "select_drive_root") {
      const folderId = String(body?.folder_id || "");
      if (!folderId) return response({ error: "Dossier manquant" }, 400);
      const driveId = body?.drive_id ? String(body.drive_id) : null;
      const folder = await googleFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,driveId,webViewLink&supportsAllDrives=true`);
      if (folder.mimeType !== FOLDER_MIME) return response({ error: "La sélection n’est pas un dossier" }, 400);
      const integration = await ensureIntegration(db, member.id, "google_drive");
      const configuration = {
        ...(integration.configuration || {}),
        root_folder_id: folder.id,
        root_folder_name: folder.name,
        drive_id: driveId || folder.driveId || null,
        include_subfolders: true,
        include_shared_drives: true,
        sync_mode: "read_only",
        scope_rule: "selected_root_only",
      };
      await db.from("integrations").update({ status: "connected", configuration, last_error: null, updated_at: new Date().toISOString() }).eq("id", integration.id);
      return response({ ok: true, root: { id: folder.id, name: folder.name, drive_id: configuration.drive_id } });
    }

    if (action === "sync_drive") {
      const integration = await ensureIntegration(db, member.id, "google_drive");
      const config = integration.configuration || {};
      const rootId = config.root_folder_id;
      if (!rootId) return response({ error: "Choisis d’abord le dossier Drive à synchroniser." }, 400);

      const driveId = config.drive_id || null;
      const storedCursor = config.drive_sync_cursor || null;
      const SYNC_VERSION = 2;
      const cursor = storedCursor && storedCursor.root_id === rootId && storedCursor.version === SYNC_VERSION
        ? {
            version: SYNC_VERSION,
            root_id: rootId,
            run_id: storedCursor.run_id || crypto.randomUUID(),
            queue: (Array.isArray(storedCursor.queue) ? storedCursor.queue : []).filter((item: any) => !ignoredDrivePath(item?.path || "")),
            current: storedCursor.current && !ignoredDrivePath(storedCursor.current?.path || "") ? storedCursor.current : null,
            page_token: storedCursor.page_token || "",
            total: Number(storedCursor.total || 0),
          }
        : {
            version: SYNC_VERSION,
            root_id: rootId,
            run_id: crypto.randomUUID(),
            queue: [{ id: rootId, path: "" }],
            current: null,
            page_token: "",
            total: 0,
          };

      // Le parcours est volontairement découpé en petits lots pour éviter
      // le timeout d'une Edge Function sur un dossier avec beaucoup de fichiers.
      const MAX_API_CALLS = 5;
      const PAGE_SIZE = 100;
      let apiCalls = 0;
      let processedThisBatch = 0;

      while (apiCalls < MAX_API_CALLS && (cursor.current || cursor.queue.length)) {
        if (!cursor.current) {
          cursor.current = cursor.queue.shift() || null;
          cursor.page_token = "";
          if (!cursor.current) break;
        }

        const current = cursor.current;
        const params = new URLSearchParams({
          q: `'${String(current.id).replaceAll("'", "\\\\'")}' in parents and trashed=false`,
          pageSize: String(PAGE_SIZE),
          fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size,md5Checksum,webViewLink,parents,driveId,trashed)",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
        });
        if (cursor.page_token) params.set("pageToken", cursor.page_token);
        if (driveId) {
          params.set("corpora", "drive");
          params.set("driveId", driveId);
        }

        const data = await googleFetch(token, `https://www.googleapis.com/drive/v3/files?${params}`);
        apiCalls += 1;

        const rows: any[] = [];
        for (const file of data.files || []) {
          const isFolder = file.mimeType === FOLDER_MIME;
          const relativePath = current.path ? `${current.path}/${file.name}` : file.name;
          rows.push({
            integration_id: integration.id,
            external_file_id: file.id,
            parent_external_file_id: current.id,
            name: file.name,
            mime_type: file.mimeType || null,
            web_url: file.webViewLink || null,
            relative_path: relativePath,
            is_folder: isFolder,
            trashed: Boolean(file.trashed),
            modified_time: file.modifiedTime || null,
            size_bytes: file.size ? Number(file.size) : null,
            checksum: file.md5Checksum || null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          if (isFolder && config.include_subfolders !== false && !ignoredDrivePath(relativePath)) {
            cursor.queue.push({ id: file.id, path: relativePath });
          }
        }

        if (rows.length) {
          const { error } = await db.from("drive_sync_items")
            .upsert(rows, { onConflict: "integration_id,external_file_id" });
          if (error) throw error;
          processedThisBatch += rows.length;
          cursor.total += rows.length;
        }

        if (data.nextPageToken) {
          cursor.page_token = data.nextPageToken;
        } else {
          cursor.current = null;
          cursor.page_token = "";
        }
      }

      const done = !cursor.current && cursor.queue.length === 0;
      const updatedConfiguration = { ...config };

      if (done) {
        delete updatedConfiguration.drive_sync_cursor;
        updatedConfiguration.last_drive_sync_count = cursor.total;
        updatedConfiguration.last_drive_sync_run_id = cursor.run_id;
        await db.from("integrations").update({
          status: "connected",
          configuration: updatedConfiguration,
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", integration.id);
      } else {
        updatedConfiguration.drive_sync_cursor = cursor;
        await db.from("integrations").update({
          status: "connected",
          configuration: updatedConfiguration,
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", integration.id);
      }

      return response({
        ok: true,
        done,
        count: processedThisBatch,
        total: cursor.total,
        remaining_folders: cursor.queue.length + (cursor.current ? 1 : 0),
      });
    }

    if (action === "link_drive_item") {
      const itemId = String(body?.item_id || "");
      const project = await projectAccess(db, member, body?.project_client_key || null);
      const { data: item } = await db.from("drive_sync_items").select("id,integration_id")
        .eq("id", itemId).maybeSingle();
      if (!item) return response({ error: "Fichier Drive introuvable" }, 404);
      const { data: integration } = await db.from("integrations").select("owner_member_id").eq("id", item.integration_id).maybeSingle();
      if (member.role !== "admin" && integration?.owner_member_id !== member.id) return response({ error: "Accès Drive refusé" }, 403);
      await db.from("drive_sync_items").update({ project_id: project?.id || null, updated_at: new Date().toISOString() }).eq("id", item.id);
      return response({ ok: true });
    }

    if (action === "list_calendars") {
      const integration = await ensureIntegration(db, member.id, "google_calendar");
      const items = await listGoogleCalendars(token);
      const { data: existing } = await db.from("calendar_sources").select("external_calendar_id,selected,shared_with_team,sync_mode").eq("integration_id", integration.id);
      const old = new Map<string, any>((existing || []).map((x: any) => [x.external_calendar_id, x]));
      const rows = items.map((c: any) => ({
        integration_id: integration.id,
        external_calendar_id: c.id,
        name: c.summary || c.id,
        description: c.description || null,
        timezone: c.timeZone || null,
        access_role: c.accessRole || null,
        is_primary: Boolean(c.primary),
        selected: old.get(c.id)?.selected ?? Boolean(c.primary),
        shared_with_team: old.get(c.id)?.shared_with_team ?? false,
        sync_mode: old.get(c.id)?.sync_mode || "read_only",
        background_color: c.backgroundColor || null,
        foreground_color: c.foregroundColor || null,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length) {
        const { error } = await db.from("calendar_sources").upsert(rows, { onConflict: "integration_id,external_calendar_id" });
        if (error) throw error;
      }
      return response({ ok: true, calendars: rows });
    }

    if (action === "set_calendar_selection") {
      const integration = await ensureIntegration(db, member.id, "google_calendar");
      const selections = Array.isArray(body?.selections) ? body.selections : [];
      for (const selection of selections) {
        const externalId = String(selection?.external_calendar_id || "");
        if (!externalId) continue;
        await db.from("calendar_sources").update({
          selected: Boolean(selection.selected),
          shared_with_team: Boolean(selection.shared_with_team),
          sync_mode: "read_only",
          updated_at: new Date().toISOString(),
        }).eq("integration_id", integration.id).eq("external_calendar_id", externalId);
      }
      return response({ ok: true });
    }

    if (action === "sync_calendars") {
      const integration = await ensureIntegration(db, member.id, "google_calendar");
      const { data: sources } = await db.from("calendar_sources").select("*").eq("integration_id", integration.id).eq("selected", true);
      const timeMin = new Date(Date.now() - 90 * 86400000).toISOString();
      const timeMax = new Date(Date.now() + 365 * 86400000).toISOString();
      let total = 0;
      for (const source of sources || []) {
        let pageToken = "";
        const rows: any[] = [];
        do {
          const params = new URLSearchParams({
            timeMin, timeMax,
            singleEvents: "true",
            showDeleted: "true",
            maxResults: "2500",
            orderBy: "startTime",
          });
          if (pageToken) params.set("pageToken", pageToken);
          const data = await googleFetch(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.external_calendar_id)}/events?${params}`);
          for (const event of data.items || []) {
            rows.push({
              calendar_source_id: source.id,
              external_event_id: event.id,
              status: event.status || null,
              summary: event.summary || "Sans titre",
              description: event.description || null,
              location: event.location || null,
              start_at: event.start?.dateTime || null,
              end_at: event.end?.dateTime || null,
              start_date: event.start?.date || null,
              end_date: event.end?.date || null,
              all_day: Boolean(event.start?.date && !event.start?.dateTime),
              html_link: event.htmlLink || null,
              organizer_email: event.organizer?.email || null,
              meet_url: meetUrlFromEvent(event),
              conference_id: event.conferenceData?.conferenceId || null,
              attendees: Array.isArray(event.attendees) ? event.attendees : [],
              updated_remote_at: event.updated || null,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          pageToken = data.nextPageToken || "";
        } while (pageToken);
        for (let i = 0; i < rows.length; i += 400) {
          const { error } = await db.from("calendar_events").upsert(rows.slice(i, i + 400), { onConflict: "calendar_source_id,external_event_id" });
          if (error) throw error;
        }
        total += rows.length;
        await db.from("calendar_sources").update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", source.id);
      }
      await db.from("integrations").update({ status: "connected", last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", integration.id);
      return response({ ok: true, count: total, calendars: (sources || []).length });
    }

    if (action === "link_calendar_event") {
      const eventId = String(body?.event_id || "");
      const project = await projectAccess(db, member, body?.project_client_key || null);
      const task = await taskAccess(db, member, body?.task_client_key || null);
      const { data: event } = await db.from("calendar_events").select("id,calendar_source_id").eq("id", eventId).maybeSingle();
      if (!event) return response({ error: "Événement introuvable" }, 404);
      const { data: source } = await db.from("calendar_sources").select("integration_id,shared_with_team").eq("id", event.calendar_source_id).maybeSingle();
      const { data: integration } = source ? await db.from("integrations").select("owner_member_id").eq("id", source.integration_id).maybeSingle() : { data: null };
      if (member.role !== "admin" && integration?.owner_member_id !== member.id) return response({ error: "Seul le propriétaire de l’agenda peut modifier l’association." }, 403);
      await db.from("calendar_events").update({ project_id: project?.id || task?.project_id || null, task_id: task?.id || null, updated_at: new Date().toISOString() }).eq("id", event.id);
      return response({ ok: true });
    }


    if (action === "sync_chat") {
      const result = await syncGoogleChat(db, member, token);
      return response({ ok: true, ...result });
    }

    if (action === "list_chat_spaces") {
      const integration = await ensureIntegration(db, member.id, "google_chat");
      const { data: spaces, error } = await db.from("google_chat_spaces")
        .select("id,external_space_name,display_name,space_type,space_uri,project_id,last_remote_message_at,last_seen_at,unread_count,last_synced_at")
        .eq("integration_id", integration.id)
        .order("last_remote_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const projectIds = [...new Set((spaces || []).map((s: any) => s.project_id).filter(Boolean))];
      const { data: linkedProjects } = projectIds.length
        ? await db.from("projects").select("id,client_key").in("id", projectIds)
        : { data: [] };
      const projectKeys = new Map((linkedProjects || []).map((p: any) => [p.id, p.client_key]));
      return response({
        ok: true,
        spaces: (spaces || []).map((space: any) => ({
          ...space,
          project_client_key: space.project_id ? projectKeys.get(space.project_id) || null : null,
        }))
      });
    }

    if (action === "list_chat_messages") {
      const spaceId = String(body?.space_id || "");
      if (!spaceId) return response({ error: "Espace Chat manquant" }, 400);
      const integration = await ensureIntegration(db, member.id, "google_chat");
      const { data: space } = await db.from("google_chat_spaces")
        .select("id,integration_id,display_name,external_space_name,project_id")
        .eq("id", spaceId).eq("integration_id", integration.id).maybeSingle();
      if (!space) return response({ error: "Espace Chat introuvable" }, 404);
      const { data: messages, error } = await db.from("google_chat_messages")
        .select("id,external_message_name,thread_name,sender_user_name,sender_display_name,text,formatted_text,create_time,update_time,deleted")
        .eq("space_id", space.id)
        .order("create_time", { ascending: false })
        .limit(100);
      if (error) throw error;
      return response({ ok: true, space, messages: (messages || []).reverse() });
    }

    if (action === "mark_chat_space_seen") {
      const spaceId = String(body?.space_id || "");
      const integration = await ensureIntegration(db, member.id, "google_chat");
      const { data: space } = await db.from("google_chat_spaces")
        .select("id").eq("id", spaceId).eq("integration_id", integration.id).maybeSingle();
      if (!space) return response({ error: "Espace Chat introuvable" }, 404);
      const seenAt = new Date().toISOString();
      await db.from("google_chat_spaces").update({
        last_seen_at: seenAt,
        unread_count: 0,
        updated_at: seenAt,
      }).eq("id", space.id);
      return response({ ok: true, seen_at: seenAt });
    }

    if (action === "send_chat_message") {
      const spaceId = String(body?.space_id || "");
      const textValue = String(body?.text || "").trim();
      if (!spaceId || !textValue) return response({ error: "Espace et message requis" }, 400);
      if (textValue.length > 32000) return response({ error: "Message trop long" }, 400);
      const integration = await ensureIntegration(db, member.id, "google_chat");
      const { data: space } = await db.from("google_chat_spaces")
        .select("*").eq("id", spaceId).eq("integration_id", integration.id).maybeSingle();
      if (!space) return response({ error: "Espace Chat introuvable" }, 404);

      const remote = await googleFetch(
        token,
        `https://chat.googleapis.com/v1/${space.external_space_name}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textValue }),
        }
      );

      if (remote?.name && remote?.createTime) {
        const { error } = await db.from("google_chat_messages").upsert({
          space_id: space.id,
          external_message_name: remote.name,
          thread_name: remote.thread?.name || null,
          sender_user_name: remote.sender?.name || null,
          sender_display_name: remote.sender?.displayName || member.display_name,
          text: remote.text || textValue,
          formatted_text: remote.formattedText || null,
          create_time: remote.createTime,
          update_time: remote.lastUpdateTime || null,
          deleted: false,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "space_id,external_message_name" });
        if (error) throw error;
      }
      return response({ ok: true, message: remote });
    }

    if (action === "link_chat_space_project") {
      const spaceId = String(body?.space_id || "");
      const integration = await ensureIntegration(db, member.id, "google_chat");
      const project = await projectAccess(db, member, body?.project_client_key || null);
      const { data: space } = await db.from("google_chat_spaces")
        .select("id").eq("id", spaceId).eq("integration_id", integration.id).maybeSingle();
      if (!space) return response({ error: "Espace Chat introuvable" }, 404);
      await db.from("google_chat_spaces").update({
        project_id: project?.id || null,
        updated_at: new Date().toISOString(),
      }).eq("id", space.id);
      return response({ ok: true });
    }

    if (action === "create_meet_event") {
      const title = String(body?.title || "").trim();
      if (!title) return response({ error: "Titre de réunion requis" }, 400);
      const project = await projectAccess(db, member, body?.project_client_key || null);
      const task = await taskAccess(db, member, body?.task_client_key || null);
      const result = await createMeetEventForMember(db, member, token, {
        title,
        description: body?.description ? String(body.description) : null,
        start_at: String(body?.start_at || ""),
        end_at: String(body?.end_at || ""),
        timezone: body?.timezone ? String(body.timezone) : "Europe/Paris",
        attendee_emails: Array.isArray(body?.attendee_emails) ? body.attendee_emails : [],
        project_id: project?.id || task?.project_id || null,
        task_id: task?.id || null,
      });
      return response({ ok: true, ...result });
    }

    if (action === "create_meeting_request") {
      const recipientClientKey = String(body?.recipient_client_key || "");
      const title = String(body?.title || "").trim();
      const start = new Date(String(body?.start_at || ""));
      const end = new Date(String(body?.end_at || ""));
      if (!recipientClientKey || !title) return response({ error: "Destinataire et sujet requis" }, 400);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return response({ error: "Créneau invalide" }, 400);
      }
      const { data: recipient } = await db.from("team_members")
        .select("id,client_key,display_name,profile_id,active")
        .eq("client_key", recipientClientKey).eq("active", true).maybeSingle();
      if (!recipient) return response({ error: "Destinataire Pilotage introuvable" }, 404);
      if (recipient.id === member.id) return response({ error: "Choisis un autre membre pour la demande." }, 400);

      const project = await projectAccess(db, member, body?.project_client_key || null);
      const task = await taskAccess(db, member, body?.task_client_key || null);
      const recipientEmail = await memberEmail(db, recipient.id);
      const clientKey = `meeting-request-${crypto.randomUUID()}`;
      const { data: requestRow, error } = await db.from("meeting_requests").insert({
        client_key: clientKey,
        requester_member_id: member.id,
        recipient_member_id: recipient.id,
        project_id: project?.id || task?.project_id || null,
        task_id: task?.id || null,
        title,
        description: body?.description ? String(body.description) : null,
        proposed_start_at: start.toISOString(),
        proposed_end_at: end.toISOString(),
        timezone: String(body?.timezone || "Europe/Paris"),
        requester_email: member.email || null,
        recipient_email: recipientEmail,
        status: "requested",
      }).select().single();
      if (error) throw error;

      await notifyMember(db, recipient.id, {
        clientKey: `meeting-request-notif-${requestRow.id}`,
        severity: "action",
        type: "meeting_request",
        title: "Demande de réunion",
        message: `${member.display_name} souhaite organiser « ${title} » le ${start.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.`,
        actionType: "read",
        projectId: requestRow.project_id,
        taskId: requestRow.task_id,
        groupKey: `meeting-request-${requestRow.id}`,
        internalTag: "PILOT-GOOGLE-MEET-REQUEST",
      });
      return response({ ok: true, request: requestRow });
    }

    if (action === "list_meeting_requests") {
      const { data: rows, error } = await db.from("meeting_requests")
        .select("*")
        .or(`requester_member_id.eq.${member.id},recipient_member_id.eq.${member.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const memberIds = [...new Set((rows || []).flatMap((r: any) => [r.requester_member_id, r.recipient_member_id]))];
      const { data: members } = memberIds.length
        ? await db.from("team_members").select("id,client_key,display_name").in("id", memberIds)
        : { data: [] };
      const names = new Map((members || []).map((m: any) => [m.id, m]));
      return response({
        ok: true,
        requests: (rows || []).map((r: any) => ({
          ...r,
          requester: names.get(r.requester_member_id) || null,
          recipient: names.get(r.recipient_member_id) || null,
          direction: r.recipient_member_id === member.id ? "incoming" : "outgoing",
        })),
      });
    }

    if (action === "respond_meeting_request") {
      const requestId = String(body?.request_id || "");
      const decision = String(body?.decision || "");
      if (!requestId || !["accept", "decline", "reschedule"].includes(decision)) {
        return response({ error: "Réponse de réunion invalide" }, 400);
      }
      const { data: requestRow } = await db.from("meeting_requests")
        .select("*").eq("id", requestId).maybeSingle();
      if (!requestRow) return response({ error: "Demande de réunion introuvable" }, 404);
      const canRespond =
        member.role === "admin"
        || (requestRow.status === "requested" && requestRow.recipient_member_id === member.id)
        || (requestRow.status === "reschedule_requested" && requestRow.requester_member_id === member.id);
      if (!canRespond) {
        return response({
          error: requestRow.status === "reschedule_requested"
            ? "Le demandeur initial doit répondre au nouveau créneau."
            : "Seul le destinataire peut répondre à cette demande."
        }, 403);
      }
      if (!["requested", "reschedule_requested"].includes(requestRow.status)) {
        return response({ error: "Cette demande a déjà été traitée." }, 409);
      }

      if (decision === "decline") {
        const now = new Date().toISOString();
        await db.from("meeting_requests").update({
          status: "declined",
          response_message: body?.message ? String(body.message) : null,
          responded_at: now,
          updated_at: now,
        }).eq("id", requestRow.id);
        const notifyId = member.id === requestRow.requester_member_id
          ? requestRow.recipient_member_id
          : requestRow.requester_member_id;
        await notifyMember(db, notifyId, {
          clientKey: `meeting-response-${requestRow.id}-declined-${member.id}`,
          severity: "info",
          type: "meeting_declined",
          title: "Réunion refusée",
          message: `${member.display_name} a refusé la réunion « ${requestRow.title} ».`,
          projectId: requestRow.project_id,
          taskId: requestRow.task_id,
          groupKey: `meeting-request-${requestRow.id}`,
          internalTag: "PILOT-GOOGLE-MEET-DECLINED",
        });
        return response({ ok: true, status: "declined" });
      }

      if (decision === "reschedule") {
        const start = new Date(String(body?.start_at || ""));
        const end = new Date(String(body?.end_at || ""));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
          return response({ error: "Nouveau créneau invalide" }, 400);
        }
        const now = new Date().toISOString();
        await db.from("meeting_requests").update({
          status: "reschedule_requested",
          proposed_start_at: start.toISOString(),
          proposed_end_at: end.toISOString(),
          response_message: body?.message ? String(body.message) : null,
          responded_at: now,
          updated_at: now,
        }).eq("id", requestRow.id);
        await notifyMember(db, requestRow.requester_member_id, {
          clientKey: `meeting-response-${requestRow.id}-reschedule-${start.getTime()}`,
          severity: "action",
          type: "meeting_rescheduled",
          title: "Nouveau créneau proposé",
          message: `${member.display_name} propose un autre créneau pour « ${requestRow.title} ».`,
          projectId: requestRow.project_id,
          taskId: requestRow.task_id,
          groupKey: `meeting-request-${requestRow.id}`,
          internalTag: "PILOT-GOOGLE-MEET-RESCHEDULE",
        });
        return response({ ok: true, status: "reschedule_requested" });
      }

      const result = await createMeetEventForMember(db, member, token, {
        title: requestRow.title,
        description: requestRow.description || null,
        start_at: requestRow.proposed_start_at,
        end_at: requestRow.proposed_end_at,
        timezone: requestRow.timezone || "Europe/Paris",
        attendee_emails: [requestRow.requester_email, requestRow.recipient_email].filter(Boolean),
        project_id: requestRow.project_id,
        task_id: requestRow.task_id,
      });
      const now = new Date().toISOString();
      await db.from("meeting_requests").update({
        status: "accepted",
        google_event_id: result.google_event_id,
        calendar_source_id: result.calendar_source_id,
        meet_url: result.meet_url,
        response_message: body?.message ? String(body.message) : null,
        responded_at: now,
        updated_at: now,
      }).eq("id", requestRow.id);
      const notifyId = member.id === requestRow.requester_member_id
        ? requestRow.recipient_member_id
        : requestRow.requester_member_id;
      await notifyMember(db, notifyId, {
        clientKey: `meeting-response-${requestRow.id}-accepted-${member.id}`,
        severity: "info",
        type: "meeting_accepted",
        title: "Réunion confirmée",
        message: result.meet_url
          ? `${member.display_name} a accepté « ${requestRow.title} ». Le lien Google Meet est prêt.`
          : `${member.display_name} a accepté « ${requestRow.title} ».`,
        projectId: requestRow.project_id,
        taskId: requestRow.task_id,
        groupKey: `meeting-request-${requestRow.id}`,
        internalTag: "PILOT-GOOGLE-MEET-ACCEPTED",
      });
      return response({ ok: true, status: "accepted", ...result });
    }

    return response({ error: "Action inconnue" }, 404);
  } catch (error) {
    console.error("[PILOT-GOOGLE-ERR]", action, error);
    try {
      const provider = action.includes("chat")
        ? "google_chat"
        : (action.includes("calendar") || action.includes("meet") || action.includes("meeting"))
          ? "google_calendar"
          : "google_drive";
      const integration = await ensureIntegration(db, member.id, provider as any);
      await markIntegrationError(db, integration.id, error);
    } catch { /* ne masque pas l'erreur initiale */ }
    return response({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});