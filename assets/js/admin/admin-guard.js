// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — admin-guard (Fase 5)
// Ejecutar ANTES de renderizar contenido de cualquier página
// dentro de /admin/ (excepto login.html).
//
// Uso en el <head>:
//   <script type="module" src="../assets/js/admin/admin-guard.js"></script>
//
// Comportamiento:
//   1. Verifica que el gate estático esté pasado (sgm.access === '1').
//      Si no, redirige a /index.html.
//   2. Verifica que haya usuario autenticado vía Firebase Auth y
//      que su UID esté en ADMIN_UIDS. Si falla, redirige a
//      /admin/login.html.
//   3. Mientras se resuelve el estado, oculta el <body> para evitar
//      flashear contenido protegido.
// ══════════════════════════════════════════════════════════════

import { onAdminAuthChange, ADMIN_ROUTES } from './admin-auth.js';

// Paso 1 — gate estático
try {
  if (sessionStorage.getItem('sgm.access') !== '1') {
    location.replace('/index.html');
  }
} catch (_) {
  location.replace('/index.html');
}

// Paso 2 — oculta el body hasta confirmar auth
const hideStyle = document.createElement('style');
hideStyle.id = 'sgm-admin-hide';
hideStyle.textContent = 'body{visibility:hidden!important}';
document.head.appendChild(hideStyle);

function reveal() {
  const el = document.getElementById('sgm-admin-hide');
  if (el) el.remove();
}

// Timeout de seguridad — si Firebase no responde en 5s asumimos sin sesión
const failTimer = setTimeout(() => {
  location.replace(ADMIN_ROUTES.login);
}, 5000);

onAdminAuthChange((user, info) => {
  clearTimeout(failTimer);
  if (!user || !info.ok) {
    location.replace(ADMIN_ROUTES.login);
    return;
  }
  // Exponer info del admin a la página
  window.__sgmAdmin = { uid: user.uid, email: user.email };
  reveal();
});
