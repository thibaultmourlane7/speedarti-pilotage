# V18 — Google Drive + Google Agenda

État : code de bout en bout présent dans le dépôt et fondations Supabase déployées. La connexion réelle reste à valider après configuration Google Cloud.

## Google Drive

- connexion OAuth individuelle par membre ;
- lecture seule par défaut ;
- sélection d'un seul dossier racine ;
- synchronisation limitée à ce dossier et à ses sous-dossiers ;
- prise en charge de Mon Drive et des Drives partagés ;
- indexation des références dans `drive_sync_items` ;
- rattachement facultatif d'un fichier à un projet Pilotage ;
- aucun fichier n'est copié dans Pilotage : Google Drive reste la source.

## Google Agenda

- connexion Google individuelle pour Thibault, Anne-Sophie et Guillaume ;
- récupération de tous les agendas accessibles au compte connecté ;
- sélection agenda par agenda ;
- possibilité de rendre un agenda visible à l'équipe ;
- lecture seule par défaut ;
- synchronisation des événements sélectionnés ;
- rattachement facultatif d'un événement à un projet et/ou une tâche.

## Sécurité

Les jetons OAuth ne sont jamais stockés dans GitHub ni dans le navigateur. Ils sont chiffrés côté serveur dans `google_credentials`. L'Edge Function `pilotage-google` réalise les appels Google avec le compte du membre connecté.

Secrets Supabase nécessaires :
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

URI de redirection OAuth à déclarer dans Google Cloud :
`https://veovtygcolfsrjocrhsf.supabase.co/functions/v1/pilotage-google/callback`

APIs Google à activer :
- Google Drive API
- Google Calendar API

## Fichiers principaux

- `src/google-integrations.js`
- `src/remote-sync.js`
- `src/app.js`
- `src/app.bundle.js`
- `src/styles.css`
- `supabase/functions/pilotage-google/index.ts`
- `supabase/migrations/20260920_v18_google_drive_calendar_foundation.sql`
- `supabase/migrations/20260920_v18_google_secure_connectors.sql`

## Validation restante

1. créer/configurer les identifiants OAuth Google ;
2. ajouter les trois secrets Supabase ;
3. connecter Thibault et sélectionner un dossier Drive ;
4. tester la synchronisation Drive ;
5. connecter un Agenda et tester la sélection multi-calendriers ;
6. répéter avec Anne-Sophie et Guillaume ;
7. seulement après ces tests, marquer V18 terminée.
