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
    lastMeet: null,
    meetInvitees: [],
    meetInviteesLoaded: false,
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

  function chatApi() {
    if (!window.PILOTAGE_CHAT) throw new Error('Chat SpeedArti indisponible.');
    return window.PILOTAGE_CHAT;
  }

  function isReady() {
    const app = document.querySelector('#app');
    return Boolean(
      window.PILOTAGE_AUTH?.member?.id
      && window.PILOTAGE_GOOGLE
      && window.PILOTAGE_CHAT
      && app
      && !app.hidden
    );
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
        <p>Connecte ton compte Google pour utiliser Agenda et Meet dans Pilotage. Le Chat SpeedArti fonctionne indépendamment.</p>
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
    if (ui.chatError) {
      return `
        <div class="gw-error-card">
          <strong>Chat SpeedArti indisponible</strong>
          <p>${esc(ui.chatError)}</p>
          <button class="gw-secondary" data-gw-action="sync-chat">Réessayer</button>
        </div>`;
    }
    if (ui.loading === 'chat' && !ui.spaces.length) {
      return '<div class="gw-loading">Chargement du Chat SpeedArti…</div>';
    }

    return `
      <div class="gw-chat-tools">
        <span>${ui.spaces.length} salon${ui.spaces.length > 1 ? 's' : ''}</span>
        <span class="gw-inline-actions">
          <button class="gw-secondary small" data-gw-action="open-chat-room">+ Salon</button>
          <button class="gw-icon-button" data-gw-action="sync-chat" title="Actualiser">↻</button>
        </span>
      </div>
      <div class="gw-space-list">
        ${ui.spaces.length ? ui.spaces.map(space => `
          <button class="gw-space-row" data-gw-space="${esc(space.id)}">
            <span class="gw-space-avatar">${space.room_type === 'project' ? '▦' : '👥'}</span>
            <span class="gw-space-copy">
              <strong>${esc(space.display_name || 'Chat SpeedArti')}</strong>
              <small>${space.project_name ? esc(space.project_name) : esc(space.last_message_preview || 'Équipe SpeedArti')}</small>
            </span>
            ${Number(space.unread_count || 0) ? `<b class="gw-unread">${Number(space.unread_count)}</b>` : ''}
          </button>
        `).join('') : '<div class="gw-empty-line">Aucun salon disponible.</div>'}
      </div>`;
  }

  function renderConversation() {
    const space = ui.spaces.find(s => s.id === ui.selectedSpaceId);
    if (!space) {
      ui.chatView = 'spaces';
      return renderSpaces();
    }
    return `
      <div class="gw-conversation">
        <div class="gw-conversation-head">
          <button class="gw-icon-button" data-gw-action="back-spaces">←</button>
          <div>
            <strong>${esc(space.display_name || 'Chat SpeedArti')}</strong>
            <small>${space.project_name ? `Projet · ${esc(space.project_name)}` : 'Chat interne SpeedArti'}</small>
          </div>
          <button class="gw-icon-button" data-gw-action="sync-current" title="Actualiser">↻</button>
        </div>
        <div class="gw-message-list" id="gwMessageList">
          ${ui.messages.length ? ui.messages.map(m => {
            const own = m.sender_member_id === currentMember()?.id;
            return `
              <article class="gw-message ${own ? 'is-own' : ''}">
                <div class="gw-message-meta"><strong>${esc(m.sender_display_name || 'Équipe')}</strong><time>${esc(formatDateTime(m.created_at))}</time></div>
                <p>${esc(m.body || '')}</p>
              </article>`;
          }).join('') : '<div class="gw-empty-line">Aucun message pour le moment.</div>'}
        </div>
        <form id="gwSendForm" class="gw-compose">
          <textarea id="gwSendText" rows="2" maxlength="10000" placeholder="Écrire un message…" required></textarea>
          <button class="gw-primary" type="submit" ${ui.loading === 'send' ? 'disabled' : ''}>${ui.loading === 'send' ? '…' : 'Envoyer'}</button>
        </form>
      </div>`;
  }

  function renderChatRoomForm() {
    return `
      <form id="gwCreateChatRoomForm" class="gw-form">
        <div class="gw-form-head"><strong>Nouveau salon</strong><button type="button" class="gw-icon-button" data-gw-action="close-chat-room">×</button></div>
        <label><span>Nom du salon</span><input id="gwChatRoomName" required maxlength="120" placeholder="Ex. Configurateur terrasse" /></label>
        <label><span>Projet lié (optionnel)</span>
          <select id="gwChatRoomProject">
            <option value="">Équipe générale</option>
            ${projects().map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
        </label>
        <p class="gw-meeting-desc">Avec un projet, les membres déjà affectés à ce projet sont ajoutés au salon. Sans projet, le salon est accessible à l’équipe active.</p>
        <button class="gw-primary" type="submit" ${ui.loading === 'create-room' ? 'disabled' : ''}>${ui.loading === 'create-room' ? 'Création…' : 'Créer le salon'}</button>
      </form>`;
  }

  function renderChat() {
    if (ui.form === 'chat-room') return renderChatRoomForm();
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
        ${r.meet_url ? `
          <div class="gw-meet-link-row">
            <a class="gw-meet-link" href="${esc(r.meet_url)}" target="_blank" rel="noopener">📹 Rejoindre Google Meet</a>
            <button class="gw-secondary small" data-gw-copy-meet="${esc(r.meet_url)}">Copier le lien</button>
          </div>` : ''}
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
    const internalInvitees = ui.meetInvitees.filter(invitee => !invitee.is_current);
    return `
      <form id="gwCreateMeetForm" class="gw-form">
        <div class="gw-form-head"><strong>Créer un Google Meet</strong><button type="button" class="gw-icon-button" data-gw-action="close-form">×</button></div>
        <label><span>Titre</span><input id="gwMeetTitle" required maxlength="240" placeholder="Réunion SpeedArti" /></label>
        <div class="gw-form-grid">
          <label><span>Début</span><input id="gwMeetStart" type="datetime-local" value="${localInputValue(start)}" required /></label>
          <label><span>Fin</span><input id="gwMeetEnd" type="datetime-local" value="${localInputValue(end)}" required /></label>
        </div>

        <fieldset class="gw-invitees">
          <legend>Invités SpeedArti</legend>
          ${ui.loading === 'invitees'
            ? '<div class="gw-empty-line">Chargement des membres…</div>'
            : internalInvitees.length
              ? internalInvitees.map(invitee => `
                <label class="gw-invitee-option">
                  <input type="checkbox" data-gw-invitee-email="${esc(invitee.email || '')}" ${invitee.email ? '' : 'disabled'} />
                  <span class="gw-invitee-avatar">${esc(invitee.initials || (invitee.display_name || '?').slice(0,2).toUpperCase())}</span>
                  <span class="gw-invitee-copy">
                    <strong>${esc(invitee.display_name || 'Membre')}</strong>
                    <small>${invitee.email ? esc(invitee.email) : 'Adresse e-mail indisponible'}</small>
                  </span>
                </label>`).join('')
              : '<div class="gw-empty-line">Aucun autre membre disponible.</div>'}
        </fieldset>

        <label>
          <span>Invités externes</span>
          <input id="gwMeetAttendees" placeholder="client@exemple.fr, partenaire@exemple.fr" />
        </label>
        <small class="gw-field-help">Tu peux sélectionner plusieurs membres ci-dessus et ajouter plusieurs adresses externes séparées par une virgule.</small>

        <label><span>Projet</span><select id="gwMeetProject"><option value="">Sans projet</option>${projects().map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
        <label><span>Description</span><textarea id="gwMeetDescription" rows="2" maxlength="2000" placeholder="Optionnel"></textarea></label>
        <button class="gw-primary" type="submit" ${ui.loading === 'create-meet' ? 'disabled' : ''}>${ui.loading === 'create-meet' ? 'Création…' : 'Créer le lien Meet et inviter'}</button>
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
      ${ui.lastMeet?.meet_url ? `
        <div class="gw-last-meet">
          <div class="gw-last-meet-main">
            <strong>${esc(ui.lastMeet.title || 'Google Meet')}</strong>
            <small>Réunion créée dans Google Agenda${ui.lastMeet.attendee_count ? ` · ${ui.lastMeet.attendee_count} invité${ui.lastMeet.attendee_count > 1 ? 's' : ''}` : ''}</small>
            <code>${esc(ui.lastMeet.meet_url)}</code>
          </div>
          <div class="gw-last-meet-actions">
            <button class="gw-secondary small" data-gw-copy-meet="${esc(ui.lastMeet.meet_url)}">Copier</button>
            <a href="${esc(ui.lastMeet.meet_url)}" target="_blank" rel="noopener">📹 Rejoindre</a>
          </div>
        </div>` : ''}
      ${actionableRequests().length ? `<div class="gw-action-callout"><b>${actionableRequests().length}</b> demande${actionableRequests().length > 1 ? 's' : ''} à traiter</div>` : ''}
      ${renderMeetingList()}
    `;
  }

  function renderPanel() {
    if (!ui.open) return '';
    const chatCount = chatBadge();
    const meetCount = actionableRequests().length;
    return `
      <section class="gw-panel" role="dialog" aria-label="Chat SpeedArti et réunions">
        <header class="gw-header">
          <div class="gw-brand"><span>S</span><div><strong>Communication</strong><small>Chat interne + Google Meet</small></div></div>
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
    } catch (error) {
      ui.status = null;
      ui.meetError = error?.message || 'Impossible de lire la connexion Google.';
    }
    render();
  }

  async function syncChat(background = false) {
    if (ui.syncingChat) return;
    ui.syncingChat = true;
    if (!background) ui.loading = 'chat';
    if (!background) render();
    try {
      const rows = await chatApi().listRooms();
      ui.spaces = rows.map(row => ({
        id: row.room_id,
        client_key: row.client_key,
        display_name: row.room_name,
        room_type: row.room_type,
        project_id: row.project_id,
        project_client_key: row.project_client_key,
        project_name: row.project_name,
        unread_count: Number(row.unread_count || 0),
        last_message_at: row.last_message_at,
        last_message_preview: row.last_message_preview || ''
      }));
      ui.chatError = '';
      if (ui.selectedSpaceId && !ui.spaces.some(x => x.id === ui.selectedSpaceId)) {
        ui.selectedSpaceId = null;
        ui.chatView = 'spaces';
        ui.messages = [];
      }
      if (ui.selectedSpaceId) await loadMessages(ui.selectedSpaceId, false);
    } catch (error) {
      ui.chatError = error?.message || 'Chargement du Chat SpeedArti impossible.';
    } finally {
      ui.syncingChat = false;
      if (ui.loading === 'chat') ui.loading = '';
      render();
    }
  }

  async function loadMessages(spaceId, markSeen = true) {
    try {
      ui.messages = await chatApi().listMessages(spaceId, 100);
      if (markSeen) {
        await chatApi().markRead(spaceId);
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
    ui.form = null;
    ui.messages = [];
    render();
    await loadMessages(spaceId, true);
  }

  async function createChatRoom(event) {
    event.preventDefault();
    const name = document.querySelector('#gwChatRoomName')?.value?.trim() || '';
    const projectClientKey = document.querySelector('#gwChatRoomProject')?.value || null;
    if (!name) return;
    ui.loading = 'create-room';
    render();
    try {
      const roomId = await chatApi().createRoom(name, projectClientKey);
      ui.form = null;
      await syncChat(true);
      if (roomId) await openSpace(roomId);
      showToast('Salon créé', projectClientKey ? 'Salon projet prêt.' : 'Salon équipe prêt.');
    } catch (error) {
      showToast('Création impossible', error?.message || 'Erreur du Chat SpeedArti.');
    } finally {
      ui.loading = '';
      render();
    }
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
      await chatApi().sendMessage(ui.selectedSpaceId, text);
      await loadMessages(ui.selectedSpaceId, true);
      await syncChat(true);
    } catch (error) {
      showToast('Message non envoyé', error?.message || 'Erreur du Chat SpeedArti.');
    } finally {
      ui.loading = '';
      render();
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

  async function loadMeetInvitees(force = false) {
    if (ui.meetInviteesLoaded && !force) return;
    ui.loading = 'invitees';
    render();
    try {
      const result = await api().listMeetingInvitees();
      ui.meetInvitees = Array.isArray(result?.invitees) ? result.invitees : [];
      ui.meetInviteesLoaded = true;
      ui.meetError = '';
    } catch (error) {
      ui.meetError = error?.message || 'Impossible de charger les invités SpeedArti.';
    } finally {
      if (ui.loading === 'invitees') ui.loading = '';
      render();
    }
  }

  async function openMeetForm() {
    ui.form = 'meet';
    render();
    await loadMeetInvitees(false);
  }

  async function copyMeetLink(url) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Lien copié', 'Le lien Google Meet est dans le presse-papiers.');
    } catch {
      const area = document.createElement('textarea');
      area.value = url;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      showToast('Lien copié', 'Le lien Google Meet est dans le presse-papiers.');
    }
  }

  async function submitMeet(event) {
    event.preventDefault();
    const title = document.querySelector('#gwMeetTitle')?.value?.trim() || '';
    const startAt = isoFromInput('#gwMeetStart');
    const endAt = isoFromInput('#gwMeetEnd');
    const internalAttendees = [...document.querySelectorAll('[data-gw-invitee-email]:checked')]
      .map(input => String(input.dataset.gwInviteeEmail || '').trim())
      .filter(Boolean);
    const externalAttendees = String(document.querySelector('#gwMeetAttendees')?.value || '')
      .split(/[;,\s]+/)
      .map(v => v.trim())
      .filter(Boolean);
    const attendees = [...new Set([...internalAttendees, ...externalAttendees])];
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
        ui.lastMeet = { title, meet_url: result.meet_url, attendee_count: attendees.length };
        showToast('Google Meet créé', 'Le lien Meet est prêt et l’événement a été ajouté à Google Agenda.');
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

    try {
      const chatChannel = chatApi().subscribe(async payload => {
        const row = payload?.new || {};
        const isOwn = row.sender_member_id === currentMember()?.id;
        await syncChat(true);
        if (ui.selectedSpaceId === row.room_id && ui.open && ui.tab === 'chat') {
          await loadMessages(row.room_id, true);
        } else if (!isOwn) {
          notification('Nouveau message SpeedArti', 'Un nouveau message est arrivé dans le chat.');
        }
      });
      if (chatChannel) channels.push(chatChannel);
    } catch (error) {
      console.warn('Realtime Chat indisponible', error);
    }

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
    root.querySelectorAll('[data-gw-tab]').forEach(el => el.addEventListener('click', async () => {
      ui.tab = el.dataset.gwTab;
      ui.form = null;
      render();
      if (ui.tab === 'chat') {
        syncChat(true);
      } else {
        await refreshStatus();
        if (ui.status?.account && !ui.status?.needs_reconnect) {
          refreshMeetings(true);
        }
      }
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
    root.querySelector('[data-gw-action="open-chat-room"]')?.addEventListener('click', () => { ui.form = 'chat-room'; ui.chatView = 'spaces'; render(); });
    root.querySelector('[data-gw-action="close-chat-room"]')?.addEventListener('click', () => { ui.form = null; render(); });
    root.querySelector('#gwCreateChatRoomForm')?.addEventListener('submit', createChatRoom);
    root.querySelector('[data-gw-action="refresh-meetings"]')?.addEventListener('click', () => refreshMeetings(false));
    root.querySelector('[data-gw-action="open-request"]')?.addEventListener('click', () => { ui.form = 'request'; render(); });
    root.querySelector('[data-gw-action="open-meet"]')?.addEventListener('click', openMeetForm);
    root.querySelector('[data-gw-action="close-form"]')?.addEventListener('click', () => { ui.form = null; render(); });
    root.querySelector('#gwRequestMeetingForm')?.addEventListener('submit', submitMeetingRequest);
    root.querySelector('#gwCreateMeetForm')?.addEventListener('submit', submitMeet);
    root.querySelectorAll('[data-gw-meeting-accept]').forEach(el => el.addEventListener('click', () => respondMeeting(el.dataset.gwMeetingAccept, 'accept')));
    root.querySelectorAll('[data-gw-meeting-decline]').forEach(el => el.addEventListener('click', () => respondMeeting(el.dataset.gwMeetingDecline, 'decline')));
    root.querySelectorAll('[data-gw-meeting-reschedule]').forEach(el => el.addEventListener('click', () => proposeReschedule(el.dataset.gwMeetingReschedule)));
    root.querySelectorAll('[data-gw-copy-meet]').forEach(el => el.addEventListener('click', () => copyMeetLink(el.dataset.gwCopyMeet)));
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
      openMeetForm();
    });
    target.appendChild(btn);
  }

  async function initialLoad() {
    await Promise.allSettled([refreshStatus(), syncChat(true)]);
    if (ui.status?.account && !ui.status?.needs_reconnect) {
      await refreshMeetings(true);
    }
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
          if (ui.status?.account && !ui.status?.needs_reconnect) refreshMeetings(true);
        });
        syncChat(true);
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