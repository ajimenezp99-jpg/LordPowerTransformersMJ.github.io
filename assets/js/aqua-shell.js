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
  try {
    if (window.self !== window.top) {
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
  const segs = path.replace(/\/+$/, '').split('/').filter(Boolean);
  // El último segmento es el archivo. Los demás son carpetas → tantas "../" como carpetas.
  // Si el path termina en /admin/x.html, segs = [...repo, 'admin', 'x.html'] → 1 carpeta a subir.
  // Para GitHub Pages el repo es root, no hay prefijo de proyecto. Funciona tanto en raíz como subpath.
  let base = '';
  const file = segs[segs.length - 1] || '';
  const isFile = /\.html?$/.test(file);
  const folderDepth = isFile ? Math.max(0, segs.length - 1) : segs.length;
  // Detectar si la página está en /pages/ o /admin/ (subir un nivel) o en raíz (no subir)
  if (path.includes('/pages/') || path.includes('/admin/')) base = '../';
  else base = './';
  // Permitir override explícito
  const explicit = document.documentElement.getAttribute('data-aqua-base');
  if (explicit !== null) base = explicit;

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
        <a href="${u('pages/documentos.html')}" class="sb-item" data-key="documentos"><span class="i"><i data-lucide="folder-open"></i></span>Documentos</a>
        <a href="${u('pages/normativa.html')}" class="sb-item" data-key="normativa"><span class="i"><i data-lucide="scroll-text"></i></span>Normativa</a>
        <a href="${u('pages/cobertura.html')}" class="sb-item" data-key="cobertura"><span class="i"><i data-lucide="globe-2"></i></span>Cobertura</a>
        <a href="${u('pages/about.html')}" class="sb-item" data-key="about"><span class="i"><i data-lucide="info"></i></span>Acerca</a>
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
