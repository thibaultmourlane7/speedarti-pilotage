# Référentiel des balises — SpeedArti Pilotage Démo

Les balises sont **internes et invisibles dans l'interface utilisateur**. Elles servent au diagnostic, aux logs et à la traçabilité.

| Balise | Fonction | Fichier principal | Visible UI |
|---|---|---|---|
| `PILOT-DEMO-001` | Données mockées locales | `src/data.js` | Non |
| `PILOT-DEMO-002` | Persistance locale | `src/state.js` | Non |
| `PILOT-UI-001` | Navigation desktop | `src/app.js` | Non |
| `PILOT-UI-002` | Navigation mobile | `src/app.js` | Non |
| `PILOT-UI-004` | Drawer notifications | `src/app.js` | Non |
| `PILOT-UI-005` | Fenêtre planification | `src/app.js` | Non |
| `PILOT-UI-006` | Recherche globale | `src/app.js` | Non |
| `PILOT-TASK-007` | Terminer / rouvrir une tâche | `src/app.js` | Non |
| `PILOT-PLAN-001` | Détection besoin planification | future API | Non |
| `PILOT-PLAN-002` | État À planifier | future API | Non |
| `PILOT-PLAN-003` | Ouverture fenêtre planification | `src/app.js` | Non |
| `PILOT-PLAN-004` | Confirmation planification | `src/app.js` | Non |
| `PILOT-PLAN-005` | Déplacement Roadmap | `src/app.js` | Non |
| `PILOT-ACT-001` | Ajout activité | `src/app.js` | Non |
| `PILOT-NOTIF-002` | Lecture notification | future logique | Non |
| `PILOT-NOTIF-009` | Résolution notification | `src/app.js` | Non |

## Règles permanentes

1. Une balise existante n'est jamais recyclée pour une autre fonction.
2. Toute nouvelle fonction importante reçoit une balise avant intégration.
3. Une erreur technique doit enregistrer la balise de la fonction concernée.
4. Les balises ne sont jamais rendues dans les composants visuels finaux.


### PILOT-UI-010 — Système de code couleur visuel V2
Palette, statuts, priorités, roadmap, notifications, agenda et documents. Invisible dans l’interface comme balise technique.


## V3 — Actions manuelles et filtres

| Balise | Fonction | Visible UI |
|---|---|---|
| `PILOT-TASK-001` | Création manuelle d’une tâche | Non |
| `PILOT-PROJ-001` | Création manuelle d’un projet | Non |
| `PILOT-UI-011` | Fenêtre d’ajout rapide d’une tâche | Non |
| `PILOT-UI-012` | Fenêtre de création d’un projet | Non |
| `PILOT-UI-013` | Filtrage de la liste des projets | Non |
| `PILOT-UI-014` | Filtres de la Roadmap | Non |
| `PILOT-UI-015` | Filtres du journal d’activité | Non |
| `PILOT-UI-016` | Filtres du centre de notifications | Non |

Ces balises restent strictement internes et ne doivent jamais être affichées dans l’interface finale.


## V4 — Flux IA vers la Roadmap

| Balise | Fonction | Visible UI |
|---|---|---|
| `PILOT-UI-017` | Fenêtre de simulation d’une mise à jour IA | Non (balise) |
| `PILOT-AI-009` | Réception d’une mise à jour ChatGPT / Claude | Non |
| `PILOT-AI-011` | Transformation de la mise à jour IA en donnée Pilotage | Non |
| `PILOT-PLAN-001` | Détection qu’un nouvel élément nécessite une planification | Non |
| `PILOT-NOTIF-005` | Notification « nouvel élément à planifier » | Non |

### Scénario V4

1. Une mise à jour ChatGPT ou Claude est simulée.
2. Le nouvel élément est créé avec `planningStatus = unplanned` et `needsPlanning = true`.
3. Une notification de planification est créée.
4. Si Pilotage est ouvert, la fenêtre « Planifier cette tâche » s’ouvre immédiatement.
5. L’IA peut suggérer une période mais Thibault choisit la période officielle.
6. Si la fenêtre est annulée, l’élément reste « À organiser » et la notification reste active.

Dans la vraie version, la simulation sera remplacée par l’API sécurisée sans modifier ce comportement fonctionnel.
