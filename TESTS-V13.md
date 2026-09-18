# Tests V13 effectués

## Code
- `node --check` : OK sur `app.js`, `app.bundle.js`, `auth.js`, `remote-sync.js`, `state.js`, `data.js`, `tags.js`.
- aucune date opérationnelle `2026-09-17`, `2026-09-18` ou `2026-09-21` ne reste dans `app.js`.
- les contrôles visibles `IA démo`, `Réinitialiser la démo`, `Simuler collecte multi-IA`, import/export démo ont été retirés.

## Supabase
- `tasks.sort_order` accepte maintenant les entiers 64 bits produits par `Date.now()`.
- test admin : clôture directe d'un projet autorisée.
- simulation membre : création d'un projet normal autorisée.
- simulation membre : clôture directe d'un projet bloquée par RLS.
- simulation membre : création d'une demande de changement autorisée, décision finale bloquée.
- simulation membre : création d'un compte rendu brouillon autorisée, auto-validation bloquée.
- aucun enregistrement des tests RLS n'a été conservé (transactions annulées).

## Advisors
- sécurité : seul l'avertissement natif Supabase « Leaked Password Protection Disabled » reste, car l'option native exige un plan payant ; V13 ajoute le contrôle gratuit HIBP côté inscription.
- performance : les avertissements de policies permissives multiples et d'index dupliqués ont été supprimés. Les index encore indiqués comme « unused » sont conservés : la base est encore trop jeune/vide pour conclure qu'ils sont inutiles.
