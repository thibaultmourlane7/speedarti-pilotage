(() => {
  'use strict';

  const TAGS = Object.freeze({
    API: 'PILOT-GOOGLE-002',
    OAUTH: 'PILOT-GOOGLE-003',
    DRIVE_PICKER: 'PILOT-GOOGLE-004',
    DRIVE_SYNC: 'PILOT-GOOGLE-005',
    DRIVE_LINK: 'PILOT-GOOGLE-006',
    CAL_LIST: 'PILOT-GOOGLE-007',
    CAL_SYNC: 'PILOT-GOOGLE-008',
    CAL_LINK: 'PILOT-GOOGLE-009'
  });

  function trace(tag, message, details = {}) {
    console.debug(`[${tag}] ${message}`, details);
  }

  function getClient() {
    const client = window.PILOTAGE_SUPABASE_CLIENT;
    if (!client) throw new Error('Session Supabase indisponible.');
    return client;
  }

  function endpoint() {
    const config = window.PILOTAGE_SUPABASE;
    if (!config?.url) throw new Error('Configuration Supabase manquante.');
    return `${config.url}/functions/v1/pilotage-google`;
  }

  async function invoke(action, payload = {}) {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error('Reconnecte-toi à Pilotage.');

    trace(TAGS.API, 'Appel connecteur Google', { action });
    const response = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...payload })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorObject = new Error(body.error || `Google HTTP ${response.status}`);
      errorObject.code = body.code || null;
      errorObject.status = response.status;
      errorObject.details = body;
      throw errorObject;
    }
    return body;
  }

  async function connect() {
    trace(TAGS.OAUTH, 'Début OAuth Google');
    const returnUrl = `${window.location.origin}${window.location.pathname}`;
    const data = await invoke('start_oauth', { return_url: returnUrl });
    if (!data.authorization_url) throw new Error('URL OAuth Google absente.');
    window.location.assign(data.authorization_url);
  }

  async function refreshPilotage() {
    if (window.PILOTAGE_REMOTE?.refreshFromSupabase) {
      await window.PILOTAGE_REMOTE.refreshFromSupabase();
    }
  }

  window.PILOTAGE_GOOGLE = Object.freeze({
    status: () => invoke('status'),
    connect,
    disconnect: async () => { const r = await invoke('disconnect'); await refreshPilotage(); return r; },
    listDriveRoots: () => invoke('list_drive_roots'),
    listDriveFolder: (parentId, driveId = null) => invoke('list_drive_folder', { parent_id: parentId, drive_id: driveId }),
    selectDriveRoot: async (folderId, driveId = null) => {
      trace(TAGS.DRIVE_PICKER, 'Dossier Drive sélectionné', { folderId, driveId });
      const r = await invoke('select_drive_root', { folder_id: folderId, drive_id: driveId });
      await refreshPilotage();
      return r;
    },
    syncDrive: async () => {
      trace(TAGS.DRIVE_SYNC, 'Synchronisation Drive demandée');
      const r = await invoke('sync_drive');
      await refreshPilotage();
      return r;
    },
    linkDriveItem: async (itemId, projectClientKey = null) => {
      trace(TAGS.DRIVE_LINK, 'Association Drive / projet', { itemId, projectClientKey });
      const r = await invoke('link_drive_item', { item_id: itemId, project_client_key: projectClientKey });
      await refreshPilotage();
      return r;
    },
    listCalendars: async () => {
      trace(TAGS.CAL_LIST, 'Récupération des agendas Google');
      const r = await invoke('list_calendars');
      await refreshPilotage();
      return r;
    },
    setCalendarSelection: async selections => {
      const r = await invoke('set_calendar_selection', { selections });
      await refreshPilotage();
      return r;
    },
    syncCalendars: async () => {
      trace(TAGS.CAL_SYNC, 'Synchronisation Google Calendar demandée');
      const r = await invoke('sync_calendars');
      await refreshPilotage();
      return r;
    },
    linkCalendarEvent: async (eventId, projectClientKey = null, taskClientKey = null) => {
      trace(TAGS.CAL_LINK, 'Association événement / Pilotage', { eventId, projectClientKey, taskClientKey });
      const r = await invoke('link_calendar_event', { event_id: eventId, project_client_key: projectClientKey, task_client_key: taskClientKey });
      await refreshPilotage();
      return r;
    }
  });
})();