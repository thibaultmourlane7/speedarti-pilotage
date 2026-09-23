
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.6";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function publishableKey() {
  try {
    const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return parsed.default;
    }
  } catch {}
  return Deno.env.get("SUPABASE_ANON_KEY") || "";
}

function cleanText(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function nullableText(value: unknown, max = 1000) {
  const text = cleanText(value, max);
  return text || null;
}

function extractResponseText(response: any) {
  const chunks: string[] = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function normalizeHistory(history: unknown) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10).flatMap((item: any) => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
    const content = cleanText(item?.content, 3000);
    return role && content ? [{ role, content }] : [];
  });
}

async function openaiRequest(apiKey: string, payload: any) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || "Erreur OpenAI";
    throw new Error(message);
  }
  return body;
}

const tools = [
  {
    type: "function",
    name: "create_task",
    description: "Créer une tâche opérationnelle dans Pilotage. Pour une tâche liée à un projet, le responsable doit être participant du projet.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        project_client_key: { type: ["string", "null"] },
        assigned_to_client_key: { type: ["string", "null"] },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        planning_bucket: { type: "string", enum: ["backlog", "this_week", "this_month", "next_3_months", "later"] },
        scheduled_for: { type: ["string", "null"], description: "Date YYYY-MM-DD ou null." },
        due_at: { type: ["string", "null"], description: "Date/heure ISO ou null." }
      },
      required: ["title", "project_client_key", "assigned_to_client_key", "priority", "planning_bucket", "scheduled_for", "due_at"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "update_task",
    description: "Mettre à jour une tâche accessible. Ne jamais inventer un identifiant : utiliser le client_key présent dans le contexte.",
    parameters: {
      type: "object",
      properties: {
        task_client_key: { type: "string" },
        title: { type: ["string", "null"] },
        assigned_to_client_key: { type: ["string", "null"] },
        status: { type: ["string", "null"], enum: ["todo", "in_progress", "to_validate", "to_test", "completed", "blocked", "paused", null] },
        priority: { type: ["string", "null"], enum: ["urgent", "high", "medium", "low", null] },
        planning_bucket: { type: ["string", "null"], enum: ["backlog", "this_week", "this_month", "next_3_months", "later", null] },
        scheduled_for: { type: ["string", "null"] },
        due_at: { type: ["string", "null"] }
      },
      required: ["task_client_key", "title", "assigned_to_client_key", "status", "priority", "planning_bucket", "scheduled_for", "due_at"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "update_project",
    description: "Mettre à jour un projet de manière non critique : progression, blocage, prochaine action, priorité ou état courant. Interdit de passer directement un projet en completed.",
    parameters: {
      type: "object",
      properties: {
        project_client_key: { type: "string" },
        progress: { type: ["integer", "null"], minimum: 0, maximum: 99 },
        blocker: { type: ["string", "null"] },
        next_action: { type: ["string", "null"] },
        priority: { type: ["string", "null"], enum: ["urgent", "high", "medium", "low", null] },
        status: { type: ["string", "null"], enum: ["todo", "in_progress", "to_validate", "to_test", "blocked", "paused", null] }
      },
      required: ["project_client_key", "progress", "blocker", "next_action", "priority", "status"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "request_project_completion",
    description: "Demander la clôture d'un projet. Cette fonction ne clôture jamais directement : elle crée une demande à valider humainement.",
    parameters: {
      type: "object",
      properties: {
        project_client_key: { type: "string" },
        note: { type: ["string", "null"] }
      },
      required: ["project_client_key", "note"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "create_daily_report_draft",
    description: "Créer un brouillon de compte rendu quotidien pour l'utilisateur connecté. Le brouillon reste non validé.",
    parameters: {
      type: "object",
      properties: {
        report_date: { type: "string", description: "Date YYYY-MM-DD." },
        summary: { type: "string" },
        achievements: { type: "array", items: { type: "string" } },
        blockers: { type: "array", items: { type: "string" } },
        next_steps: { type: "array", items: { type: "string" } },
        project_client_keys: { type: "array", items: { type: "string" } }
      },
      required: ["report_date", "summary", "achievements", "blockers", "next_steps", "project_client_keys"],
      additionalProperties: false
    },
    strict: true
  }
];

async function main(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Session requise." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const key = publishableKey();
  if (!supabaseUrl || !key) return json({ error: "Configuration Supabase indisponible." }, 500);

  const supabase = createClient(supabaseUrl, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Session invalide." }, 401);

  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .select("id,client_key,display_name,team_role,role,active")
    .eq("profile_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (memberError || !member) return json({ error: "Membre Pilotage introuvable." }, 403);

  const { data: agent, error: agentError } = await supabase
    .from("ai_agents")
    .select("id,client_key,name,provider,member_id,active")
    .eq("member_id", member.id)
    .eq("provider", "OpenAI")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (agentError || !agent) return json({ error: "Agent ChatGPT Pilotage non configuré pour ce membre." }, 404);

  const body = await req.json().catch(() => ({}));
  const action = body?.action || "chat";

  if (action === "health") {
    return json({
      ok: true,
      configured: Boolean(Deno.env.get("OPENAI_API_KEY")),
      model: DEFAULT_MODEL,
      agent: agent.client_key,
      member: member.client_key
    });
  }

  if (action === "history") {
    const { data: rows, error } = await supabase
      .from("ai_requests")
      .select("request_id,payload,result,status,received_at,processed_at")
      .eq("agent_id", agent.id)
      .order("received_at", { ascending: false })
      .limit(20);

    if (error) return json({ error: error.message }, 400);

    const messages: any[] = [];
    for (const row of [...(rows || [])].reverse()) {
      const userMessage = cleanText(row?.payload?.message, 4000);
      const reply = cleanText(row?.result?.reply, 6000);
      if (userMessage) messages.push({ role: "user", content: userMessage, at: row.received_at });
      if (reply) messages.push({ role: "assistant", content: reply, actions: row?.result?.actions || [], at: row.processed_at || row.received_at });
    }

    return json({ ok: true, messages, model: DEFAULT_MODEL, configured: Boolean(Deno.env.get("OPENAI_API_KEY")) });
  }

  if (action !== "chat") return json({ error: "Action inconnue." }, 400);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({
      error: "OPENAI_API_KEY n'est pas encore configurée dans les secrets Supabase.",
      code: "openai_not_configured",
      configured: false
    }, 503);
  }

  const message = cleanText(body?.message, 6000);
  if (!message) return json({ error: "Message vide." }, 400);

  const history = normalizeHistory(body?.history);

  // PILOT-AI-023 — garde-fou coût/abus par agent : 12 requêtes maximum sur 60 s.
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount, error: rateError } = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .gte("received_at", oneMinuteAgo);
  if (rateError) return json({ error: rateError.message }, 400);
  if ((recentCount || 0) >= 12) {
    return json({ error: "Trop de demandes rapprochées. Réessaie dans une minute.", code: "rate_limited" }, 429);
  }

  const [
    projectsRes,
    projectMembersRes,
    tasksRes,
    teamRes,
    reportsRes,
    activityRes,
    changesRes,
    ideasRes
  ] = await Promise.all([
    supabase.from("projects").select("id,client_key,name,owner_id,status,priority,progress,blocker,next_action,archived_at,updated_at").is("archived_at", null).order("updated_at", { ascending: false }).limit(40),
    supabase.from("project_members").select("project_id,member_id,project_role"),
    supabase.from("tasks").select("id,client_key,title,project_id,assigned_to_member_id,status,priority,scheduled_for,due_at,planning_status,planning_bucket,completed_at,updated_at").order("updated_at", { ascending: false }).limit(120),
    supabase.from("team_members").select("id,client_key,display_name,team_role,role,active").eq("active", true),
    supabase.from("daily_reports").select("client_key,member_id,report_date,status,summary,achievements,blockers_items,next_steps_items,validated_at").order("report_date", { ascending: false }).limit(20),
    supabase.from("activity_log").select("actor_label,project_id,task_id,text,created_at").order("created_at", { ascending: false }).limit(40),
    supabase.from("change_requests").select("client_key,request_type,project_id,task_id,status,note,requested_at,decided_at").order("requested_at", { ascending: false }).limit(30),
    supabase.rpc("list_pilotage_ideas")
  ]);

  const queryErrors = [projectsRes.error, projectMembersRes.error, tasksRes.error, teamRes.error, reportsRes.error, activityRes.error, changesRes.error, ideasRes.error].filter(Boolean);
  if (queryErrors.length) return json({ error: queryErrors[0]?.message || "Contexte Pilotage indisponible." }, 400);

  const team = teamRes.data || [];
  const byMemberId = new Map(team.map((m: any) => [m.id, m]));
  const projects = (projectsRes.data || []).map((p: any) => ({
    client_key: p.client_key,
    name: p.name,
    owner: byMemberId.get(p.owner_id)?.client_key || null,
    members: (projectMembersRes.data || [])
      .filter((pm: any) => pm.project_id === p.id)
      .map((pm: any) => byMemberId.get(pm.member_id)?.client_key)
      .filter(Boolean),
    status: p.status,
    priority: p.priority,
    progress: p.progress,
    blocker: p.blocker,
    next_action: p.next_action,
    updated_at: p.updated_at
  }));

  const projectById = new Map((projectsRes.data || []).map((p: any) => [p.id, p.client_key]));
  const tasks = (tasksRes.data || []).map((t: any) => ({
    client_key: t.client_key,
    title: t.title,
    project_client_key: projectById.get(t.project_id) || null,
    assigned_to: byMemberId.get(t.assigned_to_member_id)?.client_key || null,
    status: t.status,
    priority: t.priority,
    scheduled_for: t.scheduled_for,
    due_at: t.due_at,
    planning_bucket: t.planning_bucket
  }));

  const ideas = (ideasRes.data || []).map((idea: any) => ({
    client_key: idea.client_key,
    title: idea.title,
    status: idea.status,
    module: idea.module || null,
    origin: idea.origin,
    association_type: idea.association_type,
    project_client_key: idea.project_client_key || idea.task_project_client_key || null,
    task_client_key: idea.task_client_key || null,
    converted_task_client_key: idea.converted_task_client_key || null,
    vote_count: Number(idea.vote_count || 0),
    like_count: Number(idea.like_count || 0),
    dislike_count: Number(idea.dislike_count || 0),
    neutral_count: Number(idea.neutral_count || 0),
    vote_threshold: Number(idea.vote_threshold || 1),
    comment_count: Number(idea.comment_count || 0),
    updated_at: idea.updated_at
  }));

  const context = {
    now: new Date().toISOString(),
    current_user: {
      client_key: member.client_key,
      name: member.display_name,
      role: member.role,
      team_role: member.team_role
    },
    team: team.map((m: any) => ({ client_key: m.client_key, name: m.display_name, role: m.role, team_role: m.team_role })),
    projects,
    tasks,
    ideas,
    recent_reports: reportsRes.data || [],
    recent_activity: activityRes.data || [],
    recent_change_requests: changesRes.data || []
  };

  const requestId = crypto.randomUUID();

  const { error: logInsertError } = await supabase.from("ai_requests").insert({
    request_id: requestId,
    agent_id: agent.id,
    action: "pilotage_chat",
    status: "processing",
    payload: { message, history_length: history.length },
    internal_tag: "PILOT-AI-019",
    received_at: new Date().toISOString()
  });

  if (logInsertError) return json({ error: "Impossible de journaliser la requête IA : " + logInsertError.message }, 400);

  const instructions = [
    "Tu es ChatGPT Pilotage, l'assistant opérationnel interne de SpeedArti.",
    "Tu travailles uniquement avec les données Pilotage fournies dans CONTEXTE_PILOTAGE et les outils autorisés.",
    "Ne jamais inventer un projet, une tâche, une personne, une date critique ou un identifiant.",
    "Si une donnée nécessaire manque, pose une question courte au lieu de deviner.",
    "Les mises à jour de routine peuvent utiliser les outils. La clôture d'un projet doit TOUJOURS utiliser request_project_completion, jamais update_project.",
    "Ne modifie jamais les participants d'un projet, les rôles utilisateurs, les accès, ni les validations finales.",
    "Les idées sont des signaux de roadmap : tu peux les lire, les comparer et les signaler, mais tu ne dois jamais les valider, les rejeter, changer leur statut ni les transformer en tâche automatiquement. Les votes ont trois positions (J’aime, J’aime pas, neutre) et seuls les J’aime comptent pour le seuil automatique À étudier.",
    "Pour les comptes rendus, crée seulement un brouillon pour l'utilisateur connecté.",
    "Réponds en français, de façon courte et opérationnelle.",
    "Quand tu exécutes une action, indique clairement ce qui a été fait.",
    "CONTEXTE_PILOTAGE=" + JSON.stringify(context)
  ].join("\n");

  let response: any;
  const executedActions: any[] = [];

  async function memberByClientKey(clientKey: string | null) {
    if (!clientKey) return member;
    const { data, error } = await supabase
      .from("team_members")
      .select("id,client_key,display_name,role")
      .eq("client_key", clientKey)
      .eq("active", true)
      .maybeSingle();
    if (error || !data) throw new Error("Membre introuvable ou inaccessible : " + clientKey);
    return data;
  }

  async function projectByClientKey(clientKey: string) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,client_key,name,owner_id,status,progress")
      .eq("client_key", clientKey)
      .maybeSingle();
    if (error || !data) throw new Error("Projet introuvable ou inaccessible : " + clientKey);
    return data;
  }

  async function taskByClientKey(clientKey: string) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id,client_key,title,project_id,assigned_to_member_id,status")
      .eq("client_key", clientKey)
      .maybeSingle();
    if (error || !data) throw new Error("Tâche introuvable ou inaccessible : " + clientKey);
    return data;
  }

  async function assertProjectMember(projectId: string, memberId: string) {
    const { data, error } = await supabase
      .from("project_members")
      .select("project_id,member_id")
      .eq("project_id", projectId)
      .eq("member_id", memberId)
      .maybeSingle();
    if (error || !data) throw new Error("Le responsable choisi ne participe pas à ce projet.");
  }

  async function logActivity(projectId: string | null, taskId: string | null, text: string, tag = "PILOT-AI-020") {
    await supabase.from("activity_log").insert({
      client_key: crypto.randomUUID(),
      actor_member_id: member.id,
      actor_label: member.display_name + " via ChatGPT",
      project_id: projectId,
      task_id: taskId,
      action_type: "chatgpt",
      text,
      internal_tag: tag
    });
  }

  async function notifyMember(recipientMemberId: string, projectId: string | null, taskId: string | null, title: string, message: string) {
    if (recipientMemberId === member.id) return;
    await supabase.from("notifications").insert({
      client_key: crypto.randomUUID(),
      recipient_member_id: recipientMemberId,
      severity: "info",
      type: "task_assignment",
      title,
      message,
      action_type: taskId ? "edit_task" : "open_project",
      project_id: projectId,
      task_id: taskId,
      group_key: "chatgpt:" + crypto.randomUUID(),
      internal_tag: "PILOT-AI-020"
    });
  }

  async function executeTool(name: string, args: any) {
    if (name === "create_task") {
      const project = args.project_client_key ? await projectByClientKey(args.project_client_key) : null;
      const assignee = await memberByClientKey(args.assigned_to_client_key || member.client_key);

      if (project) await assertProjectMember(project.id, assignee.id);
      if (!project && member.role !== "admin" && assignee.id !== member.id) {
        throw new Error("Sans projet, un membre peut créer une tâche uniquement pour lui-même.");
      }

      const row = {
        client_key: crypto.randomUUID(),
        title: cleanText(args.title, 160),
        project_id: project?.id || null,
        assigned_to_member_id: assignee.id,
        source_type: "chatgpt",
        source_agent_id: agent.id,
        status: "todo",
        priority: args.priority,
        scheduled_for: args.scheduled_for || null,
        due_at: args.due_at || null,
        planning_status: "planned",
        planning_bucket: args.planning_bucket,
        needs_planning: false,
        sort_order: Date.now()
      };

      const { data, error } = await supabase.from("tasks").insert(row).select("id,client_key,title").single();
      if (error) throw new Error(error.message);
      await logActivity(project?.id || null, data.id, "Tâche créée par ChatGPT : " + data.title);
      await notifyMember(
        assignee.id,
        project?.id || null,
        data.id,
        "Nouvelle tâche assignée par ChatGPT",
        data.title + (project ? " · " + project.name : "")
      );
      return { ok: true, action: "create_task", task: { client_key: data.client_key, title: data.title } };
    }

    if (name === "update_task") {
      const task = await taskByClientKey(args.task_client_key);
      const updates: any = {};

      if (args.title !== null) updates.title = cleanText(args.title, 160);
      if (args.status !== null) {
        updates.status = args.status;
        updates.completed_at = args.status === "completed" ? new Date().toISOString() : null;
      }
      if (args.priority !== null) updates.priority = args.priority;
      if (args.planning_bucket !== null) {
        updates.planning_bucket = args.planning_bucket;
        updates.planning_status = "planned";
        updates.needs_planning = false;
      }
      if (args.scheduled_for !== null) updates.scheduled_for = args.scheduled_for;
      if (args.due_at !== null) updates.due_at = args.due_at;

      let newAssignee: any = null;
      if (args.assigned_to_client_key !== null) {
        const assignee = await memberByClientKey(args.assigned_to_client_key);
        if (task.project_id) await assertProjectMember(task.project_id, assignee.id);
        if (!task.project_id && member.role !== "admin" && assignee.id !== member.id) {
          throw new Error("Sans projet, un membre peut assigner uniquement sa propre tâche.");
        }
        updates.assigned_to_member_id = assignee.id;
        newAssignee = assignee;
      }

      if (!Object.keys(updates).length) return { ok: true, action: "update_task", unchanged: true };

      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id)
        .select("id,client_key,title,status,project_id")
        .single();
      if (error) throw new Error(error.message);
      await logActivity(data.project_id || null, data.id, "Tâche mise à jour par ChatGPT : " + data.title);
      if (newAssignee && newAssignee.id !== task.assigned_to_member_id) {
        await notifyMember(newAssignee.id, data.project_id || null, data.id, "Tâche réassignée par ChatGPT", data.title);
      }
      return { ok: true, action: "update_task", task: { client_key: data.client_key, title: data.title, status: data.status } };
    }

    if (name === "update_project") {
      const project = await projectByClientKey(args.project_client_key);
      const updates: any = {};

      if (args.progress !== null) updates.progress = Math.max(0, Math.min(99, Number(args.progress)));
      if (args.blocker !== null) updates.blocker = cleanText(args.blocker, 1000);
      if (args.next_action !== null) updates.next_action = cleanText(args.next_action, 1000);
      if (args.priority !== null) updates.priority = args.priority;
      if (args.status !== null) updates.status = args.status;

      if (!Object.keys(updates).length) return { ok: true, action: "update_project", unchanged: true };

      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", project.id)
        .select("id,client_key,name,status,progress")
        .single();
      if (error) throw new Error(error.message);
      await logActivity(data.id, null, "Projet mis à jour par ChatGPT : " + data.name);
      return { ok: true, action: "update_project", project: { client_key: data.client_key, name: data.name, status: data.status, progress: data.progress } };
    }

    if (name === "request_project_completion") {
      const project = await projectByClientKey(args.project_client_key);

      const { data: existing } = await supabase
        .from("change_requests")
        .select("id,client_key")
        .eq("project_id", project.id)
        .eq("request_type", "project_complete")
        .eq("status", "pending")
        .maybeSingle();

      if (existing) return { ok: true, action: "request_project_completion", already_pending: true };

      const { data: change, error } = await supabase.from("change_requests").insert({
        client_key: crypto.randomUUID(),
        request_type: "project_complete",
        project_id: project.id,
        requested_by_member_id: member.id,
        source_agent_id: agent.id,
        source_type: "chatgpt",
        status: "pending",
        proposed: { status: "completed", progress: 100 },
        note: nullableText(args.note, 1000)
      }).select("id,client_key").single();

      if (error) throw new Error(error.message);

      const { data: admin } = await supabase
        .from("team_members")
        .select("id,client_key")
        .eq("role", "admin")
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      await logActivity(project.id, null, "Demande de clôture créée par ChatGPT", "PILOT-AI-021");

      if (admin) {
        await supabase.from("notifications").insert({
          client_key: crypto.randomUUID(),
          recipient_member_id: admin.id,
          severity: "action",
          type: "approval_required",
          title: "Validation projet demandée par ChatGPT",
          message: project.name + " · demande de passage en Terminé",
          action_type: "approval",
          project_id: project.id,
          change_request_id: change.id,
          group_key: "ai-project-complete:" + change.client_key,
          internal_tag: "PILOT-AI-021"
        });
      }

      return { ok: true, action: "request_project_completion", request: change };
    }

    if (name === "create_daily_report_draft") {
      const projectIds: string[] = [];
      for (const clientKey of args.project_client_keys || []) {
        const project = await projectByClientKey(clientKey);
        projectIds.push(project.id);
      }

      const reportClientKey = crypto.randomUUID();
      const { data: report, error } = await supabase.from("daily_reports").insert({
        client_key: reportClientKey,
        member_id: member.id,
        report_date: args.report_date,
        kind: "source",
        source_type: "ai",
        ai_agent_id: agent.id,
        status: "draft",
        summary: cleanText(args.summary, 2500),
        done_summary: cleanText(args.summary, 2500),
        achievements: Array.isArray(args.achievements) ? args.achievements.map((x: any) => cleanText(x, 500)).filter(Boolean) : [],
        blockers_items: Array.isArray(args.blockers) ? args.blockers.map((x: any) => cleanText(x, 500)).filter(Boolean) : [],
        next_steps_items: Array.isArray(args.next_steps) ? args.next_steps.map((x: any) => cleanText(x, 500)).filter(Boolean) : [],
        blockers: Array.isArray(args.blockers) ? args.blockers.map((x: any) => cleanText(x, 500)).filter(Boolean).join("\n") : "",
        next_steps: Array.isArray(args.next_steps) ? args.next_steps.map((x: any) => cleanText(x, 500)).filter(Boolean).join("\n") : ""
      }).select("id,client_key,report_date").single();

      if (error) throw new Error(error.message);

      if (projectIds.length) {
        const { error: linkError } = await supabase.from("daily_report_projects").insert(
          [...new Set(projectIds)].map(project_id => ({ report_id: report.id, project_id }))
        );
        if (linkError) throw new Error(linkError.message);
      }

      await logActivity(projectIds[0] || null, null, "Brouillon de compte rendu créé par ChatGPT", "PILOT-AI-022");
      return { ok: true, action: "create_daily_report_draft", report: { client_key: report.client_key, report_date: report.report_date } };
    }

    throw new Error("Outil inconnu : " + name);
  }

  try {
    response = await openaiRequest(apiKey, {
      model: DEFAULT_MODEL,
      instructions,
      input: [...history, { role: "user", content: message }],
      tools,
      tool_choice: "auto",
      store: false,
      max_output_tokens: 1800
    });

    const calls = (response?.output || []).filter((item: any) => item?.type === "function_call");
    for (const call of calls) {
      try {
        const args = JSON.parse(call.arguments || "{}");
        const result = await executeTool(call.name, args);
        executedActions.push({ name: call.name, ok: true, result });
      } catch (toolError) {
        executedActions.push({
          name: call.name,
          ok: false,
          error: toolError instanceof Error ? toolError.message : String(toolError)
        });
      }
    }

    const modelText = extractResponseText(response);
    const actionLines = executedActions.map((item: any) => {
      if (!item.ok) return "⚠ " + item.name + " : " + item.error;
      if (item.name === "create_task") return "✓ Tâche créée : " + (item.result?.task?.title || "tâche");
      if (item.name === "update_task") return "✓ Tâche mise à jour : " + (item.result?.task?.title || "tâche");
      if (item.name === "update_project") return "✓ Projet mis à jour : " + (item.result?.project?.name || "projet");
      if (item.name === "request_project_completion") return item.result?.already_pending ? "✓ Demande de clôture déjà en attente." : "✓ Demande de clôture envoyée pour validation.";
      if (item.name === "create_daily_report_draft") return "✓ Brouillon de compte rendu créé.";
      return "✓ Action exécutée : " + item.name;
    });

    const reply = [modelText, ...actionLines].filter(Boolean).join("\n") || "Demande traitée.";

    await supabase.from("ai_requests").update({
      status: "completed",
      result: { reply, actions: executedActions, model: DEFAULT_MODEL },
      processed_at: new Date().toISOString()
    }).eq("request_id", requestId);

    return json({
      ok: true,
      configured: true,
      requestId,
      reply,
      actions: executedActions,
      model: DEFAULT_MODEL
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await supabase.from("ai_requests").update({
      status: "failed",
      error_message: errorMessage,
      result: { actions: executedActions },
      processed_at: new Date().toISOString()
    }).eq("request_id", requestId);

    return json({ error: errorMessage, requestId, actions: executedActions }, 500);
  }
}

Deno.serve(main);
