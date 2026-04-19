// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Compatibilidad admin-auth (Fase 14)
// ──────────────────────────────────────────────────────────────
// Este módulo existía en F5 con allowlist estática (ADMIN_UIDS).
// En F14 el acceso es unificado por Firebase Auth + /usuarios/{uid}
// con rol='admin'. Se conserva la misma superficie pública
// (`logoutAdmin`, `onAdminAuthChange`, `ADMIN_ROUTES`) para no
// tener que reescribir los controladores admin-*.js individuales.
// ══════════════════════════════════════════════════════════════

import { logout as sessionLogout, getSession }
  from '../auth/session-guard.js';

export const ADMIN_ROUTES = {
  login:    '/index.html',
  home:     '/admin/index.html',
  fallback: '/home.html'
};

export async function logoutAdmin() {
  await sessionLogout();
}

// Notifica cuando la sesión está disponible. El guard ya redirigió
// a login si no había sesión o el rol no era admin, así que aquí
// simplemente se entrega el perfil cuando exista.
export function onAdminAuthChange(callback) {
  function emit() {
    const s = getSession();
    if (s) callback(s.user, { ok: true });
    else   callback(null, { ok: false, reason: 'Sin sesión.' });
  }
  const s = getSession();
  if (s) { emit(); return () => {}; }
  const handler = () => emit();
  window.addEventListener('sgm:session-ready', handler, { once: true });
  return () => window.removeEventListener('sgm:session-ready', handler);
}

// Stub mínimo — ya nadie debería llamarlos, pero los mantenemos
// para no romper imports durante la migración.
export function humanizeAuthError(err) {
  return err?.message || 'Error desconocido.';
}
export function ensureReady() {
  return { ok: true };
}
export async function loginAdmin() {
  throw new Error('Login consolidado. Use /index.html.');
}
