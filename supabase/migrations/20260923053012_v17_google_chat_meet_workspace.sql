-- V17 — Google Chat + Meet + meeting requests
-- Server-side writes only for Google-synchronized tables; authenticated users read via RLS.

alter table public.calendar_events
  add column if not exists meet_url text,
  add column if not exists conference_id text,
  add column if not exists attendees jsonb not null default '[]'::jsonb;

create table if not exists public.google_chat_spaces (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  external_space_name text not null,
  display_name text not null default '',
  space_type text,
  space_uri text,
  last_remote_message_at timestamptz,
  last_notified_at timestamptz,
  last_seen_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, external_space_name)
);

create index if not exists google_chat_spaces_integration_idx
  on public.google_chat_spaces(integration_id);
create index if not exists google_chat_spaces_project_idx
  on public.google_chat_spaces(project_id);

create table if not exists public.google_chat_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.google_chat_spaces(id) on delete cascade,
  external_message_name text not null,
  thread_name text,
  sender_user_name text,
  sender_display_name text,
  text text not null default '',
  formatted_text text,
  create_time timestamptz not null,
  update_time timestamptz,
  deleted boolean not null default false,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, external_message_name)
);

create index if not exists google_chat_messages_space_time_idx
  on public.google_chat_messages(space_id, create_time desc);

create table if not exists public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  client_key text unique,
  requester_member_id uuid not null references public.team_members(id) on delete cascade,
  recipient_member_id uuid not null references public.team_members(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  proposed_start_at timestamptz not null,
  proposed_end_at timestamptz not null,
  timezone text not null default 'Europe/Paris',
  status text not null default 'requested'
    check (status in ('requested','accepted','declined','reschedule_requested','cancelled')),
  requester_email text,
  recipient_email text,
  response_message text,
  google_event_id text,
  calendar_source_id uuid references public.calendar_sources(id) on delete set null,
  meet_url text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposed_end_at > proposed_start_at),
  check (requester_member_id <> recipient_member_id)
);

create index if not exists meeting_requests_requester_idx
  on public.meeting_requests(requester_member_id, created_at desc);
create index if not exists meeting_requests_recipient_idx
  on public.meeting_requests(recipient_member_id, created_at desc);
create index if not exists meeting_requests_status_idx
  on public.meeting_requests(status, proposed_start_at);

alter table public.google_chat_spaces enable row level security;
alter table public.google_chat_messages enable row level security;
alter table public.meeting_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='google_chat_spaces' and policyname='google_chat_spaces_select_v17'
  ) then
    create policy google_chat_spaces_select_v17 on public.google_chat_spaces
      for select to authenticated
      using (
        private.is_admin()
        or exists (
          select 1 from public.integrations i
          where i.id = google_chat_spaces.integration_id
            and i.owner_member_id = private.current_team_member_id()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='google_chat_messages' and policyname='google_chat_messages_select_v17'
  ) then
    create policy google_chat_messages_select_v17 on public.google_chat_messages
      for select to authenticated
      using (
        private.is_admin()
        or exists (
          select 1
          from public.google_chat_spaces s
          join public.integrations i on i.id = s.integration_id
          where s.id = google_chat_messages.space_id
            and i.owner_member_id = private.current_team_member_id()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='meeting_requests' and policyname='meeting_requests_select_v17'
  ) then
    create policy meeting_requests_select_v17 on public.meeting_requests
      for select to authenticated
      using (
        private.is_admin()
        or requester_member_id = private.current_team_member_id()
        or recipient_member_id = private.current_team_member_id()
      );
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime'
         and schemaname='public'
         and tablename='meeting_requests'
     ) then
    alter publication supabase_realtime add table public.meeting_requests;
  end if;
end $$;
