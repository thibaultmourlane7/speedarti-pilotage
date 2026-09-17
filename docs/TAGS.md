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

## V5 — Édition rapide, assignation et pilotage opérationnel

| Balise | Fonction | Visible UI |
|---|---|---|
| `PILOT-TASK-002` | Modifier une tâche existante | Non |
| `PILOT-TASK-003` | Affecter / réaffecter une tâche | Non |
| `PILOT-TASK-004` | Jour prévu / échéance d’une tâche | Non |
| `PILOT-PROJ-002` | Modifier un projet | Non |
| `PILOT-PROJ-003` | Changer le responsable d’un projet | Non |
| `PILOT-PROJ-004` | Modifier la progression d’un projet | Non |
| `PILOT-UI-018` | Sélecteur visuel de responsable | Non (balise) |
| `PILOT-UI-019` | Éditeur complet de tâche | Non (balise) |
| `PILOT-UI-020` | Éditeur complet de projet | Non (balise) |
| `PILOT-UI-021` | Vues Agenda Aujourd’hui / Semaine / Mois | Non (balise) |
| `PILOT-UI-022` | Recherche et filtre Documents | Non (balise) |
| `PILOT-UI-023` | Fenêtre de liaison Google Drive | Non (balise) |
| `PILOT-UI-024` | Action explicite Déplacer / dater sur Roadmap mobile | Non (balise) |
| `PILOT-DRIVE-001` | Ajouter une référence de document Drive | Non |

### Règle V5

L’assignation ne dépend plus d’un simple menu déroulant : Thibault, Anne-Sophie et Guillaume sont proposés sous forme de choix visuels cliquables. La valeur sélectionnée reste une donnée structurée interne (`assignedTo` / `owner`) et les balises restent invisibles dans l’interface.

## V6 — Validations humaines, alertes intelligentes et IA multi-scénarios

| Balise | Fonction | Visible UI |
|---|---|---|
| `PILOT-PROJ-005` | Créer une demande de passage d’un projet en Terminé | Non |
| `PILOT-PROJ-006` | Valider officiellement un projet comme Terminé | Non |
| `PILOT-PROJ-007` | Refuser une demande de clôture projet | Non |
| `PILOT-UI-025` | Fenêtre de validation humaine | Non (balise) |
| `PILOT-UI-026` | Synthèse visuelle des alertes du jour | Non (balise) |
| `PILOT-AI-012` | Appliquer automatiquement une progression IA routinière | Non |
| `PILOT-AI-013` | Enregistrer automatiquement un blocage signalé par IA | Non |
| `PILOT-AI-014` | Proposition IA de clôture projet | Non |
| `PILOT-AI-015` | Erreur technique lors d’un flux IA | Non |
| `PILOT-NOTIF-001` | Création d’une notification | Non |
| `PILOT-NOTIF-004` | Notification d’erreur technique | Non |
| `PILOT-NOTIF-006` | Notification de validation requise | Non |
| `PILOT-NOTIF-007` | Notification d’échéance dépassée | Non |
| `PILOT-NOTIF-008` | Notification de blocage | Non |
| `PILOT-NOTIF-010` | Regroupement / déduplication des notifications | Non |

### Règles V6

- Une progression de projet peut être mise à jour automatiquement par un agent IA.
- Un blocage opérationnel peut être enregistré automatiquement, avec alerte visible.
- Un agent IA ne peut jamais passer directement un projet en `completed` : une demande de validation est créée.
- Le passage officiel en `completed` est séparé du pourcentage de progression et nécessite une décision humaine.
- `read` / `readAt` signifie que la notification a été vue ; `resolved` / `resolvedAt` signifie que le problème ou l’action a réellement été traité.
- Les erreurs techniques identiques sont regroupées par `groupKey` pour éviter le spam ; un compteur conserve le nombre d’occurrences.
- Les échéances dépassées et blocages actifs génèrent au maximum une notification active par élément grâce à la déduplication.


## V7 — Gros lot productivité, recherche et robustesse de démo

| Balise | Fonction | Visible UI |
|---|---|---|
| `PILOT-UI-027` | Palette d’actions rapides « Créer » | Non (balise) |
| `PILOT-UI-028` | Raccourci Équipe → Roadmap filtrée par responsable | Non (balise) |
| `PILOT-UI-029` | Recherche + filtre projet dans l’activité | Non (balise) |
| `PILOT-UI-031` | Recherche globale enrichie | Non (balise) |
| `PILOT-TASK-005` | Changement rapide du statut d’une tâche | Non |
| `PILOT-NOTIF-011` | Marquer toutes les notifications actives comme lues | Non |
| `PILOT-AI-016` | Détection / rejet d’une requête IA dupliquée | Non |
| `PILOT-DEMO-004` | Export JSON de la sauvegarde locale de démo | Non |
| `PILOT-DEMO-005` | Restauration d’une sauvegarde locale de démo | Non |

### Règles V7

- Le bouton **Créer** centralise les actions fréquentes sans ajouter une nouvelle page principale.
- Les tâches peuvent passer rapidement de `todo` à `in_progress`, puis à `completed`, tout en conservant l’historique.
- La zone Équipe reste dans Aujourd’hui ; un clic ouvre la Roadmap directement filtrée sur la personne concernée.
- Le journal d’activité peut être filtré par personne, projet et texte, sans exposer les balises internes.
- Les notifications peuvent être marquées lues en masse sans être considérées comme résolues.
- Une requête IA déjà traitée est ignorée sans recréer de tâche ni de notification métier en double.
- Export / import JSON concerne uniquement la démo locale. En production, Supabase deviendra la source structurée centrale.
