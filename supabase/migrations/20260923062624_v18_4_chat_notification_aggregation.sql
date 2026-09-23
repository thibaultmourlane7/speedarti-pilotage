-- V18.4 — agrégation des notifications du Chat interne.
-- Une seule notification active par destinataire/salon ; les nouveaux messages
-- mettent à jour cette notification et incrémentent son compteur.

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
      internal_tag,
      count,
      read_at,
      resolved_at,
      updated_at
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
      'PILOT-CHAT-INTERNAL',
      1,
      null,
      null,
      now()
    )
    on conflict (recipient_member_id, group_key)
      where group_key is not null and resolved_at is null
    do update set
      severity='info',
      type='pilotage_chat_message',
      title=excluded.title,
      message=excluded.message,
      action_type='read',
      project_id=excluded.project_id,
      internal_tag='PILOT-CHAT-INTERNAL',
      count=public.notifications.count + 1,
      read_at=null,
      updated_at=now();
  end loop;

  return new;
end;
$$;
