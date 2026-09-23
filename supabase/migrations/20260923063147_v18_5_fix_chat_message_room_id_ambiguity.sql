-- V18.5 — corrige l'ambiguïté PL/pgSQL sur room_id dans la lecture des messages.

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
    select 1
    from public.pilotage_chat_room_members rm
    where rm.room_id = p_room_id
      and rm.member_id = v_member
  ) then
    raise exception 'Accès au salon refusé';
  end if;

  return query
  select
    m.id as message_id,
    m.client_key,
    m.room_id,
    m.sender_member_id,
    tm.client_key as sender_client_key,
    tm.display_name as sender_display_name,
    m.body,
    m.created_at,
    m.edited_at
  from public.pilotage_chat_messages m
  join public.team_members tm
    on tm.id = m.sender_member_id
  where m.room_id = p_room_id
    and m.deleted_at is null
  order by m.created_at desc
  limit v_limit;
end;
$$;

revoke execute on function public.list_pilotage_chat_messages(uuid,integer) from public;
revoke execute on function public.list_pilotage_chat_messages(uuid,integer) from anon;
grant execute on function public.list_pilotage_chat_messages(uuid,integer) to authenticated;
