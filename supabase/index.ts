import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const allowedEvents = new Set([
  "work_done","task_created","task_updated","task_completed",
  "project_progress","blocker","next_step","decision","note",
]);

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}
function clean(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}
function parisDateKey(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return map.year + "-" + map.month + "-" + map.day;
}
async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function sourceType(provider: string, name: string) {
  const value = (provider + " " + name).toLowerCase();
  if (value.includes("anthropic") || value.includes("claude")) return "claude";
  if (value.includes("openai") || value.includes("chatgpt")) return "chatgpt";
  return "other_ai";
}
function appendUnique(items: unknown, value: string) {
  const list = Array.isArray(items) ? items.map(x => clean(x, 600)).filter(Boolean) : [];
  if (!list.includes(value)) list.push(value);
  return list.slice(-50);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return reply({ error: "Jeton agent requis." }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) return reply({ error: "Configuration serveur indisponible." }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });
  const body = await req.json().catch(() => ({}));

  const agentClientKey = clean(body?.agent_client_key, 120);
  const eventId = clean(body?.event_id, 180);
  const eventType = clean(body?.event_type, 80);
  const summary = clean(body?.summary, 2000);
  const projectClientKey = clean(body?.project_client_key, 180) || null;
  const taskClientKey = clean(body?.task_client_key, 180) || null;
  const happenedAtRaw = clean(body?.happened_at, 80) || new Date().toISOString();
  const payload = body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};
  const dryRun = body?.dry_run === true;

  if (!agentClientKey) return reply({ error:"agent_client_key requis." }, 400);
  if (!eventId) return reply({ error:"event_id requis pour l'idempotence." }, 400);
  if (!allowedEvents.has(eventType)) return reply({ error:"event_type non autorisé." }, 400);
  if (!summary) return reply({ error:"summary requis." }, 400);

  const happenedAt = new Date(happenedAtRaw);
  if (Number.isNaN(happenedAt.getTime())) return reply({ error:"happened_at invalide." }, 400);

  const tokenHash = await sha256Hex(token);
  const { data: tokenRow } = await db.from("ai_agent_tokens").select("agent_id,active").eq("token_hash", tokenHash).maybeSingle();
  if (!tokenRow || tokenRow.active !== true) return reply({ error:"Jeton agent invalide." }, 401);

  const { data: agent } = await db.from("ai_agents").select("id,client_key,name,provider,member_id,active").eq("id", tokenRow.agent_id).maybeSingle();
  if (!agent || agent.active !== true || agent.client_key !== agentClientKey) return reply({ error:"Agent non autorisé." }, 403);

  const { data: member } = await db.from("team_members").select("id,client_key,display_name,role,active").eq("id", agent.member_id).maybeSingle();
  if (!member || member.active !== true) return reply({ error:"Membre lié à l'agent indisponible." }, 403);

  const { data: duplicate } = await db.from("ai_events").select("event_id,processing_status").eq("event_id", eventId).maybeSingle();
  if (duplicate) return reply({ ok:true, duplicate:true, event_id:eventId, status:duplicate.processing_status });

  let project: any = null;
  let task: any = null;

  if (taskClientKey) {
    const { data } = await db.from("tasks").select("id,client_key,title,project_id,status,assigned_to_member_id").eq("client_key", taskClientKey).maybeSingle();
    if (!data) return reply({ error:"Tâche introuvable : " + taskClientKey }, 404);
    task = data;
  }

  if (projectClientKey) {
    const { data } = await db.from("projects").select("id,client_key,name,status").eq("client_key", projectClientKey).maybeSingle();
    if (!data) return reply({ error:"Projet introuvable : " + projectClientKey }, 404);
    project = data;
  } else if (task?.project_id) {
    const { data } = await db.from("projects").select("id,client_key,name,status").eq("id", task.project_id).maybeSingle();
    project = data || null;
  }

  if (task && project && task.project_id && task.project_id !== project.id) return reply({ error:"La tâche ne correspond pas au projet indiqué." }, 409);

  if (project && member.role !== "admin") {
    const { data: membership } = await db.from("project_members").select("project_id").eq("project_id", project.id).eq("member_id", member.id).maybeSingle();
    if (!membership) return reply({ error:"L'agent n'a pas accès à ce projet." }, 403);
  }

  if (task && !project && member.role !== "admin" && task.assigned_to_member_id !== member.id) {
    return reply({ error:"L'agent n'a pas accès à cette tâche hors projet." }, 403);
  }

  if (dryRun) return reply({
    ok:true, dry_run:true, agent:agent.client_key, member:member.client_key,
    event_type:eventType, project:project?.client_key || null, task:task?.client_key || null,
    validated_at:new Date().toISOString()
  });

  const { data: inserted, error: insertError } = await db.from("ai_events").insert({
    event_id:eventId, agent_id:agent.id, member_id:member.id,
    project_id:project?.id || null, task_id:task?.id || null,
    event_type:eventType, summary, payload, happened_at:happenedAt.toISOString(),
    processing_status:"received", internal_tag:"PILOT-AI-024"
  }).select("id,event_id").single();
  if (insertError) return reply({ error:insertError.message }, 400);

  let taskUpdated = false;
  if (eventType === "task_completed" && task) {
    const { error } = await db.from("tasks").update({ status:"completed", completed_at:happenedAt.toISOString() }).eq("id", task.id);
    if (error) {
      await db.from("ai_events").update({ processing_status:"rejected", processed_at:new Date().toISOString() }).eq("id", inserted.id);
      return reply({ error:"Événement reçu mais mise à jour tâche impossible : " + error.message }, 409);
    }
    taskUpdated = true;
  }

  await db.from("activity_log").insert({
    client_key:"ai-event:" + eventId, actor_member_id:member.id,
    actor_label:member.display_name + " via " + agent.name,
    project_id:project?.id || null, task_id:task?.id || null,
    action_type:"ai_event_" + eventType, text:summary,
    metadata:{ event_id:eventId, event_type:eventType, agent_client_key:agent.client_key, provider:agent.provider, ...payload },
    internal_tag:"PILOT-AI-025"
  });

  const reportDate = parisDateKey(happenedAt);
  const baseKey = "ai-daily:" + agent.client_key + ":" + reportDate;
  const { data: existing } = await db.from("daily_reports").select("id,client_key,status,achievements,blockers_items,next_steps_items").eq("client_key", baseKey).maybeSingle();

  let reportKey = baseKey;
  let achievements: string[] = [];
  let blockers: string[] = [];
  let nextSteps: string[] = [];
  if (existing && existing.status === "draft") {
    achievements = Array.isArray(existing.achievements) ? existing.achievements : [];
    blockers = Array.isArray(existing.blockers_items) ? existing.blockers_items : [];
    nextSteps = Array.isArray(existing.next_steps_items) ? existing.next_steps_items : [];
  } else if (existing) reportKey = baseKey + ":" + eventId;

  if (["work_done","task_created","task_updated","task_completed","project_progress","decision","note"].includes(eventType)) achievements = appendUnique(achievements, summary);
  if (eventType === "blocker") blockers = appendUnique(blockers, summary);
  if (eventType === "next_step") nextSteps = appendUnique(nextSteps, summary);

  const summaryLines = [
    ...achievements.map(x => "✓ " + x),
    ...blockers.map(x => "Blocage : " + x),
    ...nextSteps.map(x => "Suite : " + x)
  ];

  const { data: report, error: reportError } = await db.from("daily_reports").upsert({
    client_key:reportKey, member_id:member.id, report_date:reportDate, kind:"source",
    source_type:sourceType(agent.provider, agent.name), ai_agent_id:agent.id,
    done_summary:achievements.join("\n"), blockers:blockers.join("\n"), next_steps:nextSteps.join("\n"),
    status:"draft", summary:summaryLines.join("\n"), achievements, blockers_items:blockers, next_steps_items:nextSteps
  }, { onConflict:"client_key" }).select("id,client_key").single();

  if (reportError) {
    await db.from("ai_events").update({ processing_status:"rejected", processed_at:new Date().toISOString() }).eq("id", inserted.id);
    return reply({ error:"Événement reçu mais compte rendu impossible : " + reportError.message }, 409);
  }

  if (project?.id && report?.id) {
    await db.from("daily_report_projects").upsert({ report_id:report.id, project_id:project.id }, { onConflict:"report_id,project_id", ignoreDuplicates:true });
  }

  const processedAt = new Date().toISOString();
  await Promise.all([
    db.from("ai_events").update({ processing_status:"processed", processed_at:processedAt }).eq("id", inserted.id),
    db.from("ai_agents").update({ last_seen_at:processedAt, updated_at:processedAt }).eq("id", agent.id),
    db.from("ai_agent_tokens").update({ last_used_at:processedAt, updated_at:processedAt }).eq("agent_id", agent.id),
  ]);

  return reply({
    ok:true, duplicate:false, event_id:eventId, agent:agent.client_key, member:member.client_key,
    event_type:eventType, project:project?.client_key || null, task:task?.client_key || null,
    task_updated:taskUpdated, daily_report:report?.client_key || null, processed_at:processedAt
  }, 201);
});
