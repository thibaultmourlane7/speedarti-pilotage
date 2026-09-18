-- Migration déjà appliquée au projet Supabase Pilotage d'entreprise.
-- PILOT-SUPA-011 — accepte les valeurs de tri basées sur Date.now().
alter table public.tasks
  alter column sort_order type bigint
  using sort_order::bigint;
