-- V18.2 — privilèges minimaux nécessaires au Chat interne sous RLS.
revoke all on table public.pilotage_chat_rooms from anon;
revoke all on table public.pilotage_chat_room_members from anon;
revoke all on table public.pilotage_chat_messages from anon;

grant select, insert on table public.pilotage_chat_rooms to authenticated;
grant select, update on table public.pilotage_chat_room_members to authenticated;
grant select, insert on table public.pilotage_chat_messages to authenticated;
