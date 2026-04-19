// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — KPIs públicos (Fase 8)
// Inicializa el dashboard desde el renderer compartido.
// ══════════════════════════════════════════════════════════════

import { loadDashboard } from './kpis-render.js';

const $ = (id) => document.getElementById(id);

// Logout unificado (Fase 14)
import('./auth/session-guard.js').then((m) => {
  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', () => m.logout());
});
$('yr').textContent = new Date().getFullYear();

$('btnReload').addEventListener('click', () => loadDashboard());
loadDashboard();
