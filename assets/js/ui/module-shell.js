// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Module shell genérico (R2 · refactor v2.3)
// ──────────────────────────────────────────────────────────────
// Coordinador de tabs + lazy-load de iframes para cualquier
// módulo consolidado del refactor v2.3 (Suministros, Salud,
// Activos, Análisis, Administración, Recursos).
//
// Uso típico (un import de una línea):
//
//   import { initModuleShell } from './ui/module-shell.js';
//   initModuleShell('saludTabs', { defaultTab: 'muestras' });
//
// El elemento `#saludTabs` debe contener la estructura ARIA del
// componente tabs (ver assets/js/ui/tabs.js).
//
// Comportamiento:
//   · Lazy-load del iframe en cada panel cuando la tab se activa.
//   · Hash routing automático (#tab=muestras).
//   · Oculta tabs marcadas data-admin a usuarios no-admin.
//   · Soporta opciones avanzadas vía el segundo argumento.
// ══════════════════════════════════════════════════════════════

import { initTabs } from './tabs.js';

function lazyLoadIframe(panel) {
  const iframe = panel.querySelector('iframe[data-src]');
  if (!iframe) return;
  const dataSrc = iframe.getAttribute('data-src');
  if (dataSrc && !iframe.src) {
    iframe.src = dataSrc;
  }
}

function aplicarRoleHide(rootEl) {
  const session = window.__sgmSession;
  if (!session || !session.profile) return;
  const role = session.profile.rol || session.role;
  if (role === 'admin') return;
  for (const tab of rootEl.querySelectorAll('[role="tab"][data-admin]')) {
    tab.hidden = true;
  }
}

/**
 * Inicializa el shell de un módulo consolidado.
 *
 * @param {string|HTMLElement} rootIdOrEl - id del contenedor o el elemento
 * @param {object} [opts]
 * @param {string} [opts.defaultTab] - tab activa por defecto si no hay hash
 * @param {string} [opts.hashKey='tab']
 * @param {(key, panel) => void} [opts.onShow]
 * @param {(key, panel) => void} [opts.onHide]
 * @returns API de tabs ({ activate, getActive, destroy })
 */
export function initModuleShell(rootIdOrEl, opts = {}) {
  const root = typeof rootIdOrEl === 'string'
    ? document.getElementById(rootIdOrEl)
    : rootIdOrEl;
  if (!root) throw new Error(`initModuleShell: no se encontró el contenedor "${rootIdOrEl}"`);

  const api = initTabs(root, {
    defaultTab: opts.defaultTab,
    hashKey:    opts.hashKey || 'tab',
    onShow:     (key, panel) => {
      lazyLoadIframe(panel);
      if (opts.onShow) try { opts.onShow(key, panel); } catch (err) { console.warn('[module-shell.onShow]', err); }
    },
    onHide:     opts.onHide
  });

  // Aplicar role-hide tan pronto como la sesión esté lista.
  if (window.__sgmSession) {
    aplicarRoleHide(root);
  } else {
    window.addEventListener('sgm:session-ready', () => aplicarRoleHide(root), { once: true });
  }

  return api;
}
