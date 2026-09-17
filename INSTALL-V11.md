# SpeedArti Pilotage — V11 Auth Supabase

## Objectif

Brancher l'authentification Supabase sur la V10 **sans modifier encore les données métier**.

## À remplacer / ajouter manuellement sur GitHub

### Remplacer
- `index.html`
- `src/tags.js`
- `docs/TAGS.md`

### Ajouter
- `src/supabase-config.js`
- `src/auth.js`
- `src/auth.css`

### Ne pas modifier
- `src/app.js`
- `src/app.bundle.js`
- `src/styles.css`
- `src/data.js`
- `src/state.js`

## Premier accès

Chaque membre utilise **son adresse e-mail déjà autorisée côté Supabase**. Les adresses ne sont volontairement pas écrites dans le dépôt GitHub public.

Cliquer sur **Première connexion ? Créer mon accès**, choisir un mot de passe de 8 caractères minimum, puis suivre l'e-mail de confirmation Supabase si celui-ci est demandé.

## Important

Cette V11 protège l'accès avec Supabase Auth, mais les projets / tâches / comptes rendus sont encore conservés localement sur le navigateur. L'écran Compte l'indique explicitement. La migration des données vers Supabase arrive au lot suivant.
