# SpeedArti Pilotage — V10 contrôle humain final

Remplacer uniquement :

- `src/app.js`
- `src/app.bundle.js`
- `src/styles.css`
- `src/tags.js`
- `docs/TAGS.md`

Ne pas modifier `index.html`, `src/data.js` ni `src/state.js`.

## Corrections issues du test navigateur

- raccourci `+ Ajouter manuellement` d'un membre : la bonne personne est réellement préselectionnée ;
- filtre Projets `Bloqués` : inclut aussi un projet `in_progress` avec un blocage actif ;
- rendez-vous Google Calendar : plus de faux bouton sans action ;
- avatar : plus de faux bouton sans action ;
- erreur technique : `Réessayer (démo)` effectue une relance simulée tracée avant Supabase ;
- page Comptes rendus : suppression du débordement horizontal mobile ;
- actions de tâches mobile : `Démarrer` et `Reporter` restent entièrement accessibles ;
- libellé d'absence de compte rendu amélioré (`Aucune source reçue`).

## Contrôle final effectué

35 scénarios navigateur validés, 0 bug restant dans le périmètre de démo testé.
