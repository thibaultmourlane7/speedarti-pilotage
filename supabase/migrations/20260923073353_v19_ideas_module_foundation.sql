
-- V19 — Module Idées SpeedArti Pilotage
-- Idée -> projet / tâche existante / aucune association.
-- Votes, commentaires, ressources, workflow, conversion en tâche et traçabilité.

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  description text not null default '' check (char_length(description) <= 12000),
  author_member_id uuid not null references public.team_members(id) on delete restrict,
  association_type text not null default 'none'
    check (association_type in ('none','project','task')),
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  module text,
  origin text not null default 'internal'
    check (origin in ('internal','client','partner','user','issue')),
  status text not null default 'new'
    check (status in ('new','under_review','validated','planned','in_development','realized','rejected','abandoned')),
  impact_level text check (impact_level is null or impact_level in ('low','medium','high')),
  effort_level text check (effort_level is null or effort_level in ('low','medium','high')),
  converted_task_id uuid references public.tasks(id) on delete set null,
  validated_by_member_id uuid references public.team_members(id) on delete set null,
  validated_at timestamptz,
  realized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ideas_association_shape_check check (
    (association_type = 'none' and project_id is null and task_id is null)
    or (association_type = 'project' and project_id is not null and task_id is null)
    or (association_type = 'task' and task_id is not null and project_id is null)
  )
);

create table if not exists public.idea_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idea_id, member_id)
);

