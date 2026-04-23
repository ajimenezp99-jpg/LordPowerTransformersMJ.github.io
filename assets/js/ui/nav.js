// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Nav unificada v3
// Componente ESM que renderiza la topbar + drawer en todas las
// páginas protegidas. Menos desplegables (solo "Más" + "Admin"),
// el resto son links planos. Responsivo.
//
// Uso:
//   <script type="module" src="{PATH}/assets/js/ui/nav.js"></script>
// No hay que tocar el HTML: el script detecta el contenedor
// <header data-sgm-nav> o lo crea al inicio del <body>.
// ══════════════════════════════════════════════════════════════

// Raíz del sitio (funciona en raíz o en project-pages subpath)
const BASE = new URL('../../../', import.meta.url).href;
const url = (p) => BASE + p.replace(/^\/+/, '');

// Estructura de navegación. Orden = prioridad visual.
// Todas las páginas apuntan a /pages/* por defecto; los enlaces admin
// apuntan a /admin/* y se ocultan a no-admins. Un día los fundiremos.
const NAV = {
  primary: [
    { key: 'home',      label: 'Inicio',     href: 'home.html',               icon: 'layout-dashboard' },
    { key: 'inventario',label: 'Inventario', href: 'pages/inventario.html',   icon: 'database' },
    { key: 'ordenes',   label: 'Órdenes',    href: 'pages/ordenes.html',      icon: 'clipboard-list' },
    { key: 'mapa',      label: 'Mapa',       href: 'pages/mapa.html',         icon: 'map' },
    { key: 'kpis',      label: 'KPIs',       href: 'pages/kpis.html',         icon: 'bar-chart-3' },
    { key: 'alertas',   label: 'Alertas',    href: 'pages/alertas.html',      icon: 'bell-ring' },
  ],
  more: {
    key: 'more', label: 'Más',
    groups: [
      {
        title: 'Análisis',
        items: [
          { label: 'Dashboard ejecutivo', hint: 'Vista gerencial',      href: 'pages/dashboard.html',     icon: 'layout-grid' },
          { label: 'Matriz de Riesgo',    hint: 'Criticidad × Salud',   href: 'pages/matriz-riesgo.html', icon: 'grid-3x3' },
          { label: 'Plan de Inversión',   hint: 'Ranking multicriterio', href: 'admin/plan-inversion.html',icon: 'trending-up' },
          { label: 'Desempeño aliados',   hint: 'Score por contratista', href: 'admin/desempeno-aliados.html', icon: 'award' },
        ],
      },
      {
        title: 'Salud del activo',
        items: [
          { label: 'Muestras',            hint: 'DGA · ADFQ · FUR',     href: 'admin/muestras.html',       icon: 'flask-conical' },
          { label: 'Motor de Salud',      hint: 'Calculadora HI',        href: 'admin/motor-salud.html',    icon: 'activity' },
          { label: 'Propuestas FUR',      hint: 'Juicio experto §A9.2',  href: 'admin/propuestas-fur.html', icon: 'gavel' },
          { label: 'Contramuestras',      hint: 'Monitoreo reforzado',   href: 'admin/contramuestras.html', icon: 'repeat-2' },
          { label: 'Fallados + RCA',      hint: '5 Porqués · Ishikawa',  href: 'admin/fallados.html',       icon: 'alert-octagon' },
        ],
      },
      {
        title: 'Operación',
        items: [
          { label: 'Subestaciones', hint: 'Catálogo de sitios',    href: 'admin/subestaciones.html', icon: 'factory' },
          { label: 'Contratos',     hint: 'Macro vigentes',         href: 'admin/contratos.html',     icon: 'file-text' },
          { label: 'Catálogos §A7', hint: 'Sub/macro/causantes',    href: 'admin/catalogos.html',     icon: 'book-open' },
          { label: 'Documentos',    hint: 'Protocolos y evidencias',href: 'pages/documentos.html',    icon: 'folder-open' },
          { label: 'Normativa',     hint: 'Referencias técnicas',   href: 'pages/normativa.html',     icon: 'scroll-text' },
        ],
      },
    ],
  },
  admin: {
    key: 'admin', label: 'Admin',
    groups: [
      {
        title: 'Administración',
        items: [
          { label: 'Usuarios y roles',  hint: 'Alta / baja / RBAC',     href: 'admin/usuarios.html',        icon: 'users' },
          { label: 'Umbrales de salud', hint: 'Baselines MO.00418',      href: 'admin/umbrales-salud.html',  icon: 'sliders-horizontal' },
          { label: 'Importar Excel',    hint: 'Carga masiva de TX',      href: 'admin/importar.html',        icon: 'upload-cloud' },
          { label: 'Auditoría',         hint: 'Bitácora ISO 55001',      href: 'admin/auditoria.html',       icon: 'history' },
        ],
      },
    ],
  },
};

// ── Utilidades ────────────────────────────────────────────────
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    el.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return el;
}

function icon(name) {
  return h('i', { 'data-lucide': name });
}

