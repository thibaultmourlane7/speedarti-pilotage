-- Historical migration applied on 2026-09-22 while evaluating a custom OAuth bridge.
-- It is immediately neutralized by the following cleanup migration because
-- SpeedArti Pilotage now uses the native Supabase Auth OAuth 2.1 server.

create table if not exists public.mcp_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  client_name text not null default 'ChatGPT',
  redirect_uris jsonb not null default '[]'::jsonb,
  token_endpoint_auth_method text not null default 'none',
  grant_types jsonb not null default '["authorization_code","refresh_token"]'::jsonb,
  response_types jsonb not null default '["code"]'::jsonb,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mcp_oauth_clients_auth_method_check check (token_endpoint_auth_method in ('none'))
);

create table if not exists public.mcp_oauth_authorization_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  state text,
  scope text not null,
  resource text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  status text not null default 'pending',
  member_id uuid references public.team_members(id) on delete set null,
  agent_id uuid references public.ai_agents(id) on delete set null,
  expires_at timestamptz not null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mcp_oauth_authorization_requests_status_check check (status in ('pending','approved','denied','expired')),
  constraint mcp_oauth_authorization_requests_pkce_check check (code_challenge_method = 'S256')
);

create table if not exists public.mcp_oauth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  scope text not null,
  resource text not null,
  code_challenge text not null,
  member_id uuid not null references public.team_members(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  token_kind text not null,
  token_hash text not null unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  scope text not null,
  resource text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mcp_oauth_tokens_kind_check check (token_kind in ('access','refresh'))
);

create index if not exists mcp_oauth_auth_requests_client_idx
  on public.mcp_oauth_authorization_requests(client_id, expires_at);
create index if not exists mcp_oauth_codes_client_idx
  on public.mcp_oauth_codes(client_id, expires_at);
create index if not exists mcp_oauth_tokens_client_idx
  on public.mcp_oauth_tokens(client_id, token_kind, expires_at);
create index if not exists mcp_oauth_tokens_agent_idx
  on public.mcp_oauth_tokens(agent_id, token_kind, expires_at);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_authorization_requests enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;

revoke all on table public.mcp_oauth_clients from anon, authenticated;
revoke all on table public.mcp_oauth_authorization_requests from anon, authenticated;
revoke all on table public.mcp_oauth_codes from anon, authenticated;
revoke all on table public.mcp_oauth_tokens from anon, authenticated;

drop policy if exists mcp_oauth_clients_deny_client on public.mcp_oauth_clients;
create policy mcp_oauth_clients_deny_client on public.mcp_oauth_clients
for all to anon, authenticated using (false) with check (false);

drop policy if exists mcp_oauth_authorization_requests_deny_client on public.mcp_oauth_authorization_requests;
create policy mcp_oauth_authorization_requests_deny_client on public.mcp_oauth_authorization_requests
for all to anon, authenticated using (false) with check (false);

drop policy if exists mcp_oauth_codes_deny_client on public.mcp_oauth_codes;
create policy mcp_oauth_codes_deny_client on public.mcp_oauth_codes
for all to anon, authenticated using (false) with check (false);

drop policy if exists mcp_oauth_tokens_deny_client on public.mcp_oauth_tokens;
create policy mcp_oauth_tokens_deny_client on public.mcp_oauth_tokens
for all to anon, authenticated using (false) with check (false);
