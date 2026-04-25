// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Histórico de Movimientos (Fase 46)
// Tabla con filtros + acción Ver (modal detalle) + Eliminar con
// justificación obligatoria + Export CSV.
// ══════════════════════════════════════════════════════════════

import {
  obtener, eliminar, suscribir, isReady
} from '../data/movimientos.js';
import { suscribir as suscribirSuministros } from '../data/suministros.js';

const $ = (id) => document.getElementById(id);
const tbody       = $('tbody');
const info        = $('infoBox');
const counter     = $('counter');
const modal       = $('modal');
const modalBody   = $('modalBody');
const fBusqueda   = $('fBusqueda');
const fAnio       = $('fAnio');
const fTipo       = $('fTipo');
const fZona       = $('fZona');
const fSum        = $('fSum');
const btnExportCsv = $('btnExportCsv');

let cacheMovs = [];
let cacheSums = [];
let unsubMovs = null;
let unsubSums = null;

function showInfo(msg, kind) {
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = msg ? 'block' : 'none';
}
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function fmtCOP(v) {
  if (v == null || isNaN(+v) || +v === 0) return '—';
  return '$' + Math.round(+v).toLocaleString('es-CO');
}
function fmtFecha(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function rebuildAnioFilter() {
  const aniosDisponibles = new Set(cacheMovs.map((m) => m.anio).filter(Boolean));
  const yearActual = new Date().getFullYear();
  for (let y = yearActual - 3; y <= yearActual + 1; y++) aniosDisponibles.add(y);
  const sorted = [...aniosDisponibles].sort((a, b) => b - a);
  const prev = fAnio.value;
  fAnio.innerHTML = '<option value="">Todos los años</option>' +
    sorted.map((y) => `<option value="${y}">${y}</option>`).join('');
  if (prev) fAnio.value = prev;
}
function rebuildSumFilter() {
  const prev = fSum.value;
  fSum.innerHTML = '<option value="">Todos los suministros</option>' +
    cacheSums.map((s) => `<option value="${escHtml(s.codigo)}">${escHtml(s.codigo + ' · ' + s.nombre)}</option>`).join('');
  if (prev) fSum.value = prev;
}

function aplicarFiltros() {
  const q = fBusqueda.value.trim().toLowerCase();
  const a = fAnio.value;
  const t = fTipo.value;
  const z = fZona.value;
  const s = fSum.value;
  return cacheMovs.filter((m) => {
    if (a && String(m.anio) !== a) return false;
    if (t && m.tipo !== t) return false;
    if (z && m.zona !== z) return false;
    if (s && m.suministro_id !== s) return false;
    if (q) {
      const blob = `${m.codigo} ${m.suministro_id} ${m.suministro_nombre || ''} ${m.matricula || ''} ${m.subestacion || ''} ${m.odt || ''} ${m.usuario || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  const rows = aplicarFiltros();
  counter.textContent = `Listado · ${rows.length} de ${cacheMovs.length} movimientos`;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="td-empty">${
      cacheMovs.length === 0
        ? 'Sin movimientos registrados. Use el formulario de Movimiento para crear el primero.'
        : 'Sin coincidencias para los filtros.'
    }</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((m) => `
    <tr data-id="${escHtml(m.id)}">
      <td><code>${escHtml(m.codigo)}</code></td>
      <td>${escHtml(m.anio || '—')}<br><small><span class="estado-pill ${m.tipo === 'INGRESO' ? 'tipo-ingreso-pill' : 'tipo-egreso-pill'}">${escHtml(m.tipo || '—')}</span></small></td>
      <td><code>${escHtml(m.suministro_id)}</code><br><small style="opacity:.7">${escHtml(m.suministro_nombre || '')}</small></td>
      <td>${escHtml(m.marca || '—')}</td>
      <td>${escHtml(m.matricula || '—')}<br><small style="opacity:.7">${escHtml(m.subestacion || '')}</small></td>
      <td>${escHtml(m.zona || '—')}</td>
      <td style="text-align:right; font-family: var(--font-mono); font-weight: 600;">${escHtml(m.cantidad ?? '—')}</td>
      <td style="text-align:right; font-family: var(--font-mono);">${fmtCOP(m.valor_total)}</td>
      <td><small>${escHtml(m.odt || '—')}</small></td>
      <td><small>${escHtml(m.usuario || '—')}</small></td>
      <td class="col-actions">
        <button class="row-btn" data-act="ver" data-id="${escHtml(m.id)}" title="Ver detalle" aria-label="Ver"><i data-lucide="eye"></i></button>
        <button class="row-btn danger" data-act="del" data-id="${escHtml(m.id)}" title="Eliminar" aria-label="Eliminar"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>
  `).join('');
  window.sgmRefreshIcons?.();
}

// ── Modal detalle ──
function abrirDetalle(m) {
  modalBody.innerHTML = `
    <div class="mov-detalle-grid">
      <div><strong>Código:</strong> <code>${escHtml(m.codigo)}</code></div>
      <div><strong>Año / Tipo:</strong> ${escHtml(m.anio)} · ${escHtml(m.tipo)}</div>
      <div><strong>Suministro:</strong> ${escHtml(m.suministro_id)} · ${escHtml(m.suministro_nombre || '—')}</div>
      <div><strong>Marca:</strong> ${escHtml(m.marca || '—')}</div>
      <div><strong>Cantidad:</strong> ${escHtml(m.cantidad)}</div>
      <div><strong>Valor unit.:</strong> ${fmtCOP(m.valor_unitario)}</div>
      <div><strong>Valor total:</strong> ${fmtCOP(m.valor_total)}</div>
      <div><strong>Matrícula:</strong> ${escHtml(m.matricula || '—')}</div>
      <div><strong>Subestación:</strong> ${escHtml(m.subestacion || '—')}</div>
      <div><strong>Zona / Depto:</strong> ${escHtml(m.zona || '—')} · ${escHtml(m.departamento || '—')}</div>
      <div><strong>ODT:</strong> ${escHtml(m.odt || '—')}</div>
      <div><strong>Usuario:</strong> ${escHtml(m.usuario || '—')}</div>
      <div style="grid-column: 1 / -1;"><strong>Observaciones:</strong> ${escHtml(m.observaciones || '—')}</div>
      <div style="grid-column: 1 / -1; padding-top: 8px; border-top: 1px solid rgba(0,40,90,.1); font-size:11px; color: var(--ink-3);">
        Creado: ${fmtFecha(m.createdAt)} · uid: <code>${escHtml(m.createdBy || '—')}</code>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}
function cerrarModal() { modal.style.display = 'none'; }

// ── Eventos ──
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (act === 'ver') {
    try {
      const m = await obtener(id);
      if (!m) return showInfo('Movimiento no encontrado.', 'err');
      abrirDetalle(m);
    } catch (err) { showInfo('Error: ' + err.message, 'err'); }
    return;
  }
  if (act === 'del') {
    const m = await obtener(id);
    if (!m) return showInfo('Movimiento no encontrado.', 'err');
    const justificacion = prompt(
      `Eliminar el movimiento ${m.codigo} (${m.tipo} ${m.cantidad} × ${m.suministro_id}).\n\n` +
      `JUSTIFICACIÓN OBLIGATORIA (queda en /auditoria):`
    );
    if (!justificacion || !justificacion.trim()) {
      showInfo('Eliminación cancelada (justificación obligatoria).', 'err');
      return;
    }
    try {
      const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
      await eliminar(id, { uid, prev: m, justificacion: justificacion.trim() });
      showInfo(`✓ Movimiento ${m.codigo} eliminado.`, 'ok');
    } catch (err) { showInfo('Error al eliminar: ' + err.message, 'err'); }
  }
});

$('modalClose').addEventListener('click', cerrarModal);
$('btnCloseDetalle').addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

[fBusqueda, fAnio, fTipo, fZona, fSum].forEach((el) => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});

// ── Export CSV ──
btnExportCsv.addEventListener('click', () => {
  const rows = aplicarFiltros();
  if (rows.length === 0) { showInfo('No hay filas para exportar con los filtros actuales.', 'err'); return; }
  const headers = ['codigo','anio','tipo','suministro_id','suministro_nombre','marca',
                   'matricula','subestacion','zona','departamento','cantidad',
                   'valor_unitario','valor_total','odt','usuario','observaciones'];
  const escCsv = (v) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escCsv(r[h])).join(','))
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sgm-movimientos-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showInfo(`✓ Exportadas ${rows.length} filas a CSV.`, 'ok');
});

// ── Suscripciones ──
function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    return;
  }
  if (unsubMovs) try { unsubMovs(); } catch (_) {}
  if (unsubSums) try { unsubSums(); } catch (_) {}
  unsubSums = suscribirSuministros({}, (rows) => {
    cacheSums = rows; rebuildSumFilter();
  }, (err) => console.warn('[sums]', err));
  unsubMovs = suscribir({}, (rows) => {
    cacheMovs = rows;
    rebuildAnioFilter();
    render();
  }, (err) => {
    console.error(err);
    showInfo('Error realtime: ' + (err.message || err), 'err');
  });
}

window.addEventListener('beforeunload', () => {
  if (unsubMovs) try { unsubMovs(); } catch (_) {}
  if (unsubSums) try { unsubSums(); } catch (_) {}
});

// ── Init ──
arrancar();
