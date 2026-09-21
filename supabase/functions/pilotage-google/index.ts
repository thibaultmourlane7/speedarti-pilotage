import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json; charset=utf-8" };
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const OAUTH_SCOPES = ["openid", "email", DRIVE_SCOPE, CALENDAR_SCOPE].join(" ");
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
async function ensureIntegration(db: ReturnType<typeof dbClient>, memberId: string, provider: "google_drive" | "google_calendar") {
  const { data: existing } = await db.from("integrations").select("*")
    .eq("owner_member_id", memberId).eq("provider", provider).maybeSingle();
  if (existing) return existing;
  const configuration = provider === "google_drive"
    ? { root_folder_id: null, root_folder_name: null, drive_id: null, include_subfolders: true, include_shared_drives: true, sync_mode: "read_only", scope_rule: "selected_root_only" }
    : { multi_calendar: true, selected_calendar_ids: [], default_sync_mode: "read_only" };
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
      const { data: cred } = await db.from("google_credentials").select("google_email,access_token_expires_at,updated_at").eq("owner_member_id", member.id).maybeSingle();
      return response({ configured: cfg.configured, integrations: integrations || [], account: cred || null, redirect_uri: cfg.redirectUri });
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
      const cursor = storedCursor && storedCursor.root_id === rootId
        ? {
            root_id: rootId,
            run_id: storedCursor.run_id || crypto.randomUUID(),
            queue: Array.isArray(storedCursor.queue) ? storedCursor.queue : [],
            current: storedCursor.current || null,
            page_token: storedCursor.page_token || "",
            total: Number(storedCursor.total || 0),
          }
        : {
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
          if (isFolder && config.include_subfolders !== false) {
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
      let pageToken = "";
      const items: any[] = [];
      do {
        const params = new URLSearchParams({ maxResults: "250" });
        if (pageToken) params.set("pageToken", pageToken);
        const data = await googleFetch(token, `https://www.googleapis.com/calendar/v3/users/me/calendarList?${params}`);
        items.push(...(data.items || []));
        pageToken = data.nextPageToken || "";
      } while (pageToken);
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

    return response({ error: "Action inconnue" }, 404);
  } catch (error) {
    console.error("[PILOT-GOOGLE-ERR]", action, error);
    try {
      const provider = action.includes("calendar") ? "google_calendar" : "google_drive";
      const integration = await ensureIntegration(db, member.id, provider as any);
      await markIntegrationError(db, integration.id, error);
    } catch { /* ne masque pas l'erreur initiale */ }
    return response({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});