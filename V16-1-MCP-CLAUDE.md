# V16.1 — Connexion Claude à SpeedArti Pilotage

## Architecture
Claude → MCP `pilotage-mcp` → `pilotage-ai-ingest` → Supabase → Pilotage.

## Outils exposés
### `listPilotageContext`
Retourne uniquement les projets et tâches accessibles au membre lié à l'agent.
Claude doit utiliser cet outil avant d'associer un événement à un projet/tâche.

### `reportPilotageEvent`
Remonte :
- travail réalisé ;
- tâche créée / modifiée / terminée ;
- progression projet ;
- blocage ;
- prochaine étape ;
- décision ;
- note utile.

## Sécurité
- identité déduite du jeton, jamais fournie librement par Claude ;
- jeton stocké en base uniquement sous forme SHA-256 ;
- URL privée propre au connecteur Anne-Sophie ;
- droits projet contrôlés avant traitement ;
- la fonction V16 conserve l'anti-doublon et le compte rendu automatique.

## Étape restant à faire
Anne-Sophie doit ajouter le connecteur personnalisé dans Claude avec l'URL privée fournie séparément.
Ensuite :
1. activer le connecteur dans une conversation ;
2. demander à Claude de lister le contexte Pilotage ;
3. lancer une remontée `dry_run=true` ;
4. faire une remontée réelle ;
5. vérifier Activité + Comptes rendus dans Pilotage.
