
-- V20 — Arborescence Projets : 3 niveaux max, tri, glisser-déposer,
-- progression automatique des projets parents à partir des tâches du sous-arbre.

alter table public.projects
  add column if not exists parent_project_id uuid,
  add column if not exists tree_sort_order bigint not null default 0,
  add column if not exists manual_progress smallint not null default 0;

update public.projects
set manual_progress = progress
where manual_progress is distinct from progress
  and parent_project_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.projects'::regclass
      and conname='projects_parent_project_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_parent_project_id_fkey
      foreign key (parent_project_id)
      references public.projects(id)
      on delete restrict;
  end if;
end $$;

alter table public.projects
  drop constraint if exists projects_no_self_parent;
alter table public.projects
  add constraint projects_no_self_parent
  check (parent_project_id is null or parent_project_id <> id);

create index if not exists projects_parent_project_idx
  on public.projects(parent_project_id);

create index if not exists projects_tree_order_idx
  on public.projects(parent_project_id, tree_sort_order, created_at);

with ranked as (
  select id, row_number() over (
    partition by parent_project_id
    order by created_at, id
  ) * 1000 as position
  from public.projects
)
update public.projects p
set tree_sort_order = ranked.position
from ranked
where ranked.id = p.id
  and p.tree_sort_order = 0;

create or replace function private.project_depth(p_project_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  with recursive ancestors as (
    select p.id, p.parent_project_id, 0 as depth
    from public.projects p
    where p.id = p_project_id

    union all

    select parent.id, parent.parent_project_id, a.depth + 1
    from ancestors a
    join public.projects parent on parent.id = a.parent_project_id
    where a.depth < 10
  )
  select coalesce(max(depth),0)::integer from ancestors;
$$;

create or replace function private.project_subtree_relative_depth(p_project_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  with recursive descendants as (
    select p.id, 0 as depth
    from public.projects p
    where p.id = p_project_id

    union all

    select child.id, d.depth + 1
    from descendants d
    join public.projects child on child.parent_project_id = d.id
    where d.depth < 10
  )
  select coalesce(max(depth),0)::integer from descendants;
$$;

create or replace function private.validate_project_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_parent_depth integer;
  v_subtree_depth integer;
  v_parent_owner uuid;
  v_parent_exists boolean;
  v_cycle boolean;
begin
  if new.parent_project_id is null then
    return new;
  end if;

  if new.parent_project_id = new.id then
    raise exception 'Un projet ne peut pas être son propre parent';
  end if;

  select true, p.owner_id
    into v_parent_exists, v_parent_owner
  from public.projects p
  where p.id = new.parent_project_id;

  if not coalesce(v_parent_exists,false) then
    raise exception 'Projet parent introuvable';
  end if;

  if v_member is not null and not private.is_admin() then
    if not (
      v_parent_owner = v_member
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = new.parent_project_id
          and pm.member_id = v_member
      )
    ) then
      raise exception 'Accès au projet parent refusé';
    end if;
  end if;

  with recursive descendants as (
    select p.id
    from public.projects p
    where p.id = new.id

    union all

    select child.id
    from descendants d
    join public.projects child on child.parent_project_id = d.id
  )
  select exists (
    select 1
    from descendants
    where id = new.parent_project_id
  )
  into v_cycle;

  if v_cycle then
    raise exception 'Déplacement impossible : cette hiérarchie créerait une boucle';
  end if;

  v_parent_depth := private.project_depth(new.parent_project_id);
  v_subtree_depth := private.project_subtree_relative_depth(new.id);

  -- Niveau racine = 0, enfant = 1, petit-enfant = 2 : 3 niveaux maximum.
  if v_parent_depth + 1 + v_subtree_depth > 2 then
    raise exception 'Trois niveaux maximum sont autorisés dans l’arborescence des projets';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_validate_hierarchy on public.projects;
create trigger projects_validate_hierarchy
before insert or update of parent_project_id
on public.projects
for each row
execute function private.validate_project_hierarchy();

create or replace function private.guard_project_progress_mode()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_system boolean :=
    coalesce(current_setting('pilotage.project_progress_system', true), '') = '1';
  v_has_children boolean;
begin
  if v_system then
    return new;
  end if;

  select exists (
    select 1 from public.projects c
    where c.parent_project_id = old.id
  ) into v_has_children;

  if v_has_children then
    -- Un parent garde une progression calculée. Une synchro front ne peut pas
    -- l’écraser avec une valeur manuelle devenue obsolète.
    new.progress := old.progress;
    new.manual_progress := old.manual_progress;
  elsif new.progress is distinct from old.progress then
    new.manual_progress := new.progress;
  end if;

  return new;
end;
$$;

drop trigger if exists projects_guard_progress_mode on public.projects;
create trigger projects_guard_progress_mode
before update of progress, manual_progress
on public.projects
for each row
execute function private.guard_project_progress_mode();

create or replace function private.refresh_hierarchical_project_progress()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform set_config('pilotage.project_progress_system', '1', true);

  with recursive tree as (
    select p.id as root_id, p.id as node_id
    from public.projects p

    union all

    select tree.root_id, child.id
    from tree
    join public.projects child on child.parent_project_id = tree.node_id
  ),
  task_stats as (
    select
      tree.root_id,
      count(t.id)::integer as total_tasks,
      count(t.id) filter (where t.status = 'completed')::integer as done_tasks
    from tree
    left join public.tasks t on t.project_id = tree.node_id
    group by tree.root_id
  ),
  child_flags as (
    select
      p.id,
      exists (
        select 1 from public.projects c
        where c.parent_project_id = p.id
      ) as has_children
    from public.projects p
  ),
  calculated as (
    select
      p.id,
      case
        when f.has_children then
          case
            when coalesce(s.total_tasks,0) = 0 then 0
            else round((s.done_tasks::numeric * 100) / s.total_tasks)::integer
          end
        else p.manual_progress::integer
      end as effective_progress
    from public.projects p
    join child_flags f on f.id = p.id
    left join task_stats s on s.root_id = p.id
  )
  update public.projects p
  set
    progress = greatest(0, least(100, calculated.effective_progress))::smallint,
    updated_at = case
      when p.progress is distinct from greatest(0, least(100, calculated.effective_progress))::smallint
      then now()
      else p.updated_at
    end
  from calculated
  where calculated.id = p.id
    and p.progress is distinct from greatest(0, least(100, calculated.effective_progress))::smallint;

  perform set_config('pilotage.project_progress_system', '0', true);
end;
$$;

create or replace function private.refresh_project_progress_after_task()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.refresh_hierarchical_project_progress();
  return coalesce(new,old);
end;
$$;

drop trigger if exists tasks_refresh_project_tree_progress on public.tasks;
create trigger tasks_refresh_project_tree_progress
after insert or update of status, project_id or delete
on public.tasks
for each statement
execute function private.refresh_project_progress_after_task();

create or replace function private.refresh_project_progress_after_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.refresh_hierarchical_project_progress();
  return coalesce(new,old);
end;
$$;

drop trigger if exists projects_refresh_tree_progress_insert on public.projects;
drop trigger if exists projects_refresh_tree_progress_update on public.projects;
drop trigger if exists projects_refresh_tree_progress_delete on public.projects;

create trigger projects_refresh_tree_progress_insert
after insert on public.projects
for each statement execute function private.refresh_project_progress_after_hierarchy();

create trigger projects_refresh_tree_progress_update
after update of parent_project_id on public.projects
for each statement execute function private.refresh_project_progress_after_hierarchy();

create trigger projects_refresh_tree_progress_delete
after delete on public.projects
for each statement execute function private.refresh_project_progress_after_hierarchy();

create or replace function public.move_pilotage_project(
  p_project_client_key text,
  p_parent_client_key text default null,
  p_before_client_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_project public.projects%rowtype;
  v_parent public.projects%rowtype;
  v_before public.projects%rowtype;
  v_target_parent uuid;
  v_new_order bigint;
  v_old_parent uuid;
begin
  if v_member is null then
    raise exception 'Membre Pilotage requis';
  end if;

  select * into v_project
  from public.projects
  where client_key = p_project_client_key;

  if not found then raise exception 'Projet introuvable'; end if;

  if not private.is_admin() and v_project.owner_id <> v_member then
    raise exception 'Seul le responsable du projet ou la Direction peut le déplacer';
  end if;

  v_old_parent := v_project.parent_project_id;

  if nullif(btrim(coalesce(p_before_client_key,'')),'') is not null then
    select * into v_before
    from public.projects
    where client_key = p_before_client_key;

    if not found then raise exception 'Projet de référence introuvable'; end if;
    if v_before.id = v_project.id then return jsonb_build_object('ok',true,'unchanged',true); end if;

    v_target_parent := v_before.parent_project_id;
  elsif nullif(btrim(coalesce(p_parent_client_key,'')),'') is not null then
    select * into v_parent
    from public.projects
    where client_key = p_parent_client_key;

    if not found then raise exception 'Projet parent introuvable'; end if;
    if v_parent.id = v_project.id then raise exception 'Un projet ne peut pas être son propre parent'; end if;

    v_target_parent := v_parent.id;
  else
    v_target_parent := null;
  end if;

  if v_target_parent is not null and not private.is_admin() then
    select * into v_parent from public.projects where id = v_target_parent;
    if not (
      v_parent.owner_id = v_member
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = v_target_parent
          and pm.member_id = v_member
      )
    ) then
      raise exception 'Accès au projet parent refusé';
    end if;
  end if;

  if nullif(btrim(coalesce(p_before_client_key,'')),'') is not null then
    v_new_order := greatest(1, coalesce(v_before.tree_sort_order,1000) - 1);
  else
    select coalesce(max(tree_sort_order),0) + 1000
      into v_new_order
    from public.projects p
    where p.parent_project_id is not distinct from v_target_parent
      and p.id <> v_project.id;
  end if;

  update public.projects
  set
    parent_project_id = v_target_parent,
    tree_sort_order = v_new_order,
    updated_at = now()
  where id = v_project.id;

  -- Normalisation de l'ordre des nouveaux frères.
  with ordered as (
    select
      p.id,
      row_number() over (order by p.tree_sort_order, p.created_at, p.id) * 1000 as new_order
    from public.projects p
    where p.parent_project_id is not distinct from v_target_parent
  )
  update public.projects p
  set tree_sort_order = ordered.new_order
  from ordered
  where ordered.id = p.id
    and p.tree_sort_order is distinct from ordered.new_order;

  -- Et des anciens frères si le projet a changé de dossier parent.
  if v_old_parent is distinct from v_target_parent then
    with ordered as (
      select
        p.id,
        row_number() over (order by p.tree_sort_order, p.created_at, p.id) * 1000 as new_order
      from public.projects p
      where p.parent_project_id is not distinct from v_old_parent
    )
    update public.projects p
    set tree_sort_order = ordered.new_order
    from ordered
    where ordered.id = p.id
      and p.tree_sort_order is distinct from ordered.new_order;
  end if;

  insert into public.activity_log(
    client_key,
    actor_member_id,
    actor_label,
    project_id,
    action_type,
    text,
    metadata,
    internal_tag,
    created_at
  )
  select
    'project-tree-' || gen_random_uuid()::text,
    v_member,
    tm.display_name,
    v_project.id,
    'project_tree_move',
    case
      when v_target_parent is null then 'Projet déplacé au niveau principal'
      else 'Projet déplacé dans « ' || parent.name || ' »'
    end,
    jsonb_build_object(
      'old_parent_project_id', v_old_parent,
      'new_parent_project_id', v_target_parent,
      'before_project_client_key', p_before_client_key
    ),
    'PILOT-PROJECT-TREE',
    now()
  from public.team_members tm
  left join public.projects parent on parent.id = v_target_parent
  where tm.id = v_member;

  perform private.refresh_hierarchical_project_progress();

  return jsonb_build_object(
    'ok', true,
    'project_client_key', v_project.client_key,
    'parent_client_key', (
      select p.client_key from public.projects p where p.id = v_target_parent
    ),
    'tree_sort_order', (
      select p.tree_sort_order from public.projects p where p.id = v_project.id
    )
  );
end;
$$;

revoke execute on function public.move_pilotage_project(text,text,text) from public;
revoke execute on function public.move_pilotage_project(text,text,text) from anon;
grant execute on function public.move_pilotage_project(text,text,text) to authenticated;

select private.refresh_hierarchical_project_progress();
