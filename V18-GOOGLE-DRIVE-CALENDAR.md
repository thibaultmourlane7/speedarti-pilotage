# SpeedArti Pilotage — V18 Google Drive + Google Agenda

## Objectif

Connecter Pilotage à Google sans modifier les fonctions déjà validées. La V18 ajoute les intégrations à côté du socle V16/V16.1 existant.

## Google Drive

- Connexion OAuth par membre.
- Lecture seule par défaut.
- Choix d'un **seul dossier racine**.
- Synchronisation strictement limitée à ce dossier et à ses sous-dossiers.
- Support prévu pour Mon Drive et les Drives partagés.
- Les fichiers restent hébergés chez Google ; Pilotage conserve les métadonnées et le lien.
- Un fichier synchronisé peut être rattaché à un projet Pilotage sans le déplacer dans Google Drive.

## Google Agenda

- Connexion OAuth individuelle pour chaque membre.
- Récupération de tous les agendas accessibles au compte connecté.
- Sélection explicite des agendas à synchroniser.
- Lecture seule par défaut.
- Partage avec l'équipe uniquement lorsqu'il est activé pour l'agenda concerné.
- Les événements peuvent être rattachés à un projet et, si nécessaire, à une tâche Pilotage.

## Sécurité

Les jetons Google ne doivent jamais être stockés dans le navigateur ou GitHub. Ils sont chiffrés côté Edge Function avec `GOOGLE_TOKEN_ENCRYPTION_KEY`. La table `google_credentials` n'a aucune politique RLS d'accès direct côté client.

Balises principales : `PILOT-GOOGLE-001` à `PILOT-GOOGLE-010`.