// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — UI: Tabs reusables (R0 · refactor v2.3)
// ──────────────────────────────────────────────────────────────
// Componente ARIA-compliant para navegación por pestañas con
// persistencia en URL hash. Cero dependencias.
//
// Uso típico:
//   <div class="sgm-tabs" id="suministrosTabs">
//     <div role="tablist" class="tab-bar">
//       <button role="tab" data-tab="catalogo">Catálogo</button>
//       <button role="tab" data-tab="movimientos">Movimientos</button>
//     </div>
//     <div class="tab-panels">
//       <div role="tabpanel" data-tab-panel="catalogo">…</div>
//       <div role="tabpanel" data-tab-panel="movimientos">…</div>
//     </div>
//   </div>
//
//   import { initTabs } from '/assets/js/ui/tabs.js';
//   initTabs(document.getElementById('suministrosTabs'), {
//     defaultTab: 'catalogo',
//     onShow: (key, panel) => { ... },
//     onHide: (key, panel) => { ... }
//   });
//
// Helpers exportados (puros, testeables):
//   parseHash(hash, key='tab')  → string|null
//   buildHash(key, value)       → '#tab=value'
//   updateHash(key, value)      → side effect
// ══════════════════════════════════════════════════════════════

/**
 * Parsea un hash de URL (`#tab=catalogo&otro=foo`) y devuelve el
 * valor del key indicado, o null si no está. Tolera el `#` inicial
 * o su ausencia.
 */
export function parseHash(hash, key = 'tab') {
  if (typeof hash !== 'string' || !hash) return null;
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const v = params.get(key);
  return v != null && v !== '' ? v : null;
}

/**
 * Construye un hash con un único key=value. Si quieres preservar
 * otros params, usa `mergeHash`.
 */
export function buildHash(key, value) {
  if (!key) return '';
  if (value == null || value === '') return '';
  const params = new URLSearchParams();
  params.set(key, String(value));
  return '#' + params.toString();
}

/**
 * Mergea (key, value) en un hash existente preservando otros params.
 * Pasa `value=null` para eliminar el key.
 */
