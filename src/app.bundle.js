// PILOT-DEMO-003 — Bundle autonome GitHub Pages. Généré depuis les sources séparées. Invisible dans l'UI.
(() => {
'use strict';
// PILOT-DEMO-001 — Données locales de démonstration. Invisible dans l'UI.
const initialState = {
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

// Référentiel minimal utilisé par la démo. Les balises ne sont jamais rendues dans l'interface.
const TAGS = Object.freeze({
  NAVIGATE: 'PILOT-UI-001',
  MOBILE_NAV: 'PILOT-UI-002',
  NOTIFICATION_DRAWER: 'PILOT-UI-004',
  PLANNING_MODAL: 'PILOT-UI-005',
  SEARCH: 'PILOT-UI-006',
  TASK_COMPLETE: 'PILOT-TASK-007',
  PLAN_DETECT: 'PILOT-PLAN-001',
  PLAN_UNPLANNED: 'PILOT-PLAN-002',
  PLAN_MODAL: 'PILOT-PLAN-003',
  PLAN_CONFIRM: 'PILOT-PLAN-004',
  PLAN_MOVE: 'PILOT-PLAN-005',
  ACTIVITY_LOG: 'PILOT-ACT-001',
  NOTIF_READ: 'PILOT-NOTIF-002',
  NOTIF_RESOLVE: 'PILOT-NOTIF-009'
});

function trace(tag, message, details = {}) {
  // Invisible pour l'utilisateur. Disponible dans la console pour le diagnostic.
  console.debug(`[${tag}] ${message}`, details);
}


// PILOT-DEMO-002 — Persistance locale de démo. Remplacée plus tard par Supabase.
const STORAGE_KEY = 'speedarti-pilotage-demo-v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...clone(initialState), ...JSON.parse(raw) } : clone(initialState);
  } catch {
    return clone(initialState);
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return clone(initialState);
}


let state = loadState();
let currentPage = 'today';
let selectedProjectId = null;
let notificationOpen = false;
let planningTaskId = null;

const app = document.querySelector('#app');

const navItems = [
  ['today', 'Aujourd’hui', '⌂'],
  ['planning', 'Planification', '↔'],
  ['projects', 'Projets', '▦'],
  ['calendar', 'Agenda', '□'],
  ['documents', 'Documents', '▤'],
  ['activity', 'Activité', '≋']
];

const statusLabels = {
  todo: 'À faire', in_progress: 'En cours', to_validate: 'À valider', to_test: 'À tester',
  completed: 'Terminé', blocked: 'Bloqué', paused: 'En pause'
};
const priorityLabels = { urgent: 'Urgente', high: 'Haute', medium: 'Moyenne', low: 'Faible' };
const planningLabels = {
  backlog: 'À organiser', this_week: 'Cette semaine', this_month: 'Ce mois', next_3_months: '1 à 3 mois', later: 'Plus tard'
};

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function teamName(id) { return state.team.find(x => x.id === id)?.name || 'Non attribué'; }
function project(id) { return state.projects.find(x => x.id === id); }
function task(id) { return state.tasks.find(x => x.id === id); }

function formatTime(iso) { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
function formatDate(iso) { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

function persist(tag, message, details = {}) {
  saveState(state);
  trace(tag, message, details);
}

function addActivity({ actor = 'Thibault', projectId = null, text, internalTag }) {
  state.activity.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, projectId, text, internalTag });
  persist(TAGS.ACTIVITY_LOG, 'Activité ajoutée', { projectId, internalTag });
}

function unreadNotifications() {
  return state.notifications.filter(n => !n.resolved && !n.read).length;
}

function layout(content) {
  const unread = unreadNotifications();
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">S</span><div><strong>SpeedArti</strong><small>Pilotage</small></div></div>
        <nav class="side-nav">
          ${navItems.map(([id, label, icon]) => `<button class="nav-item ${currentPage === id ? 'active' : ''}" data-page="${id}"><span>${icon}</span>${label}</button>`).join('')}
        </nav>
        <div class="sidebar-foot"><button class="text-button" id="resetDemo">Réinitialiser la démo</button></div>
      </aside>

      <div class="workspace">
        <header class="topbar">
          <div class="mobile-brand">SpeedArti <span>Pilotage</span></div>
          <div class="top-actions">
            <button class="icon-btn search-btn" id="searchBtn" aria-label="Rechercher">⌕</button>
            <button class="icon-btn notif-btn" id="notificationBtn" aria-label="Notifications">♢${unread ? `<b>${unread}</b>` : ''}</button>
            <button class="avatar" title="Thibault">${esc(state.currentUser.initials)}</button>
          </div>
        </header>
        <main class="content">${content}</main>
      </div>

      <nav class="mobile-nav">
        ${[['today','Aujourd’hui','⌂'],['planning','Planif.','↔'],['projects','Projets','▦'],['calendar','Agenda','□'],['more','Plus','•••']].map(([id,label,icon]) => `<button class="mobile-nav-item ${currentPage === id ? 'active' : ''}" data-mobile-page="${id}"><span>${icon}</span><small>${label}</small></button>`).join('')}
      </nav>

      ${notificationOpen ? renderNotifications() : ''}
      ${planningTaskId ? renderPlanningModal(planningTaskId) : ''}
    </div>
  `;
}

function pageHeader(title, subtitle = '', action = '') {
  return `<div class="page-header"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${action}</div>`;
}

function statusBadge(status) { return `<span class="badge status-${status}">${statusLabels[status] || status}</span>`; }
function priorityBadge(priority) { return `<span class="badge priority-${priority}">${priorityLabels[priority] || priority}</span>`; }

function renderToday() {
  const today = '2026-09-17'; // date fixe de la démo pour rester cohérente avec les données mockées
  const myTasks = state.tasks.filter(t => t.assignedTo === state.currentUser.id && t.scheduledFor === today && t.status !== 'completed');
  const blocked = state.projects.filter(p => p.status === 'blocked' || p.blocker).slice(0, 3);
  const toPlan = state.tasks.filter(t => t.needsPlanning && t.planningStatus === 'unplanned').length;
  const approvals = state.notifications.filter(n => !n.resolved && n.type === 'approval_required').length;
  const events = state.calendarEvents.filter(e => e.at.startsWith(today));

  return pageHeader('Bonjour Thibault', 'Jeudi 17 septembre') + `
    <section class="section">
      <div class="section-title"><h2>Agenda du jour</h2><button class="text-button" data-page="calendar">Voir l’agenda →</button></div>
      <div class="simple-list">
        ${events.map(e => `<div class="time-row"><time>${formatTime(e.at)}</time><div><strong>${esc(e.title)}</strong><small>Google Calendar</small></div></div>`).join('') || `<div class="empty-line">Aucun rendez-vous aujourd’hui.</div>`}
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>Mes tâches</h2><button class="text-button" data-action="quick-add">+ Ajouter</button></div>
      <div class="task-list">
        ${myTasks.map(t => `<div class="task-row"><button class="checkbox" data-complete="${t.id}" aria-label="Terminer"></button><div class="task-main"><strong>${esc(t.title)}</strong><small>${esc(project(t.projectId)?.name || 'Sans projet')}</small></div>${priorityBadge(t.priority)}</div>`).join('') || `<div class="empty-line">Aucune tâche prévue aujourd’hui.</div>`}
      </div>
    </section>

    <section class="section two-col">
      <div>
        <div class="section-title"><h2>À surveiller</h2></div>
        <div class="watch-list">${blocked.map(p => `<button class="watch-row" data-project="${p.id}"><span class="dot ${p.status === 'blocked' ? 'red' : 'amber'}"></span><div><strong>${esc(p.name)}</strong><small>${esc(p.blocker || p.nextAction)}</small></div></button>`).join('')}</div>
      </div>
      <div>
        <div class="section-title"><h2>Équipe</h2></div>
        <div class="team-list">
          ${state.team.filter(m => m.id !== state.currentUser.id).map(m => {
            const pending = state.tasks.filter(t => t.assignedTo === m.id && t.status !== 'completed').length;
            const blockers = state.projects.filter(p => p.owner === m.id && p.blocker).length;
            return `<div class="team-row"><div><strong>${esc(m.name)}</strong><small>${esc(m.role)}</small></div><span>${pending} tâches · ${blockers ? `${blockers} blocage` : 'Tout va bien'}</span></div>`;
          }).join('')}
        </div>
      </div>
    </section>

    <section class="section attention-box">
      <div class="section-title"><h2>À traiter</h2></div>
      <button class="attention-row" data-page="planning"><strong>${toPlan} élément${toPlan > 1 ? 's' : ''} à planifier</strong><span>Voir →</span></button>
      <button class="attention-row" id="openNotifFromToday"><strong>${approvals} validation${approvals > 1 ? 's' : ''} demandée${approvals > 1 ? 's' : ''}</strong><span>Voir →</span></button>
    </section>`;
}

function renderPlanning() {
  const buckets = ['backlog','this_week','this_month','next_3_months','later'];
  return pageHeader('Planification', 'Organiser le court, moyen et long terme') + `
    <div class="toolbar"><select><option>Tous les projets</option></select><select><option>Tous les responsables</option></select><select><option>Toutes les priorités</option></select></div>
    <div class="planning-board">
      ${buckets.map(bucket => {
        const items = state.tasks.filter(t => t.planningBucket === bucket && t.status !== 'completed').sort((a,b) => a.sortOrder - b.sortOrder);
        return `<section class="planning-column" data-bucket="${bucket}">
          <header><h2>${planningLabels[bucket]}</h2><span>${items.length}</span></header>
          <div class="planning-dropzone" data-dropzone="${bucket}">
            ${items.map(t => `<article class="planning-card ${t.needsPlanning && t.planningStatus === 'unplanned' ? 'needs-planning' : ''}" draggable="true" data-task="${t.id}">
              <strong>${esc(t.title)}</strong>
              <small>${esc(project(t.projectId)?.name || 'À rattacher')}</small>
              <footer><span>${esc(teamName(t.assignedTo))}</span>${priorityBadge(t.priority)}</footer>
              ${t.needsPlanning && t.planningStatus === 'unplanned' ? `<button class="mini-action" data-plan="${t.id}">Positionner</button>` : ''}
            </article>`).join('')}
          </div>
        </section>`;
      }).join('')}
    </div>`;
}

function renderProjects() {
  if (selectedProjectId) return renderProjectDetail(selectedProjectId);
  return pageHeader('Projets', 'Vue simple de l’état des projets', '<button class="primary-btn" data-action="new-project">+ Nouveau projet</button>') + `
    <div class="tabs"><button class="active">Tous</button><button>En cours</button><button>Bloqués</button><button>À tester</button><button>Terminés</button></div>
    <div class="project-list">
      ${state.projects.map(p => `<button class="project-row" data-project="${p.id}">
        <div class="project-main"><div class="project-title-line"><strong>${esc(p.name)}</strong>${statusBadge(p.status)}${priorityBadge(p.priority)}</div><small>${esc(teamName(p.owner))}</small></div>
        <div class="project-progress"><span>${p.progress} %</span><div class="progress"><i style="width:${p.progress}%"></i></div></div>
        <div class="project-context"><small>${p.blocker ? 'Blocage' : 'Prochaine action'}</small><span>${esc(p.blocker || p.nextAction)}</span></div>
      </button>`).join('')}
    </div>`;
}

function renderProjectDetail(id) {
  const p = project(id);
  if (!p) { selectedProjectId = null; return renderProjects(); }
  const tasks = state.tasks.filter(t => t.projectId === id);
  const docs = state.documents.filter(d => d.projectId === id);
  const activities = state.activity.filter(a => a.projectId === id).slice(0,3);
  return `
    <button class="back-btn" id="backProjects">← Projets</button>
    ${pageHeader(p.name, teamName(p.owner))}
    <div class="project-detail-head"><div>${statusBadge(p.status)} ${priorityBadge(p.priority)}</div><strong>${p.progress} %</strong></div>
    <div class="progress large"><i style="width:${p.progress}%"></i></div>
    <section class="section info-grid">
      <div><small>Blocage actuel</small><strong>${esc(p.blocker || 'Aucun blocage')}</strong></div>
      <div><small>Prochaine action</small><strong>${esc(p.nextAction || 'Non définie')}</strong></div>
    </section>
    <section class="section"><div class="section-title"><h2>Tâches</h2><button class="text-button">+ Ajouter</button></div><div class="task-list">${tasks.map(t => `<div class="task-row"><button class="checkbox ${t.status === 'completed' ? 'checked' : ''}" data-complete="${t.id}"></button><div class="task-main"><strong>${esc(t.title)}</strong><small>${statusLabels[t.status]}</small></div>${priorityBadge(t.priority)}</div>`).join('')}</div></section>
    <section class="section"><div class="section-title"><h2>Documents</h2><button class="text-button" data-page="documents">Voir tout →</button></div><div class="doc-list">${docs.map(d => `<div class="doc-row"><span class="doc-icon">▤</span><div><strong>${esc(d.name)}</strong><small>${esc(d.source)}</small></div><button class="text-button">Ouvrir →</button></div>`).join('') || '<div class="empty-line">Aucun document lié.</div>'}</div></section>
    <section class="section"><div class="section-title"><h2>Activité récente</h2></div><div class="activity-list">${activities.map(renderActivityItem).join('') || '<div class="empty-line">Aucune activité récente.</div>'}</div></section>`;
}

function renderCalendar() {
  const events = [...state.calendarEvents.map(e => ({...e, kind:'calendar'})), ...state.tasks.filter(t => t.dueAt).map(t => ({ id:t.id, at:t.dueAt, title:t.title, source:'SpeedArti', kind:'task' }))].sort((a,b) => new Date(a.at)-new Date(b.at));
  return pageHeader('Agenda', 'Rendez-vous et échéances au même endroit') + `
    <div class="tabs"><button class="active">Aujourd’hui</button><button>Semaine</button><button>Mois</button></div>
    <section class="section"><div class="date-heading">Jeudi 17 septembre</div><div class="agenda-list">${events.map(e => `<div class="agenda-row"><time>${formatTime(e.at)}</time><div><strong>${esc(e.title)}</strong><small>${e.source === 'google' ? 'Google Calendar' : 'SpeedArti'}</small></div></div>`).join('')}</div></section>`;
}

function renderDocuments() {
  return pageHeader('Documents', 'Les fichiers restent dans Google Drive', '<button class="primary-btn">+ Lier un document Drive</button>') + `
    <div class="toolbar"><input class="search-field" placeholder="Rechercher un fichier…" /><select><option>Tous les projets</option></select></div>
    <div class="documents-list">${state.projects.map(p => {
      const docs = state.documents.filter(d => d.projectId === p.id);
      if (!docs.length) return '';
      return `<section class="section doc-group"><h2>${esc(p.name)}</h2>${docs.map(d => `<div class="doc-row"><span class="doc-icon">▤</span><div><strong>${esc(d.name)}</strong><small>${esc(d.type)} · ${esc(d.source)}</small></div><button class="text-button">Ouvrir →</button></div>`).join('')}</section>`;
    }).join('')}</div>`;
}

function renderActivityItem(a) {
  const p = project(a.projectId);
  return `<div class="activity-item"><time>${formatTime(a.at)}</time><div><strong>${esc(a.actor)}</strong><small>${esc(p?.name || 'SpeedArti')}</small><p>${esc(a.text)}</p></div></div>`;
}

function renderActivity() {
  return pageHeader('Activité', 'Ce qui a réellement changé') + `
    <div class="tabs"><button class="active">Tous</button><button>Thibault</button><button>Anne-Sophie</button><button>Guillaume</button><button>IA</button></div>
    <section class="section"><div class="activity-list">${state.activity.map(renderActivityItem).join('')}</div></section>`;
}

function renderMore() {
  return pageHeader('Plus') + `<div class="menu-list"><button data-page="documents">Documents <span>→</span></button><button data-page="activity">Activité <span>→</span></button></div>`;
}

function renderNotifications() {
  const active = state.notifications.filter(n => !n.resolved);
  return `<div class="drawer-backdrop" id="drawerBackdrop"></div><aside class="notification-drawer">
    <header><div><h2>Notifications</h2><small>${active.length} à consulter</small></div><button class="icon-btn" id="closeNotif">×</button></header>
    <div class="drawer-tabs"><button class="active">Toutes</button><button>À traiter</button><button>Erreurs</button></div>
    <div class="notification-list">
      ${active.map(n => `<article class="notification-item severity-${n.severity}" data-notif="${n.id}"><span class="notif-dot"></span><div><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><div class="notif-actions">${n.actionType === 'plan' ? `<button class="text-button" data-plan="${n.taskId}">Planifier →</button>` : n.actionType === 'retry' ? `<button class="text-button" data-resolve="${n.id}">Réessayer →</button>` : `<button class="text-button" data-resolve="${n.id}">Examiner →</button>`}</div></div></article>`).join('') || '<div class="empty-state">Tout est à jour.</div>'}
    </div>
  </aside>`;
}

function renderPlanningModal(taskId) {
  const t = task(taskId);
  if (!t) return '';
  return `<div class="modal-backdrop" id="modalBackdrop"></div><div class="modal-card" role="dialog" aria-modal="true">
    <header><div><small>NOUVEL ÉLÉMENT</small><h2>Planifier cette tâche</h2></div><button class="icon-btn" id="closePlan">×</button></header>
    <div class="modal-task"><strong>${esc(t.title)}</strong><span>${esc(project(t.projectId)?.name || 'Projet à définir')}</span></div>
    <div class="meta-grid"><div><small>Responsable proposé</small><strong>${esc(teamName(t.assignedTo))}</strong></div><div><small>Priorité</small><strong>${esc(priorityLabels[t.priority])}</strong></div></div>
    <fieldset class="plan-options"><legend>Quand veux-tu le prévoir ?</legend>
      ${['this_week','this_month','next_3_months','later','backlog'].map(bucket => `<label><input type="radio" name="planBucket" value="${bucket}" ${bucket === 'backlog' ? 'checked' : ''}/><span>${planningLabels[bucket]}</span></label>`).join('')}
    </fieldset>
    ${t.suggestedBucket ? `<p class="ai-suggestion">Suggestion IA : <strong>${planningLabels[t.suggestedBucket]}</strong></p>` : ''}
    <footer><button class="secondary-btn" id="cancelPlan">Annuler</button><button class="primary-btn" id="confirmPlan" data-task="${t.id}">Ajouter</button></footer>
  </div>`;
}

function renderSearchOverlay() {
  return `<div class="modal-backdrop" id="searchBackdrop"></div><div class="search-modal"><input id="globalSearchInput" autofocus placeholder="Rechercher dans SpeedArti Pilotage…" /><div id="searchResults"><p class="search-hint">Projet, tâche, document ou activité.</p></div></div>`;
}

function render() {
  let content;
  switch (currentPage) {
    case 'planning': content = renderPlanning(); break;
    case 'projects': content = renderProjects(); break;
    case 'calendar': content = renderCalendar(); break;
    case 'documents': content = renderDocuments(); break;
    case 'activity': content = renderActivity(); break;
    case 'more': content = renderMore(); break;
    default: content = renderToday();
  }
  app.innerHTML = layout(content);
  bindEvents();
}

function navigate(page) {
  currentPage = page;
  selectedProjectId = null;
  trace(TAGS.NAVIGATE, 'Navigation', { page });
  render();
}

function openPlanning(taskId) {
  planningTaskId = taskId;
  notificationOpen = false;
  trace(TAGS.PLAN_MODAL, 'Ouverture fenêtre de planification', { taskId });
  render();
}

function completeTask(taskId) {
  const t = task(taskId);
  if (!t) return;
  const done = t.status === 'completed';
  t.status = done ? 'todo' : 'completed';
  t.completedAt = done ? null : new Date().toISOString();
  addActivity({ projectId: t.projectId, text: `${t.title} : ${done ? 'réouverte' : 'terminée'}`, internalTag: TAGS.TASK_COMPLETE });
  persist(TAGS.TASK_COMPLETE, 'Statut tâche modifié', { taskId, status: t.status });
  render();
}

function moveTask(taskId, bucket) {
  const t = task(taskId);
  if (!t) return;
  const previous = t.planningBucket;
  t.planningBucket = bucket;
  t.planningStatus = 'planned';
  t.needsPlanning = false;
  t.sortOrder = Date.now();
  addActivity({ projectId: t.projectId, text: `${t.title} : ${planningLabels[previous]} → ${planningLabels[bucket]}`, internalTag: TAGS.PLAN_MOVE });
  persist(TAGS.PLAN_MOVE, 'Tâche déplacée dans la roadmap', { taskId, previous, bucket });
}

function resolveNotification(id) {
  const n = state.notifications.find(x => x.id === id);
  if (!n) return;
  n.read = true;
  n.resolved = true;
  persist(TAGS.NOTIF_RESOLVE, 'Notification résolue', { id });
  render();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.page)));
  document.querySelectorAll('[data-mobile-page]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.mobilePage)));
  document.querySelectorAll('[data-project]').forEach(el => el.addEventListener('click', () => { selectedProjectId = el.dataset.project; currentPage = 'projects'; render(); }));
  document.querySelectorAll('[data-complete]').forEach(el => el.addEventListener('click', () => completeTask(el.dataset.complete)));
  document.querySelectorAll('[data-plan]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openPlanning(el.dataset.plan); }));
  document.querySelectorAll('[data-resolve]').forEach(el => el.addEventListener('click', () => resolveNotification(el.dataset.resolve)));

  document.querySelector('#notificationBtn')?.addEventListener('click', () => { notificationOpen = !notificationOpen; trace(TAGS.NOTIFICATION_DRAWER, 'Drawer notifications', { open: notificationOpen }); render(); });
  document.querySelector('#openNotifFromToday')?.addEventListener('click', () => { notificationOpen = true; render(); });
  document.querySelector('#closeNotif')?.addEventListener('click', () => { notificationOpen = false; render(); });
  document.querySelector('#drawerBackdrop')?.addEventListener('click', () => { notificationOpen = false; render(); });
  document.querySelector('#backProjects')?.addEventListener('click', () => { selectedProjectId = null; render(); });

  document.querySelector('#closePlan')?.addEventListener('click', () => { planningTaskId = null; render(); });
  document.querySelector('#cancelPlan')?.addEventListener('click', () => { planningTaskId = null; render(); });
  document.querySelector('#modalBackdrop')?.addEventListener('click', () => { planningTaskId = null; render(); });
  document.querySelector('#confirmPlan')?.addEventListener('click', e => {
    const selected = document.querySelector('input[name="planBucket"]:checked')?.value || 'backlog';
    const id = e.currentTarget.dataset.task;
    moveTask(id, selected);
    state.notifications.filter(n => n.taskId === id).forEach(n => { n.read = true; n.resolved = true; });
    planningTaskId = null;
    persist(TAGS.PLAN_CONFIRM, 'Planification confirmée', { taskId: id, bucket: selected });
    render();
  });

  document.querySelector('#resetDemo')?.addEventListener('click', () => { state = resetState(); currentPage = 'today'; selectedProjectId = null; notificationOpen = false; planningTaskId = null; render(); });

  document.querySelector('#searchBtn')?.addEventListener('click', () => {
    document.body.insertAdjacentHTML('beforeend', renderSearchOverlay());
    trace(TAGS.SEARCH, 'Recherche ouverte');
    const input = document.querySelector('#globalSearchInput');
    input?.focus();
    input?.addEventListener('input', () => updateSearch(input.value));
    document.querySelector('#searchBackdrop')?.addEventListener('click', closeSearch);
  });

  bindDragAndDrop();
}

function bindDragAndDrop() {
  let dragged = null;
  document.querySelectorAll('.planning-card').forEach(card => {
    card.addEventListener('dragstart', () => { dragged = card.dataset.task; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  document.querySelectorAll('[data-dropzone]').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (dragged) { moveTask(dragged, zone.dataset.dropzone); render(); }
    });
  });
}

function updateSearch(query) {
  const q = query.trim().toLowerCase();
  const target = document.querySelector('#searchResults');
  if (!target) return;
  if (!q) { target.innerHTML = '<p class="search-hint">Projet, tâche, document ou activité.</p>'; return; }
  const results = [
    ...state.projects.filter(x => x.name.toLowerCase().includes(q)).map(x => ({ type:'Projet', title:x.name, action:`project:${x.id}` })),
    ...state.tasks.filter(x => x.title.toLowerCase().includes(q)).map(x => ({ type:'Tâche', title:x.title, action:`planning:${x.id}` })),
    ...state.documents.filter(x => x.name.toLowerCase().includes(q)).map(x => ({ type:'Document', title:x.name, action:'documents' }))
  ].slice(0,8);
  target.innerHTML = results.length ? results.map(r => `<button class="search-result" data-search-action="${r.action}"><small>${r.type}</small><strong>${esc(r.title)}</strong></button>`).join('') : '<p class="search-hint">Aucun résultat.</p>';
  target.querySelectorAll('[data-search-action]').forEach(btn => btn.addEventListener('click', () => {
    const action = btn.dataset.searchAction;
    closeSearch();
    if (action.startsWith('project:')) { selectedProjectId = action.split(':')[1]; currentPage = 'projects'; render(); }
    else if (action.startsWith('planning:')) { currentPage = 'planning'; render(); }
    else navigate(action);
  }));
}

function closeSearch() {
  document.querySelector('#searchBackdrop')?.remove();
  document.querySelector('.search-modal')?.remove();
}

render();

})();
