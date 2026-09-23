
-- V19.4 — Votes à 3 positions pour le module Idées.
-- Une seule position par membre : like / dislike / neutral.
-- Seuls les "like" comptent pour le seuil automatique "À étudier".

alter table public.idea_votes
  add column if not exists vote_value text;

update public.idea_votes
set vote_value = 'like'
where vote_value is null;

alter table public.idea_votes
  alter column vote_value set default 'like',
  alter column vote_value set not null;

alter table public.idea_votes
  drop constraint if exists idea_votes_vote_value_check;

alter table public.idea_votes
  add constraint idea_votes_vote_value_check
  check (vote_value in ('like','dislike','neutral'));

alter table public.idea_votes
  add column if not exists updated_at timestamptz not null default now();

grant update(vote_value) on public.idea_votes to authenticated;

drop policy if exists idea_votes_update on public.idea_votes;
create policy idea_votes_update on public.idea_votes
for update to authenticated
using (member_id = private.current_team_member_id())
with check (member_id = private.current_team_member_id());

create or replace function private.idea_vote_updated_at()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.idea_id is distinct from old.idea_id
     or new.member_id is distinct from old.member_id then
    raise exception 'Le membre et l’idée d’un vote ne peuvent pas être modifiés';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists idea_votes_updated_at on public.idea_votes;
create trigger idea_votes_updated_at
before update on public.idea_votes
for each row execute function private.idea_vote_updated_at();

create or replace function private.idea_active_like_count(p_idea_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  select count(*)::integer
  from public.idea_votes v
  join public.team_members tm on tm.id = v.member_id
  where v.idea_id = p_idea_id
    and tm.active = true
    and v.vote_value = 'like';
$$;

create or replace function private.idea_active_vote_count(p_idea_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  select private.idea_active_like_count(p_idea_id);
$$;

create or replace function private.on_idea_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_idea_id uuid := coalesce(new.idea_id, old.idea_id);
  v_member uuid := coalesce(new.member_id, old.member_id);
  v_like_count integer;
  v_threshold integer;
  v_title text;
  v_status text;
  v_admin record;
  v_old_label text;
  v_new_label text;
begin
  select title, status into v_title, v_status
  from public.ideas
  where id = v_idea_id;

  v_old_label := case old.vote_value
    when 'like' then 'J’aime'
    when 'dislike' then 'J’aime pas'
    when 'neutral' then 'Je ne me prononce pas'
    else null
  end;

  v_new_label := case new.vote_value
    when 'like' then 'J’aime'
    when 'dislike' then 'J’aime pas'
    when 'neutral' then 'Je ne me prononce pas'
    else null
  end;

  if tg_op = 'INSERT' then
    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_added',
      'Position « ' || coalesce(v_new_label,'') || ' » ajoutée sur l’idée « ' || coalesce(v_title,'') || ' »',
      v_member,
      jsonb_build_object('vote_value', new.vote_value)
    );
  elsif tg_op = 'UPDATE' and new.vote_value is distinct from old.vote_value then
    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_changed',
      'Position changée : « ' || coalesce(v_old_label,'') || ' » → « ' || coalesce(v_new_label,'') || ' » sur l’idée « ' || coalesce(v_title,'') || ' »',
      v_member,
      jsonb_build_object('from', old.vote_value, 'to', new.vote_value)
    );
  elsif tg_op = 'DELETE' then
    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_removed',
      'Position « ' || coalesce(v_old_label,'') || ' » retirée de l’idée « ' || coalesce(v_title,'') || ' »',
      v_member,
      jsonb_build_object('vote_value', old.vote_value)
    );
  end if;

  v_like_count := private.idea_active_like_count(v_idea_id);
  v_threshold := private.idea_vote_threshold();

  if tg_op in ('INSERT','UPDATE')
     and v_status = 'new'
     and v_like_count >= v_threshold then
    perform set_config('pilotage.idea_system_update', '1', true);
    update public.ideas
    set status = 'under_review', updated_at = now()
    where id = v_idea_id and status = 'new';
    perform set_config('pilotage.idea_system_update', '0', true);

    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_threshold',
      'Seuil de soutiens atteint : idée à étudier',
      v_member,
      jsonb_build_object('like_count', v_like_count, 'vote_threshold', v_threshold)
    );

    for v_admin in
      select id from public.team_members where active = true and role = 'admin'
    loop
      perform private.notify_idea_member(
        v_admin.id,
        'idea_review_required',
        'Idée à étudier',
        '« ' || coalesce(v_title,'Idée') || ' » a atteint ' || v_like_count || '/' || v_threshold || ' soutiens.',
        'idea-review-' || v_idea_id::text,
        v_idea_id,
        'action'
      );
    end loop;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists idea_votes_after_insert on public.idea_votes;
