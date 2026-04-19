// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — KPIs públicos (Fase 8)
// Inicializa el dashboard desde el renderer compartido.
// ══════════════════════════════════════════════════════════════

import { loadDashboard } from './kpis-render.js';

const $ = (id) => document.getElementById(id);

$('btnLogout').addEventListener('click', () => {
  try { sessionStorage.removeItem('sgm.access'); } catch (_) {}
  location.href = '../index.html';
});
$('yr').textContent = new Date().getFullYear();

$('btnReload').addEventListener('click', () => loadDashboard());
loadDashboard();
