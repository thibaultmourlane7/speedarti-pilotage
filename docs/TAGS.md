# Référentiel des balises — SpeedArti Pilotage

Les balises sont **internes et invisibles dans l’interface utilisateur**. Elles servent au diagnostic, aux logs et à la traçabilité. Une balise existante n’est jamais recyclée.

## Règles permanentes

1. Une nouvelle fonction importante reçoit une balise stable avant intégration.
2. Une erreur technique doit conserver la balise de la fonction concernée.
3. Les balises ne sont jamais rendues dans l’interface finale.
4. Les secrets serveur ne sont jamais placés dans le frontend.
5. `service_role` est interdite dans le navigateur ; seule une clé Supabase **publishable** peut être exposée côté client.

## Registre

| Balise | Fonction | Fichier principal | Statut |
|---|---|---|---|
| `PILOT-DEMO-001` | Données mockées locales | `src/data.js` | Actif |
| `PILOT-DEMO-002` | Persistance locale | `src/state.js` | Actif, transition Supabase |
| `PILOT-DEMO-004` | Export sauvegarde locale | `src/app.js` | Actif |
| `PILOT-DEMO-005` | Restauration sauvegarde locale | `src/app.js` | Actif |
| `PILOT-UI-001` | Navigation desktop | `src/app.js` | Actif |
| `PILOT-UI-002` | Navigation mobile | `src/app.js` | Actif |
| `PILOT-UI-004` | Drawer notifications | `src/app.js` | Actif |
| `PILOT-UI-005` | Fenêtre planification | `src/app.js` | Actif |
| `PILOT-UI-006` | Recherche globale | `src/app.js` | Actif |
| `PILOT-UI-010` | Système de code couleur | `src/styles.css` | Actif |
| `PILOT-UI-011` | Ajout rapide tâche | `src/app.js` | Actif |
| `PILOT-UI-012` | Création projet | `src/app.js` | Actif |
| `PILOT-UI-013` | Filtres projets | `src/app.js` | Actif |
| `PILOT-UI-014` | Filtres Roadmap | `src/app.js` | Actif |
| `PILOT-UI-015` | Filtres activité | `src/app.js` | Actif |
| `PILOT-UI-016` | Filtres notifications | `src/app.js` | Actif |
| `PILOT-UI-017` | Simulation IA | `src/app.js` | Actif |
| `PILOT-UI-018` | Sélecteur responsable | `src/app.js` | Actif |
| `PILOT-UI-019` | Éditeur tâche | `src/app.js` | Actif |
| `PILOT-UI-020` | Éditeur projet | `src/app.js` | Actif |
| `PILOT-UI-021` | Vues Agenda | `src/app.js` | Actif |
| `PILOT-UI-022` | Filtres Documents | `src/app.js` | Actif |
| `PILOT-UI-023` | Liaison document Drive | `src/app.js` | Actif |
| `PILOT-UI-024` | Roadmap mobile | `src/app.js` | Actif |
| `PILOT-UI-025` | Validation humaine | `src/app.js` | Actif |
| `PILOT-UI-026` | Alertes du jour | `src/app.js` | Actif |
| `PILOT-UI-027` | Actions rapides | `src/app.js` | Actif |
| `PILOT-UI-028` | Équipe → Roadmap | `src/app.js` | Actif |
| `PILOT-UI-029` | Recherche activité | `src/app.js` | Actif |
| `PILOT-UI-031` | Recherche globale enrichie | `src/app.js` | Actif |
| `PILOT-UI-032` | Modale archivage | `src/app.js` | Actif |
| `PILOT-UI-033` | Charge équipe | `src/app.js` | Actif |
| `PILOT-UI-034` | Modale compte rendu | `src/app.js` | Actif |
| `PILOT-UI-035` | Filtres comptes rendus | `src/app.js` | Actif |
| `PILOT-UI-036` | Mobile comptes rendus | `src/styles.css` | Actif |
| `PILOT-UI-037` | Contrôles non trompeurs | `src/app.js` | Actif |
| `PILOT-UI-038` | Actions tâches mobile | `src/styles.css` | Actif |
| `PILOT-TASK-001` | Création tâche | `src/app.js` | Actif |
| `PILOT-TASK-002` | Modification tâche | `src/app.js` | Actif |
| `PILOT-TASK-003` | Assignation tâche | `src/app.js` | Actif |
| `PILOT-TASK-004` | Date / échéance tâche | `src/app.js` | Actif |
| `PILOT-TASK-005` | Statut rapide tâche | `src/app.js` | Actif |
| `PILOT-TASK-006` | Report tâche | `src/app.js` | Actif |
| `PILOT-TASK-007` | Terminer / rouvrir tâche | `src/app.js` | Actif |
| `PILOT-PLAN-001` | Détection besoin planification | API / app | Actif |
| `PILOT-PLAN-002` | État À planifier | API / app | Actif |
| `PILOT-PLAN-003` | Ouverture planification | `src/app.js` | Actif |
| `PILOT-PLAN-004` | Confirmation planification | `src/app.js` | Actif |
| `PILOT-PLAN-005` | Déplacement Roadmap | `src/app.js` | Actif |
| `PILOT-PROJ-001` | Création projet | `src/app.js` | Actif |
| `PILOT-PROJ-002` | Modification projet | `src/app.js` | Actif |
| `PILOT-PROJ-003` | Responsable projet | `src/app.js` | Actif |
| `PILOT-PROJ-004` | Progression projet | `src/app.js` | Actif |
| `PILOT-PROJ-005` | Demande de clôture | `src/app.js` | Actif |
| `PILOT-PROJ-006` | Validation clôture | `src/app.js` | Actif |
| `PILOT-PROJ-007` | Refus clôture | `src/app.js` | Actif |
| `PILOT-PROJ-008` | Archivage projet | `src/app.js` | Actif |
| `PILOT-PROJ-009` | Restauration projet | `src/app.js` | Actif |
| `PILOT-PROJ-010` | Lever blocage | `src/app.js` | Actif |
| `PILOT-PROJ-011` | Filtre projets bloqués | `src/app.js` | Actif |
| `PILOT-ACT-001` | Ajout activité | `src/app.js` | Actif |
| `PILOT-NOTIF-001` | Création notification | `src/app.js` | Actif |
| `PILOT-NOTIF-002` | Lecture notification | `src/app.js` | Actif |
| `PILOT-NOTIF-004` | Erreur technique | `src/app.js` | Actif |
| `PILOT-NOTIF-005` | Élément à planifier | `src/app.js` | Actif |
| `PILOT-NOTIF-006` | Validation requise | `src/app.js` | Actif |
| `PILOT-NOTIF-007` | Échéance dépassée | `src/app.js` | Actif |
| `PILOT-NOTIF-008` | Blocage | `src/app.js` | Actif |
| `PILOT-NOTIF-009` | Résolution notification | `src/app.js` | Actif |
| `PILOT-NOTIF-010` | Déduplication notification | `src/app.js` | Actif |
| `PILOT-NOTIF-011` | Tout marquer lu | `src/app.js` | Actif |
| `PILOT-NOTIF-012` | Réessai technique | `src/app.js` | Actif |
| `PILOT-AI-009` | Réception mise à jour IA | `src/app.js` | Actif |
| `PILOT-AI-011` | Traitement mise à jour IA | `src/app.js` | Actif |
| `PILOT-AI-012` | Progression IA | `src/app.js` | Actif |
| `PILOT-AI-013` | Blocage IA | `src/app.js` | Actif |
| `PILOT-AI-014` | Proposition clôture IA | `src/app.js` | Actif |
| `PILOT-AI-015` | Erreur IA | `src/app.js` | Actif |
| `PILOT-AI-016` | Déduplication requête IA | `src/app.js` | Actif |
| `PILOT-AI-017` | Registre multi-IA | `src/app.js` | Actif |
| `PILOT-DRIVE-001` | Référence Drive | `src/app.js` | Actif |
| `PILOT-REPORT-001` | Collecte quotidienne IA | `src/app.js` | Actif |
| `PILOT-REPORT-002` | Ajout manuel compte rendu | `src/app.js` | Actif |
| `PILOT-REPORT-003` | Modification compte rendu | `src/app.js` | Actif |
| `PILOT-REPORT-004` | Validation compte rendu | `src/app.js` | Actif |
| `PILOT-REPORT-005` | Consolidation multi-source | `src/app.js` | Actif |
| `PILOT-REPORT-006` | Collecte multi-IA | `src/app.js` | Actif |
| `PILOT-REPORT-007` | Préselection personne | `src/app.js` | Actif |
| `PILOT-AUTH-001` | Écran / garde d’authentification | `src/auth.js` | Actif V11 |
| `PILOT-AUTH-002` | Connexion e-mail / mot de passe | `src/auth.js` | Actif V11 |
| `PILOT-AUTH-003` | Création d’un accès autorisé | `src/auth.js` | Actif V11 |
| `PILOT-AUTH-004` | Session Supabase | `src/auth.js` | Actif V11 |
| `PILOT-AUTH-005` | Déconnexion | `src/auth.js` | Actif V11 |
| `PILOT-AUTH-006` | Chargement du profil / rôle | `src/auth.js` | Actif V11 |
| `PILOT-SEC-001` | Configuration publique Supabase | `src/supabase-config.js` | Actif V11 |

## V11 — Auth Supabase

- L’application n’est chargée qu’après une session Supabase valide.
- Les adresses autorisées sont contrôlées **uniquement côté serveur** dans Supabase ; elles ne sont pas publiées dans le dépôt GitHub.
- Le profil (`admin` / `member`) est chargé depuis `public.profiles`.
- La clé utilisée dans le navigateur est une **publishable key**, jamais une clé serveur.
- Les données métier restent encore dans `localStorage` pendant cette étape, avec un stockage séparé par utilisateur authentifié.
- Le prochain lot remplacera progressivement cette persistance locale par les tables Supabase déjà créées.
