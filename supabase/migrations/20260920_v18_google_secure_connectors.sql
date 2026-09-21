-- V18 — Connecteurs Google sécurisés (Drive + Calendar)
-- PILOT-GOOGLE-001..012

create table if not exists public.google_oauth_states (
  state_hash text primary key,
  member_id uuid not null references public.team_members(id) on delete cascade,
  return_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.google_oauth_states enable row level security;
-- Aucun accès client direct : service_role uniquement via Edge Function.

create table if not exists public.google_credentials (
  owner_member_id uuid primary key references public.team_members(id) on delete cascade,
  google_email text null,
  encrypted_refresh_token text null,
  refresh_iv text null,
  encrypted_access_token text null,
  access_iv text null,
  access_token_expires_at timestamptz null,
  scope text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_credentials enable row level security;
-- Aucun accès client direct : service_role uniquement via Edge Function.

alter table public.calendar_sources
  add column if not exists shared_with_team boolean not null default false;

-- Intégrations : lecture seulement de sa connexion (admin = toutes).
drop policy if exists integrations_select_v18 on public.integrations;
create policy integrations_select_v18 on public.integrations
for select to authenticated
using (
  private.is_admin()
  or owner_member_id = private.current_team_member_id()
);

-- Les écritures passent par l'Edge Function avec service_role.
drop policy if exists integrations_admin_write_v18 on public.integrations;
create policy integrations_admin_write_v18 on public.integrations
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

-- Drive : propriétaire, admin, ou membre du projet si le fichier est rattaché.
drop policy if exists drive_sync_items_select on public.drive_sync_items;
create policy drive_sync_items_select on public.drive_sync_items
for select to authenticated
using (
  private.is_admin()
  or exists (
    select 1 from public.integrations i
    where i.id = drive_sync_items.integration_id
      and i.owner_member_id = private.current_team_member_id()
  )
  or (
    drive_sync_items.project_id is not null
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = drive_sync_items.project_id
        and pm.member_id = private.current_team_member_id()
    )
  )
);

-- Calendriers : propriétaire, admin, ou agenda explicitement partagé avec l'équipe.
drop policy if exists calendar_sources_select on public.calendar_sources;
create policy calendar_sources_select on public.calendar_sources
for select to authenticated
using (
  private.is_admin()
  or shared_with_team = true
  or exists (
    select 1 from public.integrations i
    where i.id = calendar_sources.integration_id
      and i.owner_member_id = private.current_team_member_id()
  )
);

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events
for select to authenticated
using (
  private.is_admin()
  or exists (
    select 1
    from public.calendar_sources cs
    join public.integrations i on i.id = cs.integration_id
    where cs.id = calendar_events.calendar_source_id
      and (
        cs.shared_with_team = true
        or i.owner_member_id = private.current_team_member_id()
      )
  )
);

create index if not exists google_oauth_states_expires_idx
  on public.google_oauth_states(expires_at);

create index if not exists calendar_sources_shared_idx
  on public.calendar_sources(shared_with_team)
  where shared_with_team = true;