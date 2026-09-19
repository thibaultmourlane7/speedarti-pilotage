-- V16.1 — DÉJÀ APPLIQUÉ DANS SUPABASE.
-- Étend les types de source des comptes rendus afin d'accepter
-- les sources détaillées des agents externes.

alter table public.daily_reports
  drop constraint if exists daily_reports_source_type_check;

alter table public.daily_reports
  add constraint daily_reports_source_type_check
  check (source_type = any (array[
    'manual'::text,
    'ai'::text,
    'system'::text,
    'chatgpt'::text,
    'claude'::text,
    'other_ai'::text
  ]));
