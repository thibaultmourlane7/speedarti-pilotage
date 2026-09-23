-- V18.1 — durcissement Chat interne : RPC en SECURITY INVOKER,
-- création de salon sous RLS et alimentation des membres par triggers privés.

create index if not exists pilotage_chat_rooms_created_by_idx
  on public.pilotage_chat_rooms(created_by_member_id);

create or replace function private.chat_can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_project_id is null
    or private.is_admin()
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id=p_project_id
        and pm.member_id=private.current_team_member_id()
    );
$$;

revoke all on function private.chat_can_access_project(uuid) from public;
grant execute on function private.chat_can_access_project(uuid) to authenticated;

drop policy if exists pilotage_chat_rooms_insert_v18 on public.pilotage_chat_rooms;
create policy pilotage_chat_rooms_insert_v18
on public.pilotage_chat_rooms
for insert
to authenticated
with check (
  created_by_member_id=private.current_team_member_id()
  and private.chat_can_access_project(project_id)
);

create or replace function private.populate_pilotage_chat_room_members()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.project_id is not null then
    insert into public.pilotage_chat_room_members(room_id,member_id)
    select new.id,pm.member_id
    from public.project_members pm
    join public.team_members tm on tm.id=pm.member_id and tm.active=true
    where pm.project_id=new.project_id
    on conflict do nothing;
  else
    insert into public.pilotage_chat_room_members(room_id,member_id)
    select new.id,tm.id
    from public.team_members tm
    where tm.active=true
    on conflict do nothing;
  end if;

  if new.created_by_member_id is not null then
    insert into public.pilotage_chat_room_members(room_id,member_id)
    values (new.id,new.created_by_member_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pilotage_chat_room_members_seed on public.pilotage_chat_rooms;
create trigger trg_pilotage_chat_room_members_seed
after insert on public.pilotage_chat_rooms
for each row execute function private.populate_pilotage_chat_room_members();

create or replace function private.sync_project_chat_member()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op='INSERT' then
    insert into public.pilotage_chat_room_members(room_id,member_id)
    select r.id,new.member_id
    from public.pilotage_chat_rooms r
    join public.team_members tm on tm.id=new.member_id and tm.active=true
    where r.project_id=new.project_id
      and r.room_type='project'
      and r.active=true
    on conflict do nothing;
    return new;
  end if;

  if tg_op='DELETE' then
    delete from public.pilotage_chat_room_members rm
    using public.pilotage_chat_rooms r
    where rm.room_id=r.id
      and r.project_id=old.project_id
      and r.room_type='project'
      and rm.member_id=old.member_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_project_members_chat_sync on public.project_members;
create trigger trg_project_members_chat_sync
after insert or delete on public.project_members
for each row execute function private.sync_project_chat_member();

create or replace function public.list_pilotage_chat_rooms()
returns table (
  room_id uuid,
  client_key text,
  room_name text,
  room_type text,
  project_id uuid,
  project_client_key text,
  project_name text,
  last_read_at timestamptz,
  unread_count bigint,
  last_message_at timestamptz,
  last_message_preview text
)
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
begin
  if v_member is null then
    raise exception 'Utilisateur Pilotage introuvable';
  end if;

  return query
  select
    r.id,
    r.client_key,
    r.name,
    r.room_type,
    r.project_id,
    p.client_key,
    p.name,
    rm.last_read_at,
    (
      select count(*)
      from public.pilotage_chat_messages m
      where m.room_id=r.id
        and m.deleted_at is null
        and m.sender_member_id <> v_member
        and (rm.last_read_at is null or m.created_at > rm.last_read_at)
    )::bigint,
    (
      select max(m.created_at)
      from public.pilotage_chat_messages m
      where m.room_id=r.id and m.deleted_at is null
    ),
    (
      select left(m.body,180)
      from public.pilotage_chat_messages m
      where m.room_id=r.id and m.deleted_at is null
      order by m.created_at desc
      limit 1
    )
  from public.pilotage_chat_rooms r
  join public.pilotage_chat_room_members rm
    on rm.room_id=r.id and rm.member_id=v_member
  left join public.projects p on p.id=r.project_id
  where r.active=true
  order by
    coalesce((
      select max(m.created_at)
      from public.pilotage_chat_messages m
      where m.room_id=r.id and m.deleted_at is null
    ),r.created_at) desc;
end;
$$;

create or replace function public.list_pilotage_chat_messages(
  p_room_id uuid,
  p_limit integer default 100
)
returns table (
  message_id uuid,
  client_key text,
  room_id uuid,
  sender_member_id uuid,
  sender_client_key text,
  sender_display_name text,
  body text,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_limit integer := greatest(1,least(coalesce(p_limit,100),200));
begin
  if v_member is null or not exists (
    select 1 from public.pilotage_chat_room_members
    where room_id=p_room_id and member_id=v_member
  ) then
    raise exception 'Accès au salon refusé';
  end if;

  return query
  select
    m.id,
    m.client_key,
    m.room_id,
    m.sender_member_id,
    tm.client_key,
    tm.display_name,
    m.body,
    m.created_at,
    m.edited_at
  from public.pilotage_chat_messages m
  join public.team_members tm on tm.id=m.sender_member_id
  where m.room_id=p_room_id
    and m.deleted_at is null
  order by m.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.send_pilotage_chat_message(
  p_room_id uuid,
  p_body text
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_message_id uuid;
  v_body text := btrim(coalesce(p_body,''));
begin
  if v_member is null then
    raise exception 'Utilisateur Pilotage introuvable';
  end if;
  if char_length(v_body)<1 or char_length(v_body)>10000 then
    raise exception 'Message vide ou trop long';
  end if;

  insert into public.pilotage_chat_messages(room_id,sender_member_id,body)
  values (p_room_id,v_member,v_body)
  returning id into v_message_id;

  return v_message_id;
end;
$$;

create or replace function public.mark_pilotage_chat_read(p_room_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
begin
  if v_member is null then
    raise exception 'Utilisateur Pilotage introuvable';
  end if;

  update public.pilotage_chat_room_members
  set last_read_at=now()
  where room_id=p_room_id and member_id=v_member;

  if not found then
    raise exception 'Accès au salon refusé';
  end if;
end;
$$;

create or replace function public.create_pilotage_chat_room(
  p_name text,
  p_project_client_key text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_name text := btrim(coalesce(p_name,''));
  v_project uuid;
  v_room uuid;
  v_existing uuid;
begin
  if v_member is null then
    raise exception 'Utilisateur Pilotage introuvable';
  end if;
  if char_length(v_name)<1 or char_length(v_name)>120 then
    raise exception 'Nom du salon invalide';
  end if;

  if nullif(btrim(coalesce(p_project_client_key,'')),'') is not null then
    select p.id into v_project
    from public.projects p
    where p.client_key=p_project_client_key
      and p.archived_at is null
      and private.chat_can_access_project(p.id)
    limit 1;

    if v_project is null then
      raise exception 'Projet introuvable ou non autorisé';
    end if;

    select r.id into v_existing
    from public.pilotage_chat_rooms r
    where r.project_id=v_project
      and r.room_type='project'
      and r.active=true
    limit 1;

    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  insert into public.pilotage_chat_rooms(
    client_key,name,room_type,project_id,created_by_member_id
  )
  values (
    'chat-room-' || gen_random_uuid()::text,
    v_name,
    case when v_project is null then 'group' else 'project' end,
    v_project,
    v_member
  )
  returning id into v_room;

  return v_room;
end;
$$;

revoke execute on function public.list_pilotage_chat_rooms() from anon;
revoke execute on function public.list_pilotage_chat_messages(uuid,integer) from anon;
revoke execute on function public.send_pilotage_chat_message(uuid,text) from anon;
revoke execute on function public.mark_pilotage_chat_read(uuid) from anon;
revoke execute on function public.create_pilotage_chat_room(text,text) from anon;

revoke execute on function public.list_pilotage_chat_rooms() from public;
revoke execute on function public.list_pilotage_chat_messages(uuid,integer) from public;
revoke execute on function public.send_pilotage_chat_message(uuid,text) from public;
revoke execute on function public.mark_pilotage_chat_read(uuid) from public;
revoke execute on function public.create_pilotage_chat_room(text,text) from public;

grant execute on function public.list_pilotage_chat_rooms() to authenticated;
grant execute on function public.list_pilotage_chat_messages(uuid,integer) to authenticated;
grant execute on function public.send_pilotage_chat_message(uuid,text) to authenticated;
grant execute on function public.mark_pilotage_chat_read(uuid) to authenticated;
grant execute on function public.create_pilotage_chat_room(text,text) to authenticated;
