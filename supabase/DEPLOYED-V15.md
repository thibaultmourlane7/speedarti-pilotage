# pilotage-chatgpt — V15

Fonction Supabase Edge déjà déployée sur le projet `Pilotage d’entreprise`.

- slug : `pilotage-chatgpt`
- version déployée : 2
- JWT requis : oui
- OpenAI appelé uniquement côté serveur
- modèle par défaut : `gpt-5.6`
- historique : `public.ai_requests`
- outils : create_task, update_task, update_project, request_project_completion, create_daily_report_draft
- garde-fous : RLS utilisateur, clôture humaine, compte rendu en brouillon, limite 12 req/min/agent

Le secret `OPENAI_API_KEY` ne doit jamais être commité dans GitHub.
