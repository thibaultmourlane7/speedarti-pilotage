
-- V20.2 — Le déplacement d'un projet respecte directement les RLS.
create or replace function public.move_pilotage_project(
  p_project_client_key text,
  p_parent_client_key text default null,
  p_before_client_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_project public.projects%rowtype;
  v_parent public.projects%rowtype;
  v_before public.projects%rowtype;
  v_target_parent uuid;
  v_new_order bigint;
  v_previous_order bigint;
  v_old_parent uuid;
  v_actor_label text;
begin
  if v_member is null then
    raise exception 'Membre Pilotage requis';
  end if;

  select * into v_project
  from public.projects
  where client_key = p_project_client_key;

  if not found then raise exception 'Projet introuvable ou inaccessible'; end if;

  if not private.is_admin() and v_project.owner_id <> v_member then
    raise exception 'Seul le responsable du projet ou la Direction peut le déplacer';
  end if;

  v_old_parent := v_project.parent_project_id;

  if nullif(btrim(coalesce(p_before_client_key,'')),'') is not null then
    select * into v_before
    from public.projects
    where client_key = p_before_client_key;

    if not found then raise exception 'Projet de référence introuvable ou inaccessible'; end if;
    if v_before.id = v_project.id then
      return jsonb_build_object('ok',true,'unchanged',true);
    end if;

    v_target_parent := v_before.parent_project_id;

  elsif nullif(btrim(coalesce(p_parent_client_key,'')),'') is not null then
    select * into v_parent
    from public.projects
    where client_key = p_parent_client_key;

    if not found then raise exception 'Projet parent introuvable ou inaccessible'; end if;
    if v_parent.id = v_project.id then
      raise exception 'Un projet ne peut pas être son propre parent';
    end if;

    v_target_parent := v_parent.id;
  else
    v_target_parent := null;
  end if;

  if nullif(btrim(coalesce(p_before_client_key,'')),'') is not null then
    select max(p.tree_sort_order)
      into v_previous_order
    from public.projects p
    where p.parent_project_id is not distinct from v_target_parent
      and p.id not in (v_project.id, v_before.id)
      and p.tree_sort_order < v_before.tree_sort_order;

    if v_previous_order is null then
      v_new_order := v_before.tree_sort_order - 1000;
    elsif v_before.tree_sort_order - v_previous_order > 1 then
      v_new_order := v_previous_order + ((v_before.tree_sort_order - v_previous_order) / 2);
    else
      v_new_order := v_before.tree_sort_order - 1;
    end if;
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

  if not found then
    raise exception 'Déplacement refusé par les droits du projet';
  end if;

  select tm.display_name into v_actor_label
  from public.team_members tm
  where tm.id = v_member;

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
  values (
    'project-tree-' || gen_random_uuid()::text,
    v_member,
    coalesce(v_actor_label,'Pilotage'),
    v_project.id,
    'project_tree_move',
    case
      when v_target_parent is null then 'Projet déplacé au niveau principal'
      else 'Projet déplacé dans « ' || coalesce((select name from public.projects where id=v_target_parent),'Projet') || ' »'
    end,
    jsonb_build_object(
      'old_parent_project_id', v_old_parent,
      'new_parent_project_id', v_target_parent,
      'before_project_client_key', p_before_client_key
    ),
    'PILOT-PROJECT-TREE',
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'project_client_key', v_project.client_key,
    'parent_client_key', (
      select p.client_key from public.projects p where p.id = v_target_parent
    ),
    'tree_sort_order', v_new_order
  );
end;
$$;

revoke execute on function public.move_pilotage_project(text,text,text) from public;
revoke execute on function public.move_pilotage_project(text,text,text) from anon;
grant execute on function public.move_pilotage_project(text,text,text) to authenticated;
