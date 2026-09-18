-- V14 multi-utilisateur — DÉJÀ APPLIQUÉE DANS SUPABASE.

create or replace function private.can_notify_member(
  p_project_id uuid,
  p_recipient_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    private.is_admin()
    or p_recipient_member_id = private.current_team_member_id()
    or (
      p_project_id is not null
      and private.is_project_member(p_project_id)
      and (
        exists (
          select 1 from public.project_members pm
          where pm.project_id = p_project_id
            and pm.member_id = p_recipient_member_id
        )
        or exists (
          select 1 from public.team_members tm
          where tm.id = p_recipient_member_id
            and tm.active = true
            and tm.role = 'admin'
        )
      )
    );
$$;

revoke all on function private.can_notify_member(uuid, uuid) from public, anon;
grant execute on function private.can_notify_member(uuid, uuid) to authenticated;

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert
on public.notifications
for insert
to authenticated
with check (
  private.can_notify_member(project_id, recipient_member_id)
);

create or replace function private.guard_task_project_assignee()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.project_id is not null
     and new.assigned_to_member_id is not null
     and not exists (
       select 1 from public.project_members pm
       where pm.project_id = new.project_id
         and pm.member_id = new.assigned_to_member_id
     )
  then
    raise exception 'Le responsable de la tâche doit être participant du projet.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_task_project_assignee() from public, anon, authenticated;

drop trigger if exists guard_task_project_assignee on public.tasks;
create trigger guard_task_project_assignee
before insert or update of project_id, assigned_to_member_id
on public.tasks
for each row
execute function private.guard_task_project_assignee();
