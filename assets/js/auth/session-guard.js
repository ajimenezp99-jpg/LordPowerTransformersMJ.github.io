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

const LOGIN_URL = '/index.html';
const HOME_URL  = '/home.html';
const TIMEOUT_MS = 6000;

// ── Ocultar body al arrancar (evita flash de contenido) ──
function hideBody() {
  if (document.getElementById('sgm-guard-hide')) return;
  const s = document.createElement('style');
  s.id = 'sgm-guard-hide';
  s.textContent = 'body{visibility:hidden!important}';
  document.head.appendChild(s);
}
function revealBody() {
  const s = document.getElementById('sgm-guard-hide');
  if (s) s.remove();
}

hideBody();

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
    const auth = getAuthSafe();
    const db   = getDbSafe();
    if (!auth || !db) {
      redirect(LOGIN_URL);
      return;
    }

    // Timeout de seguridad.
    const failTimer = setTimeout(() => {
      console.warn('[SGM] Timeout verificando sesión.');
      redirect(LOGIN_URL);
    }, TIMEOUT_MS);

    const unsub = onAuthStateChanged(auth, async (user) => {
      clearTimeout(failTimer);
      if (!user) {
        unsub();
        redirect(LOGIN_URL);
        return;
      }

      let profile = await loadProfile(db, user.uid);

      // Fallback bootstrap: legacy admin doc.
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
      // Compat con controladores admin-*.js que leían __sgmAdmin.
      window.__sgmAdmin = { uid: user.uid, email: user.email };
      try {
        window.dispatchEvent(new CustomEvent('sgm:session-ready', { detail: sess }));
      } catch (_) {}
      revealBody();
      resolve(sess);
    });
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
