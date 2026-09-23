
-- V19.2 — durcissement intégrité du module Idées.

alter table public.ideas
  drop constraint if exists ideas_project_id_fkey;
alter table public.ideas
  add constraint ideas_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete restrict;

alter table public.ideas
  drop constraint if exists ideas_task_id_fkey;
alter table public.ideas
  add constraint ideas_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete restrict;

alter table public.idea_resources
  drop constraint if exists idea_resources_url_protocol_check;
alter table public.idea_resources
  add constraint idea_resources_url_protocol_check
  check (url is null or url ~* '^https?://');

create or replace function private.idea_active_vote_count(p_idea_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  select count(*)::integer
  from public.idea_votes v
  join public.team_members tm on tm.id = v.member_id
  where v.idea_id = p_idea_id
    and tm.active = true;
$$;

create or replace function private.on_idea_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_idea_id uuid := coalesce(new.idea_id, old.idea_id);
  v_member uuid := coalesce(new.member_id, old.member_id);
  v_count integer;
  v_threshold integer;
  v_title text;
  v_status text;
  v_admin record;
begin
  select title, status into v_title, v_status
  from public.ideas
  where id = v_idea_id;

  if tg_op = 'INSERT' then
    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_added',
      'Vote ajouté sur l’idée « ' || coalesce(v_title,'') || ' »',
      v_member
    );
  else
    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_removed',
      'Vote retiré de l’idée « ' || coalesce(v_title,'') || ' »',
      v_member
    );
  end if;

  v_count := private.idea_active_vote_count(v_idea_id);
  v_threshold := private.idea_vote_threshold();

  if tg_op = 'INSERT' and v_status = 'new' and v_count >= v_threshold then
    perform set_config('pilotage.idea_system_update', '1', true);
    update public.ideas
    set status = 'under_review', updated_at = now()
    where id = v_idea_id and status = 'new';
    perform set_config('pilotage.idea_system_update', '0', true);

    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_threshold',
      'Seuil de votes atteint : idée à étudier',
      v_member,
      jsonb_build_object('vote_count', v_count, 'vote_threshold', v_threshold)
    );

    for v_admin in
      select id from public.team_members where active = true and role = 'admin'
    loop
      perform private.notify_idea_member(
        v_admin.id,
        'idea_review_required',
        'Idée à étudier',
        '« ' || coalesce(v_title,'Idée') || ' » a atteint ' || v_count || '/' || v_threshold || ' votes.',
        'idea-review-' || v_idea_id::text,
        v_idea_id,
        'action'
      );
    end loop;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.set_pilotage_idea_status(
  p_idea_id uuid,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_current text;
  v_allowed boolean := false;
begin
  if not private.is_admin() then raise exception 'Validation Direction requise'; end if;
  if p_status not in ('new','under_review','validated','planned','in_development','realized','rejected','abandoned') then
    raise exception 'Statut invalide';
  end if;

  select status into v_current
  from public.ideas
  where id = p_idea_id
  for update;

  if not found then raise exception 'Idée introuvable'; end if;
  if p_status = v_current then return; end if;

  v_allowed :=
    (v_current = 'new' and p_status in ('under_review','rejected','abandoned'))
    or (v_current = 'under_review' and p_status in ('validated','rejected','abandoned'))
    or (v_current = 'validated' and p_status in ('planned','abandoned'))
    or (v_current = 'planned' and p_status in ('in_development','abandoned'))
    or (v_current = 'in_development' and p_status in ('realized','abandoned'))
    or (v_current in ('rejected','abandoned') and p_status = 'under_review');

  if not v_allowed then
    raise exception 'Transition de statut non autorisée : % → %', v_current, p_status;
  end if;

  update public.ideas
  set
    status = p_status,
    validated_by_member_id = case when p_status = 'validated' then v_member else validated_by_member_id end,
    validated_at = case when p_status = 'validated' then now() else validated_at end,
    realized_at = case when p_status = 'realized' then now() else realized_at end,
    updated_at = now()
  where id = p_idea_id;
end;
$$;

revoke execute on function public.set_pilotage_idea_status(uuid,text) from public;
revoke execute on function public.set_pilotage_idea_status(uuid,text) from anon;
grant execute on function public.set_pilotage_idea_status(uuid,text) to authenticated;
