# SpeedArti Pilotage — V16.1 MCP Claude

## Déjà fait côté Supabase
- migration `v16_1_daily_report_ai_source_types` appliquée ;
- Edge Function `pilotage-mcp` déployée et active ;
- tâche Pilotage « V16.1 — Déployer la passerelle MCP pour Claude Anne-Sophie » marquée terminée.

## À ajouter / remplacer dans GitHub
Remplacer :
- `src/tags.js`
- `docs/TAGS.md`

Ajouter :
- `supabase/migrations/20260919_v16_1_daily_report_ai_source_types.sql`
- `supabase/functions/pilotage-mcp/index.ts`
- `supabase/functions/pilotage-mcp/deno.json`
- `supabase/functions/pilotage-mcp/DEPLOYED-V16-1.md`
- `V16-1-MCP-CLAUDE.md`

## Important
Ne pas exécuter la migration manuellement : elle est déjà appliquée.

Le fichier privé de connexion Claude n'est PAS inclus dans ce ZIP.
Ne jamais mettre l'URL privée contenant `?key=...` dans GitHub.
