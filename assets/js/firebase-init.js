// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Bootstrap de Firebase (SDK v10 modular)
// Fase 4 · Integración Firebase
// ──────────────────────────────────────────────────────────────
// Este módulo no se auto-ejecuta en ninguna página todavía.
// Se consumirá desde:
//   - F5  → assets/js/admin/auth.js  (login con Email/Password)
//   - F6+ → módulos CRUD sobre Firestore
//   - F9  → subida/descarga vía Storage
//
// Uso:
//   import { getApp, getAuthSafe, getDbSafe, getStorageSafe,
//            isFirebaseConfigured } from './firebase-init.js';
// ══════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp as _getApp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const APP_NAME = 'sgm-transpower';

function initApp() {
  if (!isFirebaseConfigured) {
    console.warn(
      '[SGM] Firebase aún no configurado. Revisa assets/js/firebase-config.js.'
    );
    return null;
  }
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  return initializeApp(firebaseConfig, APP_NAME);
}

export function getApp() {
  return initApp();
}

export function getAuthSafe() {
  const app = initApp();
  return app ? getAuth(app) : null;
}

export function getDbSafe() {
  const app = initApp();
  return app ? getFirestore(app) : null;
}

export function getStorageSafe() {
  const app = initApp();
  return app ? getStorage(app) : null;
}

export { isFirebaseConfigured };

// Prueba de conexión opcional (solo cuando se carga manualmente).
// Invocar desde la consola:   window.__sgmFirebaseProbe()
if (typeof window !== 'undefined') {
  window.__sgmFirebaseProbe = () => {
    const app = initApp();
    if (!app) return { ok: false, reason: 'Sin configurar' };
    return {
      ok: true,
      name: app.name,
      projectId: app.options.projectId,
      services: { auth: !!getAuth(app), db: !!getFirestore(app), storage: !!getStorage(app) }
    };
  };
}
