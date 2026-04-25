// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Catálogo Suministros (Fase 43)
// CRUD + suscripción realtime sobre /suministros.
// ══════════════════════════════════════════════════════════════

import {
  obtener, crear, actualizar, eliminar, suscribir,
  UNIDADES, unidadLabel, isReady
} from '../data/suministros.js';
import { listar as listarMovimientos } from '../data/movimientos.js';
import {
  listar as listarMarcas,
  crear as crearMarca,
  eliminar as eliminarMarca
} from '../data/marcas.js';

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
const marcasChipsEdit = $('marcasChipsEdit');
const marcasInputRow  = $('marcasInputRow');
const fNuevaMarca = $('fNuevaMarca');
const btnAddMarca = $('btnAddMarca');
const formMsg     = $('formMsg');
const btnSave     = $('btnSave');
const fUnidadFilter = $('fUnidad');
const fBusqueda   = $('fBusqueda');

// ── Estado local (alimentado por suscripción realtime) ──
let cacheRows = [];
let unsub = null;
// Marcas del suministro en edición. Cada item: {id, marca}.
let marcasEnEdicion = [];
let suministroEnEdicion = null;

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
  // Sección de marcas inline solo en edición (necesita codigo conocido).
  marcasInputRow.hidden = !editing;
  modal.style.display = 'flex';
  setTimeout(() => (editing ? fNombre : fCodigo).focus(), 50);
}
function closeModal() {
  modal.style.display = 'none';
  form.reset();
  fId.value = '';
  fCodigo.disabled = false;
  marcasInputRow.hidden = true;
  marcasChipsEdit.innerHTML = '<small style="opacity:.6">Disponible solo en edición.</small>';
  marcasEnEdicion = [];
  suministroEnEdicion = null;
}

function renderMarcasChipsEdit() {
  if (!suministroEnEdicion) {
    marcasChipsEdit.innerHTML = '<small style="opacity:.6">Disponible solo en edición.</small>';
    return;
  }
  if (marcasEnEdicion.length === 0) {
    marcasChipsEdit.innerHTML = '<small style="opacity:.6">Sin marcas todavía. Agregue una con el campo de abajo.</small>';
    return;
  }
  marcasChipsEdit.innerHTML = marcasEnEdicion.map((m) =>
    `<span class="marca-chip-edit">${escHtml(m.marca)}<button type="button" class="marca-x" data-marca-id="${escHtml(m.id)}" aria-label="Quitar ${escHtml(m.marca)}">&times;</button></span>`
  ).join(' ');
  window.sgmRefreshIcons?.();
}

async function cargarMarcasDe(suministroId) {
  try {
    const list = await listarMarcas({ suministro_id: suministroId });
    marcasEnEdicion = list.map((m) => ({ id: m.id, marca: m.marca }));
  } catch (err) {
    console.warn('No se pudieron cargar marcas:', err);
    marcasEnEdicion = [];
  }
  renderMarcasChipsEdit();
}

function fillForm(s) {
  fId.value     = s.id || '';
  fCodigo.value = s.codigo || '';
  fNombre.value = s.nombre || '';
  fUnidadMain.value = s.unidad || 'Und';
  fStockInicial.value = s.stock_inicial ?? 0;
  fValorUnitario.value = s.valor_unitario ?? 0;
  fObs.value    = s.observaciones || '';
  suministroEnEdicion = s;
  // Mostrar las marcas del array como provisional, mientras la query realtime trae las reales.
  const arr = Array.isArray(s.marcas_disponibles) ? s.marcas_disponibles : [];
  marcasEnEdicion = arr.map((mk) => ({ id: null, marca: mk }));
  renderMarcasChipsEdit();
  cargarMarcasDe(s.codigo);
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

// ── Marcas inline (agregar / quitar) ──
btnAddMarca.addEventListener('click', async () => {
  if (!suministroEnEdicion) return;
  const marcaTxt = fNuevaMarca.value.trim().toUpperCase();
  if (!marcaTxt) return;
  // Duplicado check en cliente.
  if (marcasEnEdicion.some((m) => m.marca === marcaTxt)) {
    formMsg.className = 'msg err';
    formMsg.textContent = `✗ La marca "${marcaTxt}" ya está asignada.`;
    return;
  }
  const orig = btnAddMarca.textContent;
  btnAddMarca.disabled = true;
  btnAddMarca.textContent = 'Guardando…';
  try {
    const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
    const docId = await crearMarca({
      suministro_id:     suministroEnEdicion.codigo,
      suministro_nombre: suministroEnEdicion.nombre,
      marca:             marcaTxt,
      observaciones:     ''
    }, uid);
    marcasEnEdicion.push({ id: docId, marca: marcaTxt });
    renderMarcasChipsEdit();
    fNuevaMarca.value = '';
    formMsg.className = 'msg ok';
    formMsg.textContent = `✓ Marca "${marcaTxt}" añadida.`;
  } catch (err) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ ' + (err.message || err);
  } finally {
    btnAddMarca.disabled = false;
    btnAddMarca.textContent = orig;
  }
});

fNuevaMarca.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); btnAddMarca.click(); }
});

marcasChipsEdit.addEventListener('click', async (e) => {
  const btn = e.target.closest('.marca-x');
  if (!btn) return;
  const marcaId = btn.dataset.marcaId;
  if (!marcaId || marcaId === 'null') {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ Esta marca aún no está sincronizada en /marcas. Cierre el modal y vuelva a abrir.';
    return;
  }
  const m = marcasEnEdicion.find((x) => x.id === marcaId);
  if (!m) return;
  if (!confirm(`¿Quitar la marca "${m.marca}" de ${suministroEnEdicion.codigo}?`)) return;
  try {
    const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
    await eliminarMarca(marcaId, { uid });
    marcasEnEdicion = marcasEnEdicion.filter((x) => x.id !== marcaId);
    renderMarcasChipsEdit();
    formMsg.className = 'msg ok';
    formMsg.textContent = `✓ Marca "${m.marca}" eliminada.`;
  } catch (err) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ ' + (err.message || err);
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