export function mergeHash(currentHash, key, value) {
  const clean = (currentHash || '').replace(/^#/, '');
  const params = new URLSearchParams(clean);
  if (value == null || value === '') params.delete(key);
  else params.set(key, String(value));
  const out = params.toString();
  return out ? '#' + out : '';
}

/**
 * Actualiza el hash de la ventana sin disparar `hashchange`
 * navigation indeseable. Usa `history.replaceState` para evitar
 * llenar el back stack.
 */
export function updateHash(key, value) {
  if (typeof window === 'undefined' || !window.history) return;
  const newHash = mergeHash(window.location.hash, key, value);
  const url = window.location.pathname + window.location.search + newHash;
  window.history.replaceState(null, '', url);
}

/**
 * Inicializa un contenedor de tabs. Devuelve una API:
 *   { activate(key), getActive(), destroy() }
 *
 * Eventos disparados sobre el panel activado:
 *   `sgm:tab:show` (event.detail.key, event.detail.panel)
 * Y sobre el panel previamente activo:
 *   `sgm:tab:hide` (event.detail.key, event.detail.panel)
 */
export function initTabs(rootEl, options = {}) {
  if (!rootEl) throw new Error('initTabs: rootEl es obligatorio');
  const tablist = rootEl.querySelector('[role="tablist"]');
  if (!tablist) throw new Error('initTabs: falta [role="tablist"]');
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"][data-tab]'));
  if (tabs.length === 0) throw new Error('initTabs: no hay [role="tab"][data-tab]');

  const hashKey = options.hashKey || 'tab';
  const defaultTab = options.defaultTab || tabs[0].dataset.tab;
  const onShow = typeof options.onShow === 'function' ? options.onShow : null;
  const onHide = typeof options.onHide === 'function' ? options.onHide : null;
  const persistHash = options.persistHash !== false;

  const panelByKey = new Map();
  for (const panel of rootEl.querySelectorAll('[role="tabpanel"][data-tab-panel]')) {
    panelByKey.set(panel.dataset.tabPanel, panel);
  }
  const tabByKey = new Map();
  for (const tab of tabs) {
    tabByKey.set(tab.dataset.tab, tab);
    // Asegura wiring ARIA mínimo.
    if (!tab.id) tab.id = `tab-${tab.dataset.tab}-${Math.random().toString(36).slice(2, 7)}`;
    const panel = panelByKey.get(tab.dataset.tab);
    if (panel) {
      tab.setAttribute('aria-controls', panel.id || (panel.id = tab.id + '-panel'));
      panel.setAttribute('aria-labelledby', tab.id);
      if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '0');
    }
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '-1');
    if (panel) panel.hidden = true;
  }

  let activeKey = null;

  function activate(key, opts = { focus: false, persist: true }) {
    if (!tabByKey.has(key)) {
      if (tabByKey.has(defaultTab)) key = defaultTab;
      else key = tabs[0].dataset.tab;
    }
    if (key === activeKey) return;

    // Hide previous
    if (activeKey) {
      const prevTab = tabByKey.get(activeKey);
      const prevPanel = panelByKey.get(activeKey);
      if (prevTab) {
        prevTab.setAttribute('aria-selected', 'false');
        prevTab.setAttribute('tabindex', '-1');
        prevTab.classList.remove('is-active');
      }
      if (prevPanel) {
        prevPanel.hidden = true;
        prevPanel.classList.remove('is-active');
        prevPanel.dispatchEvent(new CustomEvent('sgm:tab:hide', {
          bubbles: true,
          detail: { key: activeKey, panel: prevPanel }
        }));
        if (onHide) try { onHide(activeKey, prevPanel); } catch (err) { console.warn('[tabs.onHide]', err); }
      }
    }

    // Show new
    const tab = tabByKey.get(key);
    const panel = panelByKey.get(key);
    if (tab) {
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');
      tab.classList.add('is-active');
      if (opts.focus) tab.focus();
    }
    if (panel) {
      panel.hidden = false;
      panel.classList.add('is-active');
      panel.dispatchEvent(new CustomEvent('sgm:tab:show', {
        bubbles: true,
        detail: { key, panel }
      }));
      if (onShow) try { onShow(key, panel); } catch (err) { console.warn('[tabs.onShow]', err); }
    }

    activeKey = key;
    if (persistHash && opts.persist !== false) updateHash(hashKey, key);
  }

  // Click handler
  tablist.addEventListener('click', (e) => {
    const btn = e.target.closest('[role="tab"][data-tab]');
    if (!btn || !tablist.contains(btn)) return;
    activate(btn.dataset.tab, { focus: true, persist: true });
  });

  // Keyboard nav (ARIA tabs pattern: Left/Right/Home/End)
  tablist.addEventListener('keydown', (e) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(k)) return;
    e.preventDefault();
    const idx = tabs.findIndex((t) => t.dataset.tab === activeKey);
    let next;
    if      (k === 'ArrowLeft')  next = (idx - 1 + tabs.length) % tabs.length;
    else if (k === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (k === 'Home')       next = 0;
    else                         next = tabs.length - 1;
    activate(tabs[next].dataset.tab, { focus: true, persist: true });
  });

  // Hashchange listener (e.g. usuario cambia hash manualmente o usa back/forward)
  let hashListener = null;
  if (persistHash && typeof window !== 'undefined') {
    hashListener = () => {
      const fromHash = parseHash(window.location.hash, hashKey);
      if (fromHash && fromHash !== activeKey) activate(fromHash, { persist: false });
    };
    window.addEventListener('hashchange', hashListener);
  }

  // Activate from current hash or fallback to default
  const initialKey = persistHash && typeof window !== 'undefined'
    ? (parseHash(window.location.hash, hashKey) || defaultTab)
    : defaultTab;
  activate(initialKey, { persist: false });

  return {
    activate: (key) => activate(key, { focus: false, persist: true }),
    getActive: () => activeKey,
    destroy: () => {
      if (hashListener && typeof window !== 'undefined') {
        window.removeEventListener('hashchange', hashListener);
      }
    }
  };
}
