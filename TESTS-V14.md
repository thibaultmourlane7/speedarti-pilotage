# Tests V14 complète

1. Thibault crée `TEST V14 MULTI` avec Thibault + Guillaume + Anne-Sophie.
2. Guillaume clique ↻ et voit le projet.
3. Guillaume crée/modifie/planifie une tâche dans ce projet.
4. Guillaume ne peut pas modifier les participants.
5. Une tâche projet ne peut être assignée qu’à un participant.
6. Une tâche assignée à Thibault génère une notification pour Thibault.
7. Guillaume demande la clôture : Thibault reçoit la validation.
8. Thibault valide/refuse : Guillaume reçoit le résultat après ↻.
9. Guillaume ne peut pas valider lui-même la clôture.
10. Guillaume ne voit/saisit que son propre compte rendu.
11. Thibault garde la synthèse équipe et la validation finale.
12. Guillaume peut lier un document uniquement à un projet accessible.

Tests serveur déjà passés :
- visibilité projet partagé Guillaume ;
- création tâche Guillaume ;
- assignation à participant autorisée ;
- assignation hors projet bloquée ;
- notification vers participant autorisée ;
- notification vers non-participant bloquée ;
- clôture directe membre bloquée ;
- auto-validation report membre bloquée.
