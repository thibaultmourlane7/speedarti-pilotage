# Installation V18 — Google Drive + Google Agenda

## État sur le projet Supabase actuel

Les migrations de fondation et de sécurisation V18 ont déjà été appliquées au projet `veovtygcolfsrjocrhsf`. Elles sont fournies ici pour conserver GitHub comme source de vérité documentaire.

## 1. Fichiers frontend

Remplacer les fichiers complets suivants par ceux de ce lot :

- `index.html`
- `src/app.js`
- `src/app.bundle.js`
- `src/remote-sync.js`
- `src/styles.css`
- `src/tags.js`

Ajouter :

- `src/google-integrations.js`

Ne pas supprimer les autres fichiers existants.

## 2. Google Cloud

Créer ou utiliser un projet Google Cloud dédié à SpeedArti Pilotage et activer :

- Google Drive API
- Google Calendar API

Configurer l'écran de consentement OAuth, puis créer un client OAuth de type **Application Web**.

URI de redirection à déclarer :

`https://veovtygcolfsrjocrhsf.supabase.co/functions/v1/pilotage-google/callback`

Ajouter également le domaine réel de Pilotage dans les origines autorisées du client OAuth.

## 3. Secrets Supabase

Configurer exclusivement dans les secrets Supabase :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

`GOOGLE_TOKEN_ENCRYPTION_KEY` doit être une valeur aléatoire longue et privée. Ne jamais la placer dans GitHub.

## 4. Edge Function

Déployer :

- `supabase/functions/pilotage-google/index.ts`

La fonction doit accepter le callback OAuth Google, donc son authentification Supabase native ne doit pas bloquer les requêtes GET du callback. L'Edge Function contrôle elle-même les JWT pour les actions applicatives.

## 5. Tests obligatoires avant validation

1. Se connecter avec Thibault.
2. Ouvrir Documents > Connecter Google.
3. Choisir un dossier Drive racine.
4. Vérifier que seuls ce dossier et ses sous-dossiers apparaissent après synchronisation.
5. Rattacher un fichier synchronisé à un projet.
6. Ouvrir Agenda > Actualiser les agendas.
7. Sélectionner un ou plusieurs agendas et choisir explicitement ceux visibles par l'équipe.
8. Synchroniser les événements.
9. Associer un événement à un projet/tâche.
10. Refaire les tests avec Anne-Sophie puis Guillaume.

Ne passer les tâches V18 en `completed` qu'après ces tests réels.