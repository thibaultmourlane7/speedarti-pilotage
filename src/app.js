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
let aiSimulationOpen = false;
let taskEditId = null;
let projectEditId = null;
let calendarView = 'today';
let documentSearch = '';
let documentProjectFilter = 'all';
let documentModalOpen = false;
let mobilePlanningBucket = 'this_month';
let approvalRequestId = null;
let quickActionOpen = false;
let activityProjectFilter = 'all';
let activitySearch = '';
let archiveModalProjectId = null;
let deferTaskId = null;
let teamWorkloadOpen = false;
let dailyReportModalOpen = false;
let dailyReportEditId = null;
let dailyReportDate = '2026-09-17';
let dailyReportPersonFilter = 'all';
let dailyReportPresetPersonId = null;

state.changeRequests = Array.isArray(state.changeRequests) ? state.changeRequests : [];
state.aiRequests = Array.isArray(state.aiRequests) ? state.aiRequests : [];
state.dailyReports = Array.isArray(state.dailyReports) ? state.dailyReports : [];
const DEMO_NOW = new Date('2026-09-17T13:45:00+02:00');

const app = document.querySelector('#app');

const navItems = [
  ['today', 'Aujourd’hui', '⌂'],
  ['planning', 'Planification', '↔'],
  ['projects', 'Projets', '▦'],
  ['calendar', 'Agenda', '□'],
  ['documents', 'Documents', '▤'],
  ['activity', 'Activité', '≋'],
  ['reports', 'Comptes rendus', '☷']
];

const statusLabels = {
  todo: 'À faire', in_progress: 'En cours', to_validate: 'À valider', to_test: 'À tester',
  completed: 'Terminé', blocked: 'Bloqué', paused: 'En pause'
};
const priorityLabels = { urgent: 'Urgente', high: 'Haute', medium: 'Moyenne', low: 'Faible' };
const planningLabels = {
  backlog: 'À organiser', this_week: 'Cette semaine', this_month: 'Ce mois', next_3_months: '1 à 3 mois', later: 'Plus tard'
};

const DEFAULT_AI_AGENTS = Object.freeze([
  { id:'chatgpt_thibault', name:'ChatGPT', provider:'OpenAI', personId:'u-thibault', category:'Généraliste', active:true },
  { id:'claude_anne_sophie', name:'Claude', provider:'Anthropic', personId:'u-anne', category:'Développement', active:true },
  { id:'chatgpt_anne_sophie', name:'ChatGPT', provider:'OpenAI', personId:'u-anne', category:'Généraliste', active:true },
  { id:'chatgpt_guillaume', name:'ChatGPT', provider:'OpenAI', personId:'u-guillaume', category:'Généraliste', active:true },
  { id:'marketing_guillaume_future', name:'IA marketing', provider:'À connecter', personId:'u-guillaume', category:'Marketing', active:false }
]);

function ensureAiAgents() {
  const existing = Array.isArray(state.aiAgents) ? state.aiAgents : [];
  const byId = new Map(existing.map(agent => [agent.id, agent]));
  let changed = !Array.isArray(state.aiAgents);
  DEFAULT_AI_AGENTS.forEach(defaultAgent => {
    if (!byId.has(defaultAgent.id)) {
      existing.push({ ...defaultAgent });
      changed = true;
    }
  });
  state.aiAgents = existing;
  if (changed) trace(TAGS.AI_AGENT_REGISTRY, 'Registre multi-IA initialisé / complété', { count:state.aiAgents.length });
  return state.aiAgents;
}

function aiAgent(source) {
  return ensureAiAgents().find(agent => agent.id === source) || null;
}

function activeAiAgents() {
  return ensureAiAgents().filter(agent => agent.active !== false);
}

function aiAgentsForPerson(personId, includeInactive = false) {
  return ensureAiAgents().filter(agent => agent.personId === personId && (includeInactive || agent.active !== false));
}

function aiAgentLabel(source) {
  const agent = aiAgent(source);
  if (!agent) return source || 'IA';
  return `${agent.name} · ${teamName(agent.personId)}`;
}

function aiSourceActor(source) {
  const agent = aiAgent(source);
  return agent ? `${teamName(agent.personId)} via ${agent.name}` : 'IA';
}

