# SpeedArti Pilotage — V16.2 ChatGPT OAuth

Date : 22/09/2026

## Objectif

Permettre à ChatGPT d’Anne-Sophie de se connecter à SpeedArti Pilotage sans exposer un token agent dans ChatGPT.

## Architecture retenue

- OAuth 2.1 natif de Supabase Auth.
- PKCE et enregistrement dynamique gérés par Supabase Auth.
- Le serveur MCP `pilotage-mcp` publie les métadonnées de ressource protégée attendues par ChatGPT.
- Un jeton OAuth est relié à l’utilisateur Supabase réel, puis à `team_members.profile_id`.
- L’agent OpenAI actif du membre est résolu côté serveur.
- La connexion OAuth ChatGPT est volontairement **lecture seule** pendant la première validation de bout en bout.
- Les outils OAuth exposés sont :
  - `getPilotageProfile`
  - `listPilotageContext`
- `reportPilotageEvent` reste disponible seulement via l’authentification historique par token agent, afin de ne pas casser le bridge Claude existant.
- `pilotage-mcp-v2` reste un proxy de compatibilité Claude et transmet maintenant aussi les métadonnées OAuth.

## Frontend

`src/auth.js` détecte `authorization_id` transmis par Supabase Auth et affiche un écran de consentement après authentification du membre Pilotage.

Le consentement utilise :
- `supabase.auth.oauth.getAuthorizationDetails()`
- `supabase.auth.oauth.approveAuthorization()`
- `supabase.auth.oauth.denyAuthorization()`

## Configuration manuelle Supabase encore requise

Dans Authentication > OAuth Server :
1. activer OAuth 2.1 Server ;
2. activer Dynamic Client Registration ;
3. définir l’Authorization Path vers l’entrée de l’application Pilotage ;
4. conserver une validation utilisateur explicite.

Aucun secret OAuth ou token agent ne doit être copié dans ChatGPT ou GitHub.

## Validation requise

La connexion ne sera déclarée terminée qu’après :
1. association du compte Anne-Sophie depuis ChatGPT ;
2. appel réel de `getPilotageProfile` retournant Anne-Sophie ;
3. appel réel de `listPilotageContext` retournant uniquement son périmètre Pilotage.
