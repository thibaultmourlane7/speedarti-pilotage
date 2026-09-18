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
