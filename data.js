// PILOT-DEMO-001 — Données locales de démonstration. Invisible dans l'UI.
export const initialState = {
  currentUser: { id: 'u-thibault', name: 'Thibault', initials: 'TM', role: 'admin' },
  team: [
    { id: 'u-thibault', name: 'Thibault', role: 'Direction' },
    { id: 'u-anne', name: 'Anne-Sophie', role: 'Technique' },
    { id: 'u-guillaume', name: 'Guillaume', role: 'Marketing / Métier' }
  ],
  projects: [
    {
      id: 'p-facturation',
      name: 'Facturation électronique',
      owner: 'u-anne',
      members: ['u-thibault', 'u-anne'],
      status: 'blocked',
      priority: 'urgent',
      progress: 60,
      blocker: 'Accès sandbox SuperPDP manquant',
      nextAction: 'Récupérer les nouveaux accès sandbox',
      updatedAt: '2026-09-17T10:32:00+02:00'
    },
    {
      id: 'p-ideabois',
      name: 'IDEA Bois — Configurateur Terrasse',
      owner: 'u-thibault',
      members: ['u-thibault', 'u-anne', 'u-guillaume'],
      status: 'in_progress',
      priority: 'high',
      progress: 70,
      blocker: 'Attente des accès ERP IDEA Bois',
      nextAction: 'Tester le moteur V0.4',
      updatedAt: '2026-09-17T09:20:00+02:00'
    },
    {
      id: 'p-charpente',
      name: 'Chiffrage — Charpente',
      owner: 'u-anne',
      members: ['u-thibault', 'u-anne', 'u-guillaume'],
      status: 'in_progress',
      priority: 'high',
      progress: 70,
      blocker: '',
      nextAction: 'Valider les données catalogue',
      updatedAt: '2026-09-17T11:05:00+02:00'
    },
    {
      id: 'p-meta',
      name: 'Marketing — Meta Ads',
      owner: 'u-guillaume',
      members: ['u-thibault', 'u-guillaume'],
      status: 'in_progress',
      priority: 'medium',
      progress: 45,
      blocker: '',
      nextAction: 'Calculer CPL et CAC',
      updatedAt: '2026-09-17T10:45:00+02:00'
    }
  ],
  tasks: [
    {
      id: 't-superpdp', title: 'Tester intégration SuperPDP', projectId: 'p-facturation', assignedTo: 'u-anne',
      status: 'in_progress', priority: 'urgent', scheduledFor: '2026-09-17', dueAt: '2026-09-17T18:00:00+02:00',
      planningStatus: 'planned', planningBucket: 'this_week', needsPlanning: false, sortOrder: 10
    },
    {
      id: 't-idea-reply', title: 'Répondre à IDEA Bois', projectId: 'p-ideabois', assignedTo: 'u-thibault',
      status: 'todo', priority: 'high', scheduledFor: '2026-09-17', dueAt: null,
      planningStatus: 'planned', planningBucket: 'this_week', needsPlanning: false, sortOrder: 20
    },
    {
      id: 't-meta-validate', title: 'Valider la campagne Meta', projectId: 'p-meta', assignedTo: 'u-thibault',
      status: 'todo', priority: 'medium', scheduledFor: '2026-09-17', dueAt: null,
      planningStatus: 'planned', planningBucket: 'this_week', needsPlanning: false, sortOrder: 30
    },
    {
      id: 't-charpente-data', title: 'Valider les données catalogue Charpente', projectId: 'p-charpente', assignedTo: 'u-anne',
      status: 'todo', priority: 'high', scheduledFor: null, dueAt: '2026-09-23T18:00:00+02:00',
      planningStatus: 'planned', planningBucket: 'this_month', needsPlanning: false, sortOrder: 10
    },
    {
      id: 't-idea-v04', title: 'Tester moteur terrasse V0.4', projectId: 'p-ideabois', assignedTo: 'u-anne',
      status: 'todo', priority: 'high', scheduledFor: null, dueAt: null,
      planningStatus: 'planned', planningBucket: 'this_month', needsPlanning: false, sortOrder: 20
    },
    {
      id: 't-comparator', title: 'Comparateur automatique fournisseurs', projectId: null, assignedTo: 'u-anne',
      status: 'todo', priority: 'medium', scheduledFor: null, dueAt: null,
      planningStatus: 'unplanned', planningBucket: 'backlog', suggestedBucket: 'this_month', needsPlanning: true, sortOrder: 5,
      sourceType: 'chatgpt'
    },
    {
      id: 't-stocks', title: 'Préparer module Stocks V1', projectId: null, assignedTo: 'u-thibault',
      status: 'todo', priority: 'medium', scheduledFor: null, dueAt: null,
      planningStatus: 'planned', planningBucket: 'next_3_months', needsPlanning: false, sortOrder: 10
    },
    {
      id: 't-ai-advanced', title: 'Pilotage IA avancé', projectId: null, assignedTo: 'u-thibault',
      status: 'todo', priority: 'low', scheduledFor: null, dueAt: null,
      planningStatus: 'planned', planningBucket: 'later', needsPlanning: false, sortOrder: 10
    }
  ],
  calendarEvents: [
    { id: 'c-idea', at: '2026-09-17T09:30:00+02:00', title: 'Rendez-vous IDEA Bois', source: 'google' },
    { id: 'c-anne', at: '2026-09-17T14:00:00+02:00', title: 'Point Anne-Sophie', source: 'google' }
  ],
  documents: [
    { id: 'd1', projectId: 'p-ideabois', name: 'Cahier fonctionnel', type: 'Document', source: 'Google Drive' },
    { id: 'd2', projectId: 'p-ideabois', name: 'Catalogue produits IDEA Bois', type: 'Tableur', source: 'Google Drive' },
    { id: 'd3', projectId: 'p-ideabois', name: 'Rapport V0.4', type: 'Document', source: 'Google Drive' },
    { id: 'd4', projectId: 'p-facturation', name: 'Documentation SuperPDP', type: 'Document', source: 'Google Drive' },
    { id: 'd5', projectId: 'p-facturation', name: 'Architecture Factur-X', type: 'Document', source: 'Google Drive' }
  ],
  activity: [
    { id: 'a1', at: '2026-09-17T11:32:00+02:00', actor: 'Anne-Sophie via Claude', projectId: 'p-facturation', text: 'Blocage ajouté : accès sandbox SuperPDP invalide', internalTag: 'PILOT-ACT-003' },
    { id: 'a2', at: '2026-09-17T10:45:00+02:00', actor: 'Guillaume', projectId: 'p-meta', text: 'Analyse de campagne terminée', internalTag: 'PILOT-ACT-001' },
    { id: 'a3', at: '2026-09-17T09:20:00+02:00', actor: 'Thibault', projectId: 'p-ideabois', text: 'Priorité modifiée : Moyenne → Haute', internalTag: 'PILOT-ACT-003' },
    { id: 'a4', at: '2026-09-16T17:10:00+02:00', actor: 'Anne-Sophie', projectId: 'p-charpente', text: 'Progression : 50 % → 70 %', internalTag: 'PILOT-ACT-003' }
  ],
  notifications: [
    { id: 'n-plan', severity: 'action', type: 'planning_required', title: '1 élément à planifier', message: 'Comparateur automatique fournisseurs', taskId: 't-comparator', actionType: 'plan', read: false, resolved: false, internalTag: 'PILOT-NOTIF-005' },
    { id: 'n-approval', severity: 'action', type: 'approval_required', title: 'Validation demandée', message: 'Projet Plombier proposé comme terminé', actionType: 'review', read: false, resolved: false, internalTag: 'PILOT-NOTIF-006' },
    { id: 'n-error', severity: 'error', type: 'ai_error', title: 'Mise à jour ChatGPT non enregistrée', message: 'Projet Charpente — une mise à jour a échoué.', actionType: 'retry', read: false, resolved: false, internalTag: 'PILOT-NOTIF-004' }
  ]
};
