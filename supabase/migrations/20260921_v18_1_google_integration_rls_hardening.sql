-- V18.1 — Hardening RLS Google integrations
-- Les écritures passent par l'Edge Function; les membres ne modifient pas directement la configuration d'intégration.

drop policy if exists integrations_insert on public.integrations;
drop policy if exists integrations_update on public.integrations;
drop policy if exists integrations_select on public.integrations;
drop policy if exists integrations_select_v18 on public.integrations;

create policy integrations_select_v18 on public.integrations
for select to authenticated
using (
  private.is_admin()
  or owner_member_id = private.current_team_member_id()
);

drop policy if exists calendar_sources_select on public.calendar_sources;
create policy calendar_sources_select on public.calendar_sources
for select to authenticated
using (
  private.is_admin()
  or exists (
    select 1 from public.integrations i
    where i.id = calendar_sources.integration_id
      and i.owner_member_id = private.current_team_member_id()
  )
  or (
    calendar_sources.shared_with_team = true
    and private.current_team_member_id() is not null
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
        i.owner_member_id = private.current_team_member_id()
        or (
          cs.shared_with_team = true
          and private.current_team_member_id() is not null
        )
      )
  )
);