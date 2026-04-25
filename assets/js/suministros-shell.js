// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Shell del módulo Suministros (R1 · v2.3)
// ──────────────────────────────────────────────────────────────
// Coordinador de tabs + lazy-load de iframes. Cada tab apunta a
// una página existente que se embebe (con shell oculto vía detección
// de iframe en aqua-shell.js).
// ══════════════════════════════════════════════════════════════

import { initTabs } from './ui/tabs.js';

const tabsRoot = document.getElementById('suministrosTabs');
if (!tabsRoot) throw new Error('suministros-shell: falta #suministrosTabs');

// Carga el iframe sólo la primera vez que se activa la tab.
// Subsecuentes activaciones simplemente lo muestran (preserva
// estado, suscripciones realtime, scroll position).
function lazyLoadIframe(panel) {
  const iframe = panel.querySelector('iframe[data-src]');
  if (!iframe) return;
  const dataSrc = iframe.getAttribute('data-src');
  if (dataSrc && !iframe.src) {
    iframe.src = dataSrc;
  }
}

initTabs(tabsRoot, {
  defaultTab: 'dashboard',
  hashKey: 'tab',
  onShow: (key, panel) => {
    lazyLoadIframe(panel);
  }
});

// Si el rol no es admin, ocultar las tabs admin (Catálogo, Movimiento,
// Histórico, Correcciones, Importar). El Dashboard sigue público.
function ocultarTabsAdminSiNoEsAdmin() {
  const session = window.__sgmSession;
  if (!session || !session.profile) return;
  const role = session.profile.rol || session.role;
  if (role === 'admin') return;
  // Roles legacy `admin` heredados también se aceptan; cualquier otro
  // pierde acceso a tabs admin.
  for (const tab of tabsRoot.querySelectorAll('[role="tab"][data-admin]')) {
    tab.hidden = true;
  }
}

if (window.__sgmSession) {
  ocultarTabsAdminSiNoEsAdmin();
} else {
  window.addEventListener('sgm:session-ready', ocultarTabsAdminSiNoEsAdmin, { once: true });
}
