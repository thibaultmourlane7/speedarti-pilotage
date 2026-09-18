# Hotfix V12.1 — écran blanc

## Cause identifiée
`src/auth.js` V12 utilisait un `MutationObserver` qui rappelait `patchLiveUi()` à chaque modification de l'interface.
`patchLiveUi()` réécrivait à chaque fois le texte de l'avatar et du titre, ce qui déclenchait une nouvelle mutation.
Le navigateur pouvait donc entrer dans une boucle de mutations continue après le chargement de l'application.

## Correction
Remplacer **uniquement** :
- `src/auth.js`

Aucun changement Supabase ou base de données n'est nécessaire.

La correction :
- rend `patchLiveUi()` idempotente ;
- regroupe les appels de l'observateur ;
- évite de réécrire le DOM quand la valeur est déjà correcte ;
- affiche une erreur lisible si `app.bundle.js` se charge mais ne rend rien.