drop trigger if exists idea_votes_after_update on public.idea_votes;
drop trigger if exists idea_votes_after_delete on public.idea_votes;

create trigger idea_votes_after_insert
after insert on public.idea_votes
for each row execute function private.on_idea_vote_change();

create trigger idea_votes_after_update
after update of vote_value on public.idea_votes
for each row execute function private.on_idea_vote_change();

create trigger idea_votes_after_delete
after delete on public.idea_votes
for each row execute function private.on_idea_vote_change();

create or replace function public.set_pilotage_idea_vote(
  p_idea_id uuid,
  p_vote text
)
returns text
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
begin
  if v_member is null then raise exception 'Membre Pilotage requis'; end if;
  if p_vote not in ('like','dislike','neutral') then
    raise exception 'Position de vote invalide';
  end if;
  if not exists (select 1 from public.ideas where id = p_idea_id) then
    raise exception 'Idée introuvable';
  end if;

  insert into public.idea_votes(idea_id, member_id, vote_value)
  values (p_idea_id, v_member, p_vote)
  on conflict (idea_id, member_id)
  do update set vote_value = excluded.vote_value;

  return p_vote;
end;
$$;

-- Compatibilité avec les anciennes interfaces encore en cache :
-- un clic legacy ajoute/retire uniquement un soutien "like".
create or replace function public.toggle_pilotage_idea_vote(p_idea_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
begin
  if v_member is null then raise exception 'Membre Pilotage requis'; end if;
  if not exists (select 1 from public.ideas where id = p_idea_id) then
    raise exception 'Idée introuvable';
  end if;

  if exists (
    select 1 from public.idea_votes
    where idea_id = p_idea_id and member_id = v_member
  ) then
    delete from public.idea_votes
    where idea_id = p_idea_id and member_id = v_member;
    return false;
  end if;

  insert into public.idea_votes(idea_id, member_id, vote_value)
  values (p_idea_id, v_member, 'like');
  return true;
end;
$$;

revoke execute on function public.set_pilotage_idea_vote(uuid,text) from public;
revoke execute on function public.set_pilotage_idea_vote(uuid,text) from anon;
grant execute on function public.set_pilotage_idea_vote(uuid,text) to authenticated;

drop function if exists public.get_pilotage_idea_detail(uuid);
drop function if exists public.list_pilotage_ideas();

create function public.list_pilotage_ideas()
returns table (
  idea_id uuid,
  client_key text,
  title text,
  description text,
  author_member_id uuid,
  author_client_key text,
  author_display_name text,
  association_type text,
  project_id uuid,
  project_client_key text,
  project_name text,
  task_id uuid,
  task_client_key text,
  task_title text,
  task_project_client_key text,
  task_project_name text,
  module text,
  origin text,
  status text,
  impact_level text,
  effort_level text,
  converted_task_id uuid,
  converted_task_client_key text,
  converted_task_title text,
  validated_by_member_id uuid,
  validated_by_display_name text,
  validated_at timestamptz,
  realized_at timestamptz,
  vote_count bigint,
  like_count bigint,
  dislike_count bigint,
  neutral_count bigint,
  vote_threshold integer,
  current_vote text,
  voted_by_me boolean,
  comment_count bigint,
  resource_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public, private
as $$
  select
    i.id,
    i.client_key,
    i.title,
    i.description,
    i.author_member_id,
    a.client_key,
    a.display_name,
    i.association_type,
    i.project_id,
    p.client_key,
    p.name,
    i.task_id,
    t.client_key,
    t.title,
    tp.client_key,
    tp.name,
    i.module,
    i.origin,
    i.status,
    i.impact_level,
    i.effort_level,
    i.converted_task_id,
    ct.client_key,
    ct.title,
    i.validated_by_member_id,
    vb.display_name,
    i.validated_at,
    i.realized_at,
    (select count(*) from public.idea_votes v where v.idea_id = i.id),
    (select count(*) from public.idea_votes v where v.idea_id = i.id and v.vote_value = 'like'),
    (select count(*) from public.idea_votes v where v.idea_id = i.id and v.vote_value = 'dislike'),
    (select count(*) from public.idea_votes v where v.idea_id = i.id and v.vote_value = 'neutral'),
    private.idea_vote_threshold(),
    (
      select mv.vote_value
      from public.idea_votes mv
      where mv.idea_id = i.id
        and mv.member_id = private.current_team_member_id()
      limit 1
    ),
    exists (
      select 1
      from public.idea_votes mv
      where mv.idea_id = i.id
        and mv.member_id = private.current_team_member_id()
    ),
    (select count(*) from public.idea_comments c where c.idea_id = i.id),
    (select count(*) from public.idea_resources r where r.idea_id = i.id),
    i.created_at,
    i.updated_at
  from public.ideas i
  join public.team_members a on a.id = i.author_member_id
  left join public.projects p on p.id = i.project_id
  left join public.tasks t on t.id = i.task_id
  left join public.projects tp on tp.id = t.project_id
  left join public.tasks ct on ct.id = i.converted_task_id
  left join public.team_members vb on vb.id = i.validated_by_member_id
  order by i.updated_at desc, i.created_at desc;
$$;

create function public.get_pilotage_idea_detail(p_idea_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, private
as $$
declare
  v_idea jsonb;
  v_votes jsonb;
  v_comments jsonb;
  v_resources jsonb;
begin
  select to_jsonb(x) into v_idea
  from public.list_pilotage_ideas() x
  where x.idea_id = p_idea_id;

  if v_idea is null then
    raise exception 'Idée introuvable ou inaccessible';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'member_id', tm.id,
      'member_client_key', tm.client_key,
      'display_name', tm.display_name,
      'initials', tm.initials,
      'vote_value', v.vote_value,
      'created_at', v.created_at,
      'updated_at', v.updated_at
    ) order by v.updated_at, v.created_at
  ), '[]'::jsonb)
  into v_votes
  from public.idea_votes v
  join public.team_members tm on tm.id = v.member_id
  where v.idea_id = p_idea_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'comment_id', c.id,
      'client_key', c.client_key,
      'author_member_id', c.author_member_id,
      'author_client_key', tm.client_key,
      'author_display_name', tm.display_name,
      'body', c.body,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ) order by c.created_at
  ), '[]'::jsonb)
  into v_comments
  from public.idea_comments c
  join public.team_members tm on tm.id = c.author_member_id
  where c.idea_id = p_idea_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'resource_id', r.id,
      'client_key', r.client_key,
      'resource_type', r.resource_type,
      'label', r.label,
      'url', r.url,
      'reference', r.reference,
      'created_by_member_id', r.created_by_member_id,
      'created_by_client_key', tm.client_key,
      'created_by_display_name', tm.display_name,
      'created_at', r.created_at
    ) order by r.created_at
  ), '[]'::jsonb)
  into v_resources
  from public.idea_resources r
  join public.team_members tm on tm.id = r.created_by_member_id
  where r.idea_id = p_idea_id;

  return jsonb_build_object(
    'idea', v_idea,
    'votes', v_votes,
    'comments', v_comments,
    'resources', v_resources
  );
end;
$$;

revoke execute on function public.list_pilotage_ideas() from public;
revoke execute on function public.list_pilotage_ideas() from anon;
grant execute on function public.list_pilotage_ideas() to authenticated;

revoke execute on function public.get_pilotage_idea_detail(uuid) from public;
revoke execute on function public.get_pilotage_idea_detail(uuid) from anon;
grant execute on function public.get_pilotage_idea_detail(uuid) to authenticated;
