# Référentiel des balises — SpeedArti Pilotage

Les balises sont internes et invisibles. Une balise existante n'est jamais recyclée.

## V12 — Supabase comme source structurée centrale

| ID | Fonction | Fichier / zone | Statut |
|---|---|---|---|
| `PILOT-SUPA-001` | Hydratation de l'état de l'application depuis Supabase avant chargement de la V10 | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-002` | Détection des différences locales et synchronisation uniquement des éléments modifiés | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-003` | Synchronisation projets + membres projet | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-004` | Synchronisation tâches / planning / dates / statuts | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-005` | Synchronisation append-only de l'activité | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-006` | Synchronisation notifications : lecture, résolution, regroupement | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-007` | Synchronisation comptes rendus et liens projets | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-008` | Synchronisation références de documents | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-009` | Synchronisation registre IA + requêtes IA | `src/remote-sync.js` | Actif |
| `PILOT-SUPA-010` | Reprise automatique d'une synchro interrompue grâce au cache local temporaire | `src/remote-sync.js` | Actif |
| `PILOT-TEAM-001` | Répertoire central Thibault / Anne-Sophie / Guillaume indépendant du compte Auth | Supabase + `remote-sync.js` | Actif |
| `PILOT-UI-039` | Adaptation de la session visible au membre réellement connecté | `src/auth.js` | Actif |
| `PILOT-SEC-001` | URL + clé publishable Supabase uniquement | `src/supabase-config.js` | Actif |

## Règles V12

- **Supabase devient la source structurée centrale** pour les projets, membres, tâches, validations, notifications, activité, références documentaires, agents IA, requêtes IA et comptes rendus.
- L'interface V10 n'est pas refondue : elle continue à manipuler son état en mémoire, tandis que `remote-sync.js` transforme et synchronise uniquement les éléments modifiés.
- `localStorage` n'est plus la source de vérité métier. Il sert uniquement de cache d'interface et de filet de reprise si une synchronisation réseau est interrompue.
- Au démarrage, les données Supabase remplacent les anciennes données mockées locales.
- Les rendez-vous Google mockés sont supprimés de la V12 ; l'agenda réel sera branché séparément.
- Les trois personnes existent dans `team_members` même avant la création de leur compte Auth. Lors de la première inscription autorisée, Supabase relie automatiquement le compte au bon membre.
- Les agents IA sont liés aux membres, pas aux conversations privées. Aucune conversation privée d'un agent n'est stockée ou partagée.
- Les IDs UI restent stables via `client_key`, tandis que les relations SQL utilisent des UUID internes.
- Aucune clé `service_role` n'est utilisée dans le navigateur. Le frontend utilise uniquement la clé Supabase publishable et les règles RLS.
- Les modifications sont envoyées dans l'ordre des dépendances : projet → agent → tâche → validation → notification / activité / document / requête IA → compte rendu.
- Les éléments non modifiés ne sont pas réécrits, ce qui réduit les risques d'écrasement entre membres.
- Une synchronisation non terminée est conservée temporairement sur l'appareil et rejouée à la prochaine session.

## Balises antérieures conservées

Toutes les balises V1 à V11 déjà présentes restent réservées à leur fonction historique et ne doivent pas être recyclées.


## V13 — Passage production

| Balise | Fonction | Zone | Statut |
|---|---|---|---|
| `PILOT-UI-040` | Horloge réelle : Aujourd’hui, Agenda, comptes rendus, report de tâche | `src/app.js` | Actif V13 |
| `PILOT-SEC-002` | Mode production : contrôles de démo retirés de l’interface | `src/app.js` | Actif V13 |
| `PILOT-PROJ-012` | Clôture officielle projet réservée à l’admin | Supabase RLS | Actif V13 |
| `PILOT-REPORT-008` | Brouillon éditable par son auteur ; validation finale admin | Supabase RLS | Actif V13 |
| `PILOT-SUPA-011` | `tasks.sort_order` en `bigint` pour accepter `Date.now()` | Supabase | Actif V13 |
| `PILOT-AUTH-007` | Contrôle Pwned Passwords par k-anonymity avant inscription | `src/auth.js` | Actif V13 |

### Règles V13

