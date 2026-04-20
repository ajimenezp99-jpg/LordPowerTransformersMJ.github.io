// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Inventario público (Fase 6)
// Vista de solo lectura + KPIs + filtros + búsqueda local.
// ══════════════════════════════════════════════════════════════

import {
  listar, ESTADOS, DEPARTAMENTOS,
  estadoLabel, departamentoLabel, isReady
} from './data/transformadores.js';

const $ = (id) => document.getElementById(id);

const tbody    = $('tbody');
const info     = $('infoBox');
const fDept    = $('fDept');
const fEstado  = $('fEstado');
const fSearch  = $('fSearch');
const counter  = $('counter');

let dataset = [];

// ── Poblar selects ──
for (const d of DEPARTAMENTOS) {
  fDept.insertAdjacentHTML('beforeend', `<option value="${d.value}">${d.label}</option>`);
}
for (const e of ESTADOS) {
  fEstado.insertAdjacentHTML('beforeend', `<option value="${e.value}">${e.label}</option>`);
}

function showInfo(msg, kind) {
  if (!msg) { info.style.display = 'none'; return; }
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = 'block';
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function fmtPot(t) { return (t.potencia_kva != null) ? `${t.potencia_kva} kVA` : '—'; }
function fmtTen(t) {
  if (t.tension_primaria_kv == null && t.tension_secundaria_kv == null) return '—';
  return `${t.tension_primaria_kv ?? '—'} / ${t.tension_secundaria_kv ?? '—'} kV`;
}

function bucketColor(b) {
  switch (b) {
    case 'muy_bueno': return '#1B8E3F';
    case 'bueno':     return '#4CB050';
    case 'medio':     return '#F5C518';
    case 'pobre':     return '#EF7820';
    case 'muy_pobre': return '#E53935';
    default:          return 'rgba(255,255,255,.1)';
  }
}

function render(rows) {
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Sin transformadores que coincidan con los filtros.</td></tr>';
    counter.textContent = '0 registros';
    return;
  }
  tbody.innerHTML = rows.map((t) => {
    const id    = t.identificacion || {};
    const ub    = t.ubicacion || {};
    const salud = t.salud_actual || {};
    const tipo  = id.tipo_activo || 'POTENCIA';
    const zona  = ub.zona || '—';
    const hi    = salud.hi_final;
    const bucket = salud.bucket || '';
    return `
    <tr>
      <td><code>${escHtml(t.codigo)}</code></td>
      <td><small style="opacity:.7">${escHtml(tipo)}</small></td>
      <td>${escHtml(t.nombre)}<br><small style="opacity:.6">${escHtml(t.subestacion || '')}</small></td>
      <td>${escHtml(zona)}<br><small style="opacity:.6">${escHtml(departamentoLabel(t.departamento))}</small></td>
      <td>${fmtPot(t)}<br><small style="opacity:.6">${fmtTen(t)}</small></td>
      <td><span class="estado-pill ${escHtml(t.estado)}">${escHtml(estadoLabel(t.estado))}</span></td>
      <td>${hi != null
        ? `<strong style="color:${bucketColor(bucket)}">${hi.toFixed(2)}</strong><br><small style="opacity:.7">${escHtml(bucket || '—')}</small>`
        : '—'}</td>
    </tr>`;
  }).join('');
  counter.textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'}`;
}

function updateKpis(items) {
  const acc = { total: items.length, operativo: 0, mantenimiento: 0, fuera_servicio: 0 };
  for (const t of items) { if (acc[t.estado] != null) acc[t.estado] += 1; }
  $('kTotal').textContent = acc.total;
  $('kOp').textContent    = acc.operativo;
  $('kMan').textContent   = acc.mantenimiento;
  $('kFs').textContent    = acc.fuera_servicio;
}

function applyLocalFilter() {
  const q = (fSearch.value || '').trim().toLowerCase();
  if (!q) return render(dataset);
  const filtered = dataset.filter((t) =>
    (t.codigo || '').toLowerCase().includes(q) ||
    (t.nombre || '').toLowerCase().includes(q) ||
    (t.subestacion || '').toLowerCase().includes(q) ||
    (t.municipio || '').toLowerCase().includes(q)
  );
  render(filtered);
}

async function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase aún no configurado — inventario no disponible.', 'err');
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Inventario no disponible.</td></tr>';
    counter.textContent = '—';
    $('kTotal').textContent = '—';
    $('kOp').textContent = '—';
    $('kMan').textContent = '—';
    $('kFs').textContent = '—';
    return;
  }
  try {
    showInfo('');
    dataset = await listar({
      departamento: fDept.value || undefined,
      estado:       fEstado.value || undefined
    });
    updateKpis(dataset);
    applyLocalFilter();
  } catch (err) {
    console.error(err);
    showInfo('Error al cargar inventario: ' + (err.message || err), 'err');
  }
}

// ── Eventos ──
fDept.addEventListener('change', cargar);
fEstado.addEventListener('change', cargar);
fSearch.addEventListener('input', applyLocalFilter);

// Logout unificado (Fase 14)
import('./auth/session-guard.js').then((m) => {
  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', () => m.logout());
});
$('yr').textContent = new Date().getFullYear();

cargar();
