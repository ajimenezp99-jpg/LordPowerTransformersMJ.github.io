// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Session Guard unificado (v3 hardened)
// Único punto de verificación de sesión en todo el sitio.
// Sin autenticación válida no hay contenido visible.
// ──────────────────────────────────────────────────────────────
// Resiliencia:
//  - Timeout de Auth corto (4s) + failsafe absoluto (7s).
//  - Detección inmediata si auth.currentUser ya está disponible.
//  - Timeout independiente en loadProfile (3s).
//  - Detección de unauthorized-domain con mensaje claro.
//  - Logs [SGM] visibles en consola en cada fase para diagnóstico.
// ══════════════════════════════════════════════════════════════

import {
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getAuthSafe, getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

// Raíz del sitio calculada desde la URL de este módulo.
const BASE_URL  = new URL('../../../', import.meta.url).href;
const LOGIN_URL = BASE_URL + 'index.html';
const HOME_URL  = BASE_URL + 'home.html';

const AUTH_TIMEOUT_MS    = 4000;   // tiempo máximo esperando onAuthStateChanged
const PROFILE_TIMEOUT_MS = 3500;   // tiempo máximo en cada getDoc de Firestore
const FAILSAFE_MS        = 7500;   // failsafe absoluto: muestra error y libera UI

// ── Splash visible mientras se verifica la sesión ──
function hideBody() {
  if (document.getElementById('sgm-guard-hide')) return;
  const s = document.createElement('style');
  s.id = 'sgm-guard-hide';
  s.textContent = 'body{visibility:hidden!important}';
  document.head.appendChild(s);
  mountSplash();
}
function revealBody() {
  document.getElementById('sgm-guard-hide')?.remove();
  unmountSplash();
}

function mountSplash(msg = 'Verificando sesión…') {
  let el = document.getElementById('sgm-splash');
  if (el) { const m = el.querySelector('.sgm-splash-msg'); if (m) m.textContent = msg; return; }
  el = document.createElement('div');
  el.id = 'sgm-splash';
  el.className = 'sgm-splash';
  el.style.cssText = [
    'visibility:visible!important',
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:1rem',
    'background:#0a0f1e', 'color:#a0b0cc',
    'font-family:system-ui,-apple-system,sans-serif',
    'font-size:.85rem', 'letter-spacing:.14em', 'text-transform:uppercase'
  ].join(';');
  el.innerHTML =
    '<div class="sgm-splash-ring" style="width:56px;height:56px;border:3px solid rgba(79,140,255,.15);border-top-color:#4f8cff;border-right-color:#00d9c0;border-radius:50%;animation:sgmSpin .9s linear infinite"></div>'
    + '<div class="sgm-splash-msg" style="opacity:.75">' + msg + '</div>';
  if (!document.getElementById('sgm-splash-kf')) {
    const kf = document.createElement('style');
    kf.id = 'sgm-splash-kf';
    kf.textContent = '@keyframes sgmSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(kf);
  }
  document.documentElement.appendChild(el);
}
function unmountSplash() {
  document.getElementById('sgm-splash')?.remove();
}
function showSplashError(msg, href) {
  let el = document.getElementById('sgm-splash');
  if (!el) { mountSplash(''); el = document.getElementById('sgm-splash'); }
  el.innerHTML =
    '<div style="width:42px;height:42px;border-radius:50%;background:rgba(255,90,110,.12);border:1px solid rgba(255,90,110,.4);display:inline-flex;align-items:center;justify-content:center;color:#ff5a6e;font-size:1.2rem;font-weight:700">!</div>'
    + '<div class="sgm-splash-msg sgm-splash-err" style="color:#ff5a6e;max-width:520px;text-align:center;line-height:1.55;letter-spacing:0;text-transform:none;font-family:system-ui,sans-serif;font-size:.92rem">' + msg + '</div>'
    + (href ? `<a href="${href}" style="color:#4f8cff;text-decoration:underline;letter-spacing:0;text-transform:none;font-family:system-ui,sans-serif;margin-top:.5rem">Ir al login</a>` : '');
}

hideBody();

// Failsafe absoluto: si nada resuelve en FAILSAFE_MS, muestra error y permite ir al login.
const FAILSAFE_TIMER = setTimeout(() => {
  if (!document.getElementById('sgm-guard-hide')) return; // ya resuelto
  console.warn('[SGM] FAILSAFE: %sms sin respuesta. Origin actual: %s', FAILSAFE_MS, location.origin);
  showSplashError(
    'No fue posible verificar la sesión. Verifica que el dominio "' + location.hostname +
    '" esté autorizado en Firebase Console (Authentication → Settings → Authorized domains).',
    LOGIN_URL
  );
}, FAILSAFE_MS);

// ── Utilidades ──
function redirect(url) {
  console.info('[SGM] redirigiendo →', url);
  try { location.replace(url); } catch (_) { location.href = url; }
}

function timed(promise, ms, label) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      console.warn('[SGM] timeout ' + ms + 'ms en:', label);
      resolve({ timeout: true });
    }, ms);
    promise.then((value) => { clearTimeout(t); resolve({ value }); })
           .catch((err)   => { clearTimeout(t); resolve({ err }); });
  });
}

async function loadProfile(db, uid) {
  const r = await timed(getDoc(doc(db, 'usuarios', uid)), PROFILE_TIMEOUT_MS, 'getDoc /usuarios/' + uid);
  if (r.timeout || r.err) {
    if (r.err) console.warn('[SGM] No se pudo leer /usuarios/%s:', uid, r.err);
    return null;
  }
  const snap = r.value;
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

async function isLegacyAdmin(db, uid) {
  const r = await timed(getDoc(doc(db, 'admins', uid)), PROFILE_TIMEOUT_MS, 'getDoc /admins/' + uid);
  if (r.timeout || r.err) return false;
  return r.value.exists();
}

function humanizeAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return 'El dominio "' + location.hostname + '" no está autorizado en Firebase Auth. ' +
      'Agrégalo en Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Sin conexión con el servidor de autenticación.';
  }
  return err?.message || code || 'Error desconocido.';
}

// ── API principal ──
export function ensureSession({ requireAdmin = false } = {}) {
  return new Promise((resolve) => {
    console.info('[SGM] ensureSession start · origin:', location.origin);

    if (!isFirebaseConfigured) {
      console.warn('[SGM] Firebase no configurado — al login.');
      redirect(LOGIN_URL);
      return;
    }

    let auth, db;
    try {
      auth = getAuthSafe();
      db   = getDbSafe();
    } catch (err) {
      console.error('[SGM] Firebase init error:', err);
      clearTimeout(FAILSAFE_TIMER);
      showSplashError('Firebase no pudo inicializar: ' + (err?.message || ''), LOGIN_URL);
      return;
    }
    if (!auth || !db) { redirect(LOGIN_URL); return; }

    // Detección inmediata: ¿ya hay user en Auth? Si sí, procesar sin esperar.
    const earlyUser = auth.currentUser;
    if (earlyUser) {
      console.info('[SGM] currentUser presente al arrancar:', earlyUser.email);
      handleUser(earlyUser);
      return;
    }

    // Timeout duro al onAuthStateChanged. Si Auth no responde en 4s,
    // asumimos que no hay sesión y mandamos al login.
    const failTimer = setTimeout(() => {
      console.warn('[SGM] timeout %sms esperando Auth — al login.', AUTH_TIMEOUT_MS);
      try { unsub(); } catch (_) {}
      redirect(LOGIN_URL);
    }, AUTH_TIMEOUT_MS);

    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(auth, (user) => {
        clearTimeout(failTimer);
        if (!user) {
          console.info('[SGM] sin sesión — al login.');
          try { unsub(); } catch (_) {}
          redirect(LOGIN_URL);
          return;
        }
        handleUser(user);
      }, (authErr) => {
        clearTimeout(failTimer);
        clearTimeout(FAILSAFE_TIMER);
        console.error('[SGM] Auth error:', authErr);
        showSplashError(humanizeAuthError(authErr), LOGIN_URL);
      });
    } catch (err) {
      clearTimeout(failTimer);
      clearTimeout(FAILSAFE_TIMER);
      console.error('[SGM] No se pudo suscribir a Auth:', err);
      showSplashError(humanizeAuthError(err), LOGIN_URL);
    }

    async function handleUser(user) {
      try { unsub(); } catch (_) {}
      try {
        console.info('[SGM] sesión encontrada:', user.email, '— buscando perfil…');
        let profile = await loadProfile(db, user.uid);

        if (!profile) {
          const legacy = await isLegacyAdmin(db, user.uid);
          if (legacy) {
            console.info('[SGM] perfil legacy admin (colección /admins) — autorizado.');
            profile = {
              uid: user.uid, email: user.email,
              nombre: user.displayName || user.email,
              rol: 'admin', activo: true, legacy: true
            };
          }
        }

        if (!profile || profile.activo === false) {
          console.warn('[SGM] usuario sin perfil activo — signOut + login.');
          try { await signOut(auth); } catch (_) {}
          redirect(LOGIN_URL + '?denied=1');
          return;
        }

        if (requireAdmin && profile.rol !== 'admin') {
          console.warn('[SGM] rol insuficiente para admin: %s — al home.', profile.rol);
          redirect(HOME_URL + '?denied=admin');
          return;
        }

        const sess = { user, profile, role: profile.rol };
        window.__sgmSession = sess;
        window.__sgmAdmin = { uid: user.uid, email: user.email };
        try {
          window.dispatchEvent(new CustomEvent('sgm:session-ready', { detail: sess }));
        } catch (_) {}
        clearTimeout(FAILSAFE_TIMER);
        revealBody();
        console.info('[SGM] sesión OK · rol:', profile.rol);
        resolve(sess);
      } catch (innerErr) {
        clearTimeout(FAILSAFE_TIMER);
        console.error('[SGM] Error resolviendo perfil:', innerErr);
        showSplashError('Error verificando perfil: ' + (innerErr?.message || ''), LOGIN_URL);
      }
    }
  });
}

export async function logout() {
  const auth = getAuthSafe();
  if (auth) {
    try { await signOut(auth); } catch (_) {}
  }
  try { sessionStorage.removeItem('sgm.access'); } catch (_) {}
  redirect(LOGIN_URL);
}

export function getSession() {
  return window.__sgmSession || null;
}

export function isAdmin() {
  const s = getSession();
  return !!(s && s.role === 'admin');
}
