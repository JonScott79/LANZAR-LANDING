/**
 * LANZAR ID — Mothership Integration
 * File: js/lanzar-id-mothership.js
 *
 * Provides the interactive "MY LANZAR" authenticated deck & HUD account pill
 * on the mothership (lanzar.me). Seamlessly connects to auth-api.lanzar.me.
 */

(function () {
  'use strict';

  const AUTH_API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4001'
    : 'https://auth-api.lanzar.me';

  const AUTH_PORTAL_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000'
    : 'https://auth.lanzar.me';

  const ACCOUNT_PORTAL_URL = `${AUTH_PORTAL_URL}/account`;
  const FIREBASE_WEB_API_KEY = 'AIzaSyCm11MJPwYKk2ckDIrTOGLNHdyFkdCOM2k';
  const CLIENT_ID = 'mothership';

  const TOKEN_KEY = 'lanzar_id_token';
  const REFRESH_KEY = 'lanzar_refresh_token';
  const SESSION_ID_KEY = 'lanzar_session_id';
  const PKCE_VERIFIER_KEY = 'mothership_pkce_verifier';
  const PKCE_STATE_KEY = 'mothership_pkce_state';

  let currentUserProfile = null;
  let currentSessionInfo = null;
  let isDispatchSubscribed = false;

  function base64UrlEncode(bytes) {
    let binary = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function generateCodeVerifier() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
  }

  async function generateCodeChallenge(verifier) {
    const encoded = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return base64UrlEncode(new Uint8Array(digest));
  }

  async function redirectToLanzarIdLogin() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : generateCodeVerifier();

    try {
      sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
      sessionStorage.setItem(PKCE_STATE_KEY, state);
    } catch (_) {}

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: window.location.origin,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state
    });
    window.location.href = `${AUTH_PORTAL_URL}?${params.toString()}`;
  }

  async function exchangeCustomTokenForIdToken(customToken) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true })
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.idToken) {
      throw new Error(data?.error?.message || 'Failed to exchange custom token for Firebase ID token.');
    }
    return data;
  }

  // Handle incoming PKCE (?code=&state=) callback or legacy URL token fallback
  async function handleUrlAuthToken() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code) {
        let expectedState = null;
        let codeVerifier = null;
        try {
          expectedState = sessionStorage.getItem(PKCE_STATE_KEY);
          codeVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
          sessionStorage.removeItem(PKCE_STATE_KEY);
          sessionStorage.removeItem(PKCE_VERIFIER_KEY);
        } catch (_) {}

        urlParams.delete('code');
        urlParams.delete('state');
        const remaining = urlParams.toString();
        const cleanUrl = window.location.pathname + (remaining ? '?' + remaining : '') + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);

        if ((!expectedState || !state || expectedState === state) && codeVerifier) {
          const exRes = await fetch(`${AUTH_API_BASE}/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              client_id: CLIENT_ID,
              redirect_uri: window.location.origin,
              code_verifier: codeVerifier
            })
          });
          const exData = await exRes.json().catch(() => ({}));
          if (exRes.ok && exData.custom_token) {
            if (exData.session_id) {
              localStorage.setItem(SESSION_ID_KEY, exData.session_id);
            }
            const fbData = await exchangeCustomTokenForIdToken(exData.custom_token);
            localStorage.setItem(TOKEN_KEY, fbData.idToken);
            if (fbData.refreshToken) {
              localStorage.setItem(REFRESH_KEY, fbData.refreshToken);
            }
          }
        }
        return;
      }

      const tokenFromUrl = urlParams.get('id_token') || urlParams.get('token');
      if (tokenFromUrl) {
        localStorage.setItem(TOKEN_KEY, tokenFromUrl);
        urlParams.delete('id_token');
        urlParams.delete('token');
        const newSearch = urlParams.toString();
        const cleanUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      console.warn('[LANZAR ID] Failed URL auth/PKCE capture:', e);
    }
  }

  function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function clearStoredAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
    currentUserProfile = null;
    currentSessionInfo = null;
  }

  // Strictly read-only session inspection via central cookie (OD-6: zero Firestore writes)
  async function inspectCentralCookieSession() {
    try {
      const res = await fetch(`${AUTH_API_BASE}/api/id/session/me`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (data && data.authenticated) {
        return data;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // Fetch current user profile
  async function fetchProfile(token) {
    try {
      const res = await fetch(`${AUTH_API_BASE}/api/id/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          clearStoredAuth();
        }
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn('[LANZAR ID] Error fetching profile:', err);
      return null;
    }
  }

  // Fetch The Dispatch newsletter status
  async function fetchDispatchStatus(token) {
    try {
      const res = await fetch(`${AUTH_API_BASE}/api/id/dispatch/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        return Boolean(data.subscribed);
      }
    } catch (e) {
      console.warn('[LANZAR ID] Could not check dispatch status:', e);
    }
    return false;
  }

  // Toggle The Dispatch subscription
  async function toggleDispatchSubscription(token, subscribe) {
    const endpoint = subscribe ? '/api/id/dispatch/subscribe' : '/api/id/dispatch/unsubscribe';
    try {
      const res = await fetch(`${AUTH_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'mothership_my_lanzar_deck',
          consentVersion: 'dispatch_v1'
        })
      });
      return res.ok;
    } catch (e) {
      console.error('[LANZAR ID] Failed to toggle dispatch:', e);
      return false;
    }
  }

  // Render navigation element
  function renderNavPill(profile) {
    const navContainer = document.getElementById('lanzar-id-auth-nav');
    if (!navContainer) return;

    if (!profile) {
      // Unauthenticated: render S256 PKCE Login pill
      navContainer.innerHTML = `
        <button type="button" class="hud-signin-btn" id="btn-lanzar-pkce-signin">
          <span>LANZAR ID</span>
          <span style="font-size: 1.1em; line-height: 1;">&rarr;</span>
        </button>
      `;
      document.getElementById('btn-lanzar-pkce-signin')?.addEventListener('click', () => {
        redirectToLanzarIdLogin().catch(err => console.error('[LANZAR ID] PKCE redirect failed:', err));
      });
      return;
    }

    // Authenticated: render HUD user pill
    const name = profile.displayName || (profile.email ? profile.email.split('@')[0] : 'Operator');
    const initial = (name.charAt(0) || 'U').toUpperCase();
    const badges = profile.derivedBadges || [];
    const isFounder = badges.some(b => typeof b === 'string' && b.toLowerCase().includes('founder')) || profile.isFounder;

    navContainer.innerHTML = `
      <div class="hud-account-pill" id="btn-open-lanzar-deck" role="button" tabindex="0" title="Open My LANZAR Console">
        ${profile.avatarUrl 
          ? `<img class="hud-pill-avatar" src="${profile.avatarUrl}" alt="${name}" />`
          : `<div class="hud-pill-avatar-placeholder">${initial}</div>`
        }
        <span class="hud-pill-name">${name}</span>
        ${isFounder ? `<span class="hud-pill-badge">FOUNDER</span>` : `<span class="hud-pill-badge">ID</span>`}
      </div>
    `;

    document.getElementById('btn-open-lanzar-deck')?.addEventListener('click', openDeckDrawer);
  }

  // Create Slide-out Drawer Markup
  function ensureDrawerMarkup() {
    if (document.getElementById('my-lanzar-drawer')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'my-lanzar-drawer-backdrop';
    backdrop.className = 'my-lanzar-drawer-backdrop';
    backdrop.addEventListener('click', closeDeckDrawer);

    const drawer = document.createElement('div');
    drawer.id = 'my-lanzar-drawer';
    drawer.className = 'my-lanzar-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'My LANZAR Console');

    drawer.innerHTML = `
      <header class="drawer-header">
        <div class="drawer-brand">
          <div class="drawer-orb"></div>
          <div>
            <h2 class="drawer-title">MY LANZAR</h2>
            <span class="drawer-sub">IDENTITY // OPERATIONS DECK</span>
          </div>
        </div>
        <button class="btn-drawer-close" id="btn-close-lanzar-deck" aria-label="Close Deck">&times;</button>
      </header>

      <div class="drawer-body" id="lanzar-deck-body">
        <!-- Rendered dynamically -->
      </div>

      <footer class="drawer-footer">
        <a class="btn-full-id-portal" href="${ACCOUNT_PORTAL_URL}" target="_blank" rel="noopener">
          MANAGE ACCOUNT &rarr;
        </a>
        <button class="btn-drawer-signout" id="btn-lanzar-signout">
          SIGN OUT
        </button>
      </footer>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    document.getElementById('btn-close-lanzar-deck')?.addEventListener('click', closeDeckDrawer);
    document.getElementById('btn-lanzar-signout')?.addEventListener('click', handleSignOut);
    
    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDeckDrawer();
    });
  }

  // Update Drawer Body Content
  function updateDrawerBody(profile) {
    const body = document.getElementById('lanzar-deck-body');
    if (!body || !profile) return;

    const name = profile.displayName || (profile.email ? profile.email.split('@')[0] : 'Operator');
    const initial = (name.charAt(0) || 'U').toUpperCase();
    const email = profile.email || 'operator@lanzar.me';
    const badges = profile.derivedBadges || (profile.isFounder ? ['LANZAR ID FOUNDER'] : ['MEMBER']);

    const mfaStatus = profile.mfaEnabled ? 'ENABLED' : 'DISABLED';
    const phoneStatus = profile.phoneVerified ? 'VERIFIED' : (profile.phoneNumber ? 'UNVERIFIED' : 'NOT LINKED');

    body.innerHTML = `
      <!-- User Profile Hero Card -->
      <div class="drawer-hero-card">
        <div class="drawer-avatar-wrap">
          ${profile.avatarUrl
            ? `<img class="drawer-avatar" src="${profile.avatarUrl}" alt="${name}" />`
            : `<div class="drawer-avatar-placeholder">${initial}</div>`
          }
        </div>
        <div style="flex: 1; min-width: 0;">
          <h3 class="drawer-name">${name}</h3>
          <p class="drawer-email">${email}</p>
          <div class="drawer-badges">
            ${badges.map(b => `<span class="badge-tag">${b}</span>`).join('')}
          </div>
        </div>
      </div>

      <!-- Quick Telemetry Grid -->
      <div class="drawer-section">
        <h4 class="drawer-section-title">TELEMETRY & SECURITY STATUS</h4>
        <div class="drawer-status-grid">
          <div class="drawer-status-pill">
            <span class="drawer-status-label">ACCOUNT STATUS</span>
            <span class="drawer-status-val nominal">${(profile.status || 'ACTIVE').toUpperCase()}</span>
          </div>
          <div class="drawer-status-pill">
            <span class="drawer-status-label">MFA AUTHENTICATION</span>
            <span class="drawer-status-val ${profile.mfaEnabled ? 'nominal' : 'warning'}">${mfaStatus}</span>
          </div>
          <div class="drawer-status-pill">
            <span class="drawer-status-label">PHONE VERIFICATION</span>
            <span class="drawer-status-val ${profile.phoneVerified ? 'nominal' : 'warning'}">${phoneStatus}</span>
          </div>
          <div class="drawer-status-pill">
            <span class="drawer-status-label">ACTIVE SESSIONS</span>
            <span class="drawer-status-val nominal">ACTIVE ON DEVICE</span>
          </div>
        </div>
      </div>

      <!-- Ecosystem Launchpad -->
      <div class="drawer-section">
        <h4 class="drawer-section-title">ECOSYSTEM LAUNCHPAD</h4>
        <div class="drawer-app-links">
          <a class="drawer-app-card" href="https://web.lanzar.me" target="_blank" rel="noopener">
            <span class="drawer-app-icon">&#9881;</span>
            <div>
              <div class="drawer-app-name">Web Studio</div>
              <div class="drawer-app-sub">Modern Web Platforms</div>
            </div>
          </a>
          <a class="drawer-app-card" href="https://it.lanzar.me" target="_blank" rel="noopener">
            <span class="drawer-app-icon">&#128737;</span>
            <div>
              <div class="drawer-app-name">Managed IT</div>
              <div class="drawer-app-sub">Infrastructure & Fleets</div>
            </div>
          </a>
          <a class="drawer-app-card" href="https://pythos.lanzar.me" target="_blank" rel="noopener">
            <span class="drawer-app-icon">&#9650;</span>
            <div>
              <div class="drawer-app-name">Pythos AI</div>
              <div class="drawer-app-sub">Adaptive Math Training</div>
            </div>
          </a>
          <a class="drawer-app-card" href="https://threadline.lanzar.me" target="_blank" rel="noopener">
            <span class="drawer-app-icon">&#9776;</span>
            <div>
              <div class="drawer-app-name">Threadline</div>
              <div class="drawer-app-sub">Workflow Engineering</div>
            </div>
          </a>
          <a class="drawer-app-card" href="https://portal.lanzar.me" target="_blank" rel="noopener">
            <span class="drawer-app-icon">&#128640;</span>
            <div>
              <div class="drawer-app-name">Mission Control</div>
              <div class="drawer-app-sub">Client Portal & Admin</div>
            </div>
          </a>
          <a class="drawer-app-card" href="https://tickets.lanzar.me" target="_blank" rel="noopener">
            <span class="drawer-app-icon">&#127915;</span>
            <div>
              <div class="drawer-app-name">Support Desk</div>
              <div class="drawer-app-sub">Priority Help Queue</div>
            </div>
          </a>
        </div>
      </div>

      <!-- The Dispatch Promotion (Amendment #003) -->
      <div class="drawer-dispatch-box">
        <div class="drawer-dispatch-top">
          <h4 class="drawer-dispatch-title">THE DISPATCH</h4>
          <span style="font-size: 0.65rem; color: #ffd700; font-family: monospace; font-weight: 700;">OFFICIAL DISPATCH</span>
        </div>
        <p class="drawer-dispatch-text">
          News from the LANZAR universe. New products, launches, development updates, special announcements, and things we're building.
        </p>
        <button class="btn-dispatch-toggle ${isDispatchSubscribed ? 'subscribed' : ''}" id="btn-toggle-dispatch-sub">
          ${isDispatchSubscribed ? '&#10003; SUBSCRIBED TO THE DISPATCH' : '+ SUBSCRIBE TO THE DISPATCH'}
        </button>
      </div>
    `;

    document.getElementById('btn-toggle-dispatch-sub')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const targetState = !isDispatchSubscribed;
      btn.textContent = 'UPDATING...';
      btn.disabled = true;

      const token = getStoredToken();
      if (!token) {
        await redirectToLanzarIdLogin();
        return;
      }
      const success = await toggleDispatchSubscription(token, targetState);
      if (success) {
        isDispatchSubscribed = targetState;
      }
      btn.disabled = false;
      updateDrawerBody(profile);
    });
  }

  function openDeckDrawer() {
    ensureDrawerMarkup();
    updateDrawerBody(currentUserProfile);
    const backdrop = document.getElementById('my-lanzar-drawer-backdrop');
    const drawer = document.getElementById('my-lanzar-drawer');
    if (backdrop && drawer) {
      backdrop.classList.add('active');
      drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDeckDrawer() {
    const backdrop = document.getElementById('my-lanzar-drawer-backdrop');
    const drawer = document.getElementById('my-lanzar-drawer');
    if (backdrop && drawer) {
      backdrop.classList.remove('active');
      drawer.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  async function handleSignOut() {
    const token = getStoredToken();
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    try {
      if (sessionId && token) {
        await fetch(`${AUTH_API_BASE}/api/id/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      }
      await fetch(`${AUTH_API_BASE}/api/id/session/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Lanzar-Client': 'id'
        }
      }).catch(() => {});
    } catch (_) {}
    clearStoredAuth();
    closeDeckDrawer();
    renderNavPill(null);
  }

  // Initialization
  async function init() {
    await handleUrlAuthToken();
    ensureDrawerMarkup();

    const token = getStoredToken();
    if (token) {
      const profile = await fetchProfile(token);
      if (profile) {
        currentUserProfile = profile;
        isDispatchSubscribed = await fetchDispatchStatus(token);
        renderNavPill(currentUserProfile);
        return;
      }
    }

    // Read-only central cookie check (/api/id/session/me) for cross-app SSO visibility on lanzar.me
    const cookieSession = await inspectCentralCookieSession();
    if (cookieSession && cookieSession.authenticated) {
      currentSessionInfo = cookieSession;
      currentUserProfile = {
        uid: cookieSession.uid,
        displayName: cookieSession.role === 'admin' ? 'LANZAR Admin' : 'LANZAR Operator',
        email: 'Active LANZAR ID Session',
        status: 'ACTIVE',
        derivedBadges: cookieSession.role === 'admin' ? ['ADMIN', 'LANZAR ID'] : ['LANZAR ID']
      };
      renderNavPill(currentUserProfile);
      return;
    }

    renderNavPill(null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
