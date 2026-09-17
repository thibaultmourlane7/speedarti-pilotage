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