function aiSourceType(source) {
  const agent = aiAgent(source);
  const value = `${agent?.provider || ''} ${agent?.name || source || ''}`.toLowerCase();
  if (value.includes('anthropic') || value.includes('claude')) return 'claude';
  if (value.includes('openai') || value.includes('chatgpt')) return 'chatgpt';
  return 'other_ai';
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function teamName(id) { return state.team.find(x => x.id === id)?.name || 'Non attribué'; }
function project(id) { return state.projects.find(x => x.id === id); }
function task(id) { return state.tasks.find(x => x.id === id); }

function formatTime(iso) { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
function formatDate(iso) { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function dateKey(value) { return value ? String(value).slice(0, 10) : ''; }
function toDueIso(value) { return value ? `${value}T18:00:00+02:00` : null; }
function personInitials(name = '') { return name.split(/\s|-/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase(); }
function teamPicker(targetId, selectedId) {
  const selected = selectedId || state.currentUser.id;
  return `<div class="team-picker" data-picker="${targetId}"><input type="hidden" id="${targetId}" value="${selected}" />${state.team.map(m => `<button type="button" class="team-choice ${m.id === selected ? 'active' : ''}" data-team-target="${targetId}" data-team-value="${m.id}"><span>${personInitials(m.name)}</span><b>${esc(m.name)}</b><small>${esc(m.role)}</small></button>`).join('')}</div>`;
}

function ensureRuntimeState() {
  if (!Array.isArray(state.changeRequests)) state.changeRequests = [];
  if (!Array.isArray(state.notifications)) state.notifications = [];
  if (!Array.isArray(state.aiRequests)) state.aiRequests = [];
  if (!Array.isArray(state.dailyReports)) state.dailyReports = [];
  ensureAiAgents();
  state.dailyReports.forEach(report => {
    if (report.source === 'ai' && !report.sourceAgent) report.sourceAgent = aiAgentsForPerson(report.personId)[0]?.id || null;
  });
  state.projects.forEach(p => { if (typeof p.archived !== 'boolean') p.archived = false; });
  state.notifications = state.notifications.filter(n => !(n.type === 'approval_required' && !n.changeRequestId && !n.projectId));
  state.notifications.forEach(n => {
    if (typeof n.read !== 'boolean') n.read = Boolean(n.readAt);
    if (typeof n.resolved !== 'boolean') n.resolved = Boolean(n.resolvedAt);
  });
}

function pendingCompletionRequest(projectId) {
  return state.changeRequests.find(r => r.projectId === projectId && r.type === 'project_complete' && r.status === 'pending');
}

function upsertNotification({ severity='info', type='task_update', title, message, actionType='read', taskId=null, projectId=null, changeRequestId=null, groupKey=null, internalTag=TAGS.NOTIF_CREATE, increment=false, reactivate=false }) {
  ensureRuntimeState();
  const existing = groupKey ? state.notifications.find(n => !n.resolved && n.groupKey === groupKey) : null;
  if (existing) {
    existing.title = title;
    existing.message = message;
    existing.severity = severity;
    existing.type = type;
    existing.actionType = actionType;
    existing.taskId = taskId || existing.taskId || null;
    existing.projectId = projectId || existing.projectId || null;
    existing.changeRequestId = changeRequestId || existing.changeRequestId || null;
    existing.updatedAt = new Date().toISOString();
    if (increment || reactivate) { existing.read = false; existing.readAt = null; }
    if (increment) existing.count = Number(existing.count || 1) + 1;
    trace(TAGS.NOTIF_DEDUP, 'Notification regroupée', { groupKey, count: existing.count || 1 });
    return existing;
  }
  const notification = {
    id: crypto.randomUUID(), severity, type, title, message, actionType,
    taskId, projectId, changeRequestId, groupKey, internalTag,
    count: 1, read: false, resolved: false, readAt: null, resolvedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  state.notifications.unshift(notification);
  trace(TAGS.NOTIF_CREATE, 'Notification créée', { type, severity, groupKey, notificationId: notification.id });
  return notification;
}

function refreshSmartNotifications() {
  ensureRuntimeState();
  let changed = false;
  state.notifications.filter(n => !n.resolved && (n.type === 'deadline' || n.type === 'blocker')).forEach(n => {
    if (n.type === 'deadline') {
      const t = task(n.taskId);
      const stillActive = t && t.status !== 'completed' && t.dueAt && new Date(t.dueAt) < DEMO_NOW;
      if (!stillActive) { n.resolved = true; n.resolvedAt = new Date().toISOString(); changed = true; trace(TAGS.NOTIF_RESOLVE, 'Alerte échéance résolue automatiquement', { notificationId:n.id, taskId:n.taskId }); }
    }
    if (n.type === 'blocker') {
      const p = project(n.projectId);
      const stillActive = p && p.status !== 'completed' && Boolean(p.blocker);
      if (!stillActive) { n.resolved = true; n.resolvedAt = new Date().toISOString(); changed = true; trace(TAGS.NOTIF_RESOLVE, 'Alerte blocage résolue automatiquement', { notificationId:n.id, projectId:n.projectId }); }
    }
  });
  state.tasks.filter(t => t.status !== 'completed' && t.dueAt && new Date(t.dueAt) < DEMO_NOW && (!t.projectId || !project(t.projectId)?.archived)).forEach(t => {
    const key = `deadline:${t.id}`;
    const before = state.notifications.find(n => !n.resolved && n.groupKey === key);
    upsertNotification({ severity:'warning', type:'deadline', title:'Échéance dépassée', message:`${t.title} · échéance ${formatDate(t.dueAt)}`, actionType:'edit_task', taskId:t.id, projectId:t.projectId, groupKey:key, internalTag:TAGS.NOTIF_DEADLINE });
    if (!before) { changed = true; trace(TAGS.SMART_ALERTS, 'Alerte échéance générée', { taskId:t.id }); }
  });
  state.projects.filter(p => p.blocker && p.status !== 'completed' && !p.archived).forEach(p => {
    const key = `blocker:${p.id}`;
    const before = state.notifications.find(n => !n.resolved && n.groupKey === key);
    upsertNotification({ severity:'warning', type:'blocker', title:'Blocage projet', message:`${p.name} · ${p.blocker}`, actionType:'open_project', projectId:p.id, groupKey:key, internalTag:TAGS.NOTIF_BLOCKER });
    if (!before) { changed = true; trace(TAGS.SMART_ALERTS, 'Alerte blocage générée', { projectId:p.id }); }
  });
  if (changed) saveState(state);
}

function queueProjectCompletion(projectId, { sourceType='manual', requestedBy='Thibault', note='' } = {}) {
  ensureRuntimeState();
  const p = project(projectId);
  if (!p || p.status === 'completed') return null;
  const already = pendingCompletionRequest(projectId);
  if (already) return already;
  const request = {
    id: crypto.randomUUID(), type:'project_complete', projectId, status:'pending',
    requestedBy, sourceType, note, requestedAt:new Date().toISOString(),
    proposed:{ status:'completed', progress:100 }
  };
  state.changeRequests.unshift(request);
  upsertNotification({
    severity:'action', type:'approval_required', title:'Validation projet demandée',
    message:`${p.name} · passage en Terminé`, actionType:'approval', projectId,
    changeRequestId:request.id, groupKey:`approval:${request.id}`, internalTag:TAGS.NOTIF_APPROVAL
  });
  addActivity({ actor: requestedBy, projectId, text:`Passage en Terminé proposé${note ? ` · ${note}` : ''}`, internalTag:TAGS.PROJECT_COMPLETE_REQUEST });
  persist(TAGS.PROJECT_COMPLETE_REQUEST, 'Demande de clôture projet créée', { projectId, requestId:request.id, sourceType });
  return request;
}

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
            <button class="quick-create-btn" id="quickCreateBtn" title="Actions rapides"><span>＋</span><b>Créer</b></button><button class="demo-ai-btn" id="simulateAiBtn" title="Simuler une mise à jour ChatGPT ou Claude"><span>✦</span><b>IA démo</b></button>
            <button class="icon-btn search-btn" id="searchBtn" aria-label="Rechercher">⌕</button>
            <button class="icon-btn notif-btn" id="notificationBtn" aria-label="Notifications">♢${unread ? `<b>${unread}</b>` : ''}</button>
            <span class="avatar" title="Thibault" aria-label="Utilisateur Thibault">${esc(state.currentUser.initials)}</span>
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
      ${aiSimulationOpen ? renderAiSimulationModal() : ''}
      ${documentModalOpen ? renderDocumentModal() : ''}
      ${approvalRequestId ? renderApprovalModal(approvalRequestId) : ''}
      ${quickActionOpen ? renderQuickActionModal() : ''}
      ${archiveModalProjectId ? renderArchiveModal(archiveModalProjectId) : ''}
      ${deferTaskId ? renderDeferModal(deferTaskId) : ''}
      ${teamWorkloadOpen ? renderTeamWorkloadModal() : ''}
      ${dailyReportModalOpen ? renderDailyReportModal() : ''}
    </div>
  `;
}

function pageHeader(title, subtitle = '', action = '') {
  return `<div class="page-header"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${action}</div>`;
}

function statusBadge(status) { return `<span class="badge status-${status}">${statusLabels[status] || status}</span>`; }
function priorityBadge(priority) { return `<span class="badge priority-${priority}">${priorityLabels[priority] || priority}</span>`; }

function taskQuickLabel(t) {
  if (!t) return '';
  if (t.status === 'completed') return 'Réouvrir';
  if (t.status === 'todo' || t.status === 'paused' || t.status === 'blocked') return 'Démarrer';
  return 'Terminer';
}

function taskCompletionSummary(projectId) {
  const list = state.tasks.filter(t => t.projectId === projectId);
  const done = list.filter(t => t.status === 'completed').length;
  return { done, total:list.length };
}

function pendingApprovals() {
  ensureRuntimeState();
  return state.changeRequests.filter(r => r.status === 'pending' && !project(r.projectId)?.archived);
}


function actorMatchesPerson(actor, personId) {
  const value = String(actor || '').toLowerCase();
  if (personId === 'u-anne') return value.includes('anne-sophie');
  if (personId === 'u-guillaume') return value.includes('guillaume');
  return value.includes('thibault');
}

function dailyReportsForDate(reportDate) {
  ensureRuntimeState();
  return state.dailyReports.filter(r => r.reportDate === reportDate);
}

function dailyReportsForPerson(personId, reportDate) {
  return dailyReportsForDate(reportDate).filter(r => r.personId === personId);
}

function manualDailyReportForPerson(personId, reportDate) {
  return dailyReportsForPerson(personId, reportDate).find(r => r.source === 'manual') || null;
}

function splitReportLines(value = '') {
  return String(value).split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 12);
}

function buildAutomaticDailyReport(member, reportDate, agent = null) {
  const activities = state.activity
    .filter(a => dateKey(a.at) === reportDate && actorMatchesPerson(a.actor, member.id))
    .slice(0, 8);
  const completedTasks = state.tasks.filter(t =>
    t.assignedTo === member.id && t.status === 'completed' &&
    (dateKey(t.completedAt) === reportDate || (!t.completedAt && t.scheduledFor === reportDate))
  );
  const achievements = [...new Set([
    ...completedTasks.map(t => `Tâche terminée : ${t.title}`),
    ...activities.map(a => a.text)
  ])].slice(0, 6);
  const blockers = state.projects
    .filter(p => !p.archived && p.owner === member.id && p.blocker)
    .map(p => `${p.name} : ${p.blocker}`)
    .slice(0, 4);
  const nextSteps = state.projects
    .filter(p => !p.archived && p.owner === member.id && p.status !== 'completed' && p.nextAction)
    .map(p => `${p.name} : ${p.nextAction}`)
    .slice(0, 4);
  const projectIds = [...new Set([
    ...activities.map(a => a.projectId).filter(Boolean),
    ...completedTasks.map(t => t.projectId).filter(Boolean),
    ...state.projects.filter(p => !p.archived && p.owner === member.id).map(p => p.id)
  ])].slice(0, 8);
  const sourceName = agent?.name || 'IA';
  const summary = achievements.length
    ? `${sourceName} a synthétisé ${achievements.length} avancée${achievements.length > 1 ? 's' : ''} aujourd’hui${blockers.length ? `, avec ${blockers.length} blocage${blockers.length > 1 ? 's' : ''} à suivre` : ''}.`
    : `${sourceName} n’a détecté aucune réalisation enregistrée automatiquement pour ${member.name} aujourd’hui.`;
  return { summary, achievements, blockers, nextSteps, projectIds };
}

function consolidatePersonDailyReports(personId, reportDate) {
  const reports = dailyReportsForPerson(personId, reportDate);
  const unique = values => [...new Set(values.filter(Boolean))];
  const achievements = unique(reports.flatMap(r => r.achievements || []));
  const blockers = unique(reports.flatMap(r => r.blockers || []));
  const nextSteps = unique(reports.flatMap(r => r.nextSteps || []));
  const projectIds = unique(reports.flatMap(r => r.projectIds || []));
  const validatedCount = reports.filter(r => r.validatedAt).length;
  return {
    reports, achievements, blockers, nextSteps, projectIds,
    validatedCount,
    allValidated: reports.length > 0 && validatedCount === reports.length,
    summary: reports.length > 1
      ? `${reports.length} sources consolidées · ${achievements.length} réalisation${achievements.length > 1 ? 's' : ''}${blockers.length ? ` · ${blockers.length} blocage${blockers.length > 1 ? 's' : ''}` : ''}.`
      : (reports[0]?.summary || '')
  };
}

function collectAutomaticDailyReports(reportDate = dailyReportDate) {
  ensureRuntimeState();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  activeAiAgents().forEach(agent => {
    const member = state.team.find(m => m.id === agent.personId);
    if (!member) return;
    const existing = dailyReportsForPerson(member.id, reportDate).find(r => r.source === 'ai' && r.sourceAgent === agent.id);
    if (existing?.validatedAt) { skipped += 1; return; }
    const generated = buildAutomaticDailyReport(member, reportDate, agent);
    if (existing) {
      Object.assign(existing, generated, {
        source:'ai', sourceAgent:agent.id, updatedAt:new Date().toISOString()
      });
      updated += 1;
    } else {
      state.dailyReports.unshift({
        id:crypto.randomUUID(), reportDate, personId:member.id,
        source:'ai', sourceAgent:agent.id, status:'draft',
        ...generated, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), validatedAt:null
      });
      created += 1;
    }
  });
  addActivity({ actor:'Pilotage', projectId:null, text:`Collecte multi-IA du ${formatDate(reportDate)} : ${created} créé(s), ${updated} actualisé(s), ${skipped} conservé(s)`, internalTag:TAGS.REPORT_MULTI_SOURCE });
  trace(TAGS.REPORT_MULTI_SOURCE, 'Collecte multi-source terminée', { reportDate, activeAgents:activeAiAgents().length, created, updated, skipped });
  persist(TAGS.REPORT_AUTO_COLLECT, 'Collecte quotidienne multi-IA simulée', { reportDate, created, updated, skipped, activeAgents:activeAiAgents().map(a => a.id) });
  currentPage = 'reports';
  render();
}

function teamDailySummary(reportDate) {
  const reports = dailyReportsForDate(reportDate);
  const unique = values => [...new Set(values.filter(Boolean))];
  const achievements = unique(reports.flatMap(r => r.achievements || []));
  const blockers = unique(reports.flatMap(r => r.blockers || []));
  const nextSteps = unique(reports.flatMap(r => r.nextSteps || []));
  const received = new Set(reports.map(r => r.personId)).size;
  const sources = reports.length;
  const validated = reports.filter(r => r.validatedAt).length;
  return {
    received,
    expected: state.team.length,
    sources,
    expectedSources: activeAiAgents().length,
    validated,
    achievements: achievements.length,
    blockers: blockers.length,
    nextSteps: nextSteps.length,
    text: received
      ? `${received}/${state.team.length} personnes couvertes · ${sources} source${sources > 1 ? 's' : ''} reçue${sources > 1 ? 's' : ''} · ${achievements.length} réalisation${achievements.length > 1 ? 's' : ''} · ${blockers.length} blocage${blockers.length > 1 ? 's' : ''}.`
      : 'Aucun compte rendu reçu pour cette journée.'
  };
}

function renderToday() {
  const today = '2026-09-17'; // date fixe de la démo pour rester cohérente avec les données mockées
  const myTasks = state.tasks.filter(t => t.assignedTo === state.currentUser.id && t.scheduledFor === today && t.status !== 'completed' && (!t.projectId || !project(t.projectId)?.archived));
  const blocked = state.projects.filter(p => !p.archived && (p.status === 'blocked' || p.blocker)).slice(0, 3);
  const toPlan = state.tasks.filter(t => t.needsPlanning && t.planningStatus === 'unplanned').length;
  const approvals = state.notifications.filter(n => !n.resolved && n.type === 'approval_required').length;
  const events = state.calendarEvents.filter(e => e.at.startsWith(today));

  const overdue = state.tasks.filter(t => t.status !== 'completed' && t.dueAt && new Date(t.dueAt) < DEMO_NOW && (!t.projectId || !project(t.projectId)?.archived)).length;
  const activeBlockers = state.projects.filter(p => !p.archived && p.blocker && p.status !== 'completed').length;
  const reportSummary = teamDailySummary(today);
  return pageHeader('Bonjour Thibault', 'Jeudi 17 septembre') + `
    <section class="pilot-pulse">
      <button class="pulse-card pulse-red" data-notif-open-filter="warning"><span>Retards</span><strong>${overdue}</strong><small>échéance${overdue > 1 ? 's' : ''} dépassée${overdue > 1 ? 's' : ''}</small></button>
      <button class="pulse-card pulse-orange" data-notif-open-filter="warning"><span>Blocages</span><strong>${activeBlockers}</strong><small>projet${activeBlockers > 1 ? 's' : ''} à surveiller</small></button>
      <button class="pulse-card pulse-violet" data-notif-open-filter="action"><span>Validations</span><strong>${approvals}</strong><small>décision${approvals > 1 ? 's' : ''} attendue${approvals > 1 ? 's' : ''}</small></button>
      <button class="pulse-card pulse-blue" data-page="planning"><span>À planifier</span><strong>${toPlan}</strong><small>nouvel élément</small></button>
    </section>
    <section class="section daily-report-today">
      <div class="section-title"><h2>Compte rendu du jour</h2><button class="text-button" data-page="reports">Voir les comptes rendus →</button></div>
      <button class="daily-report-summary-card" data-page="reports"><div><span class="report-progress-ring">${reportSummary.received}/${reportSummary.expected}</span><div><strong>${reportSummary.text}</strong><small>${reportSummary.sources ? `${reportSummary.validated}/${reportSummary.sources} source${reportSummary.sources > 1 ? 's' : ''} validée${reportSummary.sources > 1 ? 's' : ''}` : 'Aucune source reçue'} · multi-IA + manuel</small></div></div><span>Ouvrir →</span></button>
    </section>
    <section class="section">
      <div class="section-title"><h2>Agenda du jour</h2><button class="text-button" data-page="calendar">Voir l’agenda →</button></div>
      <div class="simple-list">
        ${events.map(e => `<div class="time-row source-google"><time>${formatTime(e.at)}</time><div><strong>${esc(e.title)}</strong><small>Google Calendar</small></div></div>`).join('') || `<div class="empty-line">Aucun rendez-vous aujourd’hui.</div>`}
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>Mes tâches</h2><button class="text-button" data-action="quick-add">+ Ajouter</button></div>
      <div class="task-list">
        ${myTasks.map(t => `<div class="task-row"><button class="checkbox ${t.status === 'completed' ? 'checked' : ''}" data-complete="${t.id}" aria-label="Terminer"></button><button class="task-main task-main-button" data-edit-task="${t.id}"><strong>${esc(t.title)}</strong><small>${esc(project(t.projectId)?.name || 'Sans projet')} · ${esc(teamName(t.assignedTo))}</small></button>${priorityBadge(t.priority)}<button class="quick-status-btn" data-task-status="${t.id}">${taskQuickLabel(t)}</button><button class="defer-btn" data-defer-task="${t.id}">Reporter</button><button class="row-action" data-edit-task="${t.id}">Modifier</button></div>`).join('') || `<div class="empty-line">Aucune tâche prévue aujourd’hui.</div>`}
      </div>
    </section>

    <section class="section two-col">
      <div>
        <div class="section-title"><h2>À surveiller</h2></div>
        <div class="watch-list">${blocked.map(p => `<button class="watch-row" data-project="${p.id}"><span class="dot ${p.status === 'blocked' ? 'red' : 'amber'}"></span><div><strong>${esc(p.name)}</strong><small>${esc(p.blocker || p.nextAction)}</small></div></button>`).join('')}</div>
      </div>
      <div>
        <div class="section-title"><h2>Équipe</h2><button class="text-button" id="openTeamWorkload">Voir la charge →</button></div>
        <div class="team-list">
          ${state.team.filter(m => m.id !== state.currentUser.id).map(m => {
            const pending = state.tasks.filter(t => t.assignedTo === m.id && t.status !== 'completed').length;
            const blockers = state.projects.filter(p => p.owner === m.id && p.blocker).length;
            return `<button class="team-row team-row-button" data-team-planning="${m.id}"><div><strong>${esc(m.name)}</strong><small>${esc(m.role)}</small></div><span>${pending} tâches · ${blockers ? `${blockers} blocage` : 'Tout va bien'} →</span></button>`;
          }).join('')}
        </div>
      </div>
    </section>

    ${pendingApprovals().length ? `<section class="section decisions-box">
      <div class="section-title"><h2>Décisions à prendre</h2><button class="text-button" id="openNotifFromToday">Tout voir →</button></div>
      <div class="decision-list">${pendingApprovals().slice(0,3).map(r => { const p=project(r.projectId); return `<button class="decision-row" data-approval="${r.id}"><div><strong>${esc(p?.name || 'Projet')}</strong><small>Passage en Terminé demandé par ${esc(r.requestedBy || 'IA')}</small></div><span>Examiner →</span></button>`; }).join('')}</div>
    </section>` : ''}
    <section class="section attention-box">
      <div class="section-title"><h2>À traiter</h2></div>
      <button class="attention-row" data-page="planning"><strong>${toPlan} élément${toPlan > 1 ? 's' : ''} à planifier</strong><span>Voir →</span></button>
      <button class="attention-row" id="openNotifFromTodayBottom"><strong>${approvals} validation${approvals > 1 ? 's' : ''} demandée${approvals > 1 ? 's' : ''}</strong><span>Voir →</span></button>
    </section>`;
}

function renderPlanning() {
  const buckets = ['backlog','this_week','this_month','next_3_months','later'];
  const filteredTasks = state.tasks.filter(t => {
    if (t.status === 'completed') return false;
    if (t.projectId && project(t.projectId)?.archived) return false;
    if (planningFilterProject !== 'all' && t.projectId !== planningFilterProject) return false;
    if (planningFilterOwner !== 'all' && t.assignedTo !== planningFilterOwner) return false;
    if (planningFilterPriority !== 'all' && t.priority !== planningFilterPriority) return false;
    return true;
  });

  return pageHeader('Planification', 'Organiser le court, moyen et long terme', '<button class="primary-btn" data-action="quick-add">+ Ajouter une tâche</button>') + `
    <div class="toolbar">
      <select id="planningProjectFilter">
        <option value="all">Tous les projets</option>
        ${state.projects.filter(p => !p.archived).map(p => `<option value="${p.id}" ${planningFilterProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
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
    <div class="mobile-roadmap-tabs">${buckets.map(bucket => `<button class="${mobilePlanningBucket === bucket ? 'active' : ''}" data-mobile-bucket="${bucket}">${planningLabels[bucket]}</button>`).join('')}</div>
    <div class="planning-board">
      ${buckets.map(bucket => {
        const items = filteredTasks.filter(t => t.planningBucket === bucket).sort((a,b) => a.sortOrder - b.sortOrder);
        return `<section class="planning-column ${mobilePlanningBucket === bucket ? 'mobile-active' : ''}" data-bucket="${bucket}">
          <header><h2>${planningLabels[bucket]}</h2><span>${items.length}</span></header>
          <div class="planning-dropzone" data-dropzone="${bucket}">
            ${items.map(t => `<article class="planning-card ${t.needsPlanning && t.planningStatus === 'unplanned' ? 'needs-planning' : ''}" draggable="true" data-task="${t.id}">
              <div class="planning-card-head"><strong>${esc(t.title)}</strong><button class="card-edit" data-edit-task="${t.id}" title="Modifier">✎</button></div>
              <small>${esc(project(t.projectId)?.name || 'Sans projet')}</small>
              ${t.scheduledFor ? `<div class="date-chip">Prévue ${formatDate(t.scheduledFor)}</div>` : ''}
              <footer><span class="owner-pill">${esc(teamName(t.assignedTo))}</span>${priorityBadge(t.priority)}</footer>
              <div class="card-actions"><button class="mini-action" data-plan="${t.id}">${t.needsPlanning && t.planningStatus === 'unplanned' ? 'Planifier' : 'Déplacer / dater'}</button><button class="mini-action secondary-mini" data-edit-task="${t.id}">Modifier</button></div>
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
    ['completed', 'Terminés'],
    ['archived', 'Archivés']
  ];
  const visibleProjects = state.projects.filter(p => {
    if (projectFilter === 'archived') return Boolean(p.archived);
    if (p.archived) return false;
    if (projectFilter === 'all') return true;
    if (projectFilter === 'blocked') return p.status === 'blocked' || Boolean(p.blocker);
    return p.status === projectFilter;
  });

  return pageHeader('Projets', 'Vue simple de l’état des projets', '<button class="primary-btn" data-action="new-project">+ Nouveau projet</button>') + `
    <div class="tabs">
      ${filters.map(([value,label]) => `<button class="${projectFilter === value ? 'active' : ''}" data-project-filter="${value}">${label}</button>`).join('')}
    </div>
    <div class="project-list">
      ${visibleProjects.map(p => { const summary=taskCompletionSummary(p.id); const pending=pendingCompletionRequest(p.id); return `<button class="project-row" data-project="${p.id}">
        <div class="project-main"><div class="project-title-line"><strong>${esc(p.name)}</strong>${statusBadge(p.status)}${priorityBadge(p.priority)}${pending ? '<span class="badge status-to_validate">Validation</span>' : ''}</div><small>${esc(teamName(p.owner))} · ${summary.done}/${summary.total} tâches terminées</small></div>
        <div class="project-progress"><span>${p.progress} %</span><div class="progress"><i style="width:${p.progress}%"></i></div></div>
        <div class="project-context"><small>${p.blocker ? 'Blocage' : 'Prochaine action'}</small><span>${esc(p.blocker || p.nextAction || 'À définir')}</span></div>
      </button>`; }).join('') || `<div class="empty-state">Aucun projet dans cette vue.</div>`}
    </div>`;
}
function renderProjectDetail(id) {
  const p = project(id);
  if (!p) { selectedProjectId = null; return renderProjects(); }
  const tasks = state.tasks.filter(t => t.projectId === id);
  const docs = state.documents.filter(d => d.projectId === id);
  const activities = state.activity.filter(a => a.projectId === id).slice(0,5);
  return `
    <button class="back-btn" id="backProjects">← Projets</button>
    ${pageHeader(p.name, teamName(p.owner), `<div class="header-actions">${p.archived ? `<button class="secondary-btn" data-restore-project="${p.id}">Restaurer</button>` : `<button class="secondary-btn" data-edit-project="${p.id}">Modifier</button><button class="archive-btn" data-archive-project="${p.id}">Archiver</button>`}</div>`)}
    ${p.archived ? `<div class="archive-banner"><strong>Projet archivé</strong><span>Il reste consultable, mais n’apparaît plus dans le pilotage actif.</span></div>` : ''}
    <div class="project-detail-head"><div>${statusBadge(p.status)} ${priorityBadge(p.priority)} <span class="owner-pill">${esc(teamName(p.owner))}</span></div><strong>${p.progress} %</strong></div>
    <div class="progress large"><i style="width:${p.progress}%"></i></div>
    <section class="section info-grid">
      <div class="${p.blocker ? 'info-blocker' : ''}"><small>Blocage actuel</small><strong>${esc(p.blocker || 'Aucun blocage')}</strong>${p.blocker && !p.archived ? `<button class="clear-blocker-btn" data-clear-blocker="${p.id}">Lever le blocage</button>` : ''}</div>
      <div><small>Prochaine action</small><strong>${esc(p.nextAction || 'Non définie')}</strong></div>
    </section>
    ${pendingCompletionRequest(p.id) ? `<section class="approval-banner"><div><span>Validation requise</span><strong>Passage du projet en Terminé</strong><small>Le projet reste dans son état actuel tant que la décision n’est pas validée.</small></div><button class="primary-btn" data-approval="${pendingCompletionRequest(p.id).id}">Examiner</button></section>` : ''}
    <section class="section"><div class="section-title"><h2>Tâches</h2><button class="text-button" data-action="add-project-task" data-project-id="${p.id}">+ Ajouter</button></div><div class="task-list">${tasks.map(t => `<div class="task-row"><button class="checkbox ${t.status === 'completed' ? 'checked' : ''}" data-complete="${t.id}"></button><button class="task-main task-main-button" data-edit-task="${t.id}"><strong>${esc(t.title)}</strong><small>${statusLabels[t.status]} · ${esc(teamName(t.assignedTo))}${t.scheduledFor ? ` · ${formatDate(t.scheduledFor)}` : ''}</small></button>${priorityBadge(t.priority)}<button class="quick-status-btn" data-task-status="${t.id}">${taskQuickLabel(t)}</button><button class="row-action" data-edit-task="${t.id}">Modifier</button></div>`).join('') || '<div class="empty-line">Aucune tâche.</div>'}</div></section>
    <section class="section"><div class="section-title"><h2>Documents</h2><button class="text-button" data-page="documents">Voir tout →</button></div><div class="doc-list">${docs.map(d => `<div class="doc-row"><span class="doc-icon ${d.type === 'Tableur' ? 'doc-sheet' : 'doc-document'}">▤</span><div><strong>${esc(d.name)}</strong><small>${esc(d.source)}</small></div>${d.url ? `<button class="text-button" data-open-doc="${d.id}">Ouvrir →</button>` : '<span class="demo-label">Référence</span>'}</div>`).join('') || '<div class="empty-line">Aucun document lié.</div>'}</div></section>
    <section class="section"><div class="section-title"><h2>Activité récente</h2></div><div class="activity-list">${activities.map(renderActivityItem).join('') || '<div class="empty-line">Aucune activité récente.</div>'}</div></section>`;
}

function renderCalendar() {
  const ref = new Date('2026-09-17T12:00:00+02:00');
  const startWeek = new Date('2026-09-14T00:00:00+02:00');
  const endWeek = new Date('2026-09-20T23:59:59+02:00');
  const events = [
    ...state.calendarEvents.map(e => ({...e, source:'google', label:'Google Calendar'})),
    ...state.tasks.filter(t => t.scheduledFor).map(t => ({ id:`scheduled-${t.id}`, taskId:t.id, at:`${t.scheduledFor}T09:00:00+02:00`, title:t.title, source:'SpeedArti', label:'Tâche planifiée' })),
    ...state.tasks.filter(t => t.dueAt).map(t => ({ id:`due-${t.id}`, taskId:t.id, at:t.dueAt, title:t.title, source:'SpeedArti', label:'Échéance' }))
  ].sort((a,b) => new Date(a.at)-new Date(b.at));

  const visible = events.filter(e => {
    const d = new Date(e.at);
    if (calendarView === 'today') return dateKey(e.at) === '2026-09-17';
    if (calendarView === 'week') return d >= startWeek && d <= endWeek;
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  });

  const title = calendarView === 'today' ? 'Jeudi 17 septembre' : calendarView === 'week' ? 'Semaine du 14 au 20 septembre' : 'Septembre 2026';
  return pageHeader('Agenda', 'Rendez-vous, tâches prévues et échéances au même endroit') + `
    <div class="tabs">
      <button class="${calendarView === 'today' ? 'active' : ''}" data-calendar-view="today">Aujourd’hui</button>
      <button class="${calendarView === 'week' ? 'active' : ''}" data-calendar-view="week">Semaine</button>
      <button class="${calendarView === 'month' ? 'active' : ''}" data-calendar-view="month">Mois</button>
    </div>
    <section class="section"><div class="date-heading">${title}</div><div class="agenda-list">${visible.map(e => {
      const inner = `<time>${calendarView === 'today' ? formatTime(e.at) : `${dateKey(e.at).slice(8,10)}/${dateKey(e.at).slice(5,7)} ${formatTime(e.at)}`}</time><div><strong>${esc(e.title)}</strong><small>${esc(e.label)}</small></div>`;
      return e.taskId
        ? `<button class="agenda-row source-speedarti ${e.label === 'Échéance' ? 'source-deadline' : ''}" data-edit-task="${e.taskId}">${inner}</button>`
        : `<div class="agenda-row source-google">${inner}</div>`;
    }).join('') || '<div class="empty-line">Aucun élément dans cette période.</div>'}</div></section>`;
}

function renderDocuments() {
  const q = documentSearch.trim().toLowerCase();
  const docs = state.documents.filter(d => {
    if (documentProjectFilter !== 'all' && d.projectId !== documentProjectFilter) return false;
    if (q && !`${d.name} ${d.type || ''} ${project(d.projectId)?.name || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const grouped = state.projects.map(p => ({ project:p, docs:docs.filter(d => d.projectId === p.id) })).filter(g => g.docs.length);
  const orphan = docs.filter(d => !d.projectId);
  return pageHeader('Documents', 'Les fichiers restent dans Google Drive : Pilotage ne conserve que la référence', '<button class="primary-btn" data-action="link-document">+ Lier un document Drive</button>') + `
    <div class="toolbar"><input id="documentSearch" class="search-field" value="${esc(documentSearch)}" placeholder="Rechercher un fichier…" /><select id="documentProjectFilter"><option value="all">Tous les projets</option>${state.projects.map(p => `<option value="${p.id}" ${documentProjectFilter === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="documents-list">
      ${grouped.map(({project:p,docs:list}) => `<section class="section doc-group"><h2>${esc(p.name)}</h2>${list.map(d => `<div class="doc-row"><span class="doc-icon ${d.type === 'Tableur' ? 'doc-sheet' : 'doc-document'}">▤</span><div><strong>${esc(d.name)}</strong><small>${esc(d.type || 'Document')} · ${esc(d.source)}</small></div>${d.url ? `<button class="text-button" data-open-doc="${d.id}">Ouvrir →</button>` : '<span class="demo-label">Référence</span>'}</div>`).join('')}</section>`).join('')}
      ${orphan.length ? `<section class="section doc-group"><h2>Sans projet</h2>${orphan.map(d => `<div class="doc-row"><span class="doc-icon doc-document">▤</span><div><strong>${esc(d.name)}</strong><small>${esc(d.type || 'Document')} · ${esc(d.source)}</small></div>${d.url ? `<button class="text-button" data-open-doc="${d.id}">Ouvrir →</button>` : '<span class="demo-label">Référence</span>'}</div>`).join('')}</section>` : ''}
      ${!docs.length ? '<div class="empty-state">Aucun document trouvé.</div>' : ''}
    </div>`;
}

function renderActivityItem(a) {
  const p = project(a.projectId);
  const actor = String(a.actor || 'Système');
  const sourceClass = /chatgpt|claude| via /i.test(actor) ? 'activity-ai' : 'activity-human';
  return `<div class="activity-item ${sourceClass}"><time>${formatDate(a.at)}<small>${formatTime(a.at)}</small></time><div><strong>${esc(actor)}</strong><small>${esc(p?.name || 'SpeedArti')}</small><p>${esc(a.text)}</p></div></div>`;
}

function renderActivity() {
  const filters = [
    ['all','Tous'],
    ['thibault','Thibault'],
    ['anne','Anne-Sophie'],
    ['guillaume','Guillaume'],
    ['ai','IA']
  ];
  const q = activitySearch.trim().toLowerCase();
  const visible = state.activity.filter(a => {
    const actor = String(a.actor || '').toLowerCase();
    if (activityFilter === 'thibault' && !actor.includes('thibault')) return false;
    if (activityFilter === 'anne' && !actor.includes('anne-sophie')) return false;
    if (activityFilter === 'guillaume' && !actor.includes('guillaume')) return false;
    if (activityFilter === 'ai' && !(actor.includes('via') || actor.includes('chatgpt') || actor.includes('claude'))) return false;
    if (activityProjectFilter !== 'all' && a.projectId !== activityProjectFilter) return false;
    if (q && !`${a.actor || ''} ${a.text || ''} ${project(a.projectId)?.name || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  return pageHeader('Activité', 'Historique lisible de ce qui a réellement changé') + `
    <div class="tabs">
      ${filters.map(([value,label]) => `<button class="${activityFilter === value ? 'active' : ''}" data-activity-filter="${value}">${label}</button>`).join('')}
    </div>
    <div class="toolbar activity-toolbar"><input id="activitySearch" class="search-field" value="${esc(activitySearch)}" placeholder="Rechercher dans l’activité…" /><select id="activityProjectFilter"><option value="all">Tous les projets</option>${state.projects.map(p => `<option value="${p.id}" ${activityProjectFilter === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <section class="section"><div class="activity-list">${visible.map(renderActivityItem).join('') || '<div class="empty-line">Aucune activité dans ce filtre.</div>'}</div></section>`;
}


function reportSourceLabel(report) {
  if (report.source === 'manual') return 'Ajout manuel';
  return aiAgentLabel(report.sourceAgent);
}

function renderReportList(items, emptyText) {
  if (!items?.length) return `<p class="report-empty-line">${esc(emptyText)}</p>`;
  return `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

function renderDailyReportCard(member, reports) {
  const activeAgents = aiAgentsForPerson(member.id);
  const plannedAgents = aiAgentsForPerson(member.id, true).filter(a => a.active === false);
  if (!reports.length) return `<article class="daily-report-card report-missing">
    <header><div class="report-person"><span>${personInitials(member.name)}</span><div><strong>${esc(member.name)}</strong><small>${esc(member.role)} · ${activeAgents.length} IA active${activeAgents.length > 1 ? 's' : ''}</small></div></div><span class="report-status missing">Manquant</span></header>
    <div class="report-agent-chips">${activeAgents.map(a => `<span>${esc(a.name)}</span>`).join('')}${plannedAgents.map(a => `<span class="planned">${esc(a.name)} · prévu</span>`).join('')}</div>
    <div class="report-missing-body"><strong>Aucun compte rendu pour cette journée.</strong><small>Chaque IA active pourra envoyer son propre mini compte rendu. Pilotage les consolidera par personne.</small></div>
    <footer><button class="secondary-btn" data-report-new-person="${member.id}">+ Ajouter manuellement</button></footer>
  </article>`;
  const consolidated = consolidatePersonDailyReports(member.id, dailyReportDate);
  const projectNames = consolidated.projectIds.map(id => project(id)?.name).filter(Boolean);
  return `<article class="daily-report-card ${consolidated.allValidated ? 'report-validated' : ''}">
    <header><div class="report-person"><span>${personInitials(member.name)}</span><div><strong>${esc(member.name)}</strong><small>${esc(member.role)} · ${reports.length} source${reports.length > 1 ? 's' : ''}</small></div></div><span class="report-status ${consolidated.allValidated ? 'validated' : 'draft'}">${consolidated.allValidated ? 'Tout validé' : `${consolidated.validatedCount}/${reports.length} validé${reports.length > 1 ? 's' : ''}`}</span></header>
    <div class="report-summary"><small>RÉSUMÉ CONSOLIDÉ</small><strong>${esc(consolidated.summary || 'Sans résumé')}</strong></div>
    <div class="report-columns">
      <section><h3>Réalisé</h3>${renderReportList(consolidated.achievements, 'Aucune réalisation renseignée.')}</section>
      <section><h3>Blocages</h3>${renderReportList(consolidated.blockers, 'Aucun blocage signalé.')}</section>
      <section><h3>Suite</h3>${renderReportList(consolidated.nextSteps, 'Aucune prochaine étape renseignée.')}</section>
    </div>
    <div class="report-source-list">
      ${reports.map(report => `<div class="report-source-row"><div class="report-source-meta"><span class="source-badge ${report.source === 'manual' ? 'manual' : 'ai'}">${esc(reportSourceLabel(report))}</span><p>${esc(report.summary || 'Sans résumé')}</p></div><div class="report-source-actions"><span class="report-status ${report.validatedAt ? 'validated' : 'draft'}">${report.validatedAt ? 'Validé' : 'À relire'}</span><button class="secondary-btn" data-edit-report="${report.id}">Modifier</button>${report.validatedAt ? '' : `<button class="primary-btn" data-validate-report="${report.id}">Valider</button>`}</div></div>`).join('')}
    </div>
    ${projectNames.length ? `<div class="report-projects">${projectNames.map(name => `<span>${esc(name)}</span>`).join('')}</div>` : ''}
    <footer><small>${reports.length} compte${reports.length > 1 ? 's' : ''} rendu${reports.length > 1 ? 's' : ''} consolidé${reports.length > 1 ? 's' : ''}</small><div><button class="secondary-btn" data-report-new-person="${member.id}">+ Complément manuel</button></div></footer>
  </article>`;
}

function renderDailyReports() {
  const summary = teamDailySummary(dailyReportDate);
  const members = dailyReportPersonFilter === 'all' ? state.team : state.team.filter(m => m.id === dailyReportPersonFilter);
  return pageHeader('Comptes rendus', 'Plusieurs IA peuvent contribuer pour une même personne ; Pilotage consolide ensuite la journée', '<div class="header-actions report-header-actions"><button class="secondary-btn" id="collectDailyReports">✦ Simuler collecte multi-IA</button><button class="primary-btn" data-action="new-report">+ Ajouter manuellement</button></div>') + `
    <section class="report-automation-banner"><div><span>✦</span><div><strong>Automatisation multi-IA prévue</strong><small>Une personne peut utiliser plusieurs IA. Chaque agent envoie uniquement son mini compte rendu autorisé ; Pilotage les regroupe ensuite par personne et par journée, sans que les IA lisent les conversations des autres.</small></div></div></section>
    <div class="toolbar report-toolbar"><label class="report-date-field"><span>Journée</span><input id="reportDateFilter" type="date" value="${dailyReportDate}" /></label><select id="reportPersonFilter"><option value="all">Toute l’équipe</option>${state.team.map(m => `<option value="${m.id}" ${dailyReportPersonFilter === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
    <section class="team-report-summary">
      <div class="team-report-main"><span class="report-progress-ring large">${summary.received}/${summary.expected}</span><div><small>SYNTHÈSE ÉQUIPE</small><h2>${esc(summary.text)}</h2></div></div>
      <div class="team-report-stats"><span><b>${summary.achievements}</b><small>Réalisations</small></span><span class="${summary.blockers ? 'stat-warning' : ''}"><b>${summary.blockers}</b><small>Blocages</small></span><span><b>${summary.nextSteps}</b><small>Suites</small></span><span><b>${summary.sources}</b><small>Sources reçues</small></span><span class="${summary.validated === summary.sources && summary.sources ? 'stat-ok' : ''}"><b>${summary.validated}</b><small>Sources validées</small></span></div>
    </section>
    <section class="daily-report-grid">${members.map(member => renderDailyReportCard(member, dailyReportsForPerson(member.id, dailyReportDate))).join('')}</section>`;
}

function renderDailyReportModal() {
  const report = dailyReportEditId ? state.dailyReports.find(r => r.id === dailyReportEditId) : null;
  const selectedPerson = report?.personId || dailyReportPresetPersonId || state.currentUser.id;
  const selectedDate = report?.reportDate || dailyReportDate;
  const achievements = (report?.achievements || []).join('\n');
  const blockers = (report?.blockers || []).join('\n');
  const nextSteps = (report?.nextSteps || []).join('\n');
  const mainProject = report?.projectIds?.[0] || '';
  const aiLocked = report?.source === 'ai';
  const personField = aiLocked
    ? `<div class="form-field form-field-full"><span>Personne</span><div class="report-locked-source"><b>${esc(teamName(selectedPerson))}</b><small>Source liée à ${esc(reportSourceLabel(report))}</small></div><input type="hidden" id="dailyReportPerson" value="${selectedPerson}" /></div>`
    : `<label class="form-field form-field-full"><span>Personne</span>${teamPicker('dailyReportPerson', selectedPerson)}</label>`;
  return `<div class="modal-backdrop" id="dailyReportBackdrop"></div><div class="modal-card report-modal" role="dialog" aria-modal="true">
    <header><div><small>${report ? 'MODIFIER' : 'AJOUT MANUEL'}</small><h2>${report ? 'Compte rendu quotidien' : 'Ajouter un compte rendu'}</h2></div><button class="icon-btn" id="closeDailyReport">×</button></header>
    <div class="form-grid">
      ${personField}
      ${report ? `<div class="form-field form-field-full"><span>Source</span><div class="report-locked-source"><b>${esc(reportSourceLabel(report))}</b><small>${report.source === 'manual' ? 'Saisie humaine' : 'Compte rendu reçu depuis un agent IA'}</small></div></div>` : ''}
      <label class="form-field"><span>Date</span><input id="dailyReportDateInput" type="date" value="${selectedDate}" /></label>
      <label class="form-field"><span>Projet principal (optionnel)</span><select id="dailyReportProject"><option value="">Aucun / plusieurs projets</option>${state.projects.filter(p => !p.archived).map(p => `<option value="${p.id}" ${mainProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="form-field form-field-full"><span>Résumé</span><textarea id="dailyReportSummary" rows="3" placeholder="Résumé très court de la journée…">${esc(report?.summary || '')}</textarea></label>
      <label class="form-field form-field-full"><span>Ce qui a été réalisé — 1 ligne par élément</span><textarea id="dailyReportAchievements" rows="4" placeholder="Ex. Module de planification terminé">${esc(achievements)}</textarea></label>
      <label class="form-field form-field-full"><span>Blocages — 1 ligne par élément</span><textarea id="dailyReportBlockers" rows="3" placeholder="Laisser vide si aucun blocage">${esc(blockers)}</textarea></label>
      <label class="form-field form-field-full"><span>Prochaines étapes — 1 ligne par élément</span><textarea id="dailyReportNextSteps" rows="3" placeholder="Ex. Tester demain matin">${esc(nextSteps)}</textarea></label>
    </div>
    <footer><button class="secondary-btn" id="cancelDailyReport">Annuler</button><button class="primary-btn" id="saveDailyReport">${report ? 'Enregistrer' : 'Ajouter le compte rendu'}</button></footer>
  </div>`;
}

function openDailyReportModal(reportId = null, personId = null) {
  dailyReportEditId = reportId;
  dailyReportPresetPersonId = reportId ? null : (personId || null);
  dailyReportModalOpen = true;
  if (!reportId && personId) {
    const existing = manualDailyReportForPerson(personId, dailyReportDate);
    if (existing) {
      dailyReportEditId = existing.id;
      dailyReportPresetPersonId = null;
    }
  }
  notificationOpen = false;
  quickActionOpen = false;
  trace(TAGS.REPORT_PERSON_PRESET, 'Personne préselectionnée pour le compte rendu', { personId:dailyReportPresetPersonId });
  trace(TAGS.REPORT_MODAL, 'Ouverture compte rendu', { reportId:dailyReportEditId, personId });
  render();
}

function closeDailyReportModal() {
  dailyReportModalOpen = false;
  dailyReportEditId = null;
  dailyReportPresetPersonId = null;
  render();
}

function saveDailyReportFromForm() {
  const personId = document.querySelector('#dailyReportPerson')?.value || state.currentUser.id;
  const reportDate = document.querySelector('#dailyReportDateInput')?.value || dailyReportDate;
  const summaryInput = document.querySelector('#dailyReportSummary');
  const summary = summaryInput?.value.trim() || '';
  if (!summary) { summaryInput?.classList.add('field-error'); summaryInput?.focus(); return; }
  const projectId = document.querySelector('#dailyReportProject')?.value || null;
  const payload = {
    reportDate, personId, summary,
    achievements: splitReportLines(document.querySelector('#dailyReportAchievements')?.value || ''),
    blockers: splitReportLines(document.querySelector('#dailyReportBlockers')?.value || ''),
    nextSteps: splitReportLines(document.querySelector('#dailyReportNextSteps')?.value || ''),
    projectIds: projectId ? [projectId] : [], updatedAt:new Date().toISOString()
  };
  let report = dailyReportEditId ? state.dailyReports.find(r => r.id === dailyReportEditId) : manualDailyReportForPerson(personId, reportDate);
  if (report) {
    const changedPerson = report.personId !== personId || report.reportDate !== reportDate;
    if (changedPerson && report.source === 'manual') {
      const duplicate = state.dailyReports.find(r => r.id !== report.id && r.source === 'manual' && r.personId === personId && r.reportDate === reportDate);
      if (duplicate) { window.alert('Un complément manuel existe déjà pour cette personne et cette date. Modifie celui-ci directement.'); return; }
    }
    Object.assign(report, payload);
    report.source = report.source || 'manual';
    report.status = report.validatedAt ? 'validated' : 'draft';
    addActivity({ actor:teamName(personId), projectId, text:`Compte rendu (${reportSourceLabel(report)}) du ${formatDate(reportDate)} modifié`, internalTag:TAGS.REPORT_EDIT });
    persist(TAGS.REPORT_EDIT, 'Compte rendu modifié', { reportId:report.id, personId, reportDate, sourceAgent:report.sourceAgent || null });
  } else {
    report = { id:crypto.randomUUID(), ...payload, source:'manual', sourceAgent:null, status:'draft', createdAt:new Date().toISOString(), validatedAt:null };
    state.dailyReports.unshift(report);
    addActivity({ actor:teamName(personId), projectId, text:`Complément manuel du ${formatDate(reportDate)} ajouté`, internalTag:TAGS.REPORT_MANUAL_CREATE });
    persist(TAGS.REPORT_MANUAL_CREATE, 'Compte rendu manuel créé', { reportId:report.id, personId, reportDate });
  }
  dailyReportDate = reportDate;
  dailyReportModalOpen = false;
  dailyReportEditId = null;
  dailyReportPresetPersonId = null;
  currentPage = 'reports';
  render();
}

function validateDailyReport(reportId) {
  const report = state.dailyReports.find(r => r.id === reportId);
  if (!report || report.validatedAt) return;
  report.validatedAt = new Date().toISOString();
  report.validatedBy = state.currentUser.id;
  report.status = 'validated';
  report.updatedAt = new Date().toISOString();
  addActivity({ actor:'Thibault', projectId:report.projectIds?.[0] || null, text:`Compte rendu de ${teamName(report.personId)} du ${formatDate(report.reportDate)} validé`, internalTag:TAGS.REPORT_VALIDATE });
  persist(TAGS.REPORT_VALIDATE, 'Compte rendu validé', { reportId, personId:report.personId, reportDate:report.reportDate });
  render();
}

function renderMore() {
  return pageHeader('Plus', 'Outils complémentaires de la démo') + `<div class="menu-list"><button data-page="reports">Comptes rendus <span>→</span></button><button data-page="documents">Documents <span>→</span></button><button data-page="activity">Activité <span>→</span></button><button id="exportDemo">Sauvegarder la démo <span>↓</span></button><button id="importDemo">Restaurer une sauvegarde <span>↑</span></button></div>`;
}

function renderQuickActionModal() {
  const unplanned = state.tasks.find(t => t.needsPlanning && t.planningStatus === 'unplanned');
  const approval = pendingApprovals()[0];
  return `<div class="modal-backdrop" id="quickActionBackdrop"></div><div class="quick-action-modal" role="dialog" aria-modal="true">
    <header><div><small>ACTIONS RAPIDES</small><h2>Que veux-tu faire ?</h2></div><button class="icon-btn" id="closeQuickAction">×</button></header>
    <div class="quick-action-grid">
      <button data-quick-action="task"><span>✓</span><div><strong>Nouvelle tâche</strong><small>Créer et assigner rapidement</small></div></button>
      <button data-quick-action="project"><span>▦</span><div><strong>Nouveau projet</strong><small>Créer un projet complet</small></div></button>
      <button data-quick-action="document"><span>▤</span><div><strong>Lier un document</strong><small>Référence Google Drive</small></div></button>
      <button data-quick-action="report"><span>☷</span><div><strong>Compte rendu manuel</strong><small>Ajouter le mini bilan du jour</small></div></button>
      <button data-quick-action="planning" ${unplanned ? '' : 'disabled'}><span>↔</span><div><strong>Planifier le prochain élément</strong><small>${unplanned ? esc(unplanned.title) : 'Rien à planifier'}</small></div></button>
      <button data-quick-action="approval" ${approval ? '' : 'disabled'}><span>!</span><div><strong>Traiter une validation</strong><small>${approval ? esc(project(approval.projectId)?.name || 'Projet') : 'Aucune validation'}</small></div></button>
      <button data-quick-action="notifications"><span>♢</span><div><strong>Centre de notifications</strong><small>${unreadNotifications()} non lue${unreadNotifications() > 1 ? 's' : ''}</small></div></button>
    </div>
  </div>`;
}

function renderNotifications() {
  const active = state.notifications.filter(n => !n.resolved).filter(n => {
    if (notificationFilter === 'all') return true;
    if (notificationFilter === 'action') return n.severity === 'action';
    if (notificationFilter === 'warning') return n.severity === 'warning';
    if (notificationFilter === 'error') return n.severity === 'error';
    return true;
  });
  const actionHtml = n => {
    if (n.actionType === 'plan') return `<button class="text-button" data-plan="${n.taskId}" data-notif-read="${n.id}">Planifier →</button>`;
    if (n.actionType === 'approval') return `<button class="text-button" data-approval="${n.changeRequestId}" data-notif-read="${n.id}">Examiner →</button>`;
    if (n.actionType === 'edit_task') return `<button class="text-button" data-edit-task="${n.taskId}" data-notif-read="${n.id}">Ouvrir la tâche →</button>`;
    if (n.actionType === 'open_project') return `<button class="text-button" data-open-project="${n.projectId}" data-notif-read="${n.id}">Ouvrir le projet →</button>`;
    if (n.actionType === 'retry') return `<button class="text-button" data-retry-notif="${n.id}">Réessayer (démo) →</button>`;
    return `<button class="text-button" data-notif-read="${n.id}">Marquer lu</button>`;
  };
  return `<div class="drawer-backdrop" id="drawerBackdrop"></div><aside class="notification-drawer">
    <header><div><h2>Notifications</h2><small>${state.notifications.filter(n => !n.resolved).length} active${state.notifications.filter(n => !n.resolved).length > 1 ? 's' : ''} · ${unreadNotifications()} non lue${unreadNotifications() > 1 ? 's' : ''}</small></div><button class="icon-btn" id="closeNotif">×</button></header>
    <div class="drawer-tabs">
      <button class="${notificationFilter === 'all' ? 'active' : ''}" data-notif-filter="all">Toutes</button>
      <button class="${notificationFilter === 'action' ? 'active' : ''}" data-notif-filter="action">À traiter</button>
      <button class="${notificationFilter === 'warning' ? 'active' : ''}" data-notif-filter="warning">Alertes</button>
      <button class="${notificationFilter === 'error' ? 'active' : ''}" data-notif-filter="error">Erreurs</button>
    </div>
    <div class="notification-bulk"><button class="quiet-action" id="markAllRead">Tout marquer lu</button>${pendingApprovals().length ? `<button class="text-button" id="openFirstApproval">Traiter une validation</button>` : ''}</div>
    <div class="notification-list">
      ${active.map(n => `<article class="notification-item severity-${n.severity} ${n.read ? 'is-read' : 'is-unread'}" data-notif="${n.id}"><span class="notif-dot"></span><div><div class="notif-title-line"><strong>${esc(n.title)}</strong>${Number(n.count || 1) > 1 ? `<span class="count-badge">×${n.count}</span>` : ''}</div><p>${esc(n.message)}</p><div class="notif-actions">${actionHtml(n)}${!n.read ? `<button class="quiet-action" data-notif-read="${n.id}">Lu</button>` : ''}${n.actionType !== 'approval' && n.actionType !== 'plan' && !['deadline','blocker'].includes(n.type) ? `<button class="quiet-action" data-resolve="${n.id}">Résoudre</button>` : ''}</div></div></article>`).join('') || '<div class="empty-state">Aucune notification dans ce filtre.</div>'}
    </div>
  </aside>`;
}

function renderPlanningModal(taskId) {
  const t = task(taskId);
  if (!t) return '';
  const selectedBucket = t.planningBucket || 'backlog';
  return `<div class="modal-backdrop" id="modalBackdrop"></div><div class="modal-card form-modal" role="dialog" aria-modal="true">
    <header><div><small>${t.needsPlanning ? 'NOUVEL ÉLÉMENT' : 'PLANIFICATION'}</small><h2>${t.needsPlanning ? 'Planifier cette tâche' : 'Déplacer ou dater la tâche'}</h2></div><button class="icon-btn" id="closePlan">×</button></header>
    <div class="modal-task"><strong>${esc(t.title)}</strong><span>${esc(project(t.projectId)?.name || 'Sans projet')}</span></div>
    <div class="form-grid compact-grid">
      <div class="form-field form-field-full"><span>Responsable</span>${teamPicker('planOwner', t.assignedTo)}</div>
      <label class="form-field"><span>Jour prévu (optionnel)</span><input id="planScheduledFor" type="date" value="${esc(t.scheduledFor || '')}" /></label>
      <label class="form-field"><span>Échéance (optionnelle)</span><input id="planDueAt" type="date" value="${esc(dateKey(t.dueAt))}" /></label>
    </div>
    <fieldset class="plan-options"><legend>Période Roadmap</legend>
      ${['this_week','this_month','next_3_months','later','backlog'].map(bucket => `<label><input type="radio" name="planBucket" value="${bucket}" ${bucket === selectedBucket ? 'checked' : ''}/><span>${planningLabels[bucket]}</span></label>`).join('')}
    </fieldset>
    ${t.suggestedBucket && t.needsPlanning ? `<p class="ai-suggestion">Suggestion IA : <strong>${planningLabels[t.suggestedBucket]}</strong></p>` : ''}
    <footer><button class="secondary-btn" id="cancelPlan">Annuler</button><button class="primary-btn" id="confirmPlan" data-task="${t.id}">Enregistrer</button></footer>
  </div>`;
}

function renderTaskModal() {
  const existing = taskEditId ? task(taskEditId) : null;
  const defaultProject = existing?.projectId || taskModalProjectId || '';
  const owner = existing?.assignedTo || state.currentUser.id;
  const priority = existing?.priority || 'medium';
  const status = existing?.status || 'todo';
  const bucket = existing?.planningBucket || 'this_week';
  const scheduled = existing?.scheduledFor || (!existing && currentPage === 'today' ? '2026-09-17' : '');
  const due = dateKey(existing?.dueAt);
  return `<div class="modal-backdrop" id="taskModalBackdrop"></div><div class="modal-card form-modal" role="dialog" aria-modal="true">
    <header><div><small>${existing ? 'MODIFIER LA TÂCHE' : 'NOUVELLE TÂCHE'}</small><h2>${existing ? esc(existing.title) : 'Ajouter une tâche'}</h2></div><button class="icon-btn" id="closeTaskModal">×</button></header>
    <div class="form-grid">
      <label class="form-field form-field-full"><span>Titre</span><input id="taskTitle" type="text" value="${esc(existing?.title || '')}" placeholder="Ex. Tester la nouvelle intégration" maxlength="120" /></label>
      <label class="form-field form-field-full"><span>Projet</span><select id="taskProject"><option value="">Sans projet</option>${state.projects.filter(p => !p.archived || p.id === defaultProject).map(p => `<option value="${p.id}" ${defaultProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <div class="form-field form-field-full"><span>Responsable — clique sur une personne</span>${teamPicker('taskOwner', owner)}</div>
      <label class="form-field"><span>Priorité</span><select id="taskPriority">${Object.entries(priorityLabels).map(([value,label]) => `<option value="${value}" ${value === priority ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="form-field"><span>État</span><select id="taskStatus">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${value === status ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="form-field"><span>Période Roadmap</span><select id="taskPlanning">${['backlog','this_week','this_month','next_3_months','later'].map(value => `<option value="${value}" ${value === bucket ? 'selected' : ''}>${planningLabels[value]}</option>`).join('')}</select></label>
      <label class="form-field"><span>Jour prévu</span><input id="taskScheduledFor" type="date" value="${esc(scheduled)}" /></label>
      <label class="form-field"><span>Échéance</span><input id="taskDueAt" type="date" value="${esc(due)}" /></label>
    </div>
    <footer><button class="secondary-btn" id="cancelTaskModal">Annuler</button><button class="primary-btn" id="saveTask">${existing ? 'Enregistrer' : 'Ajouter la tâche'}</button></footer>
  </div>`;
}

function renderProjectModal() {
  const existing = projectEditId ? project(projectEditId) : null;
  const owner = existing?.owner || state.currentUser.id;
  const priority = existing?.priority || 'medium';
  const status = existing?.status || 'in_progress';
  const progress = Number(existing?.progress || 0);
  return `<div class="modal-backdrop" id="projectModalBackdrop"></div><div class="modal-card form-modal" role="dialog" aria-modal="true">
    <header><div><small>${existing ? 'MODIFIER LE PROJET' : 'NOUVEAU PROJET'}</small><h2>${existing ? esc(existing.name) : 'Créer un projet'}</h2></div><button class="icon-btn" id="closeProjectModal">×</button></header>
    <div class="form-grid">
      <label class="form-field form-field-full"><span>Nom du projet</span><input id="projectName" type="text" value="${esc(existing?.name || '')}" placeholder="Ex. Module SAV fournisseurs" maxlength="120" /></label>
      <div class="form-field form-field-full"><span>Responsable — clique sur une personne</span>${teamPicker('projectOwner', owner)}</div>
      <label class="form-field"><span>Priorité</span><select id="projectPriority">${Object.entries(priorityLabels).map(([value,label]) => `<option value="${value}" ${value === priority ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="form-field"><span>État</span><select id="projectStatus">${Object.entries(statusLabels).filter(([value]) => existing || value !== 'completed').map(([value,label]) => `<option value="${value}" ${value === status ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="form-field form-field-full range-field"><span>Progression <output id="projectProgressValue">${progress} %</output></span><input id="projectProgress" type="range" min="0" max="100" step="5" value="${progress}" /></label>
      <label class="form-field form-field-full"><span>Blocage actuel</span><input id="projectBlocker" type="text" value="${esc(existing?.blocker || '')}" placeholder="Laisser vide s’il n’y a aucun blocage" maxlength="180" /></label>
      <label class="form-field form-field-full"><span>Prochaine action</span><input id="projectNextAction" type="text" value="${esc(existing?.nextAction || '')}" placeholder="Ex. Définir le cahier fonctionnel" maxlength="160" /></label>
    </div>
    <footer><button class="secondary-btn" id="cancelProjectModal">Annuler</button><button class="primary-btn" id="saveProject">${existing ? 'Enregistrer' : 'Créer le projet'}</button></footer>
  </div>`;
}

function renderAiSimulationModal() {
  return `<div class="modal-backdrop" id="aiSimulationBackdrop"></div><div class="modal-card form-modal ai-demo-modal" role="dialog" aria-modal="true">
    <header><div><small>SIMULATION IA</small><h2>Tester les flux automatiques</h2></div><button class="icon-btn" id="closeAiSimulation">×</button></header>
    <div class="ai-demo-intro"><span>✦</span><p>Teste plusieurs cas réalistes : nouvelle tâche, progression automatique, blocage, demande de clôture ou erreur technique.</p></div>
    <div class="form-grid">
      <label class="form-field form-field-full"><span>Type de mise à jour</span><select id="aiMode">
        <option value="new_task">Nouvelle tâche importante → à planifier</option>
        <option value="routine_progress">Progression normale → automatique</option>
        <option value="blocker">Nouveau blocage → automatique + alerte</option>
        <option value="complete_project">Projet proposé comme terminé → validation Thibault</option>
        <option value="technical_error">Erreur technique → notification regroupée</option><option value="duplicate_request">Rejouer une requête IA → doublon ignoré</option>
      </select></label>
      <label class="form-field form-field-full"><span>Source</span><select id="aiSource">${activeAiAgents().map(agent => `<option value="${agent.id}">${esc(aiAgentLabel(agent.id))}</option>`).join('')}</select></label>
      <label class="form-field form-field-full"><span>Projet</span><select id="aiProject"><option value="">Sans projet</option>${state.projects.filter(p => !p.archived).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label class="form-field form-field-full" data-ai-section="detail"><span id="aiDetailLabel">Nouvel élément détecté</span><input id="aiTaskTitle" type="text" value="Ajouter le contrôle automatique des marges" maxlength="180" /></label>
      <label class="form-field" data-ai-section="progress"><span>Nouvelle progression</span><input id="aiProgress" type="number" min="0" max="100" step="5" value="80" /></label>
      <div class="form-field form-field-full" data-ai-section="new-task"><span>Responsable proposé</span>${teamPicker('aiOwner', state.currentUser.id)}</div>
      <label class="form-field" data-ai-section="new-task"><span>Priorité proposée</span><select id="aiPriority">${Object.entries(priorityLabels).map(([value,label]) => `<option value="${value}" ${value === 'medium' ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="form-field form-field-full" data-ai-section="new-task"><span>Suggestion IA pour la Roadmap</span><select id="aiSuggestedBucket">${['this_week','this_month','next_3_months','later','backlog'].map(value => `<option value="${value}" ${value === 'this_month' ? 'selected' : ''}>${planningLabels[value]}</option>`).join('')}</select></label>
    </div>
    <div class="ai-demo-rule" id="aiRuleText"><strong>Règle :</strong> l’IA suggère une période, mais elle ne décide jamais à ta place.</div>
    <footer><button class="secondary-btn" id="cancelAiSimulation">Annuler</button><button class="primary-btn ai-submit-btn" id="runAiSimulation">Simuler</button></footer>
  </div>`;
}

function renderApprovalModal(requestId) {
  const request = state.changeRequests.find(r => r.id === requestId);
  const p = request ? project(request.projectId) : null;
  if (!request || !p) return '';
  return `<div class="modal-backdrop" id="approvalBackdrop"></div><div class="modal-card approval-modal" role="dialog" aria-modal="true">
    <header><div><small>VALIDATION HUMAINE</small><h2>Passer le projet en Terminé ?</h2></div><button class="icon-btn" id="closeApproval">×</button></header>
    <div class="approval-project"><span class="status-dot status-${p.status}"></span><div><strong>${esc(p.name)}</strong><small>État actuel : ${esc(statusLabels[p.status])} · ${p.progress} %</small></div></div>
    <div class="approval-summary"><div><small>Demandé par</small><strong>${esc(request.requestedBy)}</strong></div><div><small>Action proposée</small><strong>Terminé · 100 %</strong></div></div>
    ${request.note ? `<p class="approval-note">${esc(request.note)}</p>` : ''}
    <p class="form-note">La progression peut évoluer automatiquement, mais le passage officiel du projet en <strong>Terminé</strong> demande une décision humaine.</p>
    <footer><button class="danger-ghost-btn" id="rejectApproval" data-request="${request.id}">Refuser</button><button class="primary-btn" id="approveApproval" data-request="${request.id}">Valider le passage en Terminé</button></footer>
  </div>`;
}

function renderDocumentModal() {
  return `<div class="modal-backdrop" id="documentModalBackdrop"></div><div class="modal-card form-modal" role="dialog" aria-modal="true">
    <header><div><small>RÉFÉRENCE DRIVE</small><h2>Lier un document</h2></div><button class="icon-btn" id="closeDocumentModal">×</button></header>
    <div class="form-grid">
      <label class="form-field form-field-full"><span>Nom</span><input id="documentName" type="text" placeholder="Ex. Cahier fonctionnel V2" maxlength="140" /></label>
      <label class="form-field form-field-full"><span>Projet</span><select id="documentProject"><option value="">Sans projet</option>${state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label class="form-field"><span>Type</span><select id="documentType"><option>Document</option><option>Tableur</option><option>PDF</option><option>Plan</option></select></label>
      <label class="form-field form-field-full"><span>Lien Google Drive (optionnel dans la démo)</span><input id="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
    </div>
    <p class="form-note">Pilotage stocke uniquement la référence et le lien. Le fichier reste dans Google Drive.</p>
    <footer><button class="secondary-btn" id="cancelDocumentModal">Annuler</button><button class="primary-btn" id="saveDocument">Lier le document</button></footer>
  </div>`;
}

function renderArchiveModal(projectId) {
  const p = project(projectId);
  if (!p) return '';
  const openTasks = state.tasks.filter(t => t.projectId === projectId && t.status !== 'completed').length;
  return `<div class="modal-backdrop" id="archiveBackdrop"></div><div class="modal-card archive-modal" role="dialog" aria-modal="true">
    <header><div><small>ARCHIVAGE PROJET</small><h2>Archiver ${esc(p.name)} ?</h2></div><button class="icon-btn" id="closeArchive">×</button></header>
    <div class="archive-summary"><span>▣</span><div><strong>Le projet ne sera pas supprimé.</strong><p>Historique, tâches et documents restent conservés. Il disparaîtra seulement des vues de pilotage actives.</p></div></div>
    ${openTasks ? `<p class="archive-warning"><strong>${openTasks} tâche${openTasks > 1 ? 's' : ''} encore ouverte${openTasks > 1 ? 's' : ''}.</strong> Elles resteront attachées au projet archivé.</p>` : ''}
    <footer><button class="secondary-btn" id="cancelArchive">Annuler</button><button class="danger-solid-btn" id="confirmArchive" data-project="${p.id}">Archiver le projet</button></footer>
  </div>`;
}

function renderDeferModal(taskId) {
  const t = task(taskId);
  if (!t) return '';
  return `<div class="modal-backdrop" id="deferBackdrop"></div><div class="modal-card defer-modal" role="dialog" aria-modal="true">
    <header><div><small>REPORTER</small><h2>${esc(t.title)}</h2></div><button class="icon-btn" id="closeDefer">×</button></header>
    <p class="form-note">Choisis quand tu veux revoir cette tâche. L’action est enregistrée dans l’historique.</p>
    <div class="defer-options">
      <button data-defer-choice="tomorrow"><strong>Demain</strong><small>18 septembre</small></button>
      <button data-defer-choice="next_week"><strong>Semaine prochaine</strong><small>21 septembre</small></button>
      <button data-defer-choice="this_month"><strong>Plus tard ce mois</strong><small>Roadmap · Ce mois</small></button>
      <button data-defer-choice="backlog"><strong>À organiser</strong><small>Retirer le jour prévu</small></button>
    </div>
    <footer><button class="secondary-btn" id="cancelDefer">Annuler</button></footer>
  </div>`;
}

function renderTeamWorkloadModal() {
  const cards = state.team.map(m => {
    const tasks = state.tasks.filter(t => t.assignedTo === m.id && t.status !== 'completed' && (!t.projectId || !project(t.projectId)?.archived));
    const today = tasks.filter(t => t.scheduledFor === '2026-09-17').length;
    const overdue = tasks.filter(t => t.dueAt && new Date(t.dueAt) < DEMO_NOW).length;
    const active = tasks.filter(t => t.status === 'in_progress').length;
    const blockers = state.projects.filter(p => !p.archived && p.owner === m.id && p.blocker).length;
    return `<button class="workload-card" data-team-planning="${m.id}"><div class="workload-person"><span>${personInitials(m.name)}</span><div><strong>${esc(m.name)}</strong><small>${esc(m.role)}</small></div></div><div class="workload-stats"><span><b>${today}</b><small>Aujourd’hui</small></span><span class="${overdue ? 'stat-alert' : ''}"><b>${overdue}</b><small>Retard</small></span><span><b>${active}</b><small>En cours</small></span><span class="${blockers ? 'stat-warning' : ''}"><b>${blockers}</b><small>Blocage</small></span></div><em>Voir sa Roadmap →</em></button>`;
  }).join('');
  return `<div class="modal-backdrop" id="teamWorkloadBackdrop"></div><div class="modal-card workload-modal" role="dialog" aria-modal="true"><header><div><small>ÉQUIPE</small><h2>Charge de travail</h2></div><button class="icon-btn" id="closeTeamWorkload">×</button></header><div class="workload-list">${cards}</div><footer><button class="secondary-btn" id="cancelTeamWorkload">Fermer</button></footer></div>`;
}

function renderSearchOverlay() {
  return `<div class="modal-backdrop" id="searchBackdrop"></div><div class="search-modal"><input id="globalSearchInput" autofocus placeholder="Rechercher dans SpeedArti Pilotage…" /><div id="searchResults"><p class="search-hint">Projet, tâche, document, compte rendu ou activité.</p></div></div>`;
}

function render() {
  ensureRuntimeState();
  refreshSmartNotifications();
  let content;
  switch (currentPage) {
    case 'planning': content = renderPlanning(); break;
    case 'projects': content = renderProjects(); break;
    case 'calendar': content = renderCalendar(); break;
    case 'documents': content = renderDocuments(); break;
    case 'activity': content = renderActivity(); break;
    case 'reports': content = renderDailyReports(); break;
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
  n.readAt = n.readAt || new Date().toISOString();
  n.resolvedAt = new Date().toISOString();
  persist(TAGS.NOTIF_RESOLVE, 'Notification résolue', { id });
  render();
}

function retryNotification(id) {
  const n = state.notifications.find(x => x.id === id);
  if (!n) return;
  n.read = true;
  n.resolved = true;
  n.readAt = n.readAt || new Date().toISOString();
  n.resolvedAt = new Date().toISOString();
  addActivity({ actor:'Pilotage', projectId:n.projectId || null, text:`Nouvel essai lancé (démo) : ${n.title}`, internalTag:TAGS.NOTIF_RETRY });
  persist(TAGS.NOTIF_RETRY, 'Nouvel essai de notification technique simulé', { id, type:n.type, groupKey:n.groupKey || null });
  render();
}

function markNotificationRead(id, shouldRender = true) {
  const n = state.notifications.find(x => x.id === id);
  if (!n) return;
  n.read = true;
  n.readAt = new Date().toISOString();
  persist(TAGS.NOTIF_READ, 'Notification lue', { id });
  if (shouldRender) render();
}

function openApproval(requestId) {
  const request = state.changeRequests.find(r => r.id === requestId && r.status === 'pending');
  if (!request) return;
  approvalRequestId = requestId;
  notificationOpen = false;
  state.notifications.filter(n => n.changeRequestId === requestId).forEach(n => { n.read = true; n.readAt = new Date().toISOString(); });
  trace(TAGS.APPROVAL_MODAL, 'Ouverture validation projet', { requestId, projectId:request.projectId });
  saveState(state);
  render();
}

function closeApproval() {
  approvalRequestId = null;
  render();
}

function decideApproval(requestId, approved) {
  const request = state.changeRequests.find(r => r.id === requestId && r.status === 'pending');
  if (!request) return;
  const p = project(request.projectId);
  if (!p) return;
  request.status = approved ? 'approved' : 'rejected';
  request.decidedAt = new Date().toISOString();
  request.decidedBy = state.currentUser.id;
  if (approved) {
    p.status = 'completed';
    p.progress = 100;
    p.blocker = '';
    p.nextAction = 'Projet clôturé';
    p.updatedAt = new Date().toISOString();
    addActivity({ projectId:p.id, text:'Projet validé comme Terminé', internalTag:TAGS.PROJECT_COMPLETE_APPROVE });
    trace(TAGS.PROJECT_COMPLETE_APPROVE, 'Clôture projet approuvée', { projectId:p.id, requestId });
  } else {
    addActivity({ projectId:p.id, text:'Passage en Terminé refusé', internalTag:TAGS.PROJECT_COMPLETE_REJECT });
    trace(TAGS.PROJECT_COMPLETE_REJECT, 'Clôture projet refusée', { projectId:p.id, requestId });
  }
  state.notifications.filter(n => n.changeRequestId === requestId).forEach(n => {
    n.read = true; n.resolved = true; n.readAt = n.readAt || new Date().toISOString(); n.resolvedAt = new Date().toISOString();
  });
  approvalRequestId = null;
  persist(approved ? TAGS.PROJECT_COMPLETE_APPROVE : TAGS.PROJECT_COMPLETE_REJECT, 'Décision validation projet', { projectId:p.id, requestId, approved });
  render();
}


function openTaskModal(projectId = null, editId = null) {
  taskModalOpen = true;
  taskModalProjectId = projectId;
  taskEditId = editId;
  projectModalOpen = false;
  documentModalOpen = false;
  planningTaskId = null;
  notificationOpen = false;
  trace(editId ? TAGS.TASK_EDITOR : TAGS.TASK_MODAL, editId ? 'Ouverture édition tâche' : 'Ouverture formulaire tâche', { projectId, taskId: editId });
  render();
  requestAnimationFrame(() => document.querySelector('#taskTitle')?.focus());
}

function openTaskEditor(taskId) {
  const t = task(taskId);
  if (!t) return;
  openTaskModal(t.projectId || null, taskId);
}

function closeTaskModal() {
  taskModalOpen = false;
  taskModalProjectId = null;
  taskEditId = null;
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
  const status = document.querySelector('#taskStatus')?.value || 'todo';
  const planningBucket = document.querySelector('#taskPlanning')?.value || 'backlog';
  const scheduledFor = document.querySelector('#taskScheduledFor')?.value || null;
  const dueAt = toDueIso(document.querySelector('#taskDueAt')?.value || '');

  if (taskEditId) {
    const existing = task(taskEditId);
    if (!existing) return;
    const oldOwner = existing.assignedTo;
    const oldProject = existing.projectId;
    const oldScheduledFor = existing.scheduledFor || null;
    const oldDueAt = existing.dueAt || null;
    Object.assign(existing, {
      title, projectId, assignedTo, priority, status, planningBucket, scheduledFor, dueAt,
      planningStatus: 'planned', needsPlanning: false, sortOrder: existing.sortOrder || Date.now(),
      completedAt: status === 'completed' ? (existing.completedAt || new Date().toISOString()) : null,
      updatedAt: new Date().toISOString()
    });
    addActivity({ projectId, text: `Tâche modifiée : ${title}`, internalTag: TAGS.TASK_EDIT });
    if (oldOwner !== assignedTo) addActivity({ projectId, text: `${title} assignée à ${teamName(assignedTo)}`, internalTag: TAGS.TASK_ASSIGN });
    if (oldScheduledFor !== scheduledFor || oldDueAt !== dueAt) addActivity({ projectId, text: `Planification mise à jour : ${title}`, internalTag: TAGS.TASK_SCHEDULE });
    persist(TAGS.TASK_EDIT, 'Tâche modifiée', { taskId: existing.id, oldProject, projectId, assignedTo, planningBucket, scheduledFor, dueAt });
  } else {
    const newTask = {
      id: crypto.randomUUID(), title, projectId, assignedTo, status, priority, scheduledFor, dueAt,
      planningStatus: 'planned', planningBucket, needsPlanning: false, sortOrder: Date.now(),
      sourceType: 'manual', createdAt: new Date().toISOString(), completedAt: status === 'completed' ? new Date().toISOString() : null
    };
    state.tasks.push(newTask);
    addActivity({ projectId, text: `Nouvelle tâche créée : ${title} · ${teamName(assignedTo)}`, internalTag: TAGS.TASK_CREATE });
    persist(TAGS.TASK_CREATE, 'Tâche créée manuellement', { taskId: newTask.id, projectId, assignedTo, planningBucket, scheduledFor, dueAt });
  }
  taskModalOpen = false;
  taskModalProjectId = null;
  taskEditId = null;
  render();
}

function openProjectModal(editId = null) {
  projectModalOpen = true;
  projectEditId = editId;
  taskModalOpen = false;
  taskEditId = null;
  documentModalOpen = false;
  planningTaskId = null;
  notificationOpen = false;
  trace(editId ? TAGS.PROJECT_EDITOR : TAGS.PROJECT_MODAL, editId ? 'Ouverture édition projet' : 'Ouverture formulaire projet', { projectId: editId });
  render();
  requestAnimationFrame(() => document.querySelector('#projectName')?.focus());
}

function closeProjectModal() {
  projectModalOpen = false;
  projectEditId = null;
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
  const progress = Number(document.querySelector('#projectProgress')?.value || 0);
  const blocker = document.querySelector('#projectBlocker')?.value.trim() || '';
  const nextAction = document.querySelector('#projectNextAction')?.value.trim() || 'À définir';

  if (projectEditId) {
    const existing = project(projectEditId);
    if (!existing) return;
    const oldOwner = existing.owner;
    const oldProgress = Number(existing.progress || 0);
    const requestedCompletion = status === 'completed' && existing.status !== 'completed';
    const savedStatus = requestedCompletion ? existing.status : status;
    const savedProgress = progress;
    Object.assign(existing, { name, owner, priority, status:savedStatus, progress:savedProgress, blocker, nextAction, updatedAt:new Date().toISOString() });
    existing.members = [...new Set([...(existing.members || []), state.currentUser.id, owner])];
    addActivity({ projectId: existing.id, text: `Projet mis à jour · ${savedProgress} % · ${statusLabels[savedStatus]}`, internalTag: TAGS.PROJECT_EDIT });
    if (requestedCompletion) { const request = queueProjectCompletion(existing.id, { sourceType:'manual', requestedBy:'Thibault', note:'Demande effectuée depuis la fiche projet' }); if (request) approvalRequestId = request.id; }
    if (oldOwner !== owner) addActivity({ projectId: existing.id, text: `Responsable projet : ${teamName(owner)}`, internalTag: TAGS.PROJECT_OWNER });
    if (oldProgress !== progress) addActivity({ projectId: existing.id, text: `Progression : ${oldProgress} % → ${progress} %`, internalTag: TAGS.PROJECT_PROGRESS });
    persist(TAGS.PROJECT_EDIT, 'Projet modifié', { projectId: existing.id, owner, priority, status:existing.status, progress:existing.progress, blocker });
  } else {
    const id = crypto.randomUUID();
    const newProject = { id, name, owner, members:[...new Set([state.currentUser.id, owner])], status, priority, progress, blocker, nextAction, updatedAt:new Date().toISOString() };
    state.projects.unshift(newProject);
    addActivity({ projectId:id, text:`Nouveau projet créé : ${name}`, internalTag:TAGS.PROJECT_CREATE });
    persist(TAGS.PROJECT_CREATE, 'Projet créé manuellement', { projectId:id, owner, priority, status });
    selectedProjectId = id;
    currentPage = 'projects';
  }
  projectModalOpen = false;
  projectEditId = null;
  render();
}

function openDocumentModal() {
  documentModalOpen = true;
  taskModalOpen = false;
  taskEditId = null;
  projectModalOpen = false;
  projectEditId = null;
  planningTaskId = null;
  notificationOpen = false;
  trace(TAGS.DOCUMENT_MODAL, 'Ouverture liaison document Drive');
  render();
  requestAnimationFrame(() => document.querySelector('#documentName')?.focus());
}

function closeDocumentModal() {
  documentModalOpen = false;
  render();
}

function createDocumentFromForm() {
  const nameInput = document.querySelector('#documentName');
  const name = nameInput?.value.trim();
  if (!name) { nameInput?.classList.add('field-error'); nameInput?.focus(); return; }
  const projectId = document.querySelector('#documentProject')?.value || null;
  const type = document.querySelector('#documentType')?.value || 'Document';
  const url = document.querySelector('#documentUrl')?.value.trim() || '';
  const id = crypto.randomUUID();
  state.documents.push({ id, projectId, name, type, source:'Google Drive', url });
  addActivity({ projectId, text:`Document lié : ${name}`, internalTag:TAGS.DOCUMENT_LINK });
  persist(TAGS.DOCUMENT_LINK, 'Référence Drive ajoutée', { documentId:id, projectId, type, hasUrl:Boolean(url) });
  documentModalOpen = false;
  render();
}

function openAiSimulation() {
  aiSimulationOpen = true;
  taskModalOpen = false;
  taskEditId = null;
  projectModalOpen = false;
  projectEditId = null;
  documentModalOpen = false;
  planningTaskId = null;
  notificationOpen = false;
  trace(TAGS.AI_SIMULATION_MODAL, 'Ouverture simulation IA');
  render();
  requestAnimationFrame(() => document.querySelector('#aiTaskTitle')?.focus());
}

function closeAiSimulation() {
  aiSimulationOpen = false;
  render();
}

function syncAiSimulationFields() {
  const mode = document.querySelector('#aiMode')?.value || 'new_task';
  document.querySelectorAll('[data-ai-section="new-task"]').forEach(el => el.hidden = mode !== 'new_task');
  document.querySelectorAll('[data-ai-section="progress"]').forEach(el => el.hidden = mode !== 'routine_progress');
  const detail = document.querySelector('[data-ai-section="detail"]');
  if (detail) detail.hidden = ['complete_project','routine_progress','duplicate_request'].includes(mode);
  const label = document.querySelector('#aiDetailLabel');
  const input = document.querySelector('#aiTaskTitle');
  const rule = document.querySelector('#aiRuleText');
  if (mode === 'new_task') { if(label) label.textContent='Nouvel élément détecté'; if(input) input.value='Ajouter le contrôle automatique des marges'; if(rule) rule.innerHTML='<strong>Règle :</strong> l’IA suggère une période, mais elle ne décide jamais à ta place.'; }
  if (mode === 'blocker') { if(label) label.textContent='Blocage détecté'; if(input) input.value='Accès fournisseur indisponible'; if(rule) rule.innerHTML='<strong>Règle :</strong> un blocage opérationnel est enregistré automatiquement et remonte dans les alertes.'; }
  if (mode === 'complete_project') { if(rule) rule.innerHTML='<strong>Règle :</strong> l’IA ne peut pas terminer officiellement un projet. Une validation Thibault est obligatoire.'; }
  if (mode === 'technical_error') { if(label) label.textContent='Erreur technique'; if(input) input.value='Échec de synchronisation de la mise à jour'; if(rule) rule.innerHTML='<strong>Anti-spam :</strong> les erreurs identiques sont regroupées dans une seule notification avec un compteur.'; }
  if (mode === 'routine_progress') { if(rule) rule.innerHTML='<strong>Règle :</strong> une progression normale est appliquée automatiquement et ajoutée à l’historique.'; }
  if (mode === 'duplicate_request') { if(rule) rule.innerHTML='<strong>Anti-doublon :</strong> une requête IA déjà reçue est ignorée sans recréer de tâche ni d’action.'; }
}

function simulateAiIncoming() {
  const mode = document.querySelector('#aiMode')?.value || 'new_task';
  const source = document.querySelector('#aiSource')?.value || activeAiAgents()[0]?.id || 'chatgpt_thibault';
  if (mode === 'duplicate_request') {
    ensureRuntimeState();
    const requestId = state.aiRequests.at(-1)?.requestId || 'demo-request-duplicate-001';
    if (!state.aiRequests.some(r => r.requestId === requestId)) state.aiRequests.push({ requestId, source, receivedAt:new Date().toISOString() });
    upsertNotification({ severity:'info', type:'task_update', title:'Mise à jour IA déjà reçue', message:'La requête a été reconnue et ignorée : aucune tâche ni action n’a été créée en double.', actionType:'read', groupKey:`ai-duplicate:${requestId}`, internalTag:TAGS.AI_REQUEST_DEDUP });
    addActivity({ actor:aiSourceActor(source), projectId:null, text:'Requête IA dupliquée ignorée automatiquement', internalTag:TAGS.AI_REQUEST_DEDUP });
    persist(TAGS.AI_REQUEST_DEDUP, 'Doublon IA ignoré', { requestId, source });
    aiSimulationOpen=false; notificationOpen=true; render(); return;
  }
  const projectId = document.querySelector('#aiProject')?.value || null;
  const title = document.querySelector('#aiTaskTitle')?.value.trim() || '';
  const actor = aiSourceActor(source);
  trace(TAGS.AI_REQUEST_RECEIVED, 'Mise à jour IA reçue (simulation)', { mode, source, projectId });
  state.aiRequests.push({ requestId:crypto.randomUUID(), source, mode, receivedAt:new Date().toISOString() });

  if (mode !== 'new_task' && mode !== 'technical_error' && !projectId) {
    document.querySelector('#aiProject')?.classList.add('field-error');
    document.querySelector('#aiProject')?.focus();
    return;
  }

  if (mode === 'new_task') {
    const titleInput = document.querySelector('#aiTaskTitle');
    if (!title) { titleInput?.classList.add('field-error'); titleInput?.focus(); return; }
    const assignedTo = document.querySelector('#aiOwner')?.value || state.currentUser.id;
    const priority = document.querySelector('#aiPriority')?.value || 'medium';
    const suggestedBucket = document.querySelector('#aiSuggestedBucket')?.value || 'this_month';
    const taskId = crypto.randomUUID();
    state.tasks.push({ id:taskId, title, projectId, assignedTo, status:'todo', priority, scheduledFor:null, dueAt:null, planningStatus:'unplanned', planningBucket:'backlog', suggestedBucket, needsPlanning:true, sortOrder:Date.now(), sourceType:aiSourceType(source), sourceAgent:source, createdAt:new Date().toISOString() });
    const notification = upsertNotification({ severity:'action', type:'planning_required', title:'Nouvel élément à planifier', message:title, actionType:'plan', taskId, projectId, groupKey:`planning:${taskId}`, internalTag:TAGS.NOTIF_PLAN });
    state.activity.unshift({ id:crypto.randomUUID(), at:new Date().toISOString(), actor, projectId, text:`Nouvel élément proposé : ${title}`, internalTag:TAGS.AI_REQUEST_RECEIVED });
    trace(TAGS.PLAN_DETECT, 'Nouvel élément IA à planifier', { taskId, suggestedBucket });
    persist(TAGS.AI_REQUEST_PROCESS, 'Mise à jour IA transformée en tâche à planifier', { source, taskId, notificationId:notification.id, suggestedBucket });
    aiSimulationOpen = false; currentPage = 'planning'; planningTaskId = taskId; render(); return;
  }

  if (mode === 'routine_progress') {
    const p = project(projectId); if (!p) return;
    const previous = Number(p.progress || 0);
    const next = Math.max(0, Math.min(100, Number(document.querySelector('#aiProgress')?.value || previous)));
    p.progress = next; p.updatedAt = new Date().toISOString();
    addActivity({ actor, projectId, text:`Progression : ${previous} % → ${next} %`, internalTag:TAGS.AI_ROUTINE_UPDATE });
    persist(TAGS.AI_ROUTINE_UPDATE, 'Progression IA appliquée automatiquement', { source, projectId, previous, next });
    aiSimulationOpen = false; selectedProjectId = projectId; currentPage = 'projects'; render(); return;
  }

  if (mode === 'blocker') {
    const p = project(projectId); if (!p) return;
    const blocker = title || 'Blocage signalé par l’IA';
    p.blocker = blocker; p.status = 'blocked'; p.updatedAt = new Date().toISOString();
    addActivity({ actor, projectId, text:`Blocage ajouté : ${blocker}`, internalTag:TAGS.AI_BLOCKER_UPDATE });
    upsertNotification({ severity:'warning', type:'blocker', title:'Blocage projet', message:`${p.name} · ${blocker}`, actionType:'open_project', projectId, groupKey:`blocker:${projectId}`, internalTag:TAGS.NOTIF_BLOCKER, reactivate:true });
    persist(TAGS.AI_BLOCKER_UPDATE, 'Blocage IA appliqué automatiquement', { source, projectId, blocker });
    aiSimulationOpen = false; selectedProjectId = projectId; currentPage = 'projects'; render(); return;
  }

  if (mode === 'complete_project') {
    trace(TAGS.AI_COMPLETE_PROPOSAL, 'IA propose la clôture du projet', { source, projectId });
    const request = queueProjectCompletion(projectId, { sourceType:aiSourceType(source), requestedBy:actor, note:'Proposition reçue via agent IA' });
    aiSimulationOpen = false;
    if (request) approvalRequestId = request.id;
    render(); return;
  }

  if (mode === 'technical_error') {
    const message = title || 'Échec technique pendant une mise à jour IA';
    const groupKey = `tech:${source}:${projectId || 'global'}`;
    const n = upsertNotification({ severity:'error', type:'ai_error', title:'Erreur de synchronisation IA', message, actionType:'retry', projectId, groupKey, internalTag:TAGS.NOTIF_TECH_ERROR, increment:true });
    addActivity({ actor, projectId, text:`Erreur technique détectée : ${message}`, internalTag:TAGS.AI_TECH_ERROR });
    persist(TAGS.AI_TECH_ERROR, 'Erreur IA regroupée', { source, projectId, groupKey, count:n.count });
    aiSimulationOpen = false; notificationOpen = true; notificationFilter = 'error'; render();
  }
}

function advanceTaskStatus(taskId) {
  const t = task(taskId);
  if (!t) return;
  const previous = t.status;
  if (t.status === 'completed') t.status = 'todo';
  else if (['todo','paused','blocked'].includes(t.status)) t.status = 'in_progress';
  else t.status = 'completed';
  t.completedAt = t.status === 'completed' ? new Date().toISOString() : null;
  addActivity({ projectId:t.projectId, text:`${t.title} : ${statusLabels[previous]} → ${statusLabels[t.status]}`, internalTag:TAGS.TASK_STATUS_QUICK });
  persist(TAGS.TASK_STATUS_QUICK, 'Statut tâche modifié rapidement', { taskId, previous, status:t.status });
  render();
}

function openTeamPlanning(userId) {
  teamWorkloadOpen = false;
  planningFilterOwner = userId;
  currentPage = 'planning';
  selectedProjectId = null;
  trace(TAGS.TEAM_SHORTCUT, 'Ouverture planification équipe', { userId });
  render();
}

function markAllNotificationsRead() {
  const now = new Date().toISOString();
  state.notifications.filter(n => !n.resolved && !n.read).forEach(n => { n.read=true; n.readAt=now; });
  persist(TAGS.NOTIF_BULK_READ, 'Toutes les notifications actives marquées lues', {});
  render();
}

function openQuickAction() {
  quickActionOpen = true;
  notificationOpen = false;
  trace(TAGS.QUICK_ACTION, 'Ouverture actions rapides');
  render();
}
function closeQuickAction() { quickActionOpen=false; render(); }
function runQuickAction(action) {
  const unplanned = state.tasks.find(t => t.needsPlanning && t.planningStatus === 'unplanned');
  const approval = pendingApprovals()[0];
  quickActionOpen = false;
  if (action === 'task') return openTaskModal();
  if (action === 'project') return openProjectModal();
  if (action === 'document') return openDocumentModal();
  if (action === 'report') return openDailyReportModal();
  if (action === 'planning' && unplanned) return openPlanning(unplanned.id);
  if (action === 'approval' && approval) return openApproval(approval.id);
  if (action === 'notifications') { notificationOpen=true; return render(); }
  render();
}

function exportDemoBackup() {
  const payload = { version:'speedarti-pilotage-demo-v9', exportedAt:new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='speedarti-pilotage-sauvegarde.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  trace(TAGS.DEMO_BACKUP, 'Sauvegarde locale exportée');
}

function importDemoBackup() {
  const input = document.createElement('input'); input.type='file'; input.accept='application/json';
  input.addEventListener('change', async () => {
    const file=input.files?.[0]; if(!file) return;
    try {
      const parsed=JSON.parse(await file.text()); const incoming=parsed.state || parsed;
      if (!Array.isArray(incoming.projects) || !Array.isArray(incoming.tasks)) throw new Error('format');
      state=incoming; ensureRuntimeState(); saveState(state); trace(TAGS.DEMO_RESTORE, 'Sauvegarde locale restaurée'); render();
    } catch { window.alert('Cette sauvegarde n’est pas compatible avec la démo SpeedArti Pilotage.'); }
  });
  input.click();
}

function openArchiveModal(projectId) {
  archiveModalProjectId = projectId;
  trace(TAGS.ARCHIVE_MODAL, 'Ouverture confirmation archivage', { projectId });
  render();
}
function closeArchiveModal() { archiveModalProjectId = null; render(); }
function archiveProject(projectId) {
  const p = project(projectId);
  if (!p) return;
  p.archived = true;
  p.archivedAt = new Date().toISOString();
  state.changeRequests.filter(r => r.projectId === projectId && r.status === 'pending').forEach(r => { r.status='cancelled'; r.decidedAt=new Date().toISOString(); r.decisionBy='Thibault'; });
  state.notifications.filter(n => !n.resolved && n.projectId === projectId).forEach(n => { n.resolved=true; n.resolvedAt=new Date().toISOString(); });
  addActivity({ projectId, text:`Projet archivé : ${p.name}`, internalTag:TAGS.PROJECT_ARCHIVE });
  persist(TAGS.PROJECT_ARCHIVE, 'Projet archivé', { projectId });
  archiveModalProjectId = null;
  projectFilter = 'archived';
  selectedProjectId = null;
  render();
}
function restoreProject(projectId) {
  const p = project(projectId);
  if (!p) return;
  p.archived = false;
  p.archivedAt = null;
  addActivity({ projectId, text:`Projet restauré : ${p.name}`, internalTag:TAGS.PROJECT_RESTORE });
  persist(TAGS.PROJECT_RESTORE, 'Projet restauré', { projectId });
  projectFilter = 'all';
  render();
}
function clearProjectBlocker(projectId) {
  const p = project(projectId);
  if (!p || !p.blocker) return;
  const previous = p.blocker;
  p.blocker = '';
  if (p.status === 'blocked') p.status = 'in_progress';
  addActivity({ projectId, text:`Blocage levé : ${previous}`, internalTag:TAGS.PROJECT_BLOCKER_CLEAR });
  persist(TAGS.PROJECT_BLOCKER_CLEAR, 'Blocage projet levé', { projectId, previous });
  refreshSmartNotifications();
  render();
}
function openDeferModal(taskId) { deferTaskId = taskId; trace(TAGS.TASK_DEFER, 'Ouverture report tâche', { taskId }); render(); }
function closeDeferModal() { deferTaskId = null; render(); }
function deferTask(choice) {
  const t = task(deferTaskId);
  if (!t) return;
  const previousDate = t.scheduledFor;
  const previousBucket = t.planningBucket;
  if (choice === 'tomorrow') { t.scheduledFor='2026-09-18'; t.planningBucket='this_week'; }
  if (choice === 'next_week') { t.scheduledFor='2026-09-21'; t.planningBucket='this_week'; }
  if (choice === 'this_month') { t.scheduledFor=null; t.planningBucket='this_month'; }
  if (choice === 'backlog') { t.scheduledFor=null; t.planningBucket='backlog'; }
  t.planningStatus='planned'; t.needsPlanning=false; t.sortOrder=Date.now();
  addActivity({ projectId:t.projectId, text:`${t.title} reportée vers ${choice === 'tomorrow' ? 'demain' : choice === 'next_week' ? 'la semaine prochaine' : choice === 'this_month' ? 'ce mois' : 'À organiser'}`, internalTag:TAGS.TASK_DEFER });
  persist(TAGS.TASK_DEFER, 'Tâche reportée', { taskId:t.id, choice, previousDate, previousBucket, scheduledFor:t.scheduledFor, planningBucket:t.planningBucket });
  deferTaskId=null;
  render();
}
function openTeamWorkload() { teamWorkloadOpen=true; trace(TAGS.TEAM_WORKLOAD, 'Vue charge équipe ouverte'); render(); }
function closeTeamWorkload() { teamWorkloadOpen=false; render(); }

function bindEvents() {
  document.querySelector('#quickCreateBtn')?.addEventListener('click', openQuickAction);
  document.querySelector('#closeQuickAction')?.addEventListener('click', closeQuickAction);
  document.querySelector('#quickActionBackdrop')?.addEventListener('click', closeQuickAction);
  document.querySelectorAll('[data-quick-action]').forEach(el => el.addEventListener('click', () => runQuickAction(el.dataset.quickAction)));
  document.querySelectorAll('[data-action="new-report"]').forEach(el => el.addEventListener('click', () => openDailyReportModal()));
  document.querySelector('#collectDailyReports')?.addEventListener('click', () => collectAutomaticDailyReports(dailyReportDate));
  document.querySelector('#reportDateFilter')?.addEventListener('change', e => { dailyReportDate = e.target.value || '2026-09-17'; trace(TAGS.REPORT_FILTER, 'Changement journée comptes rendus', { reportDate:dailyReportDate }); render(); });
  document.querySelector('#reportPersonFilter')?.addEventListener('change', e => { dailyReportPersonFilter = e.target.value || 'all'; trace(TAGS.REPORT_FILTER, 'Filtre personne comptes rendus', { personId:dailyReportPersonFilter }); render(); });
  document.querySelectorAll('[data-edit-report]').forEach(el => el.addEventListener('click', () => openDailyReportModal(el.dataset.editReport)));
  document.querySelectorAll('[data-validate-report]').forEach(el => el.addEventListener('click', () => validateDailyReport(el.dataset.validateReport)));
  document.querySelectorAll('[data-report-new-person]').forEach(el => el.addEventListener('click', () => openDailyReportModal(null, el.dataset.reportNewPerson)));
  document.querySelector('#closeDailyReport')?.addEventListener('click', closeDailyReportModal);
  document.querySelector('#cancelDailyReport')?.addEventListener('click', closeDailyReportModal);
  document.querySelector('#dailyReportBackdrop')?.addEventListener('click', closeDailyReportModal);
  document.querySelector('#saveDailyReport')?.addEventListener('click', saveDailyReportFromForm);
  document.querySelector('#simulateAiBtn')?.addEventListener('click', openAiSimulation);
  document.querySelector('#closeAiSimulation')?.addEventListener('click', closeAiSimulation);
  document.querySelector('#cancelAiSimulation')?.addEventListener('click', closeAiSimulation);
  document.querySelector('#aiSimulationBackdrop')?.addEventListener('click', closeAiSimulation);
  document.querySelector('#runAiSimulation')?.addEventListener('click', simulateAiIncoming);
  document.querySelector('#aiMode')?.addEventListener('change', syncAiSimulationFields);
  if (aiSimulationOpen) requestAnimationFrame(syncAiSimulationFields);
  document.querySelector('#aiTaskTitle')?.addEventListener('keydown', e => { if (e.key === 'Enter') simulateAiIncoming(); });

  document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.page)));
  document.querySelectorAll('[data-mobile-page]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.mobilePage)));
  document.querySelectorAll('[data-project]').forEach(el => el.addEventListener('click', () => { selectedProjectId = el.dataset.project; currentPage = 'projects'; render(); }));
  document.querySelectorAll('[data-complete]').forEach(el => el.addEventListener('click', () => completeTask(el.dataset.complete)));
  document.querySelectorAll('[data-task-status]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); advanceTaskStatus(el.dataset.taskStatus); }));
  document.querySelectorAll('[data-team-planning]').forEach(el => el.addEventListener('click', () => openTeamPlanning(el.dataset.teamPlanning)));
  document.querySelector('#openTeamWorkload')?.addEventListener('click', openTeamWorkload);
  document.querySelectorAll('[data-plan]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openPlanning(el.dataset.plan); }));
  document.querySelectorAll('[data-edit-task]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openTaskEditor(el.dataset.editTask); }));
  document.querySelectorAll('[data-edit-project]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openProjectModal(el.dataset.editProject); }));
  document.querySelectorAll('[data-team-target]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    const target = el.dataset.teamTarget;
    const input = document.querySelector(`#${target}`);
    if (input) input.value = el.dataset.teamValue;
    document.querySelectorAll(`[data-team-target="${target}"]`).forEach(x => x.classList.toggle('active', x === el));
    trace(TAGS.TEAM_PICKER, 'Sélection responsable', { target, userId:el.dataset.teamValue });
  }));
  document.querySelectorAll('[data-resolve]').forEach(el => el.addEventListener('click', () => resolveNotification(el.dataset.resolve)));
  document.querySelectorAll('[data-retry-notif]').forEach(el => el.addEventListener('click', () => retryNotification(el.dataset.retryNotif)));
  document.querySelectorAll('[data-notif-read]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); markNotificationRead(el.dataset.notifRead); }));
  document.querySelectorAll('[data-approval]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openApproval(el.dataset.approval); }));
  document.querySelectorAll('[data-open-project]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); const id=el.dataset.openProject; const notifId=el.dataset.notifRead; if(notifId) markNotificationRead(notifId, false); selectedProjectId=id; currentPage='projects'; notificationOpen=false; render(); }));
  document.querySelectorAll('[data-notif-open-filter]').forEach(el => el.addEventListener('click', () => { notificationFilter=el.dataset.notifOpenFilter || 'all'; notificationOpen=true; render(); }));

  document.querySelectorAll('[data-project-filter]').forEach(el => el.addEventListener('click', () => { projectFilter = el.dataset.projectFilter; render(); }));
  document.querySelectorAll('[data-activity-filter]').forEach(el => el.addEventListener('click', () => { activityFilter = el.dataset.activityFilter; render(); }));
  document.querySelector('#activityProjectFilter')?.addEventListener('change', e => { activityProjectFilter=e.target.value; trace(TAGS.ACTIVITY_ADVANCED, 'Filtre activité projet', { projectId:activityProjectFilter }); render(); });
  document.querySelector('#activitySearch')?.addEventListener('input', e => { activitySearch=e.target.value; trace(TAGS.ACTIVITY_ADVANCED, 'Recherche activité', { query:activitySearch }); render(); requestAnimationFrame(() => { const i=document.querySelector('#activitySearch'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } }); });
  document.querySelectorAll('[data-notif-filter]').forEach(el => el.addEventListener('click', () => { notificationFilter = el.dataset.notifFilter; render(); }));
  document.querySelector('#markAllRead')?.addEventListener('click', markAllNotificationsRead);
  document.querySelector('#openFirstApproval')?.addEventListener('click', () => { const r=pendingApprovals()[0]; if(r) openApproval(r.id); });
  document.querySelectorAll('[data-action="quick-add"]').forEach(el => el.addEventListener('click', () => openTaskModal()));
  document.querySelectorAll('[data-action="add-project-task"]').forEach(el => el.addEventListener('click', () => openTaskModal(el.dataset.projectId)));
  document.querySelectorAll('[data-action="new-project"]').forEach(el => el.addEventListener('click', () => openProjectModal()));
  document.querySelectorAll('[data-action="link-document"]').forEach(el => el.addEventListener('click', openDocumentModal));

  document.querySelector('#planningProjectFilter')?.addEventListener('change', e => { planningFilterProject = e.target.value; render(); });
  document.querySelector('#planningOwnerFilter')?.addEventListener('change', e => { planningFilterOwner = e.target.value; render(); });
  document.querySelector('#planningPriorityFilter')?.addEventListener('change', e => { planningFilterPriority = e.target.value; render(); });
  document.querySelectorAll('[data-mobile-bucket]').forEach(el => el.addEventListener('click', () => { mobilePlanningBucket = el.dataset.mobileBucket; trace(TAGS.MOBILE_PLAN_ACTION, 'Période Roadmap mobile', { bucket:mobilePlanningBucket }); render(); }));
  document.querySelectorAll('[data-calendar-view]').forEach(el => el.addEventListener('click', () => { calendarView = el.dataset.calendarView; trace(TAGS.CALENDAR_VIEW, 'Vue agenda', { view:calendarView }); render(); }));
  document.querySelector('#documentSearch')?.addEventListener('input', e => { documentSearch = e.target.value; trace(TAGS.DOCUMENT_FILTER, 'Recherche document', { query:documentSearch }); render(); requestAnimationFrame(() => { const input=document.querySelector('#documentSearch'); if(input){ input.focus(); input.setSelectionRange(input.value.length,input.value.length); } }); });
  document.querySelector('#documentProjectFilter')?.addEventListener('change', e => { documentProjectFilter = e.target.value; trace(TAGS.DOCUMENT_FILTER, 'Filtre document projet', { projectId:documentProjectFilter }); render(); });
  document.querySelectorAll('[data-open-doc]').forEach(el => el.addEventListener('click', () => { const d=state.documents.find(x=>x.id===el.dataset.openDoc); if(d?.url) window.open(d.url, '_blank', 'noopener'); }));

  document.querySelector('#notificationBtn')?.addEventListener('click', () => { notificationOpen = !notificationOpen; trace(TAGS.NOTIFICATION_DRAWER, 'Drawer notifications', { open: notificationOpen }); render(); });
  document.querySelector('#openNotifFromToday')?.addEventListener('click', () => { notificationOpen = true; notificationFilter='action'; render(); });
  document.querySelector('#openNotifFromTodayBottom')?.addEventListener('click', () => { notificationOpen = true; notificationFilter='action'; render(); });
  document.querySelector('#closeNotif')?.addEventListener('click', () => { notificationOpen = false; render(); });
  document.querySelector('#drawerBackdrop')?.addEventListener('click', () => { notificationOpen = false; render(); });
  document.querySelector('#backProjects')?.addEventListener('click', () => { selectedProjectId = null; render(); });

  document.querySelector('#closePlan')?.addEventListener('click', () => { planningTaskId = null; render(); });
  document.querySelector('#cancelPlan')?.addEventListener('click', () => { planningTaskId = null; render(); });
  document.querySelector('#modalBackdrop')?.addEventListener('click', () => { planningTaskId = null; render(); });
  document.querySelector('#confirmPlan')?.addEventListener('click', e => {
    const selected = document.querySelector('input[name="planBucket"]:checked')?.value || 'backlog';
    const id = e.currentTarget.dataset.task;
    const t = task(id);
    if (!t) return;
    const previousOwner = t.assignedTo;
    const assignedTo = document.querySelector('#planOwner')?.value || t.assignedTo;
    const scheduledFor = document.querySelector('#planScheduledFor')?.value || null;
    const dueAt = toDueIso(document.querySelector('#planDueAt')?.value || '');
    moveTask(id, selected);
    t.assignedTo = assignedTo;
    t.scheduledFor = scheduledFor;
    t.dueAt = dueAt;
    if (previousOwner !== assignedTo) addActivity({ projectId:t.projectId, text:`${t.title} assignée à ${teamName(assignedTo)}`, internalTag:TAGS.TASK_ASSIGN });
    state.notifications.filter(n => n.taskId === id).forEach(n => { n.read = true; n.resolved = true; });
    planningTaskId = null;
    persist(TAGS.PLAN_CONFIRM, 'Planification confirmée', { taskId:id, bucket:selected, assignedTo, scheduledFor, dueAt });
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
  document.querySelector('#projectProgress')?.addEventListener('input', e => { const out=document.querySelector('#projectProgressValue'); if(out) out.textContent=`${e.target.value} %`; });

  document.querySelector('#closeDocumentModal')?.addEventListener('click', closeDocumentModal);
  document.querySelector('#cancelDocumentModal')?.addEventListener('click', closeDocumentModal);
  document.querySelector('#documentModalBackdrop')?.addEventListener('click', closeDocumentModal);
  document.querySelector('#saveDocument')?.addEventListener('click', createDocumentFromForm);
  document.querySelector('#exportDemo')?.addEventListener('click', exportDemoBackup);
  document.querySelector('#importDemo')?.addEventListener('click', importDemoBackup);

  document.querySelector('#closeApproval')?.addEventListener('click', closeApproval);
  document.querySelector('#approvalBackdrop')?.addEventListener('click', closeApproval);
  document.querySelector('#approveApproval')?.addEventListener('click', e => decideApproval(e.currentTarget.dataset.request, true));
  document.querySelector('#rejectApproval')?.addEventListener('click', e => decideApproval(e.currentTarget.dataset.request, false));

  document.querySelectorAll('[data-archive-project]').forEach(el => el.addEventListener('click', () => openArchiveModal(el.dataset.archiveProject)));
  document.querySelectorAll('[data-restore-project]').forEach(el => el.addEventListener('click', () => restoreProject(el.dataset.restoreProject)));
  document.querySelectorAll('[data-clear-blocker]').forEach(el => el.addEventListener('click', () => clearProjectBlocker(el.dataset.clearBlocker)));
  document.querySelector('#closeArchive')?.addEventListener('click', closeArchiveModal);
  document.querySelector('#cancelArchive')?.addEventListener('click', closeArchiveModal);
  document.querySelector('#archiveBackdrop')?.addEventListener('click', closeArchiveModal);
  document.querySelector('#confirmArchive')?.addEventListener('click', e => archiveProject(e.currentTarget.dataset.project));

  document.querySelectorAll('[data-defer-task]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openDeferModal(el.dataset.deferTask); }));
  document.querySelector('#closeDefer')?.addEventListener('click', closeDeferModal);
  document.querySelector('#cancelDefer')?.addEventListener('click', closeDeferModal);
  document.querySelector('#deferBackdrop')?.addEventListener('click', closeDeferModal);
  document.querySelectorAll('[data-defer-choice]').forEach(el => el.addEventListener('click', () => deferTask(el.dataset.deferChoice)));

  document.querySelector('#closeTeamWorkload')?.addEventListener('click', closeTeamWorkload);
  document.querySelector('#cancelTeamWorkload')?.addEventListener('click', closeTeamWorkload);
  document.querySelector('#teamWorkloadBackdrop')?.addEventListener('click', closeTeamWorkload);

  document.querySelector('#resetDemo')?.addEventListener('click', () => {
    if (!window.confirm('Réinitialiser toute la démo locale ?')) return;
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
    aiSimulationOpen = false;
    taskEditId = null;
    projectEditId = null;
    calendarView = 'today';
    documentSearch = '';
    documentProjectFilter = 'all';
    documentModalOpen = false;
    approvalRequestId = null;
    quickActionOpen = false;
    activityProjectFilter = 'all';
    activitySearch = '';
    archiveModalProjectId = null;
    deferTaskId = null;
    teamWorkloadOpen = false;
    dailyReportModalOpen = false;
    dailyReportEditId = null;
    dailyReportDate = '2026-09-17';
    dailyReportPersonFilter = 'all';
    dailyReportPresetPersonId = null;
    mobilePlanningBucket = 'this_month';
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
  if (!q) { target.innerHTML = '<p class="search-hint">Projet, tâche, document, compte rendu ou activité.</p>'; return; }
  const results = [
    ...state.projects.filter(x => x.name.toLowerCase().includes(q)).map(x => ({ type:'Projet', title:x.name, action:`project:${x.id}` })),
    ...state.tasks.filter(x => x.title.toLowerCase().includes(q)).map(x => ({ type:'Tâche', title:x.title, action:`task:${x.id}` })),
    ...state.documents.filter(x => x.name.toLowerCase().includes(q)).map(x => ({ type:'Document', title:x.name, action:'documents' })),
    ...state.activity.filter(x => `${x.actor || ''} ${x.text || ''}`.toLowerCase().includes(q)).map(x => ({ type:'Activité', title:x.text, action:'activity' })),
    ...state.dailyReports.filter(x => `${teamName(x.personId)} ${x.summary || ''} ${(x.achievements || []).join(' ')} ${(x.blockers || []).join(' ')}`.toLowerCase().includes(q)).map(x => ({ type:'Compte rendu', title:`${teamName(x.personId)} · ${formatDate(x.reportDate)} · ${x.summary}`, action:'reports' }))
  ].slice(0,12);
  target.innerHTML = results.length ? results.map(r => `<button class="search-result" data-search-action="${r.action}"><small>${r.type}</small><strong>${esc(r.title)}</strong></button>`).join('') : '<p class="search-hint">Aucun résultat.</p>';
  target.querySelectorAll('[data-search-action]').forEach(btn => btn.addEventListener('click', () => {
    const action = btn.dataset.searchAction;
    closeSearch();
    if (action.startsWith('project:')) { selectedProjectId = action.split(':')[1]; currentPage = 'projects'; render(); }
    else if (action.startsWith('task:')) { openTaskEditor(action.split(':')[1]); }
    else navigate(action);
  }));
}

function closeSearch() {
  document.querySelector('#searchBackdrop')?.remove();
  document.querySelector('.search-modal')?.remove();
}

render();
