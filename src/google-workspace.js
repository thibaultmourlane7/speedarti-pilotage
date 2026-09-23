(() => {
  'use strict';

  const ROOT_ID = 'pilotageGoogleWorkspace';
  const CACHE_KEY = 'speedarti-pilotage-demo-v1';
  const CHAT_POLL_MS = 60_000;
  const BOOT_POLL_MS = 700;

  const ui = {
    open: false,
    tab: 'chat',
    chatView: 'spaces',
    selectedSpaceId: null,
    spaces: [],
    messages: [],
    requests: [],
    status: null,
    loading: '',
    chatError: '',
    meetError: '',
    toast: null,
    form: null,
    booted: false,
    syncingChat: false,
    realtimeReady: false
  };

  let root = null;
  let pollTimer = null;
  let bootTimer = null;
  let observer = null;
  const channels = [];

  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
    }[c]));
  }

  function cache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch { return {}; }
  }

  function team() {
    return Array.isArray(cache().team) ? cache().team : [];
  }

  function projects() {
    return Array.isArray(cache().projects) ? cache().projects.filter(p => !p.archived) : [];
  }

  function currentMember() {
    return window.PILOTAGE_AUTH?.member || null;
  }

  function currentClientKey() {
    return currentMember()?.client_key || cache()?.currentUser?.id || '';
  }

  function projectName(clientKey) {
    return projects().find(p => p.id === clientKey)?.name || '';
  }

  function localInputValue(date = new Date()) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function defaultStart() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  }

  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('fr-FR', {
      day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
    });
  }

  function notification(title, body) {
    showToast(title, body);
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, tag: `speedarti-${title}-${body}` });
      }
    } catch {}
  }

  function showToast(title, message) {
    ui.toast = { title, message };
    render();
    setTimeout(() => {
      if (ui.toast?.title === title && ui.toast?.message === message) {
        ui.toast = null;
        render();
      }
    }, 6500);
  }

  function api() {
    if (!window.PILOTAGE_GOOGLE) throw new Error('Module Google indisponible.');
    return window.PILOTAGE_GOOGLE;
  }

  function isReady() {
    const app = document.querySelector('#app');
    return Boolean(window.PILOTAGE_AUTH?.member?.id && window.PILOTAGE_GOOGLE && app && !app.hidden);
  }

  function ensureRoot() {
    if (root?.isConnected) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);
    return root;
  }

  function reconnectCard(kind = 'Google') {
    const account = ui.status?.account?.google_email || '';
    return `
      <div class="gw-empty-card">
        <div class="gw-empty-icon">G</div>
        <strong>Connexion Google à mettre à jour</strong>
        <p>${account ? `Compte actuel : <b>${esc(account)}</b><br>` : ''}Les nouvelles autorisations ${esc(kind)} doivent être validées une fois.</p>
        <button class="gw-primary" data-gw-action="connect-google">Reconnecter Google</button>
      </div>`;
  }

  function disconnectedCard() {
    return `
      <div class="gw-empty-card">
        <div class="gw-empty-icon">G</div>
        <strong>Google n’est pas connecté</strong>
        <p>Connecte ton compte Google pour utiliser Chat, Agenda et Meet dans Pilotage.</p>
        <button class="gw-primary" data-gw-action="connect-google">Connecter Google</button>
      </div>`;
  }

  function chatBadge() {
    return ui.spaces.reduce((sum, s) => sum + Number(s.unread_count || 0), 0);
  }

  function actionableRequests() {
    return ui.requests.filter(r =>
      (r.status === 'requested' && r.direction === 'incoming')
      || (r.status === 'reschedule_requested' && r.direction === 'outgoing')
    );
  }

  function totalBadge() {
    return chatBadge() + actionableRequests().length;
  }

  function renderLauncher() {
    const count = totalBadge();
    return `
      <button class="gw-launcher ${ui.open ? 'is-open' : ''}" data-gw-action="toggle" aria-label="Ouvrir Google Chat et les réunions">
        <span class="gw-launch-icon">💬</span>
        <span class="gw-launch-label">Chat</span>
        ${count ? `<b class="gw-launch-badge">${count > 99 ? '99+' : count}</b>` : ''}
      </button>`;
  }

  function renderSpaces() {
    if (!ui.status?.account) return disconnectedCard();
    if (ui.status?.needs_reconnect) return reconnectCard('Chat et Meet');
    if (ui.chatError) {
      return `
        <div class="gw-error-card">
          <strong>Google Chat indisponible</strong>
          <p>${esc(ui.chatError)}</p>
          <div class="gw-inline-actions">
            <button class="gw-secondary" data-gw-action="sync-chat">Réessayer</button>
            <button class="gw-secondary" data-gw-action="connect-google">Reconnecter Google</button>
          </div>
        </div>`;
    }
    if (ui.loading === 'chat' && !ui.spaces.length) {
      return '<div class="gw-loading">Synchronisation Google Chat…</div>';
    }
    if (!ui.spaces.length) {
      return `
        <div class="gw-empty-card">
          <strong>Aucune conversation chargée</strong>
          <p>Actualise Google Chat pour récupérer les espaces accessibles à ce compte.</p>
          <button class="gw-primary" data-gw-action="sync-chat">Actualiser Chat</button>
        </div>`;
    }

    return `
      <div class="gw-chat-tools">
        <span>${ui.spaces.length} espace${ui.spaces.length > 1 ? 's' : ''}</span>
        <button class="gw-icon-button" data-gw-action="sync-chat" title="Actualiser">↻</button>
      </div>
      <div class="gw-space-list">
        ${ui.spaces.map(space => {
          const pname = space.project_client_key ? projectName(space.project_client_key) : '';
          return `
            <button class="gw-space-row" data-gw-space="${esc(space.id)}">
              <span class="gw-space-avatar">${space.space_type === 'DIRECT_MESSAGE' ? '👤' : '👥'}</span>
              <span class="gw-space-copy">
                <strong>${esc(space.display_name || 'Google Chat')}</strong>
                <small>${pname ? esc(pname) : (space.space_type === 'DIRECT_MESSAGE' ? 'Message direct' : 'Espace Google Chat')}</small>
              </span>
              ${Number(space.unread_count || 0) ? `<b class="gw-unread">${Number(space.unread_count)}</b>` : ''}
            </button>`;
        }).join('')}
      </div>`;
  }

  function renderConversation() {
    const space = ui.spaces.find(s => s.id === ui.selectedSpaceId);
    if (!space) {
      ui.chatView = 'spaces';
      return renderSpaces();
    }
    const projectValue = space.project_client_key || '';
    return `
      <div class="gw-conversation">
        <div class="gw-conversation-head">
          <button class="gw-icon-button" data-gw-action="back-spaces">←</button>
          <div><strong>${esc(space.display_name || 'Google Chat')}</strong><small>Google Chat</small></div>
          <button class="gw-icon-button" data-gw-action="sync-current" title="Actualiser">↻</button>
        </div>
        <label class="gw-project-link">
          <span>Projet lié</span>
          <select id="gwChatProject">
            <option value="">Sans projet</option>
            ${projects().map(p => `<option value="${esc(p.id)}" ${p.id === projectValue ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </label>
        <div class="gw-message-list" id="gwMessageList">
          ${ui.messages.length ? ui.messages.map(m => {
            const own = currentMember()?.display_name && m.sender_display_name === currentMember().display_name;
            return `
              <article class="gw-message ${own ? 'is-own' : ''}">
                <div class="gw-message-meta"><strong>${esc(m.sender_display_name || 'Google Chat')}</strong><time>${esc(formatDateTime(m.create_time))}</time></div>
                <p>${esc(m.text || '')}</p>
              </article>`;
          }).join('') : '<div class="gw-empty-line">Aucun message chargé.</div>'}
        </div>
        <form id="gwSendForm" class="gw-compose">
          <textarea id="gwSendText" rows="2" maxlength="32000" placeholder="Écrire un message…" required></textarea>
          <button class="gw-primary" type="submit" ${ui.loading === 'send' ? 'disabled' : ''}>${ui.loading === 'send' ? '…' : 'Envoyer'}</button>
        </form>
      </div>`;
  }

  function renderChat() {
    return ui.chatView === 'conversation' ? renderConversation() : renderSpaces();
  }

  function requestStatusLabel(status) {
    return ({
      requested:'Demandée',
      accepted:'Acceptée',
      declined:'Refusée',
      reschedule_requested:'Nouveau créneau proposé',
      cancelled:'Annulée'
    })[status] || status;
  }

  function meetingCard(r) {
    const counterpart = r.direction === 'incoming' ? r.requester?.display_name : r.recipient?.display_name;
    const canAct = (r.status === 'requested' && r.direction === 'incoming')
      || (r.status === 'reschedule_requested' && r.direction === 'outgoing');
    const canReschedule = r.status === 'requested' && r.direction === 'incoming';
    return `
      <article class="gw-meeting-card ${canAct ? 'needs-action' : ''}">
        <div class="gw-meeting-top">
          <div><strong>${esc(r.title)}</strong><small>${esc(counterpart || 'Équipe')} · ${esc(requestStatusLabel(r.status))}</small></div>
          <span class="gw-status">${r.direction === 'incoming' ? 'Reçue' : 'Envoyée'}</span>
        </div>
        <p class="gw-meeting-date">📅 ${esc(formatDateTime(r.proposed_start_at))} → ${esc(formatDateTime(r.proposed_end_at))}</p>
        ${r.description ? `<p class="gw-meeting-desc">${esc(r.description)}</p>` : ''}
        ${r.meet_url ? `<a class="gw-meet-link" href="${esc(r.meet_url)}" target="_blank" rel="noopener">📹 Rejoindre Google Meet</a>` : ''}
        ${canAct ? `
          <div class="gw-inline-actions">
            <button class="gw-primary small" data-gw-meeting-accept="${esc(r.id)}">Accepter</button>
            ${canReschedule ? `<button class="gw-secondary small" data-gw-meeting-reschedule="${esc(r.id)}">Autre créneau</button>` : ''}
            <button class="gw-danger small" data-gw-meeting-decline="${esc(r.id)}">Refuser</button>
          </div>` : ''}
      </article>`;
  }

  function renderMeetingList() {
    if (ui.loading === 'meetings' && !ui.requests.length) return '<div class="gw-loading">Chargement des réunions…</div>';
    const pending = ui.requests.filter(r => r.status !== 'cancelled').slice(0, 30);
    return pending.length
      ? `<div class="gw-meeting-list">${pending.map(meetingCard).join('')}</div>`
      : '<div class="gw-empty-line">Aucune demande de réunion.</div>';
  }

  function renderRequestForm() {
    const start = defaultStart();
    const end = new Date(start.getTime() + 30 * 60_000);
    const members = team().filter(m => m.id !== currentClientKey());
    return `
      <form id="gwRequestMeetingForm" class="gw-form">
        <div class="gw-form-head"><strong>Demander une réunion</strong><button type="button" class="gw-icon-button" data-gw-action="close-form">×</button></div>
        <label><span>Avec</span><select id="gwRequestRecipient" required><option value="">Choisir…</option>${members.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select></label>
        <label><span>Sujet</span><input id="gwRequestTitle" required maxlength="240" placeholder="Ex. Validation configurateur terrasse" /></label>
        <div class="gw-form-grid">
          <label><span>Début</span><input id="gwRequestStart" type="datetime-local" value="${localInputValue(start)}" required /></label>
          <label><span>Fin</span><input id="gwRequestEnd" type="datetime-local" value="${localInputValue(end)}" required /></label>
        </div>
        <label><span>Projet</span><select id="gwRequestProject"><option value="">Sans projet</option>${projects().map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
        <label><span>Message</span><textarea id="gwRequestDescription" rows="2" maxlength="2000" placeholder="Optionnel"></textarea></label>
        <button class="gw-primary" type="submit" ${ui.loading === 'request' ? 'disabled' : ''}>${ui.loading === 'request' ? 'Envoi…' : 'Envoyer la demande'}</button>
      </form>`;
  }

  function renderMeetForm() {
    const start = defaultStart();
    const end = new Date(start.getTime() + 30 * 60_000);
    return `
      <form id="gwCreateMeetForm" class="gw-form">
        <div class="gw-form-head"><strong>Créer un Google Meet</strong><button type="button" class="gw-icon-button" data-gw-action="close-form">×</button></div>
        <label><span>Titre</span><input id="gwMeetTitle" required maxlength="240" placeholder="Réunion SpeedArti" /></label>
        <div class="gw-form-grid">
          <label><span>Début</span><input id="gwMeetStart" type="datetime-local" value="${localInputValue(start)}" required /></label>
          <label><span>Fin</span><input id="gwMeetEnd" type="datetime-local" value="${localInputValue(end)}" required /></label>
        </div>
        <label><span>Participants</span><input id="gwMeetAttendees" placeholder="email1@..., email2@..." /></label>
        <label><span>Projet</span><select id="gwMeetProject"><option value="">Sans projet</option>${projects().map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
        <label><span>Description</span><textarea id="gwMeetDescription" rows="2" maxlength="2000" placeholder="Optionnel"></textarea></label>
        <button class="gw-primary" type="submit" ${ui.loading === 'create-meet' ? 'disabled' : ''}>${ui.loading === 'create-meet' ? 'Création…' : 'Créer et inviter'}</button>
      </form>`;
  }

  function renderMeetings() {
    if (!ui.status?.account) return disconnectedCard();
    if (ui.status?.needs_reconnect) return reconnectCard('Agenda et Meet');
    if (ui.meetError) {
      return `
        <div class="gw-error-card">
          <strong>Réunions indisponibles</strong>
          <p>${esc(ui.meetError)}</p>
          <button class="gw-secondary" data-gw-action="refresh-meetings">Réessayer</button>
        </div>`;
    }
    if (ui.form === 'request') return renderRequestForm();
    if (ui.form === 'meet') return renderMeetForm();

    return `
      <div class="gw-meet-actions">
        <button class="gw-primary" data-gw-action="open-request">Demander une réunion</button>
        <button class="gw-secondary" data-gw-action="open-meet">Créer un Meet</button>
      </div>
      ${actionableRequests().length ? `<div class="gw-action-callout"><b>${actionableRequests().length}</b> demande${actionableRequests().length > 1 ? 's' : ''} à traiter</div>` : ''}
      ${renderMeetingList()}
    `;
  }

  function renderPanel() {
    if (!ui.open) return '';
    const chatCount = chatBadge();
    const meetCount = actionableRequests().length;
    return `
      <section class="gw-panel" role="dialog" aria-label="Google Chat et réunions">
        <header class="gw-header">
          <div class="gw-brand"><span>G</span><div><strong>Communication</strong><small>SpeedArti Pilotage</small></div></div>
          <button class="gw-icon-button" data-gw-action="toggle" aria-label="Réduire">—</button>
        </header>
        <nav class="gw-tabs">
          <button class="${ui.tab === 'chat' ? 'active' : ''}" data-gw-tab="chat">Chat ${chatCount ? `<b>${chatCount}</b>` : ''}</button>
          <button class="${ui.tab === 'meetings' ? 'active' : ''}" data-gw-tab="meetings">Réunions ${meetCount ? `<b>${meetCount}</b>` : ''}</button>
        </nav>
        <div class="gw-body">
          ${ui.tab === 'chat' ? renderChat() : renderMeetings()}
        </div>
      </section>`;
  }

  function renderToast() {
    if (!ui.toast) return '';
    return `<div class="gw-toast"><strong>${esc(ui.toast.title)}</strong><p>${esc(ui.toast.message)}</p></div>`;
  }

  function render() {
    ensureRoot();
    root.innerHTML = `${renderToast()}${renderPanel()}${renderLauncher()}`;
    bind();
    if (ui.chatView === 'conversation') {
      requestAnimationFrame(() => {
        const list = document.querySelector('#gwMessageList');
        if (list) list.scrollTop = list.scrollHeight;
      });
    }
  }

  async function refreshStatus() {
    try {
      ui.status = await api().status();
      ui.meetError = '';
      if (ui.status?.needs_reconnect) ui.chatError = '';
    } catch (error) {
      ui.status = null;
      ui.meetError = error?.message || 'Impossible de lire la connexion Google.';
    }
    render();
  }

  function normalizeSpaces(spaces) {
    const cachedProjects = projects();
    return (spaces || []).map(s => {
      let projectClientKey = null;
      if (s.project_id) {
        const hit = cachedProjects.find(p => p.uuid === s.project_id || p.databaseId === s.project_id);
        projectClientKey = hit?.id || null;
      }
      return { ...s, project_client_key: projectClientKey };
    });
  }

  async function syncChat(background = false) {
    if (ui.syncingChat || !ui.status?.account || ui.status?.needs_reconnect) return;
    ui.syncingChat = true;
    if (!background) ui.loading = 'chat';
    if (!background) render();
    try {
      const result = await api().syncChat();
      ui.spaces = normalizeSpaces(result?.spaces || []);
      ui.chatError = '';
      if (background && Number(result?.new_messages || 0) > 0) {
        notification(
          'Nouveau message Google Chat',
          `${Number(result.new_messages)} nouveau${Number(result.new_messages) > 1 ? 'x' : ''} message${Number(result.new_messages) > 1 ? 's' : ''}.`
        );
      }
      if (ui.selectedSpaceId) await loadMessages(ui.selectedSpaceId, false);
    } catch (error) {
      const message = error?.message || 'Synchronisation Google Chat impossible.';
      ui.chatError = /403|forbidden|not enabled|disabled|workspace/i.test(message)
        ? `${message} Vérifie que Google Chat API est activée et que le compte Google autorise l’API Chat.`
        : message;
    } finally {
      ui.syncingChat = false;
      if (ui.loading === 'chat') ui.loading = '';
      render();
    }
  }

  async function loadMessages(spaceId, markSeen = true) {
    try {
      const result = await api().listChatMessages(spaceId);
      ui.messages = result?.messages || [];
      if (markSeen) {
        await api().markChatSpaceSeen(spaceId);
        const space = ui.spaces.find(s => s.id === spaceId);
        if (space) space.unread_count = 0;
      }
      ui.chatError = '';
    } catch (error) {
      ui.chatError = error?.message || 'Impossible de charger les messages.';
    }
    render();
  }

  async function openSpace(spaceId) {
    ui.selectedSpaceId = spaceId;
    ui.chatView = 'conversation';
    ui.messages = [];
    render();
    await loadMessages(spaceId, true);
  }

  async function refreshMeetings(background = false) {
    if (!ui.status?.account || ui.status?.needs_reconnect) return;
    if (!background) ui.loading = 'meetings';
    if (!background) render();
    try {
      const result = await api().listMeetingRequests();
      ui.requests = result?.requests || [];
      ui.meetError = '';
    } catch (error) {
      ui.meetError = error?.message || 'Impossible de charger les demandes de réunion.';
    } finally {
      if (ui.loading === 'meetings') ui.loading = '';
      render();
    }
  }

  async function connectGoogle() {
    try {
      await api().connect();
    } catch (error) {
      showToast('Connexion Google impossible', error?.message || 'Réessaie plus tard.');
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = document.querySelector('#gwSendText')?.value?.trim();
    if (!text || !ui.selectedSpaceId) return;
    ui.loading = 'send';
    render();
    try {
      await api().sendChatMessage(ui.selectedSpaceId, text);
      await syncChat(true);
      await loadMessages(ui.selectedSpaceId, true);
    } catch (error) {
      showToast('Message non envoyé', error?.message || 'Erreur Google Chat.');
    } finally {
      ui.loading = '';
      render();
    }
  }

  async function linkProject(value) {
    if (!ui.selectedSpaceId) return;
    try {
      await api().linkChatSpaceProject(ui.selectedSpaceId, value || null);
      const space = ui.spaces.find(s => s.id === ui.selectedSpaceId);
      if (space) space.project_client_key = value || null;
      showToast('Google Chat', value ? 'Conversation liée au projet.' : 'Lien projet retiré.');
    } catch (error) {
      showToast('Association impossible', error?.message || 'Erreur Pilotage.');
    }
  }

  function isoFromInput(id) {
    const value = document.querySelector(id)?.value || '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  async function submitMeetingRequest(event) {
    event.preventDefault();
    const recipient = document.querySelector('#gwRequestRecipient')?.value || '';
    const title = document.querySelector('#gwRequestTitle')?.value?.trim() || '';
    const startAt = isoFromInput('#gwRequestStart');
    const endAt = isoFromInput('#gwRequestEnd');
    if (!recipient || !title || !startAt || !endAt) return;
    ui.loading = 'request';
    render();
    try {
      await api().createMeetingRequest({
        recipient_client_key: recipient,
        title,
        start_at: startAt,
        end_at: endAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
        project_client_key: document.querySelector('#gwRequestProject')?.value || null,
        description: document.querySelector('#gwRequestDescription')?.value?.trim() || null
      });
      ui.form = null;
      await refreshMeetings(true);
      showToast('Demande envoyée', 'Le destinataire a reçu une notification dans Pilotage.');
    } catch (error) {
      showToast('Demande non envoyée', error?.message || 'Erreur Pilotage.');
    } finally {
      ui.loading = '';
      render();
    }
  }

  async function submitMeet(event) {
    event.preventDefault();
    const title = document.querySelector('#gwMeetTitle')?.value?.trim() || '';
    const startAt = isoFromInput('#gwMeetStart');
    const endAt = isoFromInput('#gwMeetEnd');
    const attendees = String(document.querySelector('#gwMeetAttendees')?.value || '')
      .split(/[;,\s]+/)
      .map(v => v.trim())
      .filter(Boolean);
    if (!title || !startAt || !endAt) return;
    ui.loading = 'create-meet';
    render();
    try {
      const result = await api().createMeetEvent({
        title,
        start_at: startAt,
        end_at: endAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
        attendee_emails: attendees,
        project_client_key: document.querySelector('#gwMeetProject')?.value || null,
        description: document.querySelector('#gwMeetDescription')?.value?.trim() || null
      });
      ui.form = null;
      if (result?.meet_url) {
        showToast('Google Meet créé', 'Le lien Meet est prêt et l’événement a été ajouté à Google Agenda.');
        window.open(result.meet_url, '_blank', 'noopener');
      } else {
        showToast('Réunion créée', 'L’événement a été ajouté à Google Agenda.');
      }
      await refreshMeetings(true);
    } catch (error) {
      showToast('Création impossible', error?.message || 'Erreur Google Agenda.');
    } finally {
      ui.loading = '';
      render();
    }
  }

  async function respondMeeting(id, decision, payload = {}) {
    ui.loading = `meeting-${id}`;
    render();
    try {
      const result = await api().respondMeetingRequest(id, decision, payload);
      await refreshMeetings(true);
      if (decision === 'accept') {
        showToast('Réunion confirmée', result?.meet_url ? 'Le Google Meet a été créé.' : 'La réunion est confirmée.');
      } else if (decision === 'decline') {
        showToast('Réunion refusée', 'Le demandeur a été notifié.');
      } else {
        showToast('Nouveau créneau proposé', 'Le demandeur a été notifié.');
      }
    } catch (error) {
      showToast('Action impossible', error?.message || 'Erreur de réunion.');
    } finally {
      ui.loading = '';
      render();
    }
  }

  async function proposeReschedule(id) {
    const request = ui.requests.find(r => r.id === id);
    if (!request) return;
    const currentStart = localInputValue(new Date(request.proposed_start_at));
    const currentEnd = localInputValue(new Date(request.proposed_end_at));
    const start = window.prompt('Nouveau début (AAAA-MM-JJTHH:MM)', currentStart);
    if (!start) return;
    const end = window.prompt('Nouvelle fin (AAAA-MM-JJTHH:MM)', currentEnd);
    if (!end) return;
    const sd = new Date(start);
    const ed = new Date(end);
    if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime()) || ed <= sd) {
      showToast('Créneau invalide', 'Vérifie la date et l’heure.');
      return;
    }
    await respondMeeting(id, 'reschedule', {
      start_at: sd.toISOString(),
      end_at: ed.toISOString()
    });
  }

  function realtimeEvent(payload) {
    const row = payload?.new || payload?.old || {};
    refreshMeetings(true);
    if (payload?.eventType === 'INSERT' && row.recipient_member_id === currentMember()?.id) {
      notification('Nouvelle demande de réunion', 'Une demande de réunion vient d’arriver dans Pilotage.');
    } else if (payload?.eventType === 'UPDATE') {
      notification('Réunion mise à jour', 'Le statut ou le créneau d’une réunion a changé.');
    }
  }

  function subscribeRealtime() {
    if (ui.realtimeReady) return;
    const client = window.PILOTAGE_SUPABASE_CLIENT;
    const memberId = currentMember()?.id;
    if (!client || !memberId) return;

    const incoming = client.channel(`meeting-incoming-${memberId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'meeting_requests',
        filter: `recipient_member_id=eq.${memberId}`
      }, realtimeEvent)
      .subscribe();
    const outgoing = client.channel(`meeting-outgoing-${memberId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'meeting_requests',
        filter: `requester_member_id=eq.${memberId}`
      }, realtimeEvent)
      .subscribe();
    channels.push(incoming, outgoing);
    ui.realtimeReady = true;
  }

  function bind() {
    root.querySelectorAll('[data-gw-action="toggle"]').forEach(el => el.addEventListener('click', () => {
      ui.open = !ui.open;
      render();
      if (ui.open) {
        if (ui.tab === 'chat') syncChat(true);
        else refreshMeetings(true);
      }
    }));
    root.querySelectorAll('[data-gw-tab]').forEach(el => el.addEventListener('click', () => {
      ui.tab = el.dataset.gwTab;
      ui.form = null;
      render();
      if (ui.tab === 'chat') syncChat(true);
      else refreshMeetings(true);
    }));
    root.querySelector('[data-gw-action="connect-google"]')?.addEventListener('click', connectGoogle);
    root.querySelectorAll('[data-gw-action="sync-chat"],[data-gw-action="sync-current"]').forEach(el => el.addEventListener('click', () => syncChat(false)));
    root.querySelector('[data-gw-action="back-spaces"]')?.addEventListener('click', () => {
      ui.chatView = 'spaces';
      ui.selectedSpaceId = null;
      ui.messages = [];
      render();
    });
    root.querySelectorAll('[data-gw-space]').forEach(el => el.addEventListener('click', () => openSpace(el.dataset.gwSpace)));
    root.querySelector('#gwSendForm')?.addEventListener('submit', sendMessage);
    root.querySelector('#gwChatProject')?.addEventListener('change', e => linkProject(e.target.value));
    root.querySelector('[data-gw-action="refresh-meetings"]')?.addEventListener('click', () => refreshMeetings(false));
    root.querySelector('[data-gw-action="open-request"]')?.addEventListener('click', () => { ui.form = 'request'; render(); });
    root.querySelector('[data-gw-action="open-meet"]')?.addEventListener('click', () => { ui.form = 'meet'; render(); });
    root.querySelector('[data-gw-action="close-form"]')?.addEventListener('click', () => { ui.form = null; render(); });
    root.querySelector('#gwRequestMeetingForm')?.addEventListener('submit', submitMeetingRequest);
    root.querySelector('#gwCreateMeetForm')?.addEventListener('submit', submitMeet);
    root.querySelectorAll('[data-gw-meeting-accept]').forEach(el => el.addEventListener('click', () => respondMeeting(el.dataset.gwMeetingAccept, 'accept')));
    root.querySelectorAll('[data-gw-meeting-decline]').forEach(el => el.addEventListener('click', () => respondMeeting(el.dataset.gwMeetingDecline, 'decline')));
    root.querySelectorAll('[data-gw-meeting-reschedule]').forEach(el => el.addEventListener('click', () => proposeReschedule(el.dataset.gwMeetingReschedule)));
  }

  function injectAgendaShortcut() {
    const header = [...document.querySelectorAll('.page-header')].find(node =>
      node.querySelector('h1')?.textContent?.trim() === 'Agenda'
    );
    if (!header || header.querySelector('[data-gw-agenda-shortcut]')) return;
    const target = header.querySelector('.page-header-actions') || header;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary-btn gw-agenda-shortcut';
    btn.dataset.gwAgendaShortcut = 'true';
    btn.textContent = '+ Réunion Meet';
    btn.addEventListener('click', () => {
      ui.open = true;
      ui.tab = 'meetings';
      ui.form = 'meet';
      render();
    });
    target.appendChild(btn);
  }

  async function initialLoad() {
    await refreshStatus();
    if (!ui.status?.account || ui.status?.needs_reconnect) return;
    await Promise.allSettled([syncChat(true), refreshMeetings(true)]);
  }

  function installObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (isReady()) injectAgendaShortcut();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    injectAgendaShortcut();
  }

  async function boot() {
    if (ui.booted || !isReady()) return;
    ui.booted = true;
    ensureRoot();
    render();
    subscribeRealtime();
    installObserver();
    await initialLoad();

    pollTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshMeetings(true);
      syncChat(true);
    }, CHAT_POLL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshStatus().then(() => {
          refreshMeetings(true);
          syncChat(true);
        });
      }
    });
  }

  bootTimer = setInterval(() => {
    if (isReady()) {
      clearInterval(bootTimer);
      boot();
    }
  }, BOOT_POLL_MS);

  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
    if (bootTimer) clearInterval(bootTimer);
    const client = window.PILOTAGE_SUPABASE_CLIENT;
    if (client) channels.forEach(channel => { try { client.removeChannel(channel); } catch {} });
  });
})();