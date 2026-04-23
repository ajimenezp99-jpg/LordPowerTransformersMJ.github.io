// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes públicas (Fase 7)
// Vista de solo lectura + KPIs + filtros + búsqueda local.
// ══════════════════════════════════════════════════════════════

import {
  suscribir, ESTADOS_ORDEN, TIPOS_ORDEN, PRIORIDADES,
  estadoOrdenLabel, tipoLabel, prioridadLabel, isReady
} from './data/ordenes.js';

const $ = (id) => document.getElementById(id);

const tbody     = $('tbody');
const info      = $('infoBox');
const fEstado   = $('fEstado');
const fTipo     = $('fTipo');
const fPrioridad = $('fPrioridad');
const fSearch   = $('fSearch');
const counter   = $('counter');

let dataset = [];

// ── Poblar selects ──
for (const e of ESTADOS_ORDEN) {
  fEstado.insertAdjacentHTML('beforeend', `<option value="${e.value}">${e.label}</option>`);
}
for (const t of TIPOS_ORDEN) {
  fTipo.insertAdjacentHTML('beforeend', `<option value="${t.value}">${t.label}</option>`);
}
for (const p of PRIORIDADES) {
  fPrioridad.insertAdjacentHTML('beforeend', `<option value="${p.value}">${p.label}</option>`);
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

function render(rows) {
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="td-empty">Sin órdenes que coincidan con los filtros.</td></tr>';
    counter.textContent = '0 registros';
    return;
  }
  tbody.innerHTML = rows.map((o) => `
    <tr>
      <td><code>${escHtml(o.codigo)}</code></td>
      <td>${escHtml(o.titulo)}<br><small style="opacity:.6">${escHtml(o.transformadorCodigo || '—')}</small></td>
      <td><span class="tipo-pill ${escHtml(o.tipo)}">${escHtml(tipoLabel(o.tipo))}</span></td>
      <td><span class="prioridad-pill ${escHtml(o.prioridad)}">${escHtml(prioridadLabel(o.prioridad))}</span></td>
      <td>${escHtml(o.macroactividad_codigo || '—')}</td>
      <td>${escHtml(o.contrato_codigo || '—')}</td>
      <td>${escHtml(o.fecha_programada || '—')}</td>
      <td>${escHtml(o.tecnico || '—')}${o.aliado_ejecutor ? `<br><small style="opacity:.6">${escHtml(o.aliado_ejecutor)}</small>` : ''}</td>
      <td><span class="estado-pill ${escHtml(o.estado)}">${escHtml(estadoOrdenLabel(o.estado_v2 || o.estado))}</span></td>
    </tr>
  `).join('');
  counter.textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'}`;
}

function updateKpis(items) {
  const acc = { total: items.length, planificada: 0, en_curso: 0, cerrada: 0, cancelada: 0 };
  for (const o of items) { if (acc[o.estado] != null) acc[o.estado] += 1; }
  $('kTotal').textContent = acc.total;
  $('kPlan').textContent  = acc.planificada;
  $('kCurso').textContent = acc.en_curso;
  $('kCerr').textContent  = acc.cerrada;
}

function applyLocalFilter() {
  const q = (fSearch.value || '').trim().toLowerCase();
  if (!q) return render(dataset);
  const filtered = dataset.filter((o) =>
    (o.codigo || '').toLowerCase().includes(q) ||
    (o.titulo || '').toLowerCase().includes(q) ||
    (o.transformadorCodigo || '').toLowerCase().includes(q) ||
    (o.tecnico || '').toLowerCase().includes(q)
  );
  render(filtered);
}

let unsubscribe = null;

function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase aún no configurado — órdenes no disponibles.', 'err');
    tbody.innerHTML = '<tr><td colspan="9" class="td-empty">Órdenes no disponibles.</td></tr>';
    counter.textContent = '—';
    $('kTotal').textContent = '—';
    $('kPlan').textContent  = '—';
    $('kCurso').textContent = '—';
    $('kCerr').textContent  = '—';
    return;
  }
  if (unsubscribe) { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
  showInfo('');
  unsubscribe = suscribir(
    {
      estado:    fEstado.value    || undefined,
      tipo:      fTipo.value      || undefined,
      prioridad: fPrioridad.value || undefined
    },
    (items) => {
      dataset = items;
      updateKpis(dataset);
      applyLocalFilter();
    },
    (err) => {
      console.error(err);
      showInfo('Error al cargar órdenes: ' + (err.message || err), 'err');
    }
  );
}

// ── Eventos ──
fEstado.addEventListener('change', cargar);
fTipo.addEventListener('change', cargar);
fPrioridad.addEventListener('change', cargar);
fSearch.addEventListener('input', applyLocalFilter);
window.addEventListener('beforeunload', () => {
  if (unsubscribe) { try { unsubscribe(); } catch (_) {} }
});

// Logout unificado (Fase 14)
import('./auth/session-guard.js').then((m) => {
  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', () => m.logout());
});
if($('yr'))$('yr').textContent = new Date().getFullYear();

cargar();
