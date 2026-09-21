-- V18 — Google Drive + Google Calendar
-- PILOT-GOOGLE-001..010

create unique index if not exists integrations_owner_provider_uidx
  on public.integrations(owner_member_id, provider)
  where owner_member_id is not null;

create table if not exists public.drive_sync_items (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  external_file_id text not null,
  parent_external_file_id text null,
  name text not null,
  mime_type text null,
  web_url text null,
  relative_path text not null default '',
  is_folder boolean not null default false,
  trashed boolean not null default false,
  modified_time timestamptz null,
  size_bytes bigint null,
  checksum text null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(integration_id, external_file_id)
);

create index if not exists drive_sync_items_integration_idx on public.drive_sync_items(integration_id);
create index if not exists drive_sync_items_project_idx on public.drive_sync_items(project_id);
alter table public.drive_sync_items enable row level security;

create table if not exists public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  external_calendar_id text not null,
  name text not null,
  description text null,
  timezone text null,
  access_role text null,
  is_primary boolean not null default false,
  selected boolean not null default false,
  sync_mode text not null default 'read_only' check (sync_mode in ('read_only','two_way')),
  background_color text null,
  foreground_color text null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(integration_id, external_calendar_id)
);

create index if not exists calendar_sources_integration_idx on public.calendar_sources(integration_id);
alter table public.calendar_sources enable row level security;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_source_id uuid not null references public.calendar_sources(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  task_id uuid null references public.tasks(id) on delete set null,
  external_event_id text not null,
  status text null,
  summary text not null default '',
  description text null,
  location text null,
  start_at timestamptz null,
  end_at timestamptz null,
  start_date date null,
  end_date date null,
  all_day boolean not null default false,
  html_link text null,
  organizer_email text null,
  updated_remote_at timestamptz null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(calendar_source_id, external_event_id)
);

create index if not exists calendar_events_source_idx on public.calendar_events(calendar_source_id);
create index if not exists calendar_events_project_idx on public.calendar_events(project_id);
create index if not exists calendar_events_task_idx on public.calendar_events(task_id);
create index if not exists calendar_events_start_idx on public.calendar_events(start_at);
alter table public.calendar_events enable row level security;

insert into public.integrations(owner_member_id, provider, status, configuration)
select
  tm.id,
  v.provider,
  'disconnected',
  case
    when v.provider='google_drive' then jsonb_build_object(
      'root_folder_id', null,
      'root_folder_name', null,
      'include_subfolders', true,
      'include_shared_drives', true,
      'sync_mode', 'read_only',
      'scope_rule', 'selected_root_only'
    )
    else jsonb_build_object(
      'multi_calendar', true,
      'selected_calendar_ids', jsonb_build_array(),
      'default_sync_mode', 'read_only'
    )
  end
from public.team_members tm
cross join (values ('google_drive'),('google_calendar')) as v(provider)
where tm.active=true
on conflict (owner_member_id, provider) where owner_member_id is not null
do update set configuration=excluded.configuration, updated_at=now();