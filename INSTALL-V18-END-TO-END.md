# Installation V18 — Google Drive + Google Agenda

## Principe

La V18 est ajoutée sans refondre ni remplacer les fichiers métier existants.

Le socle V10 à V16 reste intact. L'intégration Google est chargée comme un module additionnel.

## Fichiers ajoutés

- `src/google-integrations.js`
- `src/v18-google-ui.js`
- `supabase/functions/pilotage-google/index.ts`
- `supabase/functions/pilotage-google/deno.json`
- migrations V18 dans `supabase/migrations/`
- `V18-GOOGLE-DRIVE-CALENDAR.md`

## Fichiers existants modifiés

- `index.html` : charge les deux modules Google avant `auth.js`
- `src/tags.js` : ajoute les balises V18
- `docs/TAGS.md` : documente les balises V18

Aucun remplacement de `src/app.js`, `src/app.bundle.js`, `src/remote-sync.js` ou `src/styles.css` n'est nécessaire dans cette branche.

## Supabase

Les tables, RLS et structures Drive/Calendar sont déjà déployées sur le projet Pilotage.

L'Edge Function `pilotage-google` est déployée. Elle accepte le callback OAuth Google publiquement, mais toutes les actions applicatives POST vérifient elles-mêmes la session Supabase de l'utilisateur.

## Google Cloud à configurer

Activer :
- Google Drive API
- Google Calendar API

Créer un client OAuth Web.

URI de redirection :

`https://veovtygcolfsrjocrhsf.supabase.co/functions/v1/pilotage-google/callback`

Configurer uniquement dans les secrets Supabase :
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Ne jamais placer ces valeurs dans GitHub.

## Tests obligatoires avant merge sur main

1. Thibault connecte Google.
2. Drive : choisir un seul dossier racine et vérifier que seuls ses descendants remontent.
3. Drive : tester Mon Drive et, si disponible, un Drive partagé.
4. Drive : rattacher un fichier synchronisé à un projet.
5. Agenda : charger tous les agendas accessibles.
6. Agenda : sélectionner les agendas à synchroniser.
7. Agenda : tester le partage explicite d'un agenda avec l'équipe.
8. Agenda : synchroniser les événements.
9. Refaire la connexion et les contrôles avec Anne-Sophie.
10. Refaire la connexion et les contrôles avec Guillaume.

Ne passer V18 en terminé qu'après ces tests réels.
