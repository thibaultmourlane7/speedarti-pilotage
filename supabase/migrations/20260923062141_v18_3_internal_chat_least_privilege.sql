-- V18.3 — moindre privilège explicite sur les tables du Chat interne.
revoke all on table public.pilotage_chat_rooms from public;
revoke all on table public.pilotage_chat_room_members from public;
revoke all on table public.pilotage_chat_messages from public;

revoke all on table public.pilotage_chat_rooms from anon;
revoke all on table public.pilotage_chat_room_members from anon;
revoke all on table public.pilotage_chat_messages from anon;

revoke all on table public.pilotage_chat_rooms from authenticated;
revoke all on table public.pilotage_chat_room_members from authenticated;
revoke all on table public.pilotage_chat_messages from authenticated;

grant select, insert on table public.pilotage_chat_rooms to authenticated;
grant select, update on table public.pilotage_chat_room_members to authenticated;
grant select, insert on table public.pilotage_chat_messages to authenticated;