create table if not exists public.idea_comments (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  idea_id uuid not null references public.ideas(id) on delete cascade,
  author_member_id uuid not null references public.team_members(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.idea_resources (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  idea_id uuid not null references public.ideas(id) on delete cascade,
  resource_type text not null check (resource_type in ('link','document','drive')),
  label text not null check (char_length(btrim(label)) between 1 and 240),
  url text,
  reference text,
  created_by_member_id uuid not null references public.team_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint idea_resources_value_check check (
    nullif(btrim(coalesce(url,'')),'') is not null
    or nullif(btrim(coalesce(reference,'')),'') is not null
  )
);

alter table public.tasks
  add column if not exists source_idea_id uuid references public.ideas(id) on delete set null;

create index if not exists ideas_author_idx on public.ideas(author_member_id);
create index if not exists ideas_project_idx on public.ideas(project_id);
create index if not exists ideas_task_idx on public.ideas(task_id);
create index if not exists ideas_status_idx on public.ideas(status, updated_at desc);
create index if not exists ideas_converted_task_idx on public.ideas(converted_task_id);
create index if not exists idea_votes_idea_idx on public.idea_votes(idea_id);
create index if not exists idea_votes_member_idx on public.idea_votes(member_id);
create index if not exists idea_comments_idea_idx on public.idea_comments(idea_id, created_at);
create index if not exists idea_comments_author_idx on public.idea_comments(author_member_id);
create index if not exists idea_resources_idea_idx on public.idea_resources(idea_id, created_at);
create index if not exists idea_resources_creator_idx on public.idea_resources(created_by_member_id);
create index if not exists tasks_source_idea_idx on public.tasks(source_idea_id);

alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.idea_comments enable row level security;
alter table public.idea_resources enable row level security;

revoke all on public.ideas from public, anon, authenticated;
revoke all on public.idea_votes from public, anon, authenticated;
revoke all on public.idea_comments from public, anon, authenticated;
revoke all on public.idea_resources from public, anon, authenticated;

grant select, insert, update, delete on public.ideas to authenticated;
grant select, insert, delete on public.idea_votes to authenticated;
grant select, insert, update, delete on public.idea_comments to authenticated;
grant select, insert, update, delete on public.idea_resources to authenticated;

drop policy if exists ideas_select on public.ideas;
create policy ideas_select on public.ideas
for select to authenticated
using (private.current_team_member_id() is not null);

drop policy if exists ideas_insert on public.ideas;
create policy ideas_insert on public.ideas
for insert to authenticated
with check (author_member_id = private.current_team_member_id());

drop policy if exists ideas_update on public.ideas;
create policy ideas_update on public.ideas
for update to authenticated
using (
  private.is_admin()
  or author_member_id = private.current_team_member_id()
)
with check (
  private.is_admin()
  or author_member_id = private.current_team_member_id()
);

drop policy if exists ideas_delete on public.ideas;
create policy ideas_delete on public.ideas
for delete to authenticated
using (
  private.is_admin()
  or (
    author_member_id = private.current_team_member_id()
    and status in ('new','under_review')
  )
);

drop policy if exists idea_votes_select on public.idea_votes;
create policy idea_votes_select on public.idea_votes
for select to authenticated
using (private.current_team_member_id() is not null);

drop policy if exists idea_votes_insert on public.idea_votes;
create policy idea_votes_insert on public.idea_votes
for insert to authenticated
with check (member_id = private.current_team_member_id());

drop policy if exists idea_votes_delete on public.idea_votes;
create policy idea_votes_delete on public.idea_votes
for delete to authenticated
using (member_id = private.current_team_member_id());

drop policy if exists idea_comments_select on public.idea_comments;
create policy idea_comments_select on public.idea_comments
for select to authenticated
using (private.current_team_member_id() is not null);

drop policy if exists idea_comments_insert on public.idea_comments;
create policy idea_comments_insert on public.idea_comments
for insert to authenticated
with check (author_member_id = private.current_team_member_id());

drop policy if exists idea_comments_update on public.idea_comments;
create policy idea_comments_update on public.idea_comments
for update to authenticated
using (private.is_admin() or author_member_id = private.current_team_member_id())
with check (private.is_admin() or author_member_id = private.current_team_member_id());

drop policy if exists idea_comments_delete on public.idea_comments;
create policy idea_comments_delete on public.idea_comments
for delete to authenticated
using (private.is_admin() or author_member_id = private.current_team_member_id());

drop policy if exists idea_resources_select on public.idea_resources;
create policy idea_resources_select on public.idea_resources
for select to authenticated
using (private.current_team_member_id() is not null);

drop policy if exists idea_resources_insert on public.idea_resources;
create policy idea_resources_insert on public.idea_resources
for insert to authenticated
with check (created_by_member_id = private.current_team_member_id());

drop policy if exists idea_resources_update on public.idea_resources;
create policy idea_resources_update on public.idea_resources
for update to authenticated
using (private.is_admin() or created_by_member_id = private.current_team_member_id())
with check (private.is_admin() or created_by_member_id = private.current_team_member_id());

drop policy if exists idea_resources_delete on public.idea_resources;
create policy idea_resources_delete on public.idea_resources
for delete to authenticated
using (private.is_admin() or created_by_member_id = private.current_team_member_id());

create or replace function private.idea_vote_threshold()
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  select greatest(
    1,
    ceil((count(*)::numeric * 2) / 3)::integer
  )
  from public.team_members
  where active = true;
$$;

create or replace function private.idea_effective_project(p_idea_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(i.project_id, t.project_id)
  from public.ideas i
  left join public.tasks t on t.id = i.task_id
  where i.id = p_idea_id;
$$;

create or replace function private.log_idea_activity(
  p_idea_id uuid,
  p_action_type text,
  p_text text,
  p_actor_member_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := coalesce(p_actor_member_id, private.current_team_member_id());
  v_actor_label text;
  v_project uuid;
  v_task uuid;
begin
  select display_name into v_actor_label
  from public.team_members
  where id = v_actor;

  select private.idea_effective_project(p_idea_id), task_id
    into v_project, v_task
  from public.ideas
  where id = p_idea_id;

  insert into public.activity_log(
    client_key,
    actor_member_id,
    actor_label,
    project_id,
    task_id,
    action_type,
    text,
    metadata,
    internal_tag,
    created_at
  )
  values (
    'idea-activity-' || gen_random_uuid()::text,
    v_actor,
    coalesce(v_actor_label, 'Pilotage'),
    v_project,
    v_task,
    p_action_type,
    p_text,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('idea_id', p_idea_id),
    'PILOT-IDEA-ACTIVITY',
    now()
  );
end;
$$;

create or replace function private.notify_idea_member(
  p_recipient uuid,
  p_type text,
  p_title text,
  p_message text,
  p_group_key text,
  p_idea_id uuid,
  p_severity text default 'info'
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_project uuid;
  v_task uuid;
begin
  if p_recipient is null then return; end if;

  select private.idea_effective_project(p_idea_id), task_id
    into v_project, v_task
  from public.ideas
  where id = p_idea_id;

  insert into public.notifications(
    client_key,
    recipient_member_id,
    severity,
    type,
    title,
    message,
    action_type,
    task_id,
    project_id,
    group_key,
    internal_tag,
    count,
    read_at,
    resolved_at,
    created_at,
    updated_at
  )
  values (
    'idea-notif-' || gen_random_uuid()::text,
    p_recipient,
    p_severity,
    p_type,
    p_title,
    p_message,
    'read',
    v_task,
    v_project,
    p_group_key,
    'PILOT-IDEA-NOTIFICATION',
    1,
    null,
    null,
    now(),
    now()
  )
  on conflict (recipient_member_id, group_key)
    where group_key is not null and resolved_at is null
  do update set
    severity = excluded.severity,
    type = excluded.type,
    title = excluded.title,
    message = excluded.message,
    action_type = 'read',
    task_id = excluded.task_id,
    project_id = excluded.project_id,
    internal_tag = 'PILOT-IDEA-NOTIFICATION',
    count = public.notifications.count + 1,
    read_at = null,
    updated_at = now();
end;
$$;

create or replace function private.guard_idea_write()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_system boolean := coalesce(current_setting('pilotage.idea_system_update', true), '') = '1';
begin
  if v_member is null then
    raise exception 'Membre Pilotage requis';
  end if;

  if tg_op = 'INSERT' then
    if new.author_member_id <> v_member then
      raise exception 'Auteur invalide';
    end if;
  elsif tg_op = 'UPDATE' and not private.is_admin() and not v_system then
    if old.author_member_id <> v_member then
      raise exception 'Seul l’auteur ou la Direction peut modifier cette idée';
    end if;

    if new.author_member_id is distinct from old.author_member_id
       or new.status is distinct from old.status
       or new.converted_task_id is distinct from old.converted_task_id
       or new.validated_by_member_id is distinct from old.validated_by_member_id
       or new.validated_at is distinct from old.validated_at
       or new.realized_at is distinct from old.realized_at then
      raise exception 'Ce changement nécessite une validation de la Direction';
    end if;
  end if;

  if new.association_type = 'project' then
    if not exists (select 1 from public.projects p where p.id = new.project_id) then
      raise exception 'Projet inaccessible';
    end if;
  elsif new.association_type = 'task' then
    if not exists (select 1 from public.tasks t where t.id = new.task_id) then
      raise exception 'Tâche inaccessible';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ideas_guard_write on public.ideas;
create trigger ideas_guard_write
before insert or update on public.ideas
for each row execute function private.guard_idea_write();

create or replace function private.idea_comment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists idea_comments_updated_at on public.idea_comments;
create trigger idea_comments_updated_at
before update on public.idea_comments
for each row execute function private.idea_comment_updated_at();

create or replace function private.on_idea_created()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.log_idea_activity(
    new.id,
    'idea_created',
    'Nouvelle idée : ' || new.title,
    new.author_member_id,
    jsonb_build_object('status', new.status, 'origin', new.origin, 'association_type', new.association_type)
  );
  return new;
end;
$$;

drop trigger if exists ideas_after_insert on public.ideas;
create trigger ideas_after_insert
after insert on public.ideas
for each row execute function private.on_idea_created();

create or replace function private.on_idea_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_idea_id uuid := coalesce(new.idea_id, old.idea_id);
  v_member uuid := coalesce(new.member_id, old.member_id);
  v_count integer;
  v_threshold integer;
  v_title text;
  v_status text;
  v_admin record;
begin
  select title, status into v_title, v_status
  from public.ideas
  where id = v_idea_id;

  if tg_op = 'INSERT' then
    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_added',
      'Vote ajouté sur l’idée « ' || coalesce(v_title,'') || ' »',
      v_member
    );
  else
    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_removed',
      'Vote retiré de l’idée « ' || coalesce(v_title,'') || ' »',
      v_member
    );
  end if;

  select count(*)::integer into v_count
  from public.idea_votes
  where idea_id = v_idea_id;

  v_threshold := private.idea_vote_threshold();

  if tg_op = 'INSERT' and v_status = 'new' and v_count >= v_threshold then
    perform set_config('pilotage.idea_system_update', '1', true);
    update public.ideas
    set status = 'under_review', updated_at = now()
    where id = v_idea_id and status = 'new';
    perform set_config('pilotage.idea_system_update', '0', true);

    perform private.log_idea_activity(
      v_idea_id,
      'idea_vote_threshold',
      'Seuil de votes atteint : idée à étudier',
      v_member,
      jsonb_build_object('vote_count', v_count, 'vote_threshold', v_threshold)
    );

    for v_admin in
      select id from public.team_members where active = true and role = 'admin'
    loop
      perform private.notify_idea_member(
        v_admin.id,
        'idea_review_required',
        'Idée à étudier',
        '« ' || coalesce(v_title,'Idée') || ' » a atteint ' || v_count || '/' || v_threshold || ' votes.',
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
create trigger idea_votes_after_insert
after insert on public.idea_votes
for each row execute function private.on_idea_vote_change();

drop trigger if exists idea_votes_after_delete on public.idea_votes;
create trigger idea_votes_after_delete
after delete on public.idea_votes
for each row execute function private.on_idea_vote_change();

create or replace function private.on_idea_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_author uuid;
  v_title text;
begin
  select author_member_id, title into v_author, v_title
  from public.ideas
  where id = new.idea_id;

  perform private.log_idea_activity(
    new.idea_id,
    'idea_comment_added',
    'Nouveau commentaire sur l’idée « ' || coalesce(v_title,'') || ' »',
    new.author_member_id
  );

  if v_author is not null and v_author <> new.author_member_id then
    perform private.notify_idea_member(
      v_author,
      'idea_comment',
      'Nouveau commentaire sur une idée',
      'Un commentaire a été ajouté à « ' || coalesce(v_title,'Idée') || ' ».',
      'idea-comments-' || new.idea_id::text,
      new.idea_id,
      'info'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists idea_comments_after_insert on public.idea_comments;
create trigger idea_comments_after_insert
after insert on public.idea_comments
for each row execute function private.on_idea_comment_created();

create or replace function private.on_idea_resource_created()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_title text;
begin
  select title into v_title from public.ideas where id = new.idea_id;
  perform private.log_idea_activity(
    new.idea_id,
    'idea_resource_added',
    'Ressource ajoutée à l’idée « ' || coalesce(v_title,'') || ' » : ' || new.label,
    new.created_by_member_id,
    jsonb_build_object('resource_type', new.resource_type)
  );
  return new;
end;
$$;

drop trigger if exists idea_resources_after_insert on public.idea_resources;
create trigger idea_resources_after_insert
after insert on public.idea_resources
for each row execute function private.on_idea_resource_created();

create or replace function private.on_idea_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := private.current_team_member_id();
begin
  if new.status is distinct from old.status then
    perform private.log_idea_activity(
      new.id,
      'idea_status_changed',
      'Idée « ' || new.title || ' » : ' || old.status || ' → ' || new.status,
      v_actor,
      jsonb_build_object('from', old.status, 'to', new.status)
    );

    if new.author_member_id is not null and new.author_member_id <> v_actor then
      perform private.notify_idea_member(
        new.author_member_id,
        'idea_status_changed',
        'Statut d’idée mis à jour',
        '« ' || new.title || ' » est maintenant : ' || new.status || '.',
        'idea-status-' || new.id::text,
        new.id,
        case when new.status in ('rejected','abandoned') then 'warning' else 'info' end
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_after_status_update on public.ideas;
create trigger ideas_after_status_update
after update of status on public.ideas
for each row execute function private.on_idea_status_changed();

create or replace function public.list_pilotage_ideas()
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
  vote_threshold integer,
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
    private.idea_vote_threshold(),
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

create or replace function public.get_pilotage_idea_detail(p_idea_id uuid)
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
      'created_at', v.created_at
    ) order by v.created_at
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

create or replace function public.create_pilotage_idea(
  p_title text,
  p_description text default '',
  p_association_type text default 'none',
  p_project_client_key text default null,
  p_task_client_key text default null,
  p_module text default null,
  p_origin text default 'internal',
  p_impact_level text default null,
  p_effort_level text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_id uuid := gen_random_uuid();
  v_project uuid;
  v_task uuid;
begin
  if v_member is null then raise exception 'Membre Pilotage requis'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'Titre requis'; end if;

  if p_association_type = 'project' then
    select id into v_project
    from public.projects
    where client_key = p_project_client_key;
    if v_project is null then raise exception 'Projet introuvable ou inaccessible'; end if;
  elsif p_association_type = 'task' then
    select id into v_task
    from public.tasks
    where client_key = p_task_client_key;
    if v_task is null then raise exception 'Tâche introuvable ou inaccessible'; end if;
  elsif p_association_type <> 'none' then
    raise exception 'Type d’association invalide';
  end if;

  insert into public.ideas(
    id, client_key, title, description, author_member_id,
    association_type, project_id, task_id, module, origin,
    impact_level, effort_level
  )
  values (
    v_id,
    'idea-' || replace(v_id::text,'-',''),
    btrim(p_title),
    coalesce(p_description,''),
    v_member,
    p_association_type,
    v_project,
    v_task,
    nullif(btrim(coalesce(p_module,'')),''),
    p_origin,
    p_impact_level,
    p_effort_level
  );

  return v_id;
end;
$$;

create or replace function public.update_pilotage_idea(
  p_idea_id uuid,
  p_title text,
  p_description text default '',
  p_association_type text default 'none',
  p_project_client_key text default null,
  p_task_client_key text default null,
  p_module text default null,
  p_origin text default 'internal',
  p_impact_level text default null,
  p_effort_level text default null
)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_project uuid;
  v_task uuid;
begin
  if nullif(btrim(p_title),'') is null then raise exception 'Titre requis'; end if;

  if p_association_type = 'project' then
    select id into v_project from public.projects where client_key = p_project_client_key;
    if v_project is null then raise exception 'Projet introuvable ou inaccessible'; end if;
  elsif p_association_type = 'task' then
    select id into v_task from public.tasks where client_key = p_task_client_key;
    if v_task is null then raise exception 'Tâche introuvable ou inaccessible'; end if;
  elsif p_association_type <> 'none' then
    raise exception 'Type d’association invalide';
  end if;

  update public.ideas
  set
    title = btrim(p_title),
    description = coalesce(p_description,''),
    association_type = p_association_type,
    project_id = v_project,
    task_id = v_task,
    module = nullif(btrim(coalesce(p_module,'')),''),
    origin = p_origin,
    impact_level = p_impact_level,
    effort_level = p_effort_level
  where id = p_idea_id;

  if not found then raise exception 'Idée introuvable ou non modifiable'; end if;
end;
$$;

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
  else
    insert into public.idea_votes(idea_id, member_id)
    values (p_idea_id, v_member);
    return true;
  end if;
end;
$$;

create or replace function public.add_pilotage_idea_comment(
  p_idea_id uuid,
  p_body text
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_id uuid := gen_random_uuid();
begin
  if v_member is null then raise exception 'Membre Pilotage requis'; end if;
  if nullif(btrim(p_body),'') is null then raise exception 'Commentaire vide'; end if;
  if not exists (select 1 from public.ideas where id = p_idea_id) then raise exception 'Idée introuvable'; end if;

  insert into public.idea_comments(id, client_key, idea_id, author_member_id, body)
  values (
    v_id,
    'idea-comment-' || replace(v_id::text,'-',''),
    p_idea_id,
    v_member,
    btrim(p_body)
  );
  return v_id;
end;
$$;

create or replace function public.add_pilotage_idea_resource(
  p_idea_id uuid,
  p_resource_type text,
  p_label text,
  p_url text default null,
  p_reference text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
  v_id uuid := gen_random_uuid();
begin
  if v_member is null then raise exception 'Membre Pilotage requis'; end if;
  if nullif(btrim(p_label),'') is null then raise exception 'Libellé requis'; end if;
  if not exists (select 1 from public.ideas where id = p_idea_id) then raise exception 'Idée introuvable'; end if;

  insert into public.idea_resources(
    id, client_key, idea_id, resource_type, label, url, reference, created_by_member_id
  )
  values (
    v_id,
    'idea-resource-' || replace(v_id::text,'-',''),
    p_idea_id,
    p_resource_type,
    btrim(p_label),
    nullif(btrim(coalesce(p_url,'')),''),
    nullif(btrim(coalesce(p_reference,'')),''),
    v_member
  );
  return v_id;
end;
$$;

create or replace function public.delete_pilotage_idea_comment(p_comment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  delete from public.idea_comments where id = p_comment_id;
  if not found then raise exception 'Commentaire introuvable ou non supprimable'; end if;
end;
$$;

create or replace function public.delete_pilotage_idea_resource(p_resource_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  delete from public.idea_resources where id = p_resource_id;
  if not found then raise exception 'Ressource introuvable ou non supprimable'; end if;
end;
$$;

create or replace function public.set_pilotage_idea_status(
  p_idea_id uuid,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_member uuid := private.current_team_member_id();
begin
  if not private.is_admin() then raise exception 'Validation Direction requise'; end if;
  if p_status not in ('new','under_review','validated','planned','in_development','realized','rejected','abandoned') then
    raise exception 'Statut invalide';
  end if;

  update public.ideas
  set
    status = p_status,
    validated_by_member_id = case when p_status = 'validated' then v_member else validated_by_member_id end,
    validated_at = case when p_status = 'validated' then now() else validated_at end,
    realized_at = case when p_status = 'realized' then now() else realized_at end,
    updated_at = now()
  where id = p_idea_id;

  if not found then raise exception 'Idée introuvable'; end if;
end;
$$;

create or replace function public.convert_pilotage_idea_to_task(
  p_idea_id uuid,
  p_project_client_key text default null,
  p_assignee_client_key text default null,
  p_priority text default 'medium',
  p_planning_bucket text default null,
  p_scheduled_for date default null,
  p_due_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_idea public.ideas%rowtype;
  v_member uuid := private.current_team_member_id();
  v_project uuid;
  v_assignee uuid;
  v_task_id uuid := gen_random_uuid();
  v_task_key text := 'idea-task-' || replace(gen_random_uuid()::text,'-','');
  v_planning_status text;
begin
  if not private.is_admin() then raise exception 'Conversion en tâche réservée à la Direction'; end if;

  select * into v_idea
  from public.ideas
  where id = p_idea_id
  for update;

  if not found then raise exception 'Idée introuvable'; end if;
  if v_idea.status not in ('validated','planned') then
    raise exception 'L’idée doit être validée avant de devenir une tâche';
  end if;
  if v_idea.converted_task_id is not null then
    raise exception 'Cette idée a déjà été transformée en tâche';
  end if;

  if nullif(btrim(coalesce(p_project_client_key,'')),'') is not null then
    select id into v_project
    from public.projects
    where client_key = p_project_client_key
      and archived_at is null;
    if v_project is null then raise exception 'Projet cible introuvable'; end if;
  end if;

  if nullif(btrim(coalesce(p_assignee_client_key,'')),'') is not null then
    select id into v_assignee
    from public.team_members
    where client_key = p_assignee_client_key and active = true;
  else
    v_assignee := v_member;
  end if;

  if v_assignee is null then raise exception 'Responsable introuvable'; end if;

  if v_project is not null and not exists (
    select 1
    from public.projects p
    where p.id = v_project and p.owner_id = v_assignee
    union all
    select 1
    from public.project_members pm
    where pm.project_id = v_project and pm.member_id = v_assignee
  ) then
    raise exception 'Le responsable doit participer au projet cible';
  end if;

  if p_priority not in ('urgent','high','medium','low') then
    raise exception 'Priorité invalide';
  end if;
  if p_planning_bucket is not null
     and p_planning_bucket not in ('backlog','this_week','this_month','next_3_months','later') then
    raise exception 'Période de planification invalide';
  end if;

  v_planning_status := case when p_planning_bucket is null then 'unplanned' else 'planned' end;

  insert into public.tasks(
    id,
    client_key,
    title,
    project_id,
    assigned_to_member_id,
    created_by,
    source_type,
    source_idea_id,
    status,
    priority,
    scheduled_for,
    due_at,
    planning_status,
    planning_bucket,
    suggested_bucket,
    needs_planning,
    sort_order,
    created_at,
    updated_at
  )
  values (
    v_task_id,
    v_task_key,
    v_idea.title,
    v_project,
    v_assignee,
    auth.uid(),
    'manual',
    v_idea.id,
    'todo',
    p_priority,
    p_scheduled_for,
    p_due_at,
    v_planning_status,
    p_planning_bucket,
    null,
    p_planning_bucket is null,
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    now(),
    now()
  );

  update public.ideas
  set
    converted_task_id = v_task_id,
    status = 'planned',
    updated_at = now()
  where id = v_idea.id;

  perform private.log_idea_activity(
    v_idea.id,
    'idea_converted_to_task',
    'Idée transformée en tâche : ' || v_idea.title,
    v_member,
    jsonb_build_object('task_id', v_task_id, 'task_client_key', v_task_key)
  );

  if v_assignee <> v_member then
    perform private.notify_idea_member(
      v_assignee,
      'idea_task_assignment',
      'Nouvelle tâche issue d’une idée',
      'La tâche « ' || v_idea.title || ' » t’a été attribuée.',
      'idea-task-assignment-' || v_task_id::text,
      v_idea.id,
      'action'
    );
  end if;

  return jsonb_build_object(
    'task_id', v_task_id,
    'task_client_key', v_task_key,
    'title', v_idea.title,
    'project_id', v_project,
    'assigned_to_member_id', v_assignee
  );
end;
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'list_pilotage_ideas',
        'get_pilotage_idea_detail',
        'create_pilotage_idea',
        'update_pilotage_idea',
        'toggle_pilotage_idea_vote',
        'add_pilotage_idea_comment',
        'add_pilotage_idea_resource',
        'delete_pilotage_idea_comment',
        'delete_pilotage_idea_resource',
        'set_pilotage_idea_status',
        'convert_pilotage_idea_to_task'
      )
  loop
    execute 'revoke execute on function ' || f.signature || ' from public';
    execute 'revoke execute on function ' || f.signature || ' from anon';
    execute 'grant execute on function ' || f.signature || ' to authenticated';
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ideas'
  ) then
    alter publication supabase_realtime add table public.ideas;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'idea_votes'
  ) then
    alter publication supabase_realtime add table public.idea_votes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'idea_comments'
  ) then
    alter publication supabase_realtime add table public.idea_comments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'idea_resources'
  ) then
    alter publication supabase_realtime add table public.idea_resources;
  end if;
end $$;
