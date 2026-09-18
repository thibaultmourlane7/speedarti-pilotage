# V16 — connecter les IA à Pilotage

Endpoint :
`https://veovtygcolfsrjocrhsf.supabase.co/functions/v1/pilotage-ai-ingest`

Authentification :
`Authorization: Bearer <JETON_DE_L_AGENT>`

Les jetons sont fournis séparément et ne doivent jamais être commités.

## Agents provisionnés
- `chatgpt_thibault`
- `chatgpt_guillaume`
- `chatgpt_anne_sophie`
- `claude_anne_sophie`

## Règle à donner à chaque IA
À chaque fois qu’un travail notable est réellement terminé, qu’une tâche existante est terminée,
qu’un blocage est découvert ou qu’une prochaine étape concrète est décidée, utiliser l’action
`reportPilotageEvent`.

Ne jamais inventer `project_client_key` ou `task_client_key`.
Si l’identifiant exact n’est pas disponible, envoyer l’événement sans projet/tâche plutôt que deviner.

`event_id` doit être unique et stable. Exemple :
`chatgpt_guillaume-20260918-145501-001`

Types :
- `work_done` : travail réellement effectué ;
- `task_completed` : tâche existante réellement terminée ;
- `task_created` / `task_updated` : action de gestion ;
- `project_progress` : progrès réel ;
- `blocker` : blocage identifié ;
- `next_step` : prochaine étape décidée ;
- `decision` : décision prise ;
- `note` : information utile à la synthèse.

## Test à blanc
Envoyer `dry_run: true`.
Le serveur vérifie le jeton, l’agent et les droits sans enregistrer l’événement.

## ChatGPT
Importer `connectors/pilotage-ai-ingest-openapi.yaml` comme action/connecteur HTTP
dans l’agent concerné, puis configurer son Bearer token avec le jeton correspondant.

## Claude
Utiliser le même endpoint depuis un outil HTTP/MCP ou une intégration capable d’émettre
une requête POST avec Bearer token. Le format JSON reste identique.

## Résultat dans Pilotage
Chaque remontée :
1. est enregistrée dans `ai_events` ;
2. apparaît dans l’Activité ;
3. alimente automatiquement un compte rendu IA quotidien en brouillon ;
4. met à jour `last_seen_at` de l’agent ;
5. peut terminer une tâche existante quand `event_type=task_completed` et que le `task_client_key` exact est fourni.
