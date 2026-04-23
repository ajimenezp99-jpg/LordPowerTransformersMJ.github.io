// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Session Guard unificado (Fase 14)
// Sustituye a gate.js / auth-guard.js / auth-guard-pages.js /
// admin-guard.js. Único punto de verificación de sesión en todo
// el sitio: sin autenticación no hay contenido.
// ──────────────────────────────────────────────────────────────
// Uso en el <head> (cualquier página protegida):
//
//   <script type="module">
//     import { ensureSession } from '/assets/js/auth/session-guard.js';
//     await ensureSession();                 // solo sesión
//     await ensureSession({ requireAdmin: true }); // requiere rol admin
//   </script>
//
// O con helper de ruta relativa:
//   <script type="module" src="../assets/js/auth/page-guard.js"></script>
// (wrappers en session-guard-home.js / session-guard-page.js /
//  session-guard-admin.js para paths fijos).
// ──────────────────────────────────────────────────────────────
// Flujo:
//   1. Oculta el <body> hasta resolver el estado.
//   2. Espera `onAuthStateChanged`.
//   3. Si no hay sesión → redirige a LOGIN_URL.
//   4. Si hay sesión, lee /usuarios/{uid}:
//        - Si no existe o activo=false → signOut + redirige a login.
//        - Si requireAdmin y rol!='admin' → redirige a HOME_URL.
//   5. Expone `window.__sgmSession = { user, profile, role }` y
//      dispara el evento `sgm:session-ready`.
// ══════════════════════════════════════════════════════════════

import {
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getAuthSafe, getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

// Raíz del sitio calculada desde la URL de este módulo. Esto funciona
// tanto si el sitio se sirve en la raíz (`user.github.io/`) como en
// un subpath (`user.github.io/repo/`, project pages).
const BASE_URL  = new URL('../../../', import.meta.url).href;
const LOGIN_URL = BASE_URL + 'index.html';
const HOME_URL  = BASE_URL + 'home.html';
const TIMEOUT_MS = 8000;
const FAILSAFE_MS = 12000;   // failsafe absoluto para evitar body hidden eterno

// ── Ocultar body al arrancar (evita flash de contenido) ──
function hideBody() {
  if (document.getElementById('sgm-guard-hide')) return;
  const s = document.createElement('style');
  s.id = 'sgm-guard-hide';
  s.textContent = 'body{visibility:hidden!important}';
  document.head.appendChild(s);
  mountSplash();
}
function revealBody() {
  const s = document.getElementById('sgm-guard-hide');
  if (s) s.remove();
  unmountSplash();
}

// Splash visible mientras el body está hidden para que el usuario
// no vea una pantalla en blanco/azul sin indicación de carga.
function mountSplash(msg = 'Verificando sesión…') {
  let el = document.getElementById('sgm-splash');
  if (el) { const m = el.querySelector('.sgm-splash-msg'); if (m) m.textContent = msg; return; }
  el = document.createElement('div');
  el.id = 'sgm-splash';
  el.className = 'sgm-splash';
  // Estilos inline como failsafe si theme.css aún no cargó. El resto de
  // la apariencia viene de theme.css (.sgm-splash).
  el.style.cssText = [
    'visibility:visible!important',
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:1rem',
    'background:#0a0f1e',
    'color:#a0b0cc',
    'font-family:system-ui,-apple-system,sans-serif',
    'font-size:.85rem',
    'letter-spacing:.14em',
    'text-transform:uppercase'
  ].join(';');
  el.innerHTML = '<div class="sgm-splash-ring" style="width:56px;height:56px;border:3px solid rgba(79,140,255,.15);border-top-color:#4f8cff;border-right-color:#00d9c0;border-radius:50%;animation:sgmSpin .9s linear infinite"></div>'
    + '<div class="sgm-splash-msg" style="opacity:.75">' + msg + '</div>';
  // Asegurar keyframes aun sin theme.css cargado.
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
    '<div style="width:42px;height:42px;border-radius:50%;background:rgba(255,90,110,.12);border:1px solid rgba(255,90,110,.4);display:inline-flex;align-items:center;justify-content:center;color:#ff5a6e;font-size:1.2rem">!</div>'
    + '<div class="sgm-splash-msg sgm-splash-err" style="color:#ff5a6e;max-width:460px;text-align:center;line-height:1.5">' + msg + '</div>'
    + (href ? `<a href="${href}" style="color:#4f8cff;text-decoration:underline;letter-spacing:0;text-transform:none;font-family:system-ui,sans-serif;margin-top:.5rem">Ir al login</a>` : '');
}

hideBody();
// Failsafe: si en FAILSAFE_MS no se revela ni redirige, libera la UI.
setTimeout(() => {
  if (!document.getElementById('sgm-guard-hide')) return; // ya resuelto
  console.warn('[SGM] Failsafe: liberando UI tras', FAILSAFE_MS, 'ms sin respuesta.');
  showSplashError('No fue posible verificar la sesión.', LOGIN_URL);
  // Deja el splash visible para que el usuario pueda click en "Ir al login"
}, FAILSAFE_MS);

// ── Utilidades ──
function redirect(url) {
  try { location.replace(url); } catch (_) { location.href = url; }
}

async function loadProfile(db, uid) {
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...snap.data() };
  } catch (err) {
    console.warn('[SGM] No se pudo leer /usuarios/%s:', uid, err);
    return null;
  }
}

