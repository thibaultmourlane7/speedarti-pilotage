(() => {
  'use strict';

  const TAGS = Object.freeze({
    AUTH_GATE: 'PILOT-AUTH-001',
    AUTH_SIGNIN: 'PILOT-AUTH-002',
    AUTH_SIGNUP: 'PILOT-AUTH-003',
    AUTH_SESSION: 'PILOT-AUTH-004',
    AUTH_SIGNOUT: 'PILOT-AUTH-005',
    AUTH_PROFILE: 'PILOT-AUTH-006',
    PUBLIC_CONFIG: 'PILOT-SEC-001'
  });

  // Les adresses autorisées restent uniquement dans Supabase.
  // Le dépôt GitHub public ne contient aucune liste d'e-mails de l'équipe.
  const LOCAL_IDENTITY_BY_NAME = Object.freeze({
    'thibault': { localId: 'u-thibault', name: 'Thibault', initials: 'TM', teamRole: 'Direction', role: 'admin' },
    'anne-sophie': { localId: 'u-anne', name: 'Anne-Sophie', initials: 'AS', teamRole: 'Technique', role: 'member' },
    'guillaume': { localId: 'u-guillaume', name: 'Guillaume', initials: 'GM', teamRole: 'Marketing / Métier', role: 'member' }
  });

  const BASE_STORAGE_KEY = 'speedarti-pilotage-demo-v1';
  const AUTH_USER_KEY = 'speedarti-pilotage-auth-user';
  const USER_STATE_PREFIX = 'speedarti-pilotage-user-state:';

  const authRoot = document.querySelector('#auth-root');
  const appRoot = document.querySelector('#app');
  let client = null;
  let activeSession = null;
  let activeProfile = null;
  let appLoaded = false;
  let accountObserver = null;

  function trace(tag, message, details = {}) {
    console.debug(`[${tag}] ${message}`, details);
  }

  function normalizeEmail(value = '') {
    return String(value).trim().toLowerCase();
  }

  function localIdentityFromProfile(profile) {
    const key = String(profile?.display_name || '').trim().toLowerCase();
    const direct = LOCAL_IDENTITY_BY_NAME[key];
    if (direct) return direct;

    // Secours par initiales : ne contient aucune donnée d'authentification.
    const initials = String(profile?.initials || '').trim().toUpperCase();
    if (initials === 'TM') return LOCAL_IDENTITY_BY_NAME['thibault'];
    if (initials === 'AS') return LOCAL_IDENTITY_BY_NAME['anne-sophie'];
    if (initials === 'GM') return LOCAL_IDENTITY_BY_NAME['guillaume'];
    return null;
  }

  function htmlEscape(value = '') {
    return String(value).replace(/[&<>'"]/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
    }[c]));
  }


  function renderLoading(message = 'Connexion sécurisée…') {
    authRoot.innerHTML = `
      <main class="auth-shell">
        <section class="auth-card auth-loading-card">
          <div class="auth-brand"><span>S</span><div><strong>SpeedArti</strong><small>Pilotage</small></div></div>
          <div class="auth-loader"></div>
          <h1>${htmlEscape(message)}</h1>
          <p>Vérification de la session Supabase.</p>
        </section>
      </main>`;
  }

  function renderAuth(message = '', mode = 'login') {
    const isSignup = mode === 'signup';
    authRoot.innerHTML = `
      <main class="auth-shell">
        <section class="auth-card">
          <div class="auth-brand"><span>S</span><div><strong>SpeedArti</strong><small>Pilotage d’entreprise</small></div></div>
          <div class="auth-heading">
            <span class="auth-kicker">ACCÈS ÉQUIPE</span>
            <h1>${isSignup ? 'Créer mon accès' : 'Se connecter'}</h1>
            <p>${isSignup
              ? 'Utilise ton adresse professionnelle autorisée et choisis ton mot de passe.'
              : 'Accès réservé à Thibault, Anne-Sophie et Guillaume.'}</p>
          </div>

          ${message ? `<div class="auth-message" role="status">${htmlEscape(message)}</div>` : ''}

          <form id="pilotageAuthForm" class="auth-form" novalidate>
            <label>
              <span>Adresse e-mail</span>
              <input id="authEmail" type="email" autocomplete="email" placeholder="nom@exemple.com" required />
            </label>
            <label>
              <span>Mot de passe</span>
              <input id="authPassword" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="8 caractères minimum" minlength="8" required />
            </label>
            <button class="auth-primary" type="submit">${isSignup ? 'Créer mon accès' : 'Se connecter'}</button>
          </form>

          <button id="switchAuthMode" class="auth-secondary" type="button">
            ${isSignup ? 'J’ai déjà un compte' : 'Première connexion ? Créer mon accès'}
          </button>

          <div class="auth-security">
            <span>✓</span>
            <p>Les adresses autorisées sont contrôlées côté Supabase. Une adresse inconnue ne peut pas créer de profil Pilotage.</p>
          </div>
        </section>
      </main>`;

    const form = document.querySelector('#pilotageAuthForm');
    const email = document.querySelector('#authEmail');
    const password = document.querySelector('#authPassword');
    const switcher = document.querySelector('#switchAuthMode');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const emailValue = normalizeEmail(email?.value);
      const passwordValue = password?.value || '';

      if (passwordValue.length < 8) {
        showInlineError('Le mot de passe doit contenir au moins 8 caractères.');
        password?.focus();
        return;
      }

      setFormBusy(true);
      try {
        if (isSignup) await signUp(emailValue, passwordValue);
        else await signIn(emailValue, passwordValue);
      } finally {
        if (!activeSession) setFormBusy(false);
      }
    });

    switcher?.addEventListener('click', () => renderAuth('', isSignup ? 'login' : 'signup'));
    email?.focus();
  }

  function showInlineError(message) {
    let box = document.querySelector('.auth-message');
    if (!box) {
      box = document.createElement('div');
      box.className = 'auth-message auth-error';
      box.setAttribute('role', 'alert');
      document.querySelector('.auth-heading')?.after(box);
    }
    box.classList.add('auth-error');
    box.textContent = message;
  }

  function setFormBusy(busy) {
    document.querySelectorAll('#pilotageAuthForm input, #pilotageAuthForm button, #switchAuthMode')
      .forEach(el => { el.disabled = busy; });
    const submit = document.querySelector('#pilotageAuthForm .auth-primary');
    if (submit && busy) submit.textContent = 'Connexion…';
  }

  async function signIn(email, password) {
    trace(TAGS.AUTH_SIGNIN, 'Tentative de connexion', { email });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      trace(TAGS.AUTH_SIGNIN, 'Connexion refusée', { email, error: error.message });
      showInlineError(
        /invalid login credentials/i.test(error.message)
          ? 'E-mail ou mot de passe incorrect.'
          : error.message
      );
      return;
    }
    if (data?.session) await activateSession(data.session);
  }

  async function signUp(email, password) {
    trace(TAGS.AUTH_SIGNUP, 'Création d’accès demandée', { email });

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { pilotage_access: true }
      }
    });

    if (error) {
      trace(TAGS.AUTH_SIGNUP, 'Création d’accès refusée', { email, error: error.message });
      const serverRejected = /database|saving new user|not allowed|unauthorized/i.test(error.message);
      showInlineError(serverRejected
        ? 'Cette adresse n’est pas autorisée ou le compte ne peut pas être créé.'
        : error.message);
      return;
    }

    if (data?.session) {
      await activateSession(data.session);
      return;
    }

    renderAuth(
      'Compte créé. Vérifie l’e-mail de confirmation puis reviens ici pour te connecter.',
      'login'
    );
  }

  async function fetchProfile(userId, attempt = 0) {
    const { data, error } = await client
      .from('profiles')
      .select('id, display_name, initials, team_role, role, active')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) return data;

    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
      return fetchProfile(userId, attempt + 1);
    }

    if (error) throw error;
    throw new Error('Profil Pilotage introuvable.');
  }

  function saveCurrentStateForUser(authUserId) {
    if (!authUserId) return;
    const raw = localStorage.getItem(BASE_STORAGE_KEY);
    if (raw) localStorage.setItem(`${USER_STATE_PREFIX}${authUserId}`, raw);
  }

  function prepareLocalStateForSession(session, profile) {
    const email = normalizeEmail(session.user.email);
    const approved = localIdentityFromProfile(profile);
    if (!approved) throw new Error('Profil équipe non reconnu.');

    const previousAuthUserId = localStorage.getItem(AUTH_USER_KEY);
    if (previousAuthUserId && previousAuthUserId !== session.user.id) {
      saveCurrentStateForUser(previousAuthUserId);
      localStorage.removeItem(BASE_STORAGE_KEY);
    }

    const userStateKey = `${USER_STATE_PREFIX}${session.user.id}`;
    const personalState = localStorage.getItem(userStateKey);

    if (personalState) {
      localStorage.setItem(BASE_STORAGE_KEY, personalState);
    }

    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(BASE_STORAGE_KEY) || '{}');
    } catch {
      stored = {};
    }

    stored.currentUser = {
      id: approved.localId,
      authUserId: session.user.id,
      email,
      name: profile.display_name || approved.name,
      initials: profile.initials || approved.initials,
      role: profile.role || approved.role,
      teamRole: profile.team_role || approved.teamRole
    };

    localStorage.setItem(BASE_STORAGE_KEY, JSON.stringify(stored));
    localStorage.setItem(AUTH_USER_KEY, session.user.id);

    trace(TAGS.AUTH_PROFILE, 'Profil local associé à la session Supabase', {
      email,
      authUserId: session.user.id,
      localId: approved.localId,
      role: stored.currentUser.role
    });
  }

  async function activateSession(session) {
    renderLoading('Ouverture de Pilotage…');

    try {
      const email = normalizeEmail(session.user.email);
      const profile = await fetchProfile(session.user.id);
      if (!profile.active) {
        await client.auth.signOut();
        renderAuth('Cet accès Pilotage a été désactivé.');
        return;
      }

      activeSession = session;
      activeProfile = profile;
      prepareLocalStateForSession(session, profile);

      trace(TAGS.AUTH_SESSION, 'Session Supabase active', {
        userId: session.user.id,
        email,
        role: profile.role
      });

      authRoot.innerHTML = '';
      authRoot.hidden = true;
      appRoot.hidden = false;

      window.PILOTAGE_AUTH = Object.freeze({
        userId: session.user.id,
        email,
        profile: { ...profile }
      });
      window.PILOTAGE_SUPABASE_CLIENT = client;

      await loadPilotageApp();
      installAccountBinding();
    } catch (error) {
      console.error(error);
      renderAuth(`Connexion impossible : ${error.message || 'erreur inconnue'}`);
    }
  }

  function loadPilotageApp() {
    if (appLoaded || window.__PILOTAGE_APP_LOADED__) {
      appLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './src/app.bundle.js';
      script.defer = true;
      script.dataset.pilotageApp = 'true';
      script.addEventListener('load', () => {
        appLoaded = true;
        window.__PILOTAGE_APP_LOADED__ = true;
        resolve();
      });
      script.addEventListener('error', () => reject(new Error('Impossible de charger l’application Pilotage.')));
      document.body.appendChild(script);
    });
  }

  function installAccountBinding() {
    bindAccountControl();

    if (accountObserver) accountObserver.disconnect();
    accountObserver = new MutationObserver(() => bindAccountControl());
    accountObserver.observe(appRoot, { childList: true, subtree: true });
  }

  function bindAccountControl() {
    const avatar = document.querySelector('.avatar');
    if (!avatar || avatar.dataset.authBound === 'true') return;

    avatar.dataset.authBound = 'true';
    avatar.setAttribute('role', 'button');
    avatar.setAttribute('tabindex', '0');
    avatar.setAttribute('aria-label', 'Ouvrir le menu du compte');
    avatar.title = `${activeProfile?.display_name || 'Compte'} — session Supabase`;

    const open = () => toggleAccountMenu(avatar);
    avatar.addEventListener('click', open);
    avatar.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  }

  function toggleAccountMenu(anchor) {
    const existing = document.querySelector('#pilotageAccountMenu');
    if (existing) {
      existing.remove();
      return;
    }

    const email = normalizeEmail(activeSession?.user?.email);
    const menu = document.createElement('aside');
    menu.id = 'pilotageAccountMenu';
    menu.className = 'auth-account-menu';
    menu.innerHTML = `
      <div class="auth-account-head">
        <span>${htmlEscape(activeProfile?.initials || 'SA')}</span>
        <div>
          <strong>${htmlEscape(activeProfile?.display_name || email)}</strong>
          <small>${htmlEscape(activeProfile?.team_role || '')}</small>
        </div>
      </div>
      <div class="auth-account-email">${htmlEscape(email)}</div>
      <div class="auth-account-status"><i></i> Supabase connecté</div>
      <div class="auth-account-local">Données métier : encore locales sur cet appareil — migration Supabase à l’étape suivante.</div>
      <button id="pilotageSignOut" type="button">Se déconnecter</button>
    `;

    document.body.appendChild(menu);

    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 12, rect.bottom + 8)}px`;
    menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;

    menu.querySelector('#pilotageSignOut')?.addEventListener('click', signOut);
  }

  async function signOut() {
    const userId = activeSession?.user?.id;
    saveCurrentStateForUser(userId);

    trace(TAGS.AUTH_SIGNOUT, 'Déconnexion demandée', { userId });

    document.querySelector('#pilotageAccountMenu')?.remove();
    await client.auth.signOut();

    localStorage.removeItem(BASE_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    window.location.reload();
  }

  async function handleAuthChange(event, session) {
    if (event === 'SIGNED_OUT' || !session) {
      if (!appLoaded) renderAuth();
      return;
    }

    if (event === 'SIGNED_IN' && (!activeSession || activeSession.user.id !== session.user.id)) {
      await activateSession(session);
    }
  }

  async function boot() {
    trace(TAGS.AUTH_GATE, 'Initialisation du contrôle d’accès');
    renderLoading();

    const config = window.PILOTAGE_SUPABASE;
    if (!config?.url || !config?.publishableKey) {
      renderAuth('Configuration Supabase manquante.');
      return;
    }

    if (!window.supabase?.createClient) {
      renderAuth('Le module Supabase n’a pas pu être chargé. Vérifie la connexion Internet.');
      return;
    }

    trace(TAGS.PUBLIC_CONFIG, 'Configuration publique Supabase chargée', { url: config.url });

    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    window.PILOTAGE_SUPABASE_CLIENT = client;

    const { data, error } = await client.auth.getSession();
    if (error) {
      console.error(error);
      renderAuth('Impossible de vérifier la session Supabase.');
      return;
    }

    client.auth.onAuthStateChange((event, session) => {
      setTimeout(() => handleAuthChange(event, session), 0);
    });

    if (data?.session) await activateSession(data.session);
    else renderAuth();
  }

  boot().catch(error => {
    console.error(error);
    renderAuth(`Erreur d’initialisation : ${error.message || 'inconnue'}`);
  });
})();