function currentPath() {
  const p = location.pathname.split('/').filter(Boolean);
  return p[p.length - 1] || 'home.html';
}

function isActive(href) {
  const cur = currentPath();
  const lastHref = href.split('/').pop();
  return cur === lastHref;
}

// ── Render topbar ─────────────────────────────────────────────
function renderTopbar() {
  const brand = h('a', { class: 'sgm-brand', href: url('home.html') }, [
    h('span', { class: 'sgm-brand-mark' }, 'T'),
    h('span', {}, [ 'SGM·', h('em', {}, 'TRANSPOWER') ]),
  ]);

  // Links primarios
  const nav = h('nav', { class: 'sgm-nav', 'aria-label': 'Navegación principal' });
  for (const item of NAV.primary) {
    const a = h('a', {
      class: 'sgm-nav-link',
      href: url(item.href),
      'data-nav': item.key,
    }, item.label);
    if (isActive(item.href)) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }

  // Dropdown "Más"
  nav.append(renderDropdown(NAV.more));

  // Dropdown "Admin" — oculto por defecto, se muestra con rol
  const adminDd = renderDropdown(NAV.admin, { rightAlign: true, adminOnly: true });
  adminDd.dataset.sgmAdmin = 'true';
  adminDd.hidden = true;
  nav.append(adminDd);

  const userChip = h('div', { class: 'sgm-user', id: 'sgmUser', hidden: true }, [
    h('span', { class: 'sgm-user-avatar', id: 'sgmUserAvatar' }, '·'),
    h('span', { class: 'sgm-user-meta' }, [
      h('span', { class: 'sgm-user-name', id: 'sgmUserName' }, '—'),
      h('span', { class: 'sgm-user-role', id: 'sgmUserRole' }, '—'),
    ]),
  ]);

  const btnLogout = h('button', {
    class: 'sgm-logout',
    'aria-label': 'Cerrar sesión',
    title: 'Cerrar sesión',
    id: 'sgmLogout',
  }, icon('log-out'));

  const burger = h('button', {
    class: 'sgm-burger',
    'aria-label': 'Abrir menú',
    'aria-expanded': 'false',
    id: 'sgmBurger',
  }, icon('menu'));

  return h('header', { class: 'sgm-topbar', 'data-sgm-nav': 'topbar' }, [
    brand, nav, userChip, btnLogout, burger,
  ]);
}

// ── Dropdown ──────────────────────────────────────────────────
function renderDropdown(def, { rightAlign = false, adminOnly = false } = {}) {
  const btn = h('button', {
    class: `sgm-nav-link${adminOnly ? ' is-admin' : ''}`,
    type: 'button',
    'aria-haspopup': 'true',
    'aria-expanded': 'false',
    'data-dd-button': def.key,
  }, [
    def.label,
    h('span', { class: 'chev', 'aria-hidden': 'true' }, icon('chevron-down')),
  ]);

  const grid = h('div', { class: 'sgm-dd-grid' });
  for (const group of def.groups) {
    const col = h('div', { class: 'sgm-dd-group' });
    col.append(h('div', { class: 'sgm-dd-group-title' }, group.title));
    for (const item of group.items) {
      col.append(h('a', { class: 'sgm-dd-item', href: url(item.href) }, [
        icon(item.icon || 'circle'),
        h('span', { class: 'sgm-dd-item-label' }, [
          h('span', {}, item.label),
          item.hint ? h('span', { class: 'sgm-dd-item-hint' }, item.hint) : null,
        ]),
      ]));
    }
    grid.append(col);
  }

  const panel = h('div', {
    class: 'sgm-dd-panel' + (rightAlign ? ' is-right' : ''),
    role: 'menu',
  }, grid);

  const wrap = h('div', { class: 'sgm-dd', 'data-dd': def.key }, [ btn, panel ]);

  // Toggle
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllDropdowns(wrap);
    const open = wrap.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  return wrap;
}

function closeAllDropdowns(exceptEl) {
  document.querySelectorAll('.sgm-dd.is-open').forEach((el) => {
    if (el === exceptEl) return;
    el.classList.remove('is-open');
    el.querySelector('[data-dd-button]')?.setAttribute('aria-expanded', 'false');
  });
}