// Bootstrap: si /usuarios/{uid} no existe pero /admins/{uid} sí,
// aceptamos como admin legacy (heredado de F5). Esto permite que
// el propietario entre tras el refactor aun si todavía no migró
// su perfil al nuevo esquema.
async function isLegacyAdmin(db, uid) {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch (_) {
    return false;
  }
}

// ── API principal ──
export function ensureSession({ requireAdmin = false } = {}) {
  return new Promise((resolve) => {
    if (!isFirebaseConfigured) {
      console.warn('[SGM] Firebase no configurado — redirigiendo al login.');
      redirect(LOGIN_URL);
      return;
    }

    let auth, db;
    try {
      auth = getAuthSafe();
      db   = getDbSafe();
    } catch (err) {
      console.error('[SGM] Firebase no inicializó:', err);
      showSplashError('Firebase no pudo inicializar. ' + (err?.message || ''), LOGIN_URL);
      return;
    }
    if (!auth || !db) {
      redirect(LOGIN_URL);
      return;
    }

    // Timeout de seguridad para Auth.
    const failTimer = setTimeout(() => {
      console.warn('[SGM] Timeout verificando sesión tras', TIMEOUT_MS, 'ms.');
      redirect(LOGIN_URL);
    }, TIMEOUT_MS);

    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(auth, async (user) => {
        clearTimeout(failTimer);
        try {
          if (!user) {
            unsub();
            redirect(LOGIN_URL);
            return;
          }

          let profile = await loadProfile(db, user.uid);

          if (!profile) {
            const legacy = await isLegacyAdmin(db, user.uid);
            if (legacy) {
              profile = {
                uid: user.uid,
                email: user.email,
                nombre: user.displayName || user.email,
                rol: 'admin',
                activo: true,
                legacy: true
              };
            }
          }

          if (!profile || profile.activo === false) {
            unsub();
            try { await signOut(auth); } catch (_) {}
            redirect(LOGIN_URL + '?denied=1');
            return;
          }

          if (requireAdmin && profile.rol !== 'admin') {
            unsub();
            redirect(HOME_URL + '?denied=admin');
            return;
          }

          const sess = { user, profile, role: profile.rol };
          window.__sgmSession = sess;
          window.__sgmAdmin = { uid: user.uid, email: user.email };
          try {
            window.dispatchEvent(new CustomEvent('sgm:session-ready', { detail: sess }));
          } catch (_) {}
          revealBody();
          resolve(sess);
        } catch (innerErr) {
          console.error('[SGM] Error resolviendo sesión:', innerErr);
          showSplashError('Error verificando sesión: ' + (innerErr?.message || ''), LOGIN_URL);
        }
      }, (authErr) => {
        clearTimeout(failTimer);
        console.error('[SGM] onAuthStateChanged error:', authErr);
        showSplashError('Error de autenticación: ' + (authErr?.message || ''), LOGIN_URL);
      });
    } catch (err) {
      clearTimeout(failTimer);
      console.error('[SGM] No se pudo suscribir a Auth:', err);
      showSplashError('No se pudo conectar con Auth.', LOGIN_URL);
    }
  });
}

export async function logout() {
  const auth = getAuthSafe();
  if (auth) {
    try { await signOut(auth); } catch (_) {}
  }
  // Legacy cleanup (gate estático de F0).
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
