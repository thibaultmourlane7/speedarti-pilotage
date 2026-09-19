# pilotage-mcp — V16.1

Déployée dans Supabase le 19/09/2026.

- Edge Function : `pilotage-mcp`
- version déployée : 1
- `verify_jwt` : false, volontairement
- authentification applicative : jeton privé propre à l’agent, validé via `ai_agent_tokens`
- protocoles supportés : MCP `2026-07-28` + compatibilité `2025-11-25`
- outils :
  - `listPilotageContext`
  - `reportPilotageEvent`
- la remontée réutilise `pilotage-ai-ingest`
- ne jamais mettre une URL privée contenant `?key=...` dans GitHub
