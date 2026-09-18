-- V16 remontées multi-IA — DÉJÀ APPLIQUÉ DANS SUPABASE.

create table if not exists public.ai_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  event_type text not null check (event_type in (
    'work_done','task_created','task_updated','task_completed',
    'project_progress','blocker','next_step','decision','note'
  )),
  summary text not null check (char_length(summary) between 1 and 2000),
  payload jsonb not null default '{}'::jsonb,
  happened_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','rejected')),
  internal_tag text
);

create index if not exists ai_events_member_happened_idx on public.ai_events(member_id, happened_at desc);
create index if not exists ai_events_agent_happened_idx on public.ai_events(agent_id, happened_at desc);
create index if not exists ai_events_project_happened_idx on public.ai_events(project_id, happened_at desc) where project_id is not null;

alter table public.ai_events enable row level security;

drop policy if exists ai_events_select on public.ai_events;
create policy ai_events_select on public.ai_events
for select to authenticated
using (private.is_admin() or member_id = private.current_team_member_id());

revoke insert, update, delete on public.ai_events from anon, authenticated;
grant select on public.ai_events to authenticated;

create table if not exists public.ai_agent_tokens (
  agent_id uuid primary key references public.ai_agents(id) on delete cascade,
  token_hash text not null unique,
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_agent_tokens enable row level security;
revoke all on public.ai_agent_tokens from anon, authenticated;
