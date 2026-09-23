-- V18 — Chat interne SpeedArti Pilotage (Supabase Realtime)
-- Remplace Google Chat pour les comptes Google personnels.
-- Google Calendar + Meet restent gérés par l'intégration Google existante.

create table if not exists public.pilotage_chat_rooms (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  room_type text not null default 'group'
    check (room_type in ('team','project','group','direct')),
  project_id uuid references public.projects(id) on delete set null,
  created_by_member_id uuid references public.team_members(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pilotage_chat_one_project_room_idx
  on public.pilotage_chat_rooms(project_id)
  where room_type='project' and project_id is not null and active=true;

create table if not exists public.pilotage_chat_room_members (
  room_id uuid not null references public.pilotage_chat_rooms(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (room_id, member_id)
);

create index if not exists pilotage_chat_room_members_member_idx
  on public.pilotage_chat_room_members(member_id, room_id);

create table if not exists public.pilotage_chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique default ('chat-message-' || gen_random_uuid()::text),
  room_id uuid not null references public.pilotage_chat_rooms(id) on delete cascade,
  sender_member_id uuid not null references public.team_members(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists pilotage_chat_messages_room_time_idx
  on public.pilotage_chat_messages(room_id, created_at desc);
create index if not exists pilotage_chat_messages_sender_idx
  on public.pilotage_chat_messages(sender_member_id);

alter table public.pilotage_chat_rooms enable row level security;
alter table public.pilotage_chat_room_members enable row level security;
alter table public.pilotage_chat_messages enable row level security;

create or replace function private.chat_is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.pilotage_chat_room_members rm
    where rm.room_id = p_room_id
      and rm.member_id = private.current_team_member_id()
  );
$$;

revoke all on function private.chat_is_room_member(uuid) from public;
grant execute on function private.chat_is_room_member(uuid) to authenticated;

drop policy if exists pilotage_chat_rooms_select_v18 on public.pilotage_chat_rooms;
create policy pilotage_chat_rooms_select_v18
on public.pilotage_chat_rooms
for select
to authenticated
using (private.is_admin() or private.chat_is_room_member(id));

drop policy if exists pilotage_chat_room_members_select_v18 on public.pilotage_chat_room_members;
create policy pilotage_chat_room_members_select_v18
on public.pilotage_chat_room_members
for select
to authenticated
using (
  private.is_admin()
  or member_id = private.current_team_member_id()
  or private.chat_is_room_member(room_id)
);

drop policy if exists pilotage_chat_room_members_update_v18 on public.pilotage_chat_room_members;
create policy pilotage_chat_room_members_update_v18
on public.pilotage_chat_room_members
for update
to authenticated
using (member_id = private.current_team_member_id())
with check (member_id = private.current_team_member_id());

drop policy if exists pilotage_chat_messages_select_v18 on public.pilotage_chat_messages;
create policy pilotage_chat_messages_select_v18
on public.pilotage_chat_messages
for select
to authenticated
using (private.is_admin() or private.chat_is_room_member(room_id));

drop policy if exists pilotage_chat_messages_insert_v18 on public.pilotage_chat_messages;
create policy pilotage_chat_messages_insert_v18
on public.pilotage_chat_messages
for insert
to authenticated
with check (
  sender_member_id = private.current_team_member_id()
  and private.chat_is_room_member(room_id)
);

insert into public.pilotage_chat_rooms (
  client_key, name, room_type, created_by_member_id
)
values (
  'team-general',
  'Équipe SpeedArti',
  'team',
  (select id from public.team_members where role='admin' and active=true order by created_at limit 1)
)
on conflict (client_key) do update
set active=true, updated_at=now();

insert into public.pilotage_chat_room_members(room_id, member_id)
select r.id, tm.id
from public.pilotage_chat_rooms r
cross join public.team_members tm
where r.client_key='team-general'
  and tm.active=true
on conflict (room_id,member_id) do nothing;

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
security definer
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
      select left(m.body, 180)
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
    ), r.created_at) desc;
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
security definer
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_limit integer := greatest(1, least(coalesce(p_limit,100),200));
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
security definer
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
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception 'Message vide ou trop long';
  end if;
  if not exists (
    select 1 from public.pilotage_chat_room_members
    where room_id=p_room_id and member_id=v_member
  ) then
    raise exception 'Accès au salon refusé';
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
security definer
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
security definer
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
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Nom du salon invalide';
  end if;

  if nullif(btrim(coalesce(p_project_client_key,'')),'') is not null then
    select p.id into v_project
    from public.projects p
    where p.client_key=p_project_client_key
      and p.archived_at is null
      and (
        private.is_admin()
        or exists (
          select 1 from public.project_members pm
          where pm.project_id=p.id and pm.member_id=v_member
        )
      )
    limit 1;

    if v_project is null then
      raise exception 'Projet introuvable ou non autorisé';
    end if;

    select id into v_existing
    from public.pilotage_chat_rooms
    where project_id=v_project and room_type='project' and active=true
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

  if v_project is not null then
    insert into public.pilotage_chat_room_members(room_id,member_id)
    select v_room,pm.member_id
    from public.project_members pm
    join public.team_members tm on tm.id=pm.member_id and tm.active=true
    where pm.project_id=v_project
    on conflict do nothing;
  else
    insert into public.pilotage_chat_room_members(room_id,member_id)
    select v_room,tm.id
    from public.team_members tm
    where tm.active=true
    on conflict do nothing;
  end if;

  insert into public.pilotage_chat_room_members(room_id,member_id)
  values (v_room,v_member)
  on conflict do nothing;

  return v_room;
end;
$$;

revoke all on function public.list_pilotage_chat_rooms() from public;
revoke all on function public.list_pilotage_chat_messages(uuid,integer) from public;
revoke all on function public.send_pilotage_chat_message(uuid,text) from public;
revoke all on function public.mark_pilotage_chat_read(uuid) from public;
revoke all on function public.create_pilotage_chat_room(text,text) from public;

grant execute on function public.list_pilotage_chat_rooms() to authenticated;
grant execute on function public.list_pilotage_chat_messages(uuid,integer) to authenticated;
grant execute on function public.send_pilotage_chat_message(uuid,text) to authenticated;
grant execute on function public.mark_pilotage_chat_read(uuid) to authenticated;
grant execute on function public.create_pilotage_chat_room(text,text) to authenticated;

create or replace function private.notify_pilotage_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room record;
  v_sender text;
  v_recipient record;
begin
  select r.name,r.project_id into v_room
  from public.pilotage_chat_rooms r
  where r.id=new.room_id;

  select display_name into v_sender
  from public.team_members
  where id=new.sender_member_id;

  for v_recipient in
    select rm.member_id
    from public.pilotage_chat_room_members rm
    where rm.room_id=new.room_id
      and rm.member_id<>new.sender_member_id
      and rm.muted=false
  loop
    insert into public.notifications(
      client_key,
      recipient_member_id,
      severity,
      type,
      title,
      message,
      action_type,
      project_id,
      group_key,
      internal_tag
    )
    values (
      'pilotage-chat-' || new.id::text || '-' || v_recipient.member_id::text,
      v_recipient.member_id,
      'info',
      'pilotage_chat_message',
      'Nouveau message · ' || coalesce(v_room.name,'Chat'),
      coalesce(v_sender,'Équipe') || ' : ' || left(new.body,280),
      'read',
      v_room.project_id,
      'pilotage-chat-room-' || new.room_id::text,
      'PILOT-CHAT-INTERNAL'
    )
    on conflict (client_key) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_pilotage_chat_message_notify on public.pilotage_chat_messages;
create trigger trg_pilotage_chat_message_notify
after insert on public.pilotage_chat_messages
for each row execute function private.notify_pilotage_chat_message();

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime'
         and schemaname='public'
         and tablename='pilotage_chat_messages'
     ) then
    alter publication supabase_realtime add table public.pilotage_chat_messages;
  end if;
end $$;
