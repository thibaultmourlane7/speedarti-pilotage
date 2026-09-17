# SpeedArti Pilotage — Installation V9

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

## Nouveauté principale V9 — Comptes rendus quotidiens

La V9 ajoute un module distinct **Comptes rendus** en plus du journal **Activité**.

Fonctions :

- un mini compte rendu par jour et par personne ;
- source IA ou ajout manuel ;
- simulation de la future collecte automatique ChatGPT / Claude ;
- ajout manuel si un compte rendu manque ;
- correction d'un compte rendu IA ou manuel ;
- validation humaine ;
- réalisations, blocages et prochaines étapes ;
- projets liés ;
- synthèse équipe consolidée ;
- compteur `x/3` reçu et nombre de comptes rendus validés ;
- accès depuis Aujourd'hui, le menu principal, Plus, Actions rapides et la recherche globale ;
- création / modification / validation enregistrées dans l'historique d'activité.

## Principe futur après Supabase

Chaque agent IA enverra une mise à jour structurée vers Pilotage. Les agents ne liront jamais leurs conversations respectives. Supabase conservera ensuite ces comptes rendus de manière centralisée et persistante.


## Correctif multi-IA intégré

Cette V9 prend en charge plusieurs IA par personne. Les comptes rendus sont conservés par source puis consolidés par personne/journée. Anne-Sophie peut avoir Claude + ChatGPT ; le registre peut accueillir d'autres agents (notamment marketing pour Guillaume) sans changer le modèle.
