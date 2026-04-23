// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · KPIs (Fase 8)
// Mismo dashboard que la vista pública + export CSV de órdenes.
// ══════════════════════════════════════════════════════════════

import { loadDashboard } from '../kpis-render.js';
import { exportarOrdenesCSV } from '../data/kpis.js';
import { logoutAdmin, ADMIN_ROUTES } from './admin-auth.js';

const $ = (id) => document.getElementById(id);

$('btnLogout')?.addEventListener('click', async () => {
  try { await logoutAdmin(); } catch (_) {}
  location.replace(ADMIN_ROUTES.login);
});
if($('yr'))$('yr').textContent = new Date().getFullYear();
$('btnReload').addEventListener('click', () => loadDashboard());

$('btnExport').addEventListener('click', async () => {
  const btn = $('btnExport');
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'GENERANDO…';
  try {
    const csv = await exportarOrdenesCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `sgm-ordenes-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Error al exportar: ' + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
});

loadDashboard();
