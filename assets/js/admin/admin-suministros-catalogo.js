// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Catálogo Suministros (Fase 43)
// CRUD + suscripción realtime sobre /suministros.
// ══════════════════════════════════════════════════════════════

import {
  obtener, crear, actualizar, eliminar, suscribir,
  UNIDADES, unidadLabel, isReady
} from '../data/suministros.js';
import { listar as listarMovimientos } from '../data/movimientos.js';

// ── Elementos ──
const $ = (id) => document.getElementById(id);
const tbody       = $('tbody');
const info        = $('infoBox');
const modal       = $('modal');
const modalTitle  = $('modalTitle');
const form        = $('form');
const fId         = $('fId');
const fCodigo     = $('fCodigo');
const fNombre     = $('fNombre');
const fUnidadMain = $('fUnidadMain');
const fStockInicial = $('fStockInicial');
const fValorUnitario = $('fValorUnitario');
const fObs        = $('fObs');
const marcasChips = $('marcasChips');
const formMsg     = $('formMsg');
const btnSave     = $('btnSave');
const fUnidadFilter = $('fUnidad');
const fBusqueda   = $('fBusqueda');

// ── Estado local (alimentado por suscripción realtime) ──
let cacheRows = [];
let unsub = null;

// ── Poblar selects ──
function fillSelects() {
  for (const u of UNIDADES) {
    fUnidadFilter.insertAdjacentHTML('beforeend', `<option value="${u.value}">${u.label} (${u.value})</option>`);
    fUnidadMain  .insertAdjacentHTML('beforeend', `<option value="${u.value}">${u.label} (${u.value})</option>`);
  }
}

// ── UI helpers ──
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
  if (v == null || isNaN(+v)) return '—';
  if (+v === 0) return '—';
  return '$' + Math.round(+v).toLocaleString('es-CO');
}
function fmtInt(v) {
  if (v == null || isNaN(+v)) return '—';
  return Number(v).toLocaleString('es-CO');
}

