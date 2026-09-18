-- V15 ChatGPT Pilotage — DÉJÀ APPLIQUÉ DANS SUPABASE.
update public.ai_agents
set capabilities = jsonb_build_object(
  'chat', true,
  'model', 'gpt-5.6',
  'context', 'pilotage_rls',
  'tools', jsonb_build_array(
    'create_task',
    'update_task',
    'update_project',
    'request_project_completion',
    'create_daily_report_draft'
  ),
  'critical_actions_require_human', true,
  'request_log', 'ai_requests'
)
where provider = 'OpenAI'
  and name = 'ChatGPT'
  and active = true;
