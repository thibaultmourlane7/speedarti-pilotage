# SpeedArti Pilotage — Installation V12

Cette V12 branche les données métier sur le projet Supabase **Pilotage d’entreprise** sans refondre l'interface V10.

## Fichiers à remplacer

- `index.html`
- `src/auth.js`
- `src/tags.js`
- `docs/TAGS.md`

## Fichier à ajouter

- `src/remote-sync.js`

## Fichiers à ne pas modifier

- `src/app.js`
- `src/app.bundle.js`
- `src/styles.css`
- `src/auth.css`
- `src/supabase-config.js`
- `src/data.js`
- `src/state.js`

## Après mise en ligne

1. Recharge complètement la page.
2. Connecte-toi avec le compte Thibault déjà créé.
3. L'application doit s'ouvrir avec une base métier vide (pas les anciens projets de démonstration).
4. Crée un projet puis une tâche.
5. Attends environ une seconde, ouvre l'avatar : l'état doit afficher **Données métier centralisées dans Supabase**.
6. Recharge la page : le projet et la tâche doivent toujours être présents. C'est le test principal V12.

Le bouton **Actualiser depuis Supabase** dans le menu du compte recharge les dernières données depuis la base centrale.

## Important

La V12 ne branche pas encore Google Calendar ni Google Drive réel. Les références de documents peuvent être enregistrées dans Supabase, mais la synchronisation Drive et Calendar viendra dans un lot dédié.
