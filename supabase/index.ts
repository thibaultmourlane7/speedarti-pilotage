import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id, x-pilotage-public-resource",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const SERVER_INFO = { name: "SpeedArti Pilotage MCP", version: "16.2" };
const SUPPORTED_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18"];
const REQUIRED_SCOPE = "email";

function envUrl() {
  return String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
}

function authIssuer() {
  return `${envUrl()}/auth/v1`;
}

function directResource() {
  return `${envUrl()}/functions/v1/pilotage-mcp`;
}

function v2Resource() {
  return `${envUrl()}/functions/v1/pilotage-mcp-v2`;
}

function publicResource(req: Request) {
  const forwarded = String(req.headers.get("x-pilotage-public-resource") || "").replace(/\/$/, "");
  if (forwarded === directResource() || forwarded === v2Resource()) return forwarded;
  return directResource();
}

function resourceMetadataUrl(req: Request) {
  return `${publicResource(req)}/.well-known/oauth-protected-resource`;
}

function response(body: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extra }
  });
}

function rpcResult(id: unknown, result: Record<string,unknown>) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      ...result,
      _meta: {
        ...((result as any)?._meta || {}),
        "io.modelcontextprotocol/serverInfo": SERVER_INFO
      }
    }
  };
}

function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data ? { data } : {}) }
  };
}

function authChallenge(req: Request, description = "Connecte ton compte SpeedArti Pilotage pour continuer.") {
  return `Bearer resource_metadata="${resourceMetadataUrl(req)}", error="invalid_token", error_description="${description.replaceAll('"', "'")}"`;
}

