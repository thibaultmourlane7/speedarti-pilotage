# SpeedArti Pilotage — V14 complète

## Remplacer
- `src/app.js`
- `src/app.bundle.js`
- `src/tags.js`
- `docs/TAGS.md`

## Ajouter pour historique
- `supabase/migrations/20260918_v14_multiuser_notification_and_task_guards.sql`

Ne pas exécuter le SQL manuellement : la migration a déjà été appliquée dans Supabase.

## Ne pas toucher
- `src/auth.js`
- `src/state.js`
- `src/data.js`
- `src/styles.css`
- `index.html`

## Contenu V14
- multi-sélection participants projet côté admin ;
- rôles réels admin/membre dans l’interface ;
- droits tâches Guillaume conservés ;
- assignation tâche limitée aux participants du projet ;
- notifications croisées d’assignation ;
- demande de clôture vers Direction + retour au demandeur ;
- comptes rendus membre/admin adaptés ;
- documents membre liés à un projet accessible ;
- bouton ↻ d’actualisation équipe ;
- Anne-Sophie sélectionnable avant création de son accès.

Après remplacement : Ctrl + F5.

`src/remote-sync.js` reste basé sur la V12.2 stable ; seul le transport des notifications croisées a été rendu compatible RLS.
