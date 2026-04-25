/* AQUA · Shell auto-inject — v3
 * Inyecta topbar + sidebar + escena en cualquier página que tenga
 * <body class="aqua"> y un <main class="app-main">.
 *
 * - Detecta la URL actual y marca .is-active en el sb-item correcto.
 * - Escucha sgm:session-ready / window.__sgmSession para mostrar
 *   chip de rol + iniciales + ocultar links admin a no-admins.
 * - Provee logout via assets/js/admin/admin-auth.js.
 * - ⌘K enfoca la búsqueda; Esc la limpia.
 *
 * Uso en cada página:
 *   <body class="aqua">
 *     <main class="app-main">…contenido…</main>
 *     <script src="assets/js/aqua-shell.js" defer></script>
 *
 * El shell lee <html data-aqua-base="…"> si está presente; de lo
 * contrario calcula la base a partir del pathname (ej. /pages/x.html
 * → base "../"; /home.html → "./").
 */
(function () {
  'use strict';

  if (window.__aquaShellInjected) return;
  window.__aquaShellInjected = true;

  // Si la página está embebida en un iframe (parte del refactor v2.3
  // de tabs), marcamos el body con .is-embedded y NO inyectamos
  // topbar/sidebar — el padre ya tiene su propio shell. Los estilos
  // de tabs.css ocultan los elementos correspondientes.
  let isEmbedded = false;
  try {
    if (window.self !== window.top) {
      isEmbedded = true;
      document.body.classList.add('is-embedded');
      return;
    }
  } catch (_) {
    // Cross-origin guard: si no podemos comparar, asumimos top y
    // continuamos con el shell normal.
  }

  const path = location.pathname;
  // Calcular base relativa: si estamos en /pages/foo.html o /admin/foo.html → "../"
  // Si /home.html o /index.html (raíz) → "./"
  let base = '';
  if (path.includes('/pages/') || path.includes('/admin/')) base = '../';
  else base = './';
  // Permitir override explícito
  const explicit = document.documentElement.getAttribute('data-aqua-base');
  if (explicit !== null) base = explicit;

  // R8 · Redirects de URLs legacy → módulo padre con tab activa.
  // Solo aplica cuando la página NO está embebida (top-level). Preserva
  // bookmarks viejos sin duplicar contenido.
  if (!isEmbedded) {
    const LEGACY_REDIRECTS = {
      // Suministros
      '/pages/suministros-dashboard.html':   'pages/suministros.html#tab=dashboard',
      '/admin/suministros-catalogo.html':    'pages/suministros.html#tab=catalogo',
      '/admin/suministros-movimiento.html':  'pages/suministros.html#tab=movimiento',
      '/admin/suministros-historico.html':   'pages/suministros.html#tab=historico',
      '/admin/suministros-correcciones.html':'pages/suministros.html#tab=correcciones',
      '/admin/importar-suministros.html':    'pages/suministros.html#tab=importar',
      // Activos
      '/pages/inventario.html':              'pages/activos.html#tab=inventario',
      '/pages/mapa.html':                    'pages/activos.html#tab=mapa',
      '/admin/subestaciones.html':           'pages/activos.html#tab=subestaciones',
      '/admin/contratos.html':               'pages/activos.html#tab=contratos',
      // Salud
      '/pages/muestras.html':                'pages/salud.html#tab=muestras',
      '/admin/motor-salud.html':             'pages/salud.html#tab=motor',
      '/admin/propuestas-fur.html':          'pages/salud.html#tab=fur',
      '/admin/contramuestras.html':          'pages/salud.html#tab=contramuestras',
      '/admin/fallados.html':                'pages/salud.html#tab=fallados',
      '/pages/matriz-riesgo.html':           'pages/salud.html#tab=matriz',
      // Análisis
      '/pages/dashboard.html':               'pages/analisis.html#tab=dashboard',
      '/pages/kpis.html':                    'pages/analisis.html#tab=kpis',
      '/pages/alertas.html':                 'pages/analisis.html#tab=alertas',
      '/admin/plan-inversion.html':          'pages/analisis.html#tab=plan-inversion',
      '/admin/desempeno-aliados.html':       'pages/analisis.html#tab=desempeno',
      // Administración
      '/admin/index.html':                   'admin/administracion.html#tab=panel',
      '/admin/usuarios.html':                'admin/administracion.html#tab=usuarios',
      '/admin/catalogos.html':               'admin/administracion.html#tab=catalogos',
      '/admin/importar.html':                'admin/administracion.html#tab=importar',
      '/admin/auditoria.html':               'admin/administracion.html#tab=auditoria',
      // Recursos
      '/pages/documentos.html':              'pages/recursos.html#tab=documentos',
      '/pages/normativa.html':               'pages/recursos.html#tab=normativa',
      '/pages/cobertura.html':               'pages/recursos.html#tab=cobertura',
      '/pages/about.html':                   'pages/recursos.html#tab=about'
    };
    // Match contra el suffix del pathname (acepta cualquier prefijo de
    // base path, p.ej. /LordPowerTransformersMJ.github.io/).
    const cleanPath = location.pathname;
    for (const [legacy, target] of Object.entries(LEGACY_REDIRECTS)) {
      if (cleanPath.endsWith(legacy)) {
        // Si el query/search trae ?legacy=keep, no redirigir (escape hatch).
        if (location.search && /[?&]legacy=keep\b/.test(location.search)) break;
        location.replace(base + target);
        return;
      }
    }
  }

  const u = (p) => base + p.replace(/^\/+/, '');

  /* ─── Escena de fondo (DOMINANTE: torre + cables + transformador) ── */
  function injectScene() {
    if (document.querySelector('.aqua-scene')) return;
    const frag = document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="aqua-scene" aria-hidden="true"></div>
      <div class="aqua-orb aqua-orb--blue" aria-hidden="true"></div>
      <div class="aqua-orb aqua-orb--cyan" aria-hidden="true"></div>
      <div class="aqua-orb aqua-orb--teal" aria-hidden="true"></div>
      <div class="aqua-power-scene" aria-hidden="true" style="background-image:url(${u('assets/img/aqua/substation-photo.png')})"></div>
      <div class="aqua-particles" id="aquaParticles" aria-hidden="true"></div>`;
    while (wrap.firstChild) frag.appendChild(wrap.firstChild);
    document.body.insertBefore(frag, document.body.firstChild);
  }

  /* ─── Topbar ────────────────────────────────────────────── */
  function injectTopbar() {
    if (document.querySelector('header.tb')) return;
    const tb = document.createElement('header');
    tb.className = 'tb';
    tb.innerHTML = `
      <a href="${u('home.html')}" class="tb-brand">
        <span class="logo"><i data-lucide="zap"></i></span>
        SGM · <span class="b">TRANSPOWER</span>
      </a>
      <div class="tb-search">
        <i data-lucide="search"></i>
        <input type="search" id="tbSearch" placeholder="Buscar transformador, OT, subestación…" aria-label="Buscar"/>
        <kbd>⌘K</kbd>
      </div>
      <div class="tb-right">
        <span class="tb-role" id="tbRole" hidden></span>
        <button class="btn btn--ghost btn--icon" type="button" title="Notificaciones" aria-label="Notificaciones"><i data-lucide="bell"></i></button>
        <div class="tb-avatar" id="tbAvatar" title="Perfil">··</div>
        <button class="btn btn--ghost btn--icon" type="button" id="tbLogout" title="Cerrar sesión" aria-label="Cerrar sesión"><i data-lucide="log-out"></i></button>
      </div>`;
    document.body.insertBefore(tb, document.body.firstChild);
  }

  /* ─── Sidebar ───────────────────────────────────────────── */
  function injectSidebar() {
    if (document.querySelector('aside.sb')) return;
    const sb = document.createElement('aside');
    sb.className = 'sb';
    sb.innerHTML = `
      <a href="${u('home.html')}" class="sb-brand-head" aria-label="Inicio · SGM TRANSPOWER" style="text-decoration:none">
        <span class="logo"><i data-lucide="zap"></i></span>
        <div>
          <div class="title">SGM · <em>TRANSPOWER</em></div>
          <div class="sub">Liquid Glass</div>
        </div>
      </a>
      <div class="sb-group">
        <div class="sb-group-title">Operación</div>
        <a href="${u('home.html')}" class="sb-item" data-key="home"><span class="i"><i data-lucide="layout-dashboard"></i></span>Inicio</a>
        <a href="${u('pages/activos.html')}" class="sb-item" data-key="activos"><span class="i"><i data-lucide="database"></i></span>Activos</a>
        <a href="${u('pages/ordenes.html')}" class="sb-item" data-key="ordenes"><span class="i"><i data-lucide="clipboard-list"></i></span>Órdenes</a>
        <a href="${u('pages/suministros.html')}" class="sb-item" data-key="suministros"><span class="i"><i data-lucide="package"></i></span>Suministros</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Análisis</div>
        <a href="${u('pages/analisis.html')}" class="sb-item" data-key="analisis"><span class="i"><i data-lucide="bar-chart-3"></i></span>Análisis e Indicadores</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Salud del activo</div>
        <a href="${u('pages/salud.html')}" class="sb-item" data-key="salud"><span class="i"><i data-lucide="heart-pulse"></i></span>Salud del Activo</a>
      </div>
      <div class="sb-group sb-admin-group" hidden>
        <div class="sb-group-title">Administración</div>
        <a href="${u('admin/administracion.html')}" class="sb-item sb-admin" data-key="administracion"><span class="i"><i data-lucide="settings"></i></span>Administración</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Recursos</div>
        <a href="${u('pages/recursos.html')}" class="sb-item" data-key="recursos"><span class="i"><i data-lucide="folder-open"></i></span>Recursos</a>
      </div>`;

    const main = document.querySelector('main.app-main') || document.querySelector('main');
    if (main && main.parentNode) main.parentNode.insertBefore(sb, main);
    else document.body.insertBefore(sb, document.body.firstChild);
  }

  /* ─── Active state según URL ────────────────────────────── */
  function markActive() {
    const fileNow = (path.split('/').pop() || 'home.html').replace(/\?.*$/, '');
    const folderNow = path.includes('/admin/') ? 'admin' : (path.includes('/pages/') ? 'pages' : '');
    document.querySelectorAll('.sb-item').forEach((a) => {
      try {
        const href = a.getAttribute('href') || '';
        const last = href.split('/').pop() || '';
        const folder = href.includes('admin/') ? 'admin' : (href.includes('pages/') ? 'pages' : '');
        if (last === fileNow && folder === folderNow) a.classList.add('is-active');
      } catch (_) {}
    });
  }

  /* ─── Sesión + roles ───────────────────────────────────── */
  function applySession(sess) {
    if (!sess) return;
    const profile = sess.profile || {};
    const role = sess.role || profile.rol || 'tecnico';
    const name = profile.nombre || sess.user?.email || '··';
    const initials = (name || '').split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '··';
    const av = document.getElementById('tbAvatar');
    if (av) { av.textContent = initials; av.title = name; }
    const rch = document.getElementById('tbRole');
    if (rch) {
      rch.hidden = false;
      rch.textContent = role === 'admin' ? 'ADMIN' : role.toUpperCase().slice(0, 8);
    }
    if (role === 'admin') {
      document.querySelectorAll('.sb-admin-group').forEach((el) => el.hidden = false);
    } else {
      document.querySelectorAll('.sb-admin').forEach((el) => el.style.display = 'none');
    }
  }

  /* ─── Logout ───────────────────────────────────────────── */
  async function bindLogout() {
    const btn = document.getElementById('tbLogout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        const mod = await import(u('assets/js/admin/admin-auth.js'));
        if (mod && mod.logoutAdmin) await mod.logoutAdmin();
      } catch (_) {
        try {
          const fb = await import(u('assets/js/firebase-init.js'));
          const { signOut } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
          const auth = fb.getAuthSafe?.();
          if (auth) await signOut(auth);
        } catch (_) {}
      }
      location.replace(u('index.html'));
    });
  }

  /* ─── ⌘K shortcut ──────────────────────────────────────── */
  function bindKeys() {
    const search = document.getElementById('tbSearch');
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === search) {
        search.blur(); search.value = '';
      }
    });
  }

  /* ─── Init ─────────────────────────────────────────────── */
  function init() {
    if (!document.body.classList.contains('aqua')) return;
    injectScene();
    injectTopbar();
    injectSidebar();
    markActive();
    bindLogout();
    bindKeys();

    // Re-render iconos Lucide (puede estar disponible vía CDN cargado en defer)
    const tryIcons = () => {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        try { window.lucide.createIcons(); } catch (_) {}
      } else { setTimeout(tryIcons, 80); }
    };
    tryIcons();

    // Aqua interactions (particles + glint + scroll + reveal)
    if (window.Aqua && typeof window.Aqua.init === 'function') {
      window.Aqua.init();
    }

    // Sesión
    if (window.__sgmSession) applySession(window.__sgmSession);
    window.addEventListener('sgm:session-ready', (ev) => applySession(ev.detail));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
