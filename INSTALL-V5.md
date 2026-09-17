# SpeedArti Pilotage — V5 batch

## Fichiers à remplacer sur GitHub

Remplacer uniquement :

- `src/app.js`
- `src/app.bundle.js`
- `src/styles.css`
- `src/tags.js`
- `docs/TAGS.md`

Ne pas modifier :

- `index.html`
- `src/data.js`
- `src/state.js`

## V5 — améliorations regroupées

1. Assignation des tâches par choix visuels cliquables Thibault / Anne-Sophie / Guillaume.
2. Modification d'une tâche existante depuis Aujourd'hui, un projet, la Roadmap ou la recherche.
3. Modification du responsable, priorité, état, projet, période Roadmap, jour prévu et échéance.
4. Planification / déplacement d'une tâche avec changement de responsable et dates.
5. Édition complète d'un projet : responsable, statut, priorité, progression, blocage, prochaine action.
6. Roadmap mobile : choix explicite de la période + bouton Déplacer / dater, sans dépendre du drag-and-drop.
7. Agenda fonctionnel : Aujourd'hui / Semaine / Mois, avec Google Calendar, tâches planifiées et échéances.
8. Documents : recherche, filtre projet et ajout d'une référence Google Drive.
9. Recherche globale : un résultat tâche ouvre maintenant directement l'éditeur de tâche.
10. Balises techniques V5 ajoutées au registre et invisibles dans l'interface.

## Important

La V5 reste une démo locale : les données sont stockées dans `localStorage`. Supabase, Google Calendar et Google Drive réels ne sont pas encore connectés.
