# SpeedArti Pilotage — V13 Production

## Déjà appliqué automatiquement côté Supabase
- `tasks.sort_order` est passé en `bigint` : correction de l’erreur `value ... is out of range for type integer`.
- clôture projet protégée : un membre ne peut plus passer directement un projet en `completed` ; l’admin reste décisionnaire ;
- `change_requests` : décision finale admin uniquement ;
- comptes rendus : un membre peut créer/modifier son brouillon, mais pas s’auto-valider ;
- policies `team_members` et index dupliqués nettoyés.

## Fichiers à remplacer sur GitHub
- `src/app.js`
- `src/app.bundle.js`
- `src/auth.js`
- `src/state.js`
- `src/tags.js`
- `docs/TAGS.md`

## Fichier à ajouter pour historiser la migration
- `supabase/migrations/20260918_v12_fix_task_sort_order_bigint.sql`
- `supabase/migrations/20260918_v13_production_rls_guards.sql`

## Ne pas modifier
- `src/remote-sync.js` : garder exactement la V12.2 actuellement fonctionnelle.
- `src/styles.css`
- `src/data.js`
- `src/supabase-config.js`
- `index.html`

## Changements visibles V13
- vraie date du jour dans Aujourd’hui, Agenda et les comptes rendus ;
- Demain / Semaine prochaine calculés depuis la vraie date ;
- suppression des boutons de simulation IA, reset démo, import/export démo ;
- plus de faux bouton « Réessayer » : une erreur technique non connectée est simplement clôturée manuellement ;
- droits de modification/validation mieux adaptés au rôle connecté ;
- Pwned Passwords gratuit lors de la création d’un nouveau compte, via k-anonymity.

## Test après installation
1. `Ctrl + F5`.
2. Vérifier que l’accueil affiche la date réelle.
3. Ouvrir Agenda > Aujourd’hui / Semaine / Mois.
4. Modifier la tâche `Test synchronisation Supabase`, puis recharger.
5. Vérifier que le changement reste présent.
6. Créer un petit compte rendu manuel, puis recharger.
7. Ne pas supprimer `TEST V12` avant la validation finale de V13.
