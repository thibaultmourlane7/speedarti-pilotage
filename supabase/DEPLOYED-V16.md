# pilotage-ai-ingest — V16

Déployée dans Supabase le 18/09/2026.

- version : 2
- JWT Supabase : désactivé volontairement pour les IA externes
- authentification applicative : Bearer token distinct par agent
- jetons stockés uniquement sous forme SHA-256 dans `ai_agent_tokens`
- accès métier vérifié avant insertion
- idempotence : `event_id` unique
- compte rendu quotidien automatique : brouillon
- `task_completed` peut terminer une tâche existante identifiée exactement
- `dry_run:true` valide le connecteur sans enregistrer de donnée
