# SpeedArti Pilotage — V16 Remontées multi-IA

## Remplacer dans GitHub
- `src/app.js`
- `src/app.bundle.js`
- `src/remote-sync.js`
- `src/tags.js`
- `docs/TAGS.md`

## Ajouter
- `supabase/migrations/20260918_v16_ai_event_ingestion.sql`
- `supabase/functions/pilotage-ai-ingest/index.ts`
- `supabase/functions/pilotage-ai-ingest/deno.json`
- `supabase/functions/pilotage-ai-ingest/DEPLOYED-V16.md`
- `connectors/pilotage-ai-ingest-openapi.yaml`
- `V16-CONNECTEURS-IA.md`

## Ne pas exécuter le SQL manuellement
La migration V16 et l'Edge Function sont déjà appliquées/déployées dans Supabase.

## Fichier secret séparé
Les jetons des 4 agents sont fournis dans un fichier séparé intitulé
`V16-SECRETS-IA-NE-PAS-METTRE-SUR-GITHUB.txt`.

NE JAMAIS METTRE CE FICHIER DANS GITHUB.

Après remplacement : `Ctrl + F5`.
