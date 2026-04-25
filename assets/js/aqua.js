/* AQUA · Interacciones cliente — v3 light perla
 * - Partículas eléctricas
 * - Glint (cursor → :hover light en .glass--interactive)
 * - Topbar scroll state
 * - Reveal on scroll
 * - Lucide auto-init
 *
 * No depende de Firebase ni de la lógica del producto.
 * Se autoinicializa en DOMContentLoaded.
 */
(function () {
  'use strict';

  const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── Partículas eléctricas ─────────────────────────────── */
  function spawnParticles() {
    const host = document.getElementById('aquaParticles');
    if (!host || !motion) return;
    if (host.dataset.spawned === '1') return;
    const n = Math.min(18, Math.max(8, Math.floor(window.innerWidth / 110)));
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'aqua-particle';
      p.style.left = (Math.random() * 100) + '%';
      p.style.animationDelay = (-Math.random() * 20) + 's';
      p.style.animationDuration = (14 + Math.random() * 14) + 's';
      p.style.opacity = (0.30 + Math.random() * 0.4).toFixed(2);
      host.appendChild(p);
    }
    host.dataset.spawned = '1';
  }

  /* ─── Glint sobre cursor en .glass--interactive ─────────── */
  function bindGlint(root) {
    (root || document).querySelectorAll('.glass--interactive, .qc, .stat, .widget').forEach(el => {
      if (el.dataset.glint === '1') return;
      el.dataset.glint = '1';
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100) + '%');
      });
    });
  }

  /* ─── Topbar — añade .is-scrolled tras scrollY > 12 ─────── */
  function bindTopbarScroll() {
    const tb = document.querySelector('.tb');
    if (!tb) return;
    let ticking = false;
    const update = () => {
      tb.classList.toggle('is-scrolled', window.scrollY > 12);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ─── Reveal on scroll (IntersectionObserver) ───────────── */
  function bindReveal(root) {
    const targets = (root || document).querySelectorAll('.reveal:not(.is-visible)');
    if (!targets.length || !('IntersectionObserver' in window)) {
      targets.forEach(t => t.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(t => io.observe(t));
  }

  /* ─── Lucide icons ──────────────────────────────────────── */
  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (_) {}
    }
  }

  /* ─── API pública ───────────────────────────────────────── */
  const Aqua = {
    init() {
      spawnParticles();
      bindGlint();
      bindTopbarScroll();
      bindReveal();
      renderIcons();
    },
    bindGlint, bindReveal, renderIcons, spawnParticles
  };
  window.Aqua = Aqua;
  window.renderIcons = renderIcons;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Aqua.init());
  } else {
    Aqua.init();
  }
})();
