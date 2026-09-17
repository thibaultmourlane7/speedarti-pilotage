import { loadState, saveState, resetState } from './state.js';
import { TAGS, trace } from './tags.js';

let state = loadState();
let currentPage = 'today';
let selectedProjectId = null;
let notificationOpen = false;
let planningTaskId = null;
let taskModalOpen = false;
let taskModalProjectId = null;
let projectModalOpen = false;
let projectFilter = 'all';
let planningFilterProject = 'all';
let planningFilterOwner = 'all';
let planningFilterPriority = 'all';
let activityFilter = 'all';
let notificationFilter = 'all';

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
      ${taskModalOpen ? renderTaskModal() : ''}
      ${projectModalOpen ? renderProjectModal() : ''}
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
        ${events.map(e => `<div class="time-row source-google"><time>${formatTime(e.at)}</time><div><strong>${esc(e.title)}</strong><small>Google Calendar</small></div></div>`).join('') || `<div class="empty-line">Aucun rendez-vous aujourd’hui.</div>`}
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
  const filteredTasks = state.tasks.filter(t => {
    if (t.status === 'completed') return false;
    if (planningFilterProject !== 'all' && t.projectId !== planningFilterProject) return false;
    if (planningFilterOwner !== 'all' && t.assignedTo !== planningFilterOwner) return false;
    if (planningFilterPriority !== 'all' && t.priority !== planningFilterPriority) return false;
    return true;
  });

  return pageHeader('Planification', 'Organiser le court, moyen et long terme', '<button class="primary-btn" data-action="quick-add">+ Ajouter une tâche</button>') + `
    <div class="toolbar">
      <select id="planningProjectFilter">
        <option value="all">Tous les projets</option>
        ${state.projects.map(p => `<option value="${p.id}" ${planningFilterProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
      <select id="planningOwnerFilter">
        <option value="all">Tous les responsables</option>
        ${state.team.map(m => `<option value="${m.id}" ${planningFilterOwner === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
      </select>
      <select id="planningPriorityFilter">
        <option value="all">Toutes les priorités</option>
        ${Object.entries(priorityLabels).map(([value,label]) => `<option value="${value}" ${planningFilterPriority === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div class="planning-board">
      ${buckets.map(bucket => {
        const items = filteredTasks.filter(t => t.planningBucket === bucket).sort((a,b) => a.sortOrder - b.sortOrder);
        return `<section class="planning-column" data-bucket="${bucket}">
          <header><h2>${planningLabels[bucket]}</h2><span>${items.length}</span></header>
          <div class="planning-dropzone" data-dropzone="${bucket}">
            ${items.map(t => `<article class="planning-card ${t.needsPlanning && t.planningStatus === 'unplanned' ? 'needs-planning' : ''}" draggable="true" data-task="${t.id}">
              <strong>${esc(t.title)}</strong>
              <small>${esc(project(t.projectId)?.name || 'Sans projet')}</small>
              <footer><span>${esc(teamName(t.assignedTo))}</span>${priorityBadge(t.priority)}</footer>
              ${t.needsPlanning && t.planningStatus === 'unplanned' ? `<button class="mini-action" data-plan="${t.id}">Positionner</button>` : ''}
            </article>`).join('') || `<div class="planning-empty">Aucune tâche</div>`}
          </div>
        </section>`;
      }).join('')}
    </div>`;
}
function renderProjects() {
  if (selectedProjectId) return renderProjectDetail(selectedProjectId);

  const filters = [
    ['all', 'Tous'],
    ['in_progress', 'En cours'],
    ['blocked', 'Bloqués'],
    ['to_test', 'À tester'],
    ['completed', 'Terminés']
  ];
  const visibleProjects = state.projects.filter(p => projectFilter === 'all' || p.status === projectFilter);

  return pageHeader('Projets', 'Vue simple de l’état des projets', '<button class="primary-btn" data-action="new-project">+ Nouveau projet</button>') + `
    <div class="tabs">
      ${filters.map(([value,label]) => `<button class="${projectFilter === value ? 'active' : ''}" data-project-filter="${value}">${label}</button>`).join('')}
    </div>
    <div class="project-list">
      ${visibleProjects.map(p => `<button class="project-row" data-project="${p.id}">
        <div class="project-main"><div class="project-title-line"><strong>${esc(p.name)}</strong>${statusBadge(p.status)}${priorityBadge(p.priority)}</div><small>${esc(teamName(p.owner))}</small></div>
        <div class="project-progress"><span>${p.progress} %</span><div class="progress"><i style="width:${p.progress}%"></i></div></div>
        <div class="project-context"><small>${p.blocker ? 'Blocage' : 'Prochaine action'}</small><span>${esc(p.blocker || p.nextAction || 'À définir')}</span></div>
      </button>`).join('') || `<div class="empty-state">Aucun projet dans cette vue.</div>`}
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
    <section class="section"><div class="section-title"><h2>Tâches</h2><button class="text-button" data-action="add-project-task" data-project-id="${p.id}">+ Ajouter</button></div><div class="task-list">${tasks.map(t => `<div class="task-row"><button class="checkbox ${t.status === 'completed' ? 'checked' : ''}" data-complete="${t.id}"></button><div class="task-main"><strong>${esc(t.title)}</strong><small>${statusLabels[t.status]}</small></div>${priorityBadge(t.priority)}</div>`).join('')}</div></section>
    <section class="section"><div class="section-title"><h2>Documents</h2><button class="text-button" data-page="documents">Voir tout →</button></div><div class="doc-list">${docs.map(d => `<div class="doc-row"><span class="doc-icon ${d.type === 'Tableur' ? 'doc-sheet' : 'doc-document'}">▤</span><div><strong>${esc(d.name)}</strong><small>${esc(d.source)}</small></div><button class="text-button">Ouvrir →</button></div>`).join('') || '<div class="empty-line">Aucun document lié.</div>'}</div></section>
    <section class="section"><div class="section-title"><h2>Activité récente</h2></div><div class="activity-list">${activities.map(renderActivityItem).join('') || '<div class="empty-line">Aucune activité récente.</div>'}</div></section>`;
}

function renderCalendar() {
  const events = [...state.calendarEvents.map(e => ({...e, kind:'calendar'})), ...state.tasks.filter(t => t.dueAt).map(t => ({ id:t.id, at:t.dueAt, title:t.title, source:'SpeedArti', kind:'task' }))].sort((a,b) => new Date(a.at)-new Date(b.at));
  return pageHeader('Agenda', 'Rendez-vous et échéances au même endroit') + `
    <div class="tabs"><button class="active">Aujourd’hui</button><button>Semaine</button><button>Mois</button></div>
    <section class="section"><div class="date-heading">Jeudi 17 septembre</div><div class="agenda-list">${events.map(e => `<div class="agenda-row ${e.source === 'google' ? 'source-google' : 'source-speedarti'}"><time>${formatTime(e.at)}</time><div><strong>${esc(e.title)}</strong><small>${e.source === 'google' ? 'Google Calendar' : 'SpeedArti'}</small></div></div>`).join('')}</div></section>`;
}

function renderDocuments() {
  return pageHeader('Documents', 'Les fichiers restent dans Google Drive', '<button class="primary-btn">+ Lier un document Drive</button>') + `
    <div class="toolbar"><input class="search-field" placeholder="Rechercher un fichier…" /><select><option>Tous les projets</option></select></div>
    <div class="documents-list">${state.projects.map(p => {
      const docs = state.documents.filter(d => d.projectId === p.id);
      if (!docs.length) return '';
      return `<section class="section doc-group"><h2>${esc(p.name)}</h2>${docs.map(d => `<div class="doc-row"><span class="doc-icon ${d.type === 'Tableur' ? 'doc-sheet' : 'doc-document'}">▤</span><div><strong>${esc(d.name)}</strong><small>${esc(d.type)} · ${esc(d.source)}</small></div><button class="text-button">Ouvrir →</button></div>`).join('')}</section>`;
    }).join('')}</div>`;
}

function renderActivityItem(a) {
  const p = project(a.projectId);
  return `<div class="activity-item"><time>${formatTime(a.at)}</time><div><strong>${esc(a.actor)}</strong><small>${esc(p?.name || 'SpeedArti')}</small><p>${esc(a.text)}</p></div></div>`;
}

function renderActivity() {
  const filters = [
    ['all','Tous'],
    ['thibault','Thibault'],
    ['anne','Anne-Sophie'],
    ['guillaume','Guillaume'],
    ['ai','IA']
  ];
  const visible = state.activity.filter(a => {
    const actor = a.actor.toLowerCase();
    if (activityFilter === 'all') return true;
    if (activityFilter === 'thibault') return actor.includes('thibault');
    if (activityFilter === 'anne') return actor.includes('anne-sophie');
    if (activityFilter === 'guillaume') return actor.includes('guillaume');
    if (activityFilter === 'ai') return actor.includes('via') || actor.includes('chatgpt') || actor.includes('claude');
    return true;
  });
  return pageHeader('Activité', 'Ce qui a réellement changé') + `
    <div class="tabs">
      ${filters.map(([value,label]) => `<button class="${activityFilter === value ? 'active' : ''}" data-activity-filter="${value}">${label}</button>`).join('')}
    </div>
    <section class="section"><div class="activity-list">${visible.map(renderActivityItem).join('') || '<div class="empty-line">Aucune activité dans ce filtre.</div>'}</div></section>`;
}
function renderMore() {
  return pageHeader('Plus') + `<div class="menu-list"><button data-page="documents">Documents <span>→</span></button><button data-page="activity">Activité <span>→</span></button></div>`;
}

function renderNotifications() {
  const active = state.notifications.filter(n => !n.resolved).filter(n => {
    if (notificationFilter === 'all') return true;
    if (notificationFilter === 'action') return n.severity === 'action';
    if (notificationFilter === 'error') return n.severity === 'error';
    return true;
  });
  return `<div class="drawer-backdrop" id="drawerBackdrop"></div><aside class="notification-drawer">
    <header><div><h2>Notifications</h2><small>${state.notifications.filter(n => !n.resolved).length} à consulter</small></div><button class="icon-btn" id="closeNotif">×</button></header>
    <div class="drawer-tabs">
      <button class="${notificationFilter === 'all' ? 'active' : ''}" data-notif-filter="all">Toutes</button>
      <button class="${notificationFilter === 'action' ? 'active' : ''}" data-notif-filter="action">À traiter</button>
      <button class="${notificationFilter === 'error' ? 'active' : ''}" data-notif-filter="error">Erreurs</button>
    </div>
    <div class="notification-list">
      ${active.map(n => `<article class="notification-item severity-${n.severity}" data-notif="${n.id}"><span class="notif-dot"></span><div><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><div class="notif-actions">${n.actionType === 'plan' ? `<button class="text-button" data-plan="${n.taskId}">Planifier →</button>` : n.actionType === 'retry' ? `<button class="text-button" data-resolve="${n.id}">Réessayer →</button>` : `<button class="text-button" data-resolve="${n.id}">Examiner →</button>`}</div></div></article>`).join('') || '<div class="empty-state">Aucune notification dans ce filtre.</div>'}
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


function renderTaskModal() {
  const defaultProject = taskModalProjectId || '';
  return `<div class="modal-backdrop" id="taskModalBackdrop"></div><div class="modal-card form-modal" role="dialog" aria-modal="true">
    <header><div><small>NOUVELLE TÂCHE</small><h2>Ajouter une tâche</h2></div><button class="icon-btn" id="closeTaskModal">×</button></header>
    <div class="form-grid">
      <label class="form-field form-field-full"><span>Titre</span><input id="taskTitle" type="text" placeholder="Ex. Tester la nouvelle intégration" maxlength="120" /></label>
      <label class="form-field form-field-full"><span>Projet</span><select id="taskProject"><option value="">Sans projet</option>${state.projects.map(p => `<option value="${p.id}" ${defaultProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="form-field"><span>Responsable</span><select id="taskOwner">${state.team.map(m => `<option value="${m.id}" ${m.id === state.currentUser.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label class="form-field"><span>Priorité</span><select id="taskPriority">${Object.entries(priorityLabels).map(([value,label]) => `<option value="${value}" ${value === 'medium' ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="form-field form-field-full"><span>Planification</span><select id="taskPlanning">
        <option value="today">Aujourd’hui</option>
        <option value="this_week">Cette semaine</option>
        <option value="this_month">Ce mois</option>
        <option value="next_3_months">1 à 3 mois</option>
        <option value="later">Plus tard</option>
        <option value="backlog">À organiser</option>
      </select></label>
    </div>
    <footer><button class="secondary-btn" id="cancelTaskModal">Annuler</button><button class="primary-btn" id="saveTask">Ajouter la tâche</button></footer>
  </div>`;
}

function renderProjectModal() {
  return `<div class="modal-backdrop" id="projectModalBackdrop"></div><div class="modal-card form-modal" role="dialog" aria-modal="true">
    <header><div><small>NOUVEAU PROJET</small><h2>Créer un projet</h2></div><button class="icon-btn" id="closeProjectModal">×</button></header>
    <div class="form-grid">
      <label class="form-field form-field-full"><span>Nom du projet</span><input id="projectName" type="text" placeholder="Ex. Module SAV fournisseurs" maxlength="120" /></label>
      <label class="form-field"><span>Responsable</span><select id="projectOwner">${state.team.map(m => `<option value="${m.id}" ${m.id === state.currentUser.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label class="form-field"><span>Priorité</span><select id="projectPriority">${Object.entries(priorityLabels).map(([value,label]) => `<option value="${value}" ${value === 'medium' ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="form-field"><span>État</span><select id="projectStatus">
        <option value="todo">À faire</option>
        <option value="in_progress" selected>En cours</option>
        <option value="to_validate">À valider</option>
        <option value="to_test">À tester</option>
        <option value="paused">En pause</option>
      </select></label>
      <label class="form-field form-field-full"><span>Prochaine action</span><input id="projectNextAction" type="text" placeholder="Ex. Définir le cahier fonctionnel" maxlength="160" /></label>
    </div>
    <footer><button class="secondary-btn" id="cancelProjectModal">Annuler</button><button class="primary-btn" id="saveProject">Créer le projet</button></footer>
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


function openTaskModal(projectId = null) {
  taskModalOpen = true;
  taskModalProjectId = projectId;
  projectModalOpen = false;
  planningTaskId = null;
  notificationOpen = false;
  trace(TAGS.TASK_MODAL, 'Ouverture formulaire tâche', { projectId });
  render();
  requestAnimationFrame(() => document.querySelector('#taskTitle')?.focus());
}

function closeTaskModal() {
  taskModalOpen = false;
  taskModalProjectId = null;
  render();
}

function createTaskFromForm() {
  const title = document.querySelector('#taskTitle')?.value.trim();
  if (!title) {
    document.querySelector('#taskTitle')?.classList.add('field-error');
    document.querySelector('#taskTitle')?.focus();
    return;
  }
  const projectId = document.querySelector('#taskProject')?.value || null;
  const assignedTo = document.querySelector('#taskOwner')?.value || state.currentUser.id;
  const priority = document.querySelector('#taskPriority')?.value || 'medium';
  const planningChoice = document.querySelector('#taskPlanning')?.value || 'backlog';
  const scheduledFor = planningChoice === 'today' ? '2026-09-17' : null;
  const planningBucket = planningChoice === 'today' ? 'this_week' : planningChoice;

  const newTask = {
    id: crypto.randomUUID(),
    title,
    projectId,
    assignedTo,
    status: 'todo',
    priority,
    scheduledFor,
    dueAt: null,
    planningStatus: 'planned',
    planningBucket,
    needsPlanning: false,
    sortOrder: Date.now(),
    sourceType: 'manual',
    createdAt: new Date().toISOString()
  };
  state.tasks.push(newTask);
  addActivity({
    projectId,
    text: `Nouvelle tâche créée : ${title}`,
    internalTag: TAGS.TASK_CREATE
  });
  persist(TAGS.TASK_CREATE, 'Tâche créée manuellement', { taskId: newTask.id, projectId, planningBucket, scheduledFor });
  taskModalOpen = false;
  taskModalProjectId = null;
  render();
}

function openProjectModal() {
  projectModalOpen = true;
  taskModalOpen = false;
  planningTaskId = null;
  notificationOpen = false;
  trace(TAGS.PROJECT_MODAL, 'Ouverture formulaire projet');
  render();
  requestAnimationFrame(() => document.querySelector('#projectName')?.focus());
}

function closeProjectModal() {
  projectModalOpen = false;
  render();
}

function createProjectFromForm() {
  const name = document.querySelector('#projectName')?.value.trim();
  if (!name) {
    document.querySelector('#projectName')?.classList.add('field-error');
    document.querySelector('#projectName')?.focus();
    return;
  }
  const owner = document.querySelector('#projectOwner')?.value || state.currentUser.id;
  const priority = document.querySelector('#projectPriority')?.value || 'medium';
  const status = document.querySelector('#projectStatus')?.value || 'in_progress';
  const nextAction = document.querySelector('#projectNextAction')?.value.trim() || 'À définir';
  const id = crypto.randomUUID();

  const newProject = {
    id,
    name,
    owner,
    members: [...new Set([state.currentUser.id, owner])],
    status,
    priority,
    progress: 0,
    blocker: '',
    nextAction,
    updatedAt: new Date().toISOString()
  };
  state.projects.unshift(newProject);
  addActivity({
    projectId: id,
    text: `Nouveau projet créé : ${name}`,
    internalTag: TAGS.PROJECT_CREATE
  });
  persist(TAGS.PROJECT_CREATE, 'Projet créé manuellement', { projectId: id, owner, priority, status });
  projectModalOpen = false;
  selectedProjectId = id;
  currentPage = 'projects';
  render();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.page)));
  document.querySelectorAll('[data-mobile-page]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.mobilePage)));
  document.querySelectorAll('[data-project]').forEach(el => el.addEventListener('click', () => { selectedProjectId = el.dataset.project; currentPage = 'projects'; render(); }));
  document.querySelectorAll('[data-complete]').forEach(el => el.addEventListener('click', () => completeTask(el.dataset.complete)));
  document.querySelectorAll('[data-plan]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openPlanning(el.dataset.plan); }));
  document.querySelectorAll('[data-resolve]').forEach(el => el.addEventListener('click', () => resolveNotification(el.dataset.resolve)));

  document.querySelectorAll('[data-project-filter]').forEach(el => el.addEventListener('click', () => { projectFilter = el.dataset.projectFilter; render(); }));
  document.querySelectorAll('[data-activity-filter]').forEach(el => el.addEventListener('click', () => { activityFilter = el.dataset.activityFilter; render(); }));
  document.querySelectorAll('[data-notif-filter]').forEach(el => el.addEventListener('click', () => { notificationFilter = el.dataset.notifFilter; render(); }));
  document.querySelectorAll('[data-action="quick-add"]').forEach(el => el.addEventListener('click', () => openTaskModal()));
  document.querySelectorAll('[data-action="add-project-task"]').forEach(el => el.addEventListener('click', () => openTaskModal(el.dataset.projectId)));
  document.querySelectorAll('[data-action="new-project"]').forEach(el => el.addEventListener('click', openProjectModal));

  document.querySelector('#planningProjectFilter')?.addEventListener('change', e => { planningFilterProject = e.target.value; render(); });
  document.querySelector('#planningOwnerFilter')?.addEventListener('change', e => { planningFilterOwner = e.target.value; render(); });
  document.querySelector('#planningPriorityFilter')?.addEventListener('change', e => { planningFilterPriority = e.target.value; render(); });

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

  document.querySelector('#closeTaskModal')?.addEventListener('click', closeTaskModal);
  document.querySelector('#cancelTaskModal')?.addEventListener('click', closeTaskModal);
  document.querySelector('#taskModalBackdrop')?.addEventListener('click', closeTaskModal);
  document.querySelector('#saveTask')?.addEventListener('click', createTaskFromForm);
  document.querySelector('#taskTitle')?.addEventListener('keydown', e => { if (e.key === 'Enter') createTaskFromForm(); });

  document.querySelector('#closeProjectModal')?.addEventListener('click', closeProjectModal);
  document.querySelector('#cancelProjectModal')?.addEventListener('click', closeProjectModal);
  document.querySelector('#projectModalBackdrop')?.addEventListener('click', closeProjectModal);
  document.querySelector('#saveProject')?.addEventListener('click', createProjectFromForm);
  document.querySelector('#projectName')?.addEventListener('keydown', e => { if (e.key === 'Enter') createProjectFromForm(); });

  document.querySelector('#resetDemo')?.addEventListener('click', () => {
    state = resetState();
    currentPage = 'today';
    selectedProjectId = null;
    notificationOpen = false;
    planningTaskId = null;
    taskModalOpen = false;
    taskModalProjectId = null;
    projectModalOpen = false;
    projectFilter = 'all';
    planningFilterProject = 'all';
    planningFilterOwner = 'all';
    planningFilterPriority = 'all';
    activityFilter = 'all';
    notificationFilter = 'all';
    render();
  });

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