function unauthorized(req: Request, id: unknown = null, description?: string) {
  const challenge = authChallenge(req, description);
  return response(rpcError(id, -32001, "Authentification requise."), 401, {
    "WWW-Authenticate": challenge
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function bearerToken(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function legacyQueryToken(req: Request) {
  const url = new URL(req.url);
  return (url.searchParams.get("key") || "").trim();
}

function decodeJwtPayload(token: string): Record<string,unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function resolveLegacyAgent(db: any, token: string) {
  if (!token) return null;
  const hash = await sha256Hex(token);
  const { data: tokenRow, error: tokenError } = await db
    .from("ai_agent_tokens")
    .select("agent_id,active")
    .eq("token_hash", hash)
    .maybeSingle();

  if (tokenError || !tokenRow || tokenRow.active !== true) return null;

  const { data: agent, error: agentError } = await db
    .from("ai_agents")
    .select("id,client_key,name,provider,member_id,active")
    .eq("id", tokenRow.agent_id)
    .maybeSingle();

  if (agentError || !agent || agent.active !== true) return null;

  const { data: member, error: memberError } = await db
    .from("team_members")
    .select("id,client_key,display_name,role,team_role,active,profile_id")
    .eq("id", agent.member_id)
    .maybeSingle();

  if (memberError || !member || member.active !== true) return null;
  return { kind: "legacy", tokenRow, agent, member, rawToken: token };
}

async function resolveOauthAgent(db: any, token: string) {
  if (!token) return null;

  // Un jeton OAuth Supabase contient client_id. On ne choisit jamais
  // l'identité depuis le modèle : elle vient de l'utilisateur Supabase validé.
  const claims = decodeJwtPayload(token);
  const clientId = String(claims?.client_id || "").trim();
  if (!clientId) return null;

  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData?.user) return null;

  const { data: member, error: memberError } = await db
    .from("team_members")
    .select("id,client_key,display_name,role,team_role,active,profile_id")
    .eq("profile_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (memberError || !member) return null;

  const { data: agent, error: agentError } = await db
    .from("ai_agents")
    .select("id,client_key,name,provider,member_id,active")
    .eq("member_id", member.id)
    .eq("provider", "OpenAI")
    .eq("active", true)
    .maybeSingle();

  if (agentError || !agent) return null;

  return {
    kind: "oauth",
    agent,
    member,
    user: userData.user,
    clientId,
    claims
  };
}

async function resolveAuth(db: any, req: Request) {
  const queryToken = legacyQueryToken(req);
  if (queryToken) {
    const legacy = await resolveLegacyAgent(db, queryToken);
    if (legacy) return legacy;
  }

  const token = bearerToken(req);
  if (!token) return null;

  const legacy = await resolveLegacyAgent(db, token);
  if (legacy) return legacy;

  return resolveOauthAgent(db, token);
}

function oauthSecurity() {
  return [{ type: "oauth2", scopes: [REQUIRED_SCOPE] }];
}

function profileTool(useOauth: boolean) {
  return {
    name: "getPilotageProfile",
    title: "Profil SpeedArti Pilotage connecté",
    description: "Retourne l'identité Pilotage du compte connecté afin de vérifier que ChatGPT travaille pour la bonne personne.",
    ...(useOauth ? { securitySchemes: oauthSecurity() } : {}),
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    },
    _meta: { "openai/profile": true }
  };
}

function listContextTool(useOauth: boolean) {
  return {
    name: "listPilotageContext",
    title: "Lister le contexte SpeedArti Pilotage",
    description: "Retourne les projets et tâches accessibles au membre connecté. À utiliser avant toute association à un projet ou une tâche afin de ne jamais inventer d'identifiant.",
    ...(useOauth ? { securitySchemes: oauthSecurity() } : {}),
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        include_completed: {
          type: "boolean",
          description: "Inclure les tâches déjà terminées. Par défaut false."
        }
      }
    }
  };
}

function reportTool() {
  return {
    name: "reportPilotageEvent",
    title: "Remonter une activité vers SpeedArti Pilotage",
    description: "Enregistre un travail réellement effectué, une tâche terminée, un blocage, une prochaine étape, une décision ou une note utile. Ne jamais inventer project_client_key ou task_client_key.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["event_type", "summary"],
      properties: {
        event_id: {
          type: "string",
          description: "Identifiant unique stable de l'événement. Facultatif : le serveur en génère un si absent."
        },
        event_type: {
          type: "string",
          enum: ["work_done","task_created","task_updated","task_completed","project_progress","blocker","next_step","decision","note"]
        },
        summary: { type: "string", minLength: 1, maxLength: 2000 },
        happened_at: {
          type: "string",
          description: "Horodatage ISO 8601. Facultatif, maintenant si absent."
        },
        project_client_key: { type: ["string","null"] },
        task_client_key: { type: ["string","null"] },
        metadata: { type: "object", additionalProperties: true },
        dry_run: {
          type: "boolean",
          description: "Valide sans enregistrer. Utile pour le premier test."
        }
      }
    }
  };
}

function toolsCatalog(auth: any) {
  const oauth = auth?.kind === "oauth";
  const tools: any[] = [profileTool(oauth), listContextTool(oauth)];

  // L'écriture historique reste disponible seulement pour l'authentification
  // agent-token existante. La première validation ChatGPT OAuth est lecture seule.
  if (auth?.kind === "legacy") tools.push(reportTool());
  return tools;
}

async function listContext(db: any, auth: any, args: any) {
  const includeCompleted = args?.include_completed === true;
  let projectIds: string[] = [];

  if (auth.member.role === "admin") {
    const { data } = await db
      .from("projects")
      .select("id,client_key,name,status,priority,progress,blocker,next_action")
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    const projects = data || [];
    projectIds = projects.map((p: any) => p.id);

    let taskQuery = db
      .from("tasks")
      .select("client_key,title,status,priority,project_id,assigned_to_member_id,planning_bucket,due_at")
      .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])
      .order("updated_at", { ascending: false })
      .limit(100);

    if (!includeCompleted) taskQuery = taskQuery.neq("status", "completed");
    const { data: tasks } = await taskQuery;
    const byProject = Object.fromEntries(projects.map((p: any) => [p.id, p]));

    return {
      member: auth.member.client_key,
      member_name: auth.member.display_name,
      projects: projects.map((p: any) => ({
        client_key: p.client_key,
        name: p.name,
        status: p.status,
        priority: p.priority,
        progress: p.progress,
        blocker: p.blocker,
        next_action: p.next_action
      })),
      tasks: (tasks || []).map((t: any) => ({
        client_key: t.client_key,
        title: t.title,
        status: t.status,
        priority: t.priority,
        planning_bucket: t.planning_bucket,
        due_at: t.due_at,
        project_client_key: byProject[t.project_id]?.client_key || null,
        project_name: byProject[t.project_id]?.name || null
      }))
    };
  }

  const { data: memberships } = await db
    .from("project_members")
    .select("project_id")
    .eq("member_id", auth.member.id);

  projectIds = (memberships || []).map((x: any) => x.project_id);

  const { data: projects } = projectIds.length
    ? await db
        .from("projects")
        .select("id,client_key,name,status,priority,progress,blocker,next_action")
        .in("id", projectIds)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

  let tasks: any[] = [];
  if (projectIds.length) {
    let q = db
      .from("tasks")
      .select("client_key,title,status,priority,project_id,assigned_to_member_id,planning_bucket,due_at")
      .in("project_id", projectIds)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (!includeCompleted) q = q.neq("status", "completed");
    const result = await q;
    tasks = result.data || [];
  }

  const byProject = Object.fromEntries((projects || []).map((p: any) => [p.id, p]));
  return {
    member: auth.member.client_key,
    member_name: auth.member.display_name,
    projects: (projects || []).map((p: any) => ({
      client_key: p.client_key,
      name: p.name,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      blocker: p.blocker,
      next_action: p.next_action
    })),
    tasks: tasks.map((t: any) => ({
      client_key: t.client_key,
      title: t.title,
      status: t.status,
      priority: t.priority,
      planning_bucket: t.planning_bucket,
      due_at: t.due_at,
      project_client_key: byProject[t.project_id]?.client_key || null,
      project_name: byProject[t.project_id]?.name || null
    }))
  };
}

async function callIngest(auth: any, token: string, args: any) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const eventId = String(args?.event_id || ("mcp-" + crypto.randomUUID()));
  const body = {
    agent_client_key: auth.agent.client_key,
    event_id: eventId,
    event_type: args?.event_type,
    summary: args?.summary,
    happened_at: args?.happened_at || new Date().toISOString(),
    project_client_key: args?.project_client_key || null,
    task_client_key: args?.task_client_key || null,
    metadata: {
      ...(args?.metadata || {}),
      source_bridge: "pilotage-mcp",
      mcp_server_version: "16.2"
    },
    dry_run: args?.dry_run === true
  };

  const res = await fetch(base + "/functions/v1/pilotage-ai-ingest", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({ error: "Réponse non JSON de pilotage-ai-ingest." }));
  return { ok: res.ok, status: res.status, data };
}

function protectedResourceMetadata(req: Request) {
  return {
    resource: publicResource(req),
    authorization_servers: [authIssuer()],
    scopes_supported: [REQUIRED_SCOPE],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://github.com/thibaultmourlane7/speedarti-pilotage"
  };
}

function requestSuffix(req: Request) {
  const path = new URL(req.url).pathname;
  const marker = "/pilotage-mcp";
  const i = path.indexOf(marker);
  if (i < 0) return "";
  return path.slice(i + marker.length) || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: JSON_HEADERS });

  const suffix = requestSuffix(req);
  if (req.method === "GET" && suffix === "/.well-known/oauth-protected-resource") {
    return response(protectedResourceMetadata(req), 200, { "Cache-Control": "public, max-age=300" });
  }

  const url = envUrl();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) return response(rpcError(null, -32603, "Configuration serveur indisponible."), 500);

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const auth = await resolveAuth(db, req);
  if (!auth) return unauthorized(req);

  if (req.method === "GET") {
    return response({
      ok: true,
      server: SERVER_INFO,
      auth_mode: auth.kind,
      agent: auth.agent.client_key,
      member: auth.member.client_key,
      member_name: auth.member.display_name,
      supported_protocol_versions: SUPPORTED_VERSIONS
    });
  }

  if (req.method !== "POST") return response(rpcError(null, -32600, "Méthode HTTP non autorisée."), 405);

  const payload = await req.json().catch(() => null);
  if (!payload || payload.jsonrpc !== "2.0" || !payload.method) {
    return response(rpcError(payload?.id, -32600, "Requête JSON-RPC invalide."), 400);
  }

  const id = payload.id ?? null;
  const method = payload.method;

  if (method === "initialize") {
    const requested = payload?.params?.protocolVersion;
    const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : "2025-06-18";
    return response(rpcResult(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: auth.kind === "oauth"
        ? "Connexion ChatGPT SpeedArti Pilotage en lecture seule. Vérifie d'abord getPilotageProfile puis utilise listPilotageContext."
        : "Utilise listPilotageContext avant d'associer un événement à un projet ou une tâche. Ne remonte que du travail réellement effectué."
    }), 200, { "Mcp-Session-Id": crypto.randomUUID() });
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 202, headers: JSON_HEADERS });
  }

  if (method === "ping") return response(rpcResult(id, {}));

  if (method === "server/discover") {
    return response(rpcResult(id, {
      supportedVersions: SUPPORTED_VERSIONS,
      capabilities: { tools: { listChanged: false } },
      instructions: auth.kind === "oauth"
        ? "Connexion OAuth SpeedArti Pilotage lecture seule."
        : "Utilise listPilotageContext avant d'associer un événement à un projet ou une tâche.",
      ttlMs: 60000,
      cacheScope: "private"
    }));
  }

  if (method === "tools/list") {
    return response(rpcResult(id, {
      tools: toolsCatalog(auth),
      ttlMs: 60000,
      cacheScope: "private"
    }));
  }

  if (method === "tools/call") {
    const name = payload?.params?.name;
    const args = payload?.params?.arguments || {};

    if (name === "getPilotageProfile") {
      const profile = {
        member: auth.member.client_key,
        display_name: auth.member.display_name,
        team_role: auth.member.team_role || null,
        role: auth.member.role,
        agent: auth.agent.client_key,
        provider: auth.agent.provider,
        auth_mode: auth.kind
      };
      return response(rpcResult(id, {
        content: [{ type: "text", text: `${profile.display_name} — ${profile.team_role || profile.role}` }],
        structuredContent: profile,
        isError: false
      }));
    }

    if (name === "listPilotageContext") {
      try {
        const context = await listContext(db, auth, args);
        return response(rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(context, null, 2) }],
          structuredContent: context,
          isError: false
        }));
      } catch {
        return response(rpcResult(id, {
          content: [{ type: "text", text: "Erreur de lecture du contexte Pilotage." }],
          isError: true
        }));
      }
    }

    if (name === "reportPilotageEvent") {
      if (auth.kind !== "legacy") {
        return response(rpcError(id, -32601, "Écriture non disponible pour cette connexion ChatGPT."), 403);
      }
      if (!args?.event_type || !args?.summary) {
        return response(rpcError(id, -32602, "event_type et summary sont requis."), 400);
      }

      const token = legacyQueryToken(req) || bearerToken(req);
      const result = await callIngest(auth, token, args);
      return response(rpcResult(id, {
        content: [{
          type: "text",
          text: result.ok
            ? "Remontée enregistrée dans SpeedArti Pilotage."
            : "Remontée refusée par SpeedArti Pilotage : " + (result.data?.error || ("HTTP " + result.status))
        }],
        structuredContent: result.data,
        isError: !result.ok
      }), result.ok ? 200 : 400);
    }

    return response(rpcError(id, -32601, "Outil MCP inconnu : " + String(name || "")), 404);
  }

  return response(rpcError(id, -32601, "Méthode MCP inconnue : " + method), 404);
});
