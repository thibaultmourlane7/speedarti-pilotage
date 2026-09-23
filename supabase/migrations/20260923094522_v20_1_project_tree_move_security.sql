
-- V20.1 — Durcissement du déplacement dans l'arborescence.
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
    if v_before.id = v_project.id then
      return jsonb_build_object('ok',true,'unchanged',true);
    end if;

    if not private.is_admin() and not (
      v_before.owner_id = v_member
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = v_before.id
          and pm.member_id = v_member
      )
    ) then
      raise exception 'Accès au projet de référence refusé';
    end if;

    v_target_parent := v_before.parent_project_id;

  elsif nullif(btrim(coalesce(p_parent_client_key,'')),'') is not null then
    select * into v_parent
    from public.projects
    where client_key = p_parent_client_key;

    if not found then raise exception 'Projet parent introuvable'; end if;
    if v_parent.id = v_project.id then
      raise exception 'Un projet ne peut pas être son propre parent';
    end if;

    if not private.is_admin() and not (
      v_parent.owner_id = v_member
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = v_parent.id
          and pm.member_id = v_member
      )
    ) then
      raise exception 'Accès au projet parent refusé';
    end if;

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
