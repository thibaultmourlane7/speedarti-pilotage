# SpeedArti Pilotage — Démo V1

Démo autonome du cockpit interne SpeedArti Pilotage.

## Objectif de cette version

Valider **l'interface et les comportements** avant toute connexion réelle à Supabase, Google Drive, Google Calendar, ChatGPT ou Claude.

Cette démo utilise uniquement :

- HTML ;
- CSS ;
- JavaScript ES Modules ;
- `localStorage` pour conserver les manipulations localement.

Aucune clé API et aucun secret ne sont nécessaires.

## Écrans inclus

- Aujourd'hui
- Planification / Roadmap
- Projets
- Agenda
- Documents
- Activité
- Centre de notifications
- Fenêtre « À planifier »
- Recherche globale
- Responsive mobile

## Fonctions testables

- navigation entre les 6 vues ;
- ouvrir une fiche projet ;
- terminer / rouvrir une tâche ;
- déplacer une tâche entre les colonnes de Roadmap par glisser-déposer ;
- positionner un nouvel élément depuis la fenêtre « À planifier » ;
- ouvrir et résoudre des notifications ;
- rechercher projet / tâche / document ;
- persistance locale de l'état de la démo ;
- réinitialisation de la démo.

## Balises invisibles

Le référentiel est dans :

`docs/TAGS.md`

Les balises sont écrites dans les logs console et ne sont jamais affichées dans l'interface utilisateur.

## Lancer localement

Les modules ES ont besoin d'un petit serveur HTTP.

Par exemple avec Python :

```bash
python3 -m http.server 8080
```

Puis ouvrir :

`http://localhost:8080`

## GitHub Pages

Le projet est volontairement statique pour cette phase de démonstration.

Une fois les fichiers déposés dans un dépôt GitHub, GitHub Pages peut servir directement la branche principale sans backend.

## Étape suivante après validation de la démo

1. figer les comportements validés ;
2. conserver le code réel GitHub comme source de vérité ;
3. remplacer progressivement les données mockées par Supabase ;
4. ajouter Auth + RLS ;
5. connecter l'API IA ;
6. connecter Google Calendar puis Google Drive.

Ne pas connecter Supabase avant validation fonctionnelle et visuelle de cette démo.
