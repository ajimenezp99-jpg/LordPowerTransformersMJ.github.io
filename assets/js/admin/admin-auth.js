// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Helpers de autenticación admin (Fase 5)
// Envoltorio sobre Firebase Auth + chequeo contra ADMIN_UIDS.
// ══════════════════════════════════════════════════════════════

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

import { getAuthSafe, isFirebaseConfigured } from '../firebase-init.js';
import { isAdminUid, ADMIN_UIDS, ADMIN_ROUTES } from './admin-config.js';

const AUTH_ERRORS = {
  'auth/invalid-email':            'Correo inválido.',
  'auth/user-disabled':            'Cuenta deshabilitada.',
  'auth/user-not-found':           'Credenciales incorrectas.',
  'auth/wrong-password':           'Credenciales incorrectas.',
  'auth/invalid-credential':       'Credenciales incorrectas.',
  'auth/too-many-requests':        'Demasiados intentos. Espere unos minutos.',
  'auth/network-request-failed':   'Sin conexión con el servidor de autenticación.',
  'auth/operation-not-allowed':    'Método Email/Password no habilitado en el proyecto Firebase.'
};

export function humanizeAuthError(err) {
  if (!err) return 'Error desconocido.';
  const code = err.code || '';
  return AUTH_ERRORS[code] || (err.message || 'Error desconocido.');
}

export function ensureReady() {
  if (!isFirebaseConfigured) {
    return {
      ok: false,
      reason: 'Firebase aún no configurado. Editar assets/js/firebase-config.js.'
    };
  }
  if (!Array.isArray(ADMIN_UIDS) || ADMIN_UIDS.length === 0) {
    return {
      ok: false,
      reason: 'Sin UID admin en la allowlist. Editar assets/js/admin/admin-config.js.'
    };
  }
  const auth = getAuthSafe();
  if (!auth) {
    return { ok: false, reason: 'No se pudo inicializar Firebase Auth.' };
  }
  return { ok: true, auth };
}

export async function loginAdmin(email, password) {
  const chk = ensureReady();
  if (!chk.ok) throw new Error(chk.reason);

  await setPersistence(chk.auth, browserSessionPersistence);

  const cred = await signInWithEmailAndPassword(chk.auth, email, password);
  if (!isAdminUid(cred.user.uid)) {
    await signOut(chk.auth);
    throw new Error('Cuenta sin permisos administrativos.');
  }
  return cred.user;
}

export async function logoutAdmin() {
  const auth = getAuthSafe();
  if (auth) await signOut(auth);
  try { sessionStorage.removeItem('sgm.admin'); } catch (_) {}
}

export function onAdminAuthChange(callback) {
  const auth = getAuthSafe();
  if (!auth) {
    callback(null, { ok: false, reason: 'Firebase no inicializado.' });
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    if (!user) return callback(null, { ok: false, reason: 'Sin sesión.' });
    if (!isAdminUid(user.uid)) return callback(null, { ok: false, reason: 'UID no autorizado.' });
    callback(user, { ok: true });
  });
}

export { ADMIN_ROUTES };