function aplicarFiltros(rows) {
  const u = fUnidadFilter.value;
  const q = fBusqueda.value.trim().toLowerCase();
  return rows.filter((r) => {
    if (u && r.unidad !== u) return false;
    if (q) {
      const blob = (r.codigo + ' ' + r.nombre).toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  const rows = aplicarFiltros(cacheRows);
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="td-empty">${
      cacheRows.length === 0 ? 'Sin suministros registrados. Sembrar desde Importar Suministros.' : 'Sin coincidencias para los filtros.'
    }</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((s) => {
    const marcas = Array.isArray(s.marcas_disponibles) ? s.marcas_disponibles : [];
    const chips = marcas.length === 0
      ? '<small style="opacity:.5">—</small>'
      : marcas.map((m) => `<span class="marca-chip">${escHtml(m)}</span>`).join(' ');
    return `
    <tr data-id="${escHtml(s.id)}">
      <td><code>${escHtml(s.codigo)}</code></td>
      <td>${escHtml(s.nombre)}</td>
      <td><span class="unidad-pill">${escHtml(s.unidad || 'Und')}</span></td>
      <td style="text-align:right">${fmtInt(s.stock_inicial)}</td>
      <td style="text-align:right">${fmtCOP(s.valor_unitario)}</td>
      <td>${chips}</td>
      <td class="col-actions">
        <button class="row-btn" data-act="edit" data-id="${escHtml(s.id)}" title="Editar" aria-label="Editar"><i data-lucide="pencil"></i></button>
        <button class="row-btn danger" data-act="del" data-id="${escHtml(s.id)}" title="Eliminar" aria-label="Eliminar"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`;
  }).join('');
  window.sgmRefreshIcons?.();
}

// ── Modal ──
function openModal(editing) {
  modalTitle.textContent = editing ? 'Editar suministro' : 'Nuevo suministro';
  formMsg.className = 'msg';
  formMsg.textContent = '';
  // El código es PK humana inmutable: solo se edita en alta.
  fCodigo.disabled = !!editing;
  modal.style.display = 'flex';
  setTimeout(() => (editing ? fNombre : fCodigo).focus(), 50);
}
function closeModal() {
  modal.style.display = 'none';
  form.reset();
  fId.value = '';
  fCodigo.disabled = false;
  marcasChips.innerHTML = '<small style="opacity:.6">Se gestionan desde el panel de Marcas.</small>';
}
function fillForm(s) {
  fId.value     = s.id || '';
  fCodigo.value = s.codigo || '';
  fNombre.value = s.nombre || '';
  fUnidadMain.value = s.unidad || 'Und';
  fStockInicial.value = s.stock_inicial ?? 0;
  fValorUnitario.value = s.valor_unitario ?? 0;
  fObs.value    = s.observaciones || '';
  const marcas = Array.isArray(s.marcas_disponibles) ? s.marcas_disponibles : [];
  marcasChips.innerHTML = marcas.length === 0
    ? '<small style="opacity:.6">Sin marcas. Gestionar en el panel de Marcas.</small>'
    : marcas.map((m) => `<span class="marca-chip">${escHtml(m)}</span>`).join(' ');
}
function readForm() {
  return {
    codigo:         fCodigo.value.trim().toUpperCase(),
    nombre:         fNombre.value.trim(),
    unidad:         fUnidadMain.value,
    stock_inicial:  +fStockInicial.value || 0,
    valor_unitario: +fValorUnitario.value || 0,
    observaciones:  fObs.value.trim()
  };
}

// ── Suscripción realtime ──
function arrancarSuscripcion() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Sin conexión.</td></tr>';
    return;
  }
  if (unsub) { try { unsub(); } catch (_) {} }
  unsub = suscribir(
    {},
    (rows) => { cacheRows = rows; render(); },
    (err)  => {
      console.error(err);
      showInfo('Error realtime: ' + (err.message || err), 'err');
    }
  );
}

// ── Eventos tabla ──
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id  = btn.dataset.id;
  const act = btn.dataset.act;

  if (act === 'edit') {
    try {
      const s = await obtener(id);
      if (!s) return showInfo('Suministro no encontrado.', 'err');
      fillForm(s);
      openModal(true);
    } catch (err) { showInfo('Error al cargar: ' + err.message, 'err'); }
    return;
  }

  if (act === 'del') {
    const s = await obtener(id);
    if (!s) return showInfo('Suministro no encontrado.', 'err');
    // Bloqueo defensivo: no permitir delete si tiene movimientos.
    try {
      const movs = await listarMovimientos({ suministro_id: s.codigo, limite: 1 });
      if (movs.length > 0) {
        showInfo(`✗ ${s.codigo} tiene movimientos asociados. Elimine o reasigne los movimientos antes de borrar el suministro.`, 'err');
        return;
      }
    } catch (err) {
      // Si no podemos verificar (permisos, etc), pedimos confirmación extra
      console.warn('No se pudo verificar movimientos asociados:', err);
    }
    if (!confirm(`¿Eliminar definitivamente el suministro ${s.codigo} · ${s.nombre}?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
      await eliminar(id, { uid, prev: s });
      showInfo(`✓ ${s.codigo} eliminado.`, 'ok');
    } catch (err) { showInfo('Error al eliminar: ' + err.message, 'err'); }
  }
});

// ── Submit ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.className = 'msg';
  formMsg.textContent = '';
  btnSave.disabled = true;
  const orig = btnSave.textContent;
  btnSave.textContent = 'GUARDANDO…';
  try {
    const data = readForm();
    const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
    if (fId.value) {
      await actualizar(fId.value, data, { uid });
      showInfo(`✓ ${data.codigo} actualizado.`, 'ok');
    } else {
      await crear(data, uid);
      showInfo(`✓ ${data.codigo} creado.`, 'ok');
    }
    closeModal();
    // No hace falta recargar — la suscripción realtime refresca sola.
  } catch (err) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ ' + (err.message || err);
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = orig;
  }
});

// ── Eventos UI ──
$('btnNuevo').addEventListener('click', () => { form.reset(); fId.value = ''; openModal(false); });
$('btnCancel').addEventListener('click', closeModal);
$('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
fUnidadFilter.addEventListener('change', render);
fBusqueda.addEventListener('input', render);

window.addEventListener('beforeunload', () => { if (unsub) try { unsub(); } catch (_) {} });

// ── Init ──
fillSelects();
arrancarSuscripcion();
