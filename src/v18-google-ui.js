(() => {
  'use strict';

  const STORAGE_KEY = 'speedarti-pilotage-demo-v1';
  const PANEL_ID = 'pilotageGoogleV18Panel';
  const STYLE_ID = 'pilotageGoogleV18Styles';
  let renderTimer = null;
  let busy = false;
  let lastPage = '';

  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function fmtDate(value) {
    if (!value) return 'Jamais';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle:'short', timeStyle:'short' }).format(d);
  }

  function localState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function projects() {
    return Array.isArray(localState().projects) ? localState().projects.filter(p => !p.archived) : [];
  }

  function teamNameByUuid(uuid) {
    const state = localState();
    const current = window.PILOTAGE_AUTH?.member;
    if (current?.id === uuid) return current.display_name || current.client_key || 'Moi';
    const team = Array.isArray(state.team) ? state.team : [];
    const member = team.find(x => x.authUserId === uuid || x.uuid === uuid || x.id === uuid);
    return member?.name || 'Membre équipe';
  }

  function client() {
    return window.PILOTAGE_SUPABASE_CLIENT || null;
  }

  function google() {
    return window.PILOTAGE_GOOGLE || null;
  }

  function currentMember() {
    return window.PILOTAGE_AUTH?.member || null;
  }

  function currentPage() {
    const title = document.querySelector('.page-header h1')?.textContent?.trim() || '';
    if (title === 'Documents') return 'documents';
    if (title === 'Agenda') return 'calendar';
    return '';
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .g18-panel{margin:0 0 18px;padding:18px;border:1px solid #dbe4ef;border-radius:16px;background:#fff;box-shadow:0 4px 18px rgba(15,23,42,.05)}
      .g18-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.g18-head h2{margin:0;font-size:18px}.g18-head p{margin:4px 0 0;color:#64748b;font-size:13px}
      .g18-status{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#f1f5f9;color:#475569}.g18-status.ok{background:#dcfce7;color:#166534}.g18-status.warn{background:#fef3c7;color:#92400e}.g18-status.err{background:#fee2e2;color:#991b1b}
      .g18-actions{display:flex;gap:8px;flex-wrap:wrap}.g18-btn{border:0;border-radius:10px;padding:9px 12px;font-weight:700;cursor:pointer;background:#2563eb;color:#fff}.g18-btn.secondary{background:#eff6ff;color:#1d4ed8}.g18-btn.ghost{background:#f8fafc;color:#334155;border:1px solid #e2e8f0}.g18-btn.danger{background:#fff1f2;color:#be123c}.g18-btn:disabled{opacity:.55;cursor:not-allowed}
      .g18-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.g18-card{border:1px solid #e2e8f0;border-radius:12px;padding:13px;background:#f8fafc}.g18-card small{display:block;color:#64748b;margin-bottom:4px}.g18-card strong{display:block;color:#0f172a}.g18-card p{margin:5px 0 0;color:#64748b;font-size:12px}
      .g18-list{margin-top:14px;border-top:1px solid #e2e8f0}.g18-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid #eef2f7}.g18-row strong{display:block;font-size:13px}.g18-row small{display:block;color:#64748b;margin-top:3px;white-space:normal;word-break:break-word}.g18-row-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.g18-row select{max-width:210px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
      .g18-check{display:flex;align-items:center;gap:8px;font-size:13px}.g18-check input{width:16px;height:16px}.g18-note{margin-top:10px;padding:10px 12px;border-radius:10px;background:#eff6ff;color:#1e40af;font-size:12px}.g18-error{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:12px}
      .g18-modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9998}.g18-modal{position:fixed;z-index:9999;left:50%;top:50%;transform:translate(-50%,-50%);width:min(720px,calc(100vw - 28px));max-height:78vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.24)}.g18-modal header{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #e2e8f0}.g18-modal header h3{margin:0}.g18-modal .body{padding:14px 18px}.g18-folder{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px}.g18-folder .meta{min-width:0}.g18-folder strong{display:block}.g18-folder small{color:#64748b}.g18-breadcrumb{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.g18-breadcrumb button{border:0;background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:6px 8px;cursor:pointer}
      @media(max-width:760px){.g18-grid{grid-template-columns:1fr}.g18-head{flex-direction:column}.g18-row{grid-template-columns:1fr}.g18-row-actions{justify-content:flex-start}.g18-row select{max-width:100%}}
    `;
    document.head.appendChild(style);
  }

  function insertPanel(html) {
    document.getElementById(PANEL_ID)?.remove();
    const host = document.querySelector('#app main, #app .main-content, #app .content, #app');
    const pageHeader = document.querySelector('.page-header');
    if (!host || !pageHeader) return;
    const section = document.createElement('section');
    section.id = PANEL_ID;
    section.className = 'g18-panel';
    section.innerHTML = html;
    pageHeader.insertAdjacentElement('afterend', section);
  }

  async function integrations() {
    const db = client();
    if (!db) return [];
    const { data, error } = await db.from('integrations').select('*').in('provider', ['google_drive','google_calendar']).order('created_at');
    if (error) throw error;
    return data || [];
  }

  function ownIntegration(rows, provider) {
    const memberId = currentMember()?.id;
    return rows.find(x => x.provider === provider && x.owner_member_id === memberId) || null;
  }

  async function renderDocuments() {
    if (!client() || !google() || !currentMember()) return;
    try {
      const [status, allIntegrations] = await Promise.all([google().status(), integrations()]);
      const drive = ownIntegration(allIntegrations, 'google_drive');
      const cfg = drive?.configuration || {};
      const connected = drive?.status === 'connected';
      let files = [];
      if (drive?.id && connected && cfg.root_folder_id) {
        const { data } = await client().from('drive_sync_items').select('*').eq('integration_id', drive.id).order('relative_path').limit(250);
        files = data || [];
      }
      const projectOptions = projects().map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
      const visibleFiles = files.filter(f => !f.is_folder).slice(0, 80);
      insertPanel(`
        <div class="g18-head"><div><h2>Google Drive</h2><p>Synchronisation limitée au dossier racine choisi et à ses sous-dossiers.</p></div><span class="g18-status ${connected ? 'ok' : status.configured ? 'warn' : 'err'}">${connected ? 'Connecté' : status.configured ? 'À connecter' : 'Google Cloud à configurer'}</span></div>
        <div class="g18-grid">
          <div class="g18-card"><small>Compte Google</small><strong>${esc(status.account?.google_email || 'Non connecté')}</strong><p>${connected ? 'Jetons conservés côté serveur et chiffrés.' : 'Chaque membre connecte son propre compte.'}</p></div>
          <div class="g18-card"><small>Dossier synchronisé</small><strong>${esc(cfg.root_folder_name || 'Aucun dossier sélectionné')}</strong><p>${cfg.root_folder_id ? 'Sous-dossiers inclus · lecture seule.' : 'Le reste du Drive ne sera pas synchronisé.'}</p></div>
        </div>
        <div class="g18-actions" style="margin-top:12px">
          ${connected ? `<button class="g18-btn secondary" data-g18="choose-drive">Choisir le dossier</button><button class="g18-btn" data-g18="sync-drive" ${cfg.root_folder_id ? '' : 'disabled'}>Synchroniser maintenant</button><button class="g18-btn danger" data-g18="disconnect">Déconnecter Google</button>` : `<button class="g18-btn" data-g18="connect" ${status.configured ? '' : 'disabled'}>Connecter Google</button>`}
        </div>
        ${!status.configured ? '<div class="g18-note">La partie applicative est prête. Il reste à renseigner les identifiants OAuth Google dans les secrets Supabase.</div>' : ''}
        ${connected && cfg.root_folder_id ? `<div class="g18-list"><div class="g18-row"><div><strong>${visibleFiles.length} fichier(s) affiché(s)</strong><small>${files.length} élément(s) synchronisé(s) au total dans la sélection actuelle.</small></div><div></div></div>${visibleFiles.map(f => `<div class="g18-row"><div><strong>${esc(f.name)}</strong><small>${esc(f.relative_path || '')} · ${esc(f.mime_type || 'fichier')}</small></div><div class="g18-row-actions"><select data-g18-project="${esc(f.id)}"><option value="">Sans projet</option>${projectOptions}</select><button class="g18-btn ghost" data-g18-link-drive="${esc(f.id)}">Rattacher</button>${f.web_url ? `<a class="g18-btn secondary" href="${esc(f.web_url)}" target="_blank" rel="noopener">Ouvrir</a>` : ''}</div></div>`).join('')}</div>` : ''}
      `);
      bindPanelEvents();
    } catch (error) {
      insertPanel(`<div class="g18-head"><div><h2>Google Drive</h2><p>Connecteur V18</p></div><span class="g18-status err">Erreur</span></div><div class="g18-error">${esc(error.message || error)}</div>`);
      bindPanelEvents();
    }
  }

  async function renderCalendar() {
    if (!client() || !google() || !currentMember()) return;
    try {
      const [status, allIntegrations] = await Promise.all([google().status(), integrations()]);
      const own = ownIntegration(allIntegrations, 'google_calendar');
      const connected = own?.status === 'connected';
      let sources = [];
      let events = [];
      if (connected) {
        const sourceResp = await client().from('calendar_sources').select('*').order('is_primary', { ascending:false }).order('name');
        sources = sourceResp.data || [];
        const ids = sources.map(s => s.id);
        if (ids.length) {
          const nowIso = new Date(Date.now() - 86400000).toISOString();
          const eventResp = await client().from('calendar_events').select('*').in('calendar_source_id', ids).or(`start_at.gte.${nowIso},start_date.gte.${new Date().toISOString().slice(0,10)}`).order('start_at', { ascending:true, nullsFirst:false }).limit(80);
          events = eventResp.data || [];
        }
      }
      const ownerMap = new Map(allIntegrations.map(i => [i.id, teamNameByUuid(i.owner_member_id)]));
      const sourceMap = new Map(sources.map(s => [s.id, s]));
      const ownSources = sources.filter(s => s.integration_id === own?.id);
      insertPanel(`
        <div class="g18-head"><div><h2>Google Agenda</h2><p>Chaque membre connecte son compte et choisit les agendas à synchroniser.</p></div><span class="g18-status ${connected ? 'ok' : status.configured ? 'warn' : 'err'}">${connected ? 'Connecté' : status.configured ? 'À connecter' : 'Google Cloud à configurer'}</span></div>
        <div class="g18-grid">
          <div class="g18-card"><small>Mon compte</small><strong>${esc(status.account?.google_email || 'Non connecté')}</strong><p>Lecture seule par défaut.</p></div>
          <div class="g18-card"><small>Agendas accessibles dans Pilotage</small><strong>${sources.length}</strong><p>Les agendas partagés par l’équipe sont visibles selon les droits.</p></div>
        </div>
        <div class="g18-actions" style="margin-top:12px">
          ${connected ? `<button class="g18-btn secondary" data-g18="load-calendars">Actualiser la liste</button><button class="g18-btn" data-g18="save-calendars">Enregistrer la sélection</button><button class="g18-btn" data-g18="sync-calendars">Synchroniser les événements</button><button class="g18-btn danger" data-g18="disconnect">Déconnecter Google</button>` : `<button class="g18-btn" data-g18="connect" ${status.configured ? '' : 'disabled'}>Connecter Google</button>`}
        </div>
        ${!status.configured ? '<div class="g18-note">La partie applicative est prête. Il reste à renseigner les identifiants OAuth Google dans les secrets Supabase.</div>' : ''}
        ${connected ? `<div class="g18-list"><div class="g18-row"><div><strong>Mes agendas</strong><small>Sélectionne ceux qui remontent dans Pilotage. « Partager équipe » les rend visibles aux autres membres Pilotage.</small></div><div></div></div>${ownSources.map(s => `<div class="g18-row"><div><strong>${esc(s.name)}</strong><small>${s.is_primary ? 'Principal · ' : ''}${esc(s.timezone || '')}</small></div><div class="g18-row-actions"><label class="g18-check"><input type="checkbox" data-g18-cal-selected="${esc(s.external_calendar_id)}" ${s.selected ? 'checked' : ''}> Synchroniser</label><label class="g18-check"><input type="checkbox" data-g18-cal-shared="${esc(s.external_calendar_id)}" ${s.shared_with_team ? 'checked' : ''}> Partager équipe</label></div></div>`).join('') || '<div class="g18-row"><div><strong>Aucun agenda chargé.</strong><small>Clique sur « Actualiser la liste ».</small></div><div></div></div>'}</div>
        <div class="g18-list"><div class="g18-row"><div><strong>Événements Google synchronisés</strong><small>${events.length} événement(s) affiché(s).</small></div><div></div></div>${events.slice(0,50).map(e => { const s=sourceMap.get(e.calendar_source_id); const when=e.start_at ? fmtDate(e.start_at) : (e.start_date || 'Journée entière'); return `<div class="g18-row"><div><strong>${esc(e.summary || 'Sans titre')}</strong><small>${esc(when)} · ${esc(s?.name || 'Agenda')} · ${esc(ownerMap.get(s?.integration_id) || '')}</small></div><div class="g18-row-actions">${e.html_link ? `<a class="g18-btn secondary" href="${esc(e.html_link)}" target="_blank" rel="noopener">Ouvrir</a>` : ''}</div></div>`; }).join('') || '<div class="g18-row"><div><strong>Aucun événement synchronisé.</strong><small>Lance une synchronisation après avoir sélectionné tes agendas.</small></div><div></div></div>'}</div>` : ''}
      `);
      bindPanelEvents();
    } catch (error) {
      insertPanel(`<div class="g18-head"><div><h2>Google Agenda</h2><p>Connecteur V18</p></div><span class="g18-status err">Erreur</span></div><div class="g18-error">${esc(error.message || error)}</div>`);
      bindPanelEvents();
    }
  }

  async function openDrivePicker() {
    if (document.querySelector('.g18-modal')) return;
    const bg = document.createElement('div');
    bg.className = 'g18-modal-bg';
    const modal = document.createElement('div');
    modal.className = 'g18-modal';
    modal.innerHTML = `<header><h3>Choisir le dossier Drive</h3><button class="g18-btn ghost" data-g18-close>Fermer</button></header><div class="body"><div class="g18-note">Pilotage ne synchronisera que le dossier choisi et ses sous-dossiers.</div><div id="g18FolderBody" style="margin-top:12px">Chargement…</div></div>`;
    document.body.append(bg, modal);
    const close = () => { bg.remove(); modal.remove(); };
    bg.addEventListener('click', close);
    modal.querySelector('[data-g18-close]')?.addEventListener('click', close);

    const body = modal.querySelector('#g18FolderBody');
    const breadcrumbs = [];

    async function showRoots() {
      body.textContent = 'Chargement…';
      try {
        const data = await google().listDriveRoots();
        breadcrumbs.length = 0;
        body.innerHTML = `<div class="g18-breadcrumb"><button data-g18-root>Racines Drive</button></div>${(data.roots || []).map(r => `<div class="g18-folder"><div class="meta"><strong>${esc(r.name)}</strong><small>${r.kind === 'shared_drive' ? 'Drive partagé' : 'Mon Drive'}</small></div><div class="g18-actions"><button class="g18-btn ghost" data-g18-browse="${esc(r.id)}" data-drive-id="${esc(r.drive_id || '')}">Ouvrir</button><button class="g18-btn" data-g18-select-folder="${esc(r.id)}" data-drive-id="${esc(r.drive_id || '')}">Choisir</button></div></div>`).join('')}`;
        bindFolderButtons();
      } catch (error) { body.innerHTML = `<div class="g18-error">${esc(error.message || error)}</div>`; }
    }

    async function showFolder(parentId, driveId, name = 'Dossier') {
      body.textContent = 'Chargement…';
      try {
        const data = await google().listDriveFolder(parentId, driveId || null);
        breadcrumbs.push({ id:parentId, driveId:driveId || null, name });
        body.innerHTML = `<div class="g18-breadcrumb"><button data-g18-root>Racines Drive</button>${breadcrumbs.map((b,i) => `<button data-g18-crumb="${i}">${esc(b.name)}</button>`).join('')}</div><div class="g18-actions" style="margin-bottom:12px"><button class="g18-btn" data-g18-select-folder="${esc(parentId)}" data-drive-id="${esc(driveId || '')}">Choisir ce dossier</button></div>${(data.folders || []).map(f => `<div class="g18-folder"><div class="meta"><strong>${esc(f.name)}</strong><small>Dossier</small></div><div class="g18-actions"><button class="g18-btn ghost" data-g18-browse="${esc(f.id)}" data-drive-id="${esc(driveId || f.driveId || '')}">Ouvrir</button><button class="g18-btn" data-g18-select-folder="${esc(f.id)}" data-drive-id="${esc(driveId || f.driveId || '')}">Choisir</button></div></div>`).join('') || '<div class="g18-note">Aucun sous-dossier. Tu peux sélectionner ce dossier.</div>'}`;
        bindFolderButtons();
      } catch (error) { body.innerHTML = `<div class="g18-error">${esc(error.message || error)}</div>`; }
    }

    function bindFolderButtons() {
      body.querySelector('[data-g18-root]')?.addEventListener('click', showRoots);
      body.querySelectorAll('[data-g18-browse]').forEach(btn => btn.addEventListener('click', () => {
        const driveId = btn.dataset.driveId || null;
        const label = btn.closest('.g18-folder')?.querySelector('strong')?.textContent || 'Dossier';
        showFolder(btn.dataset.g18Browse, driveId, label);
      }));
      body.querySelectorAll('[data-g18-select-folder]').forEach(btn => btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Sélection…';
        try {
          await google().selectDriveRoot(btn.dataset.g18SelectFolder, btn.dataset.driveId || null);
          close();
          await renderDocuments();
        } catch (error) {
          btn.disabled = false;
          btn.textContent = 'Choisir';
          window.alert(error.message || String(error));
        }
      }));
      body.querySelectorAll('[data-g18-crumb]').forEach(btn => btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.g18Crumb);
        const target = breadcrumbs[idx];
        breadcrumbs.splice(idx);
        if (target) showFolder(target.id, target.driveId, target.name);
      }));
    }

    showRoots();
  }

  async function act(action, button) {
    if (busy) return;
    busy = true;
    const old = button?.textContent;
    if (button) { button.disabled = true; button.textContent = '…'; }
    try {
      if (action === 'connect') return google().connect();
      if (action === 'disconnect') {
        if (!window.confirm('Déconnecter Google de ton compte Pilotage ?')) return;
        await google().disconnect();
      }
      if (action === 'choose-drive') return openDrivePicker();
      if (action === 'sync-drive') await google().syncDrive();
      if (action === 'load-calendars') await google().listCalendars();
      if (action === 'sync-calendars') await google().syncCalendars();
      if (action === 'save-calendars') {
        const selected = [...document.querySelectorAll('[data-g18-cal-selected]')];
        const selections = selected.map(input => ({
          external_calendar_id: input.dataset.g18CalSelected,
          selected: input.checked,
          shared_with_team: Boolean(document.querySelector(`[data-g18-cal-shared="${CSS.escape(input.dataset.g18CalSelected)}"]`)?.checked)
        }));
        await google().setCalendarSelection(selections);
      }
      if (currentPage() === 'documents') await renderDocuments();
      if (currentPage() === 'calendar') await renderCalendar();
    } catch (error) {
      window.alert(error.message || String(error));
    } finally {
      busy = false;
      if (button && document.body.contains(button)) { button.disabled = false; button.textContent = old || 'Action'; }
    }
  }

  function bindPanelEvents() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.querySelectorAll('[data-g18]').forEach(btn => btn.addEventListener('click', () => act(btn.dataset.g18, btn)));
    panel.querySelectorAll('[data-g18-link-drive]').forEach(btn => btn.addEventListener('click', async () => {
      if (busy) return;
      const itemId = btn.dataset.g18LinkDrive;
      const projectId = panel.querySelector(`[data-g18-project="${CSS.escape(itemId)}"]`)?.value || null;
      btn.disabled = true;
      try {
        await google().linkDriveItem(itemId, projectId);
        btn.textContent = 'Rattaché';
      } catch (error) {
        btn.disabled = false;
        window.alert(error.message || String(error));
      }
    }));
  }

  async function renderCurrentPage(force = false) {
    const page = currentPage();
    if (!page || !client() || !google() || !currentMember()) return;
    if (!force && document.getElementById(PANEL_ID) && lastPage === page) return;
    lastPage = page;
    injectStyles();
    if (page === 'documents') await renderDocuments();
    else if (page === 'calendar') await renderCalendar();
  }

  function scheduleRender(force = false) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => renderCurrentPage(force), 80);
  }

  const observer = new MutationObserver(() => scheduleRender(false));
  observer.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('load', () => scheduleRender(true));

  const params = new URLSearchParams(window.location.search);
  if (params.get('google')) {
    window.addEventListener('load', () => {
      const ok = params.get('google') === 'connected';
      setTimeout(() => window.alert(ok ? 'Compte Google connecté à Pilotage.' : `Connexion Google interrompue : ${params.get('reason') || 'erreur'}`), 250);
      params.delete('google'); params.delete('reason');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      history.replaceState({}, '', next);
    }, { once:true });
  }
})();