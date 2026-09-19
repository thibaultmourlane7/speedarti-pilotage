import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-method, mcp-name",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const SERVER_INFO = { name: "SpeedArti Pilotage MCP", version: "16.1" };
const SUPPORTED_VERSIONS = ["2026-07-28", "2025-11-25"];

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

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function authToken(req: Request) {
  const url = new URL(req.url);
  const queryKey = (url.searchParams.get("key") || "").trim();
  if (queryKey) return queryKey;
  const auth = req.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

async function resolveAgent(db: any, token: string) {
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
    .select("id,client_key,display_name,role,active")
    .eq("id", agent.member_id)
    .maybeSingle();

  if (memberError || !member || member.active !== true) return null;
  return { tokenRow, agent, member };
}

function toolsCatalog() {
  return [
    {
      name: "listPilotageContext",
      title: "Lister le contexte SpeedArti Pilotage",
      description: "Retourne les projets et tâches accessibles au membre lié à cette IA. À utiliser avant d'associer une remontée à un projet ou une tâche afin de ne jamais inventer d'identifiant.",
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
    },
    {
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
    }
  ];
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
      mcp_server_version: "16.1"
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: JSON_HEADERS });

  const token = authToken(req);
  if (!token) return response(rpcError(null, -32001, "Authentification requise."), 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) return response(rpcError(null, -32603, "Configuration serveur indisponible."), 500);

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const auth = await resolveAgent(db, token);
  if (!auth) return response(rpcError(null, -32001, "Jeton de connecteur invalide."), 401);

  if (req.method === "GET") {
    return response({
      ok: true,
      server: SERVER_INFO,
      agent: auth.agent.client_key,
      member: auth.member.client_key,
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
    const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : "2025-11-25";
    return response(rpcResult(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: "Utilise listPilotageContext avant d'associer un événement à un projet ou une tâche. Ne remonte que du travail réellement effectué."
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
      instructions: "Utilise listPilotageContext avant d'associer un événement à un projet ou une tâche.",
      ttlMs: 60000,
      cacheScope: "private"
    }));
  }

  if (method === "tools/list") {
    return response(rpcResult(id, {
      tools: toolsCatalog(),
      ttlMs: 60000,
      cacheScope: "private"
    }));
  }

  if (method === "tools/call") {
    const name = payload?.params?.name;
    const args = payload?.params?.arguments || {};

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
      if (!args?.event_type || !args?.summary) {
        return response(rpcError(id, -32602, "event_type et summary sont requis."), 400);
      }

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