// ── Drawer mobile ─────────────────────────────────────────────
function renderDrawer() {
  const scrim = h('div', { class: 'sgm-drawer-scrim', id: 'sgmScrim' });
  const drawer = h('aside', { class: 'sgm-drawer', 'aria-label': 'Menú móvil', id: 'sgmDrawer' });

  drawer.append(h('button', {
    class: 'sgm-drawer-close',
    'aria-label': 'Cerrar menú',
    id: 'sgmDrawerClose',
  }, icon('x')));

  // Links primarios
  const primarySec = h('div', { class: 'sgm-drawer-section' });
  for (const item of NAV.primary) {
    const a = h('a', {
      class: 'sgm-drawer-link',
      href: url(item.href),
    }, [ icon(item.icon || 'circle'), item.label ]);
    if (isActive(item.href)) a.setAttribute('aria-current', 'page');
    primarySec.append(a);
  }
  drawer.append(primarySec);

  // "Más" → se aplanan sus grupos
  for (const group of NAV.more.groups) {
    drawer.append(h('div', { class: 'sgm-drawer-title' }, group.title));
    const sec = h('div', { class: 'sgm-drawer-section' });
    for (const item of group.items) {
      sec.append(h('a', {
        class: 'sgm-drawer-link',
        href: url(item.href),
      }, [ icon(item.icon || 'circle'), item.label ]));
    }
    drawer.append(sec);
  }

  // Admin (oculto por defecto)
  const adminTitle = h('div', { class: 'sgm-drawer-title', 'data-sgm-admin': 'title', hidden: true }, 'Administración');
  drawer.append(adminTitle);
  const adminSec = h('div', { class: 'sgm-drawer-section', 'data-sgm-admin': 'section', hidden: true });
  for (const group of NAV.admin.groups) {
    for (const item of group.items) {
      adminSec.append(h('a', {
        class: 'sgm-drawer-link',
        href: url(item.href),
      }, [ icon(item.icon || 'circle'), item.label ]));
    }
  }
  drawer.append(adminSec);

  return [ scrim, drawer ];
}

// ── Montaje ───────────────────────────────────────────────────
function mount() {
  // Asegura aurora + grain de fondo una sola vez
  if (!document.querySelector('.sgm-aurora')) {
    document.body.prepend(h('div', { class: 'sgm-grain' }));
    document.body.prepend(h('div', { class: 'sgm-aurora' }));
  }

  const existing = document.querySelector('[data-sgm-nav="topbar"]');
  if (existing) existing.remove();
  // También retirar la vieja topbar hardcodeada si existiera
  document.querySelectorAll('header.topbar').forEach((el) => el.remove());

  const top = renderTopbar();
  document.body.prepend(top);

  const [scrim, drawer] = renderDrawer();
  document.body.append(scrim, drawer);

  // Cargar Lucide (iconos) si no está
  loadLucide();

  // Event wiring
  wireEvents();

  // Inject session data
  hookSession();
}

function wireEvents() {
  // Click fuera = cerrar dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sgm-dd')) closeAllDropdowns();
  });
  // Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      closeDrawer();
    }
  });

  // Burger
  document.getElementById('sgmBurger')?.addEventListener('click', openDrawer);
  document.getElementById('sgmDrawerClose')?.addEventListener('click', closeDrawer);
  document.getElementById('sgmScrim')?.addEventListener('click', closeDrawer);

  // Logout (delegación al session-guard si existe)
  document.getElementById('sgmLogout')?.addEventListener('click', async () => {
    try {
      const mod = await import('../auth/session-guard.js');
      if (mod.logout) return mod.logout();
    } catch (_) { /* noop */ }
    location.href = url('index.html');
  });
}

function openDrawer()  { document.body.classList.add('sgm-drawer-open'); }
function closeDrawer() { document.body.classList.remove('sgm-drawer-open'); }

// ── Integración con session-guard ─────────────────────────────
function hookSession() {
  const apply = (sess) => {
    if (!sess) return;
    const p = sess.profile || {};
    const nameNode   = document.getElementById('sgmUserName');
    const roleNode   = document.getElementById('sgmUserRole');
    const avatarNode = document.getElementById('sgmUserAvatar');
    const chip       = document.getElementById('sgmUser');

    const display = p.nombre || p.email || sess.user?.email || '—';
    if (nameNode) nameNode.textContent = display;
    if (roleNode) roleNode.textContent = (sess.role || 'tecnico').replace(/_/g, ' ');
    if (avatarNode) avatarNode.textContent = (display[0] || '?').toUpperCase();
    if (chip) chip.hidden = false;

    // Admin: mostrar dropdown + sección drawer
    if (sess.role === 'admin') {
      document.querySelectorAll('[data-sgm-admin]').forEach((el) => { el.hidden = false; });
    }
  };

  if (window.__sgmSession) apply(window.__sgmSession);
  window.addEventListener('sgm:session-ready', (e) => apply(e.detail));
}

// ── Lucide icons loader ───────────────────────────────────────
function loadLucide() {
  if (window.lucide) { window.lucide.createIcons(); return; }
  if (document.getElementById('sgm-lucide')) return;
  const s = document.createElement('script');
  s.id = 'sgm-lucide';
  s.src = 'https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js';
  s.crossOrigin = 'anonymous';
  s.onload = () => { try { window.lucide.createIcons(); } catch (_) {} };
  document.head.append(s);
}

// Re-render iconos cuando cambie el DOM (páginas de app)
const mo = new MutationObserver(() => {
  if (window.lucide) {
    try { window.lucide.createIcons(); } catch (_) {}
  }
});

// ── Bootstrap ─────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mount();
    mo.observe(document.body, { childList: true, subtree: true });
  });
} else {
  mount();
  mo.observe(document.body, { childList: true, subtree: true });
}

export { NAV };