- Supabase reste la source de vérité métier ; `localStorage` reste uniquement un cache/reprise.
- Les dates opérationnelles proviennent de l’horloge locale de l’utilisateur, plus d’une date de démonstration figée.
- Les commandes visibles de simulation IA, réinitialisation et sauvegarde/restauration de démo sont retirées de l’interface de production.
- La clôture officielle d’un projet et la validation finale d’un compte rendu sont protégées côté base, pas seulement côté interface.
- Le contrôle Pwned Passwords calcule SHA-1 localement et n’envoie que les 5 premiers caractères du hash à l’API de plage HIBP ; le mot de passe et son hash complet ne sont jamais transmis.

## V14 — Multi-utilisateur réel

| Balise | Fonction | Zone | Statut |
|---|---|---|---|
| `PILOT-PROJ-013` | Membres multiples d’un projet, responsable toujours inclus | `src/app.js` + `project_members` | Actif V14 |
| `PILOT-UI-041` | Multi-sélection des participants projet réservée à l’admin | `src/app.js` | Actif V14 |
| `PILOT-UI-042` | Interface adaptée au rôle réel admin / membre | `src/app.js` | Actif V14 |
| `PILOT-SUPA-012` | Actualisation manuelle des changements équipe via le bouton ↻ | `src/app.js` + V12.2 | Actif V14 |
| `PILOT-TASK-008` | Une tâche de projet doit être assignée à un participant du projet | UI + trigger Supabase | Actif V14 |
| `PILOT-NOTIF-013` | Notification croisée lors d’une assignation de tâche | UI + RLS Supabase | Actif V14 |
| `PILOT-NOTIF-014` | Retour au demandeur après décision de clôture | UI + RLS Supabase | Actif V14 |
| `PILOT-NOTIF-015` | Chaque membre n’affiche et ne traite que ses notifications | `src/app.js` + RLS | Actif V14 |
| `PILOT-REPORT-009` | Un membre saisit/édite uniquement son compte rendu ; admin garde la vue équipe | `src/app.js` + RLS | Actif V14 |
| `PILOT-DRIVE-002` | Un membre rattache un document à un projet accessible | `src/app.js` + RLS | Actif V14 |

### Règles V14

- Responsable unique + participants multiples.
- Thibault/admin peut sélectionner 1, 2 ou 3 membres sur un projet.
- Le responsable est toujours inclus.
- Anne-Sophie peut être ajoutée avant la création de son compte.
- Guillaume conserve création/modification des tâches et planification sur les projets accessibles.
- Une tâche de projet ne peut être assignée qu’à un participant du projet.
- Un membre non-admin ne modifie pas la composition de l’équipe projet.
- Les demandes de clôture sont envoyées à la Direction ; la décision revient au demandeur.
- Les notifications croisées restent privées : chaque membre n’affiche et ne traite que ses propres notifications.
- Les validations finales de projet et de compte rendu restent réservées à l’admin.
- Un membre voit/saisit son propre compte rendu ; la Direction conserve la synthèse équipe.
- Un membre rattache un document à un projet accessible.
- Le bouton ↻ récupère immédiatement les changements faits par un autre utilisateur.
- Supabase reste la source de vérité et les protections V13 restent actives.


## V15 — ChatGPT Pilotage

| Balise | Fonction | Zone | Statut |
|---|---|---|---|
| `PILOT-AI-018` | Interface conversationnelle ChatGPT Pilotage | `src/app.js` | Actif V15 |
| `PILOT-AI-019` | Requête authentifiée vers l’Edge Function `pilotage-chatgpt` | Frontend + Supabase Edge | Actif V15 |
| `PILOT-AI-020` | Exécution structurée des outils IA et journalisation | Supabase Edge + tables métier | Actif V15 |
| `PILOT-AI-021` | Garde humaine obligatoire pour la clôture projet | Edge Function + `change_requests` | Actif V15 |
| `PILOT-AI-022` | Création d’un compte rendu IA uniquement en brouillon | Edge Function + `daily_reports` | Actif V15 |
| `PILOT-AI-023` | Limite de fréquence par agent IA | Edge Function + `ai_requests` | Actif V15 |
| `PILOT-UI-043` | Page ChatGPT intégrée à la navigation Pilotage | `src/app.js` | Actif V15 |

### Architecture V15

- Le navigateur n’appelle jamais OpenAI directement.
- Le frontend appelle l’Edge Function Supabase authentifiée `pilotage-chatgpt`.
- La fonction utilise le JWT Supabase du membre connecté : les lectures et écritures restent soumises aux RLS.
- La clé `OPENAI_API_KEY` doit exister uniquement dans les secrets de l’Edge Function Supabase.
- Le modèle par défaut est `gpt-5.6` et peut être remplacé côté serveur par le secret `OPENAI_MODEL`.
- ChatGPT reçoit uniquement le contexte Pilotage accessible à l’utilisateur : projets, tâches, équipe, activité, validations et comptes rendus.
- Les outils disponibles sont : création/modification de tâche, mise à jour non critique d’un projet, demande de clôture et brouillon de compte rendu.
- ChatGPT ne peut pas modifier les rôles, les accès, les participants projet ni valider définitivement une clôture ou un compte rendu.
- Chaque requête est enregistrée dans `ai_requests`; les actions métier alimentent également l’activité.
- La limite serveur est de 12 requêtes par minute et par agent.
- `store:false` est utilisé pour les appels OpenAI de ce lot.


## V16 — Remontées multi-IA

| Balise | Fonction | Zone | Statut |
|---|---|---|---|
| `PILOT-AI-024` | Réception structurée d’un événement envoyé par une IA externe | Edge Function `pilotage-ai-ingest` + `ai_events` | Actif V16 |
| `PILOT-AI-025` | Journalisation de l’événement dans l’activité Pilotage | Edge Function + `activity_log` | Actif V16 |
| `PILOT-AI-026` | Consolidation automatique dans un compte rendu quotidien brouillon | Edge Function + `daily_reports` | Actif V16 |
| `PILOT-AI-027` | Idempotence par `event_id` pour éviter les doublons | Edge Function + contrainte unique | Actif V16 |
| `PILOT-SEC-003` | Authentification de chaque agent par jeton Bearer distinct, stocké haché | `ai_agent_tokens` + Edge Function | Actif V16 |
| `PILOT-UI-044` | État des sources IA et flux du jour dans Comptes rendus | `src/app.js` | Actif V16 |
| `PILOT-SUPA-013` | Chargement des événements IA récents depuis Supabase | `src/remote-sync.js` | Actif V16 |

### Règles V16

- Chaque IA externe possède son propre jeton d’ingestion.
- Le jeton en clair n’est jamais stocké dans GitHub ni dans la base ; seul son SHA-256 est conservé.
- Une IA ne peut remonter que pour la personne à laquelle son agent est rattaché.
- Hors compte Direction, un agent ne peut associer un événement qu’à un projet accessible à son membre.
- `task_completed` peut terminer une tâche existante identifiée exactement par son `client_key`.
- Une donnée critique manquante n’est jamais devinée : projet/tâche inconnus = rejet explicite.
- Chaque événement alimente l’activité et le compte rendu IA du jour en brouillon.
- Un compte rendu déjà validé n’est jamais réouvert : un complément séparé est créé.
- Les événements sont idempotents grâce à `event_id`.


## V16.1 — Passerelle MCP Claude

| Balise | Fonction | Zone | Statut |
|---|---|---|---|
| `PILOT-MCP-001` | Serveur MCP distant SpeedArti Pilotage | Edge Function `pilotage-mcp` | Actif V16.1 |
| `PILOT-MCP-002` | Lecture du contexte projets/tâches accessibles au membre lié à l’IA | Outil MCP `listPilotageContext` | Actif V16.1 |
| `PILOT-MCP-003` | Remontée structurée d’un événement métier vers V16 | Outil MCP `reportPilotageEvent` | Actif V16.1 |
| `PILOT-SEC-004` | Authentification du connecteur MCP par jeton agent distinct | URL privée / Bearer + `ai_agent_tokens` | Actif V16.1 |
| `PILOT-SUPA-014` | Autorise les sources détaillées `chatgpt`, `claude`, `other_ai` dans les comptes rendus | `daily_reports` | Actif V16.1 |

### Règles V16.1

- Le serveur MCP est public sur Internet mais chaque connecteur est protégé par un jeton agent privé.
- Le jeton n’est jamais stocké en clair dans GitHub ou dans la base.
- Le serveur déduit automatiquement l’identité de l’agent à partir du jeton : Claude Anne-Sophie ne peut pas se présenter comme une autre IA.
- `listPilotageContext` expose uniquement les projets et tâches accessibles au membre lié à l’agent.
- Claude doit utiliser `listPilotageContext` avant de renseigner un identifiant de projet ou de tâche.
- `reportPilotageEvent` réutilise la passerelle V16 `pilotage-ai-ingest` et ses contrôles métier.
- La connexion Claude reste à valider depuis le compte d’Anne-Sophie après ajout du connecteur.
