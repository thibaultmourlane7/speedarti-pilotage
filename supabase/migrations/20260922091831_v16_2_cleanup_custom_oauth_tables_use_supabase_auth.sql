-- Final decision: use Supabase Auth's native OAuth 2.1 server for MCP.
-- Remove the temporary custom OAuth storage created in the preceding migration.

drop table if exists public.mcp_oauth_tokens cascade;
drop table if exists public.mcp_oauth_codes cascade;
drop table if exists public.mcp_oauth_authorization_requests cascade;
drop table if exists public.mcp_oauth_clients cascade;
