-- Migration déjà appliquée au projet Supabase Pilotage d'entreprise.
-- PILOT-PROJ-012 / PILOT-REPORT-008

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
with check (
  private.is_admin()
  or (owner_id = private.current_team_member_id() and status <> 'completed')
);

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
using (private.is_admin() or owner_id = private.current_team_member_id())
with check (
  private.is_admin()
  or (owner_id = private.current_team_member_id() and status <> 'completed')
);

drop policy if exists change_requests_update on public.change_requests;
create policy change_requests_update on public.change_requests for update to authenticated
using (private.is_admin()) with check (private.is_admin());

drop policy if exists daily_reports_insert on public.daily_reports;
create policy daily_reports_insert on public.daily_reports for insert to authenticated
with check (
  private.is_admin()
  or (
    member_id = private.current_team_member_id()
    and status = 'draft'
    and validated_at is null
    and validated_by_member_id is null
  )
);

drop policy if exists daily_reports_update on public.daily_reports;
create policy daily_reports_update on public.daily_reports for update to authenticated
using (private.is_admin() or member_id = private.current_team_member_id())
with check (
  private.is_admin()
  or (
    member_id = private.current_team_member_id()
    and status = 'draft'
    and validated_at is null
    and validated_by_member_id is null
  )
);

drop policy if exists team_members_admin_write on public.team_members;
create policy team_members_admin_insert on public.team_members for insert to authenticated with check (private.is_admin());
create policy team_members_admin_update on public.team_members for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy team_members_admin_delete on public.team_members for delete to authenticated using (private.is_admin());

drop index if exists public.project_members_user_idx;
drop index if exists public.tasks_assigned_idx;
