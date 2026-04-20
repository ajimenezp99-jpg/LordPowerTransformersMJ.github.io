// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Órdenes de Trabajo (Fase 7)
// Controlador de la tabla + modal CRUD sobre /ordenes con historial.
// ══════════════════════════════════════════════════════════════

import {
  suscribir, obtener, crear, actualizar, eliminar,
  listarHistorial,
  ESTADOS_ORDEN, TIPOS_ORDEN, PRIORIDADES,
  estadoOrdenLabel, tipoLabel, prioridadLabel,
  isReady
} from '../data/ordenes.js';

import {
  listar as listarTransformadores,
  departamentoLabel
} from '../data/transformadores.js';

import { listarMacroactividades, listarCausantes } from '../data/catalogos.js';
import { listar as listarContratos } from '../data/contratos.js';

import { logoutAdmin, ADMIN_ROUTES } from './admin-auth.js';

// ── Elementos ──
const $ = (id) => document.getElementById(id);
const tbody     = $('tbody');
const info      = $('infoBox');
const modal     = $('modal');
const modalTitle = $('modalTitle');
const form      = $('form');
const fId       = $('fId');
const fCodigo   = $('fCodigo');
const fTitulo   = $('fTitulo');
const fDescripcion = $('fDescripcion');
const fTransformador = $('fTransformador');
const fTipoMain = $('fTipoMain');
const fPrioridadMain = $('fPrioridadMain');
const fEstadoMain = $('fEstadoMain');
const fTecnico  = $('fTecnico');
const fFechaProg = $('fFechaProg');
const fFechaIni  = $('fFechaIni');
const fFechaCierre = $('fFechaCierre');
const fDuracion = $('fDuracion');
const fObs      = $('fObs');
// v2 selectores
const fEstadoV2 = $('fEstadoV2');
const fAliado   = $('fAliado');
const fMacro    = $('fMacro');
const fContrato = $('fContrato');
const fCausantes = $('fCausantes');
const formMsg   = $('formMsg');
const btnSave   = $('btnSave');
const histWrap  = $('historialWrap');
const histList  = $('historialList');

const fEstadoFilter    = $('fEstado');
const fTipoFilter      = $('fTipo');
const fPrioridadFilter = $('fPrioridad');

let transformadoresCache = [];

// ── Poblar selects estáticos ──
function fillSelects() {
  for (const e of ESTADOS_ORDEN) {
    fEstadoFilter.insertAdjacentHTML('beforeend', `<option value="${e.value}">${e.label}</option>`);
    fEstadoMain.insertAdjacentHTML('beforeend',   `<option value="${e.value}">${e.label}</option>`);
  }
  for (const t of TIPOS_ORDEN) {
    fTipoFilter.insertAdjacentHTML('beforeend', `<option value="${t.value}">${t.label}</option>`);
    fTipoMain.insertAdjacentHTML('beforeend',   `<option value="${t.value}">${t.label}</option>`);
  }
  for (const p of PRIORIDADES) {
    fPrioridadFilter.insertAdjacentHTML('beforeend', `<option value="${p.value}">${p.label}</option>`);
    fPrioridadMain.insertAdjacentHTML('beforeend',   `<option value="${p.value}">${p.label}</option>`);
  }
}

async function fillTransformadores() {
  try {
    transformadoresCache = await listarTransformadores({});
    fTransformador.innerHTML = '<option value="">— Seleccione —</option>' +
      transformadoresCache.map((t) =>
        `<option value="${t.id}" data-codigo="${escAttr(t.codigo)}">` +
        `${escHtml(t.codigo)} · ${escHtml(t.nombre)} (${escHtml(departamentoLabel(t.departamento))})` +
        `</option>`
      ).join('');
  } catch (err) {
    console.warn('No se pudieron cargar transformadores:', err);
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
function escAttr(s) { return escHtml(s); }

function fmtFecha(s) {
  return s ? s : '—';
}

function render(rows) {
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="td-empty">Sin órdenes registradas.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((o) => `
    <tr data-id="${o.id}">
      <td><code>${escHtml(o.codigo)}</code></td>
      <td>${escHtml(o.titulo)}<br><small style="opacity:.6">${escHtml(o.transformadorCodigo || '—')}</small></td>
      <td><span class="tipo-pill ${escHtml(o.tipo)}">${escHtml(tipoLabel(o.tipo))}</span></td>
      <td><span class="prioridad-pill ${escHtml(o.prioridad)}">${escHtml(prioridadLabel(o.prioridad))}</span></td>
      <td>${fmtFecha(o.fecha_programada)}</td>
      <td>${escHtml(o.tecnico || '—')}</td>
      <td><span class="estado-pill ${escHtml(o.estado)}">${escHtml(estadoOrdenLabel(o.estado))}</span></td>
      <td class="col-actions">
        <button class="row-btn" data-act="edit" data-id="${o.id}">Editar</button>
        <button class="row-btn danger" data-act="del" data-id="${o.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// ── Modal ──
function openModal(editing) {
  modalTitle.textContent = editing ? 'Editar orden' : 'Nueva orden de trabajo';
  formMsg.className = 'msg';
  formMsg.textContent = '';
  modal.style.display = 'flex';
  cargarCatalogos();
  setTimeout(() => fCodigo.focus(), 50);
}
function closeModal() {
  modal.style.display = 'none';
  form.reset();
  fId.value = '';
  histWrap.style.display = 'none';
  histList.innerHTML = '';
}
function fillForm(o) {
  fId.value        = o.id || '';
  fCodigo.value    = o.codigo || '';
  fTitulo.value    = o.titulo || '';
  fDescripcion.value = o.descripcion || '';
  fTransformador.value = o.transformadorId || '';
  fTipoMain.value  = o.tipo || 'preventivo';
  fPrioridadMain.value = o.prioridad || 'media';
  fEstadoMain.value = o.estado || 'planificada';
  fTecnico.value   = o.tecnico || '';
  fFechaProg.value = o.fecha_programada || '';
  fFechaIni.value  = o.fecha_inicio || '';
  fFechaCierre.value = o.fecha_cierre || '';
  fDuracion.value  = o.duracion_horas ?? '';
  fObs.value       = o.observaciones || '';
  // v2
  fEstadoV2.value = o.estado_v2 || 'borrador';
  fAliado.value   = o.aliado_ejecutor || '';
  fMacro.value    = o.macroactividad_codigo || '';
  fContrato.value = o.contrato_codigo || '';
  // Multi-select de causantes
  const set = new Set(o.causantes || []);
  for (const opt of fCausantes.options) opt.selected = set.has(opt.value);
}
function readForm() {
  const sel = fTransformador.selectedOptions[0];
  const trCodigo = sel ? (sel.dataset.codigo || '') : '';
  const causantesSel = [...fCausantes.selectedOptions].map((o) => o.value);
  const macroSel = fMacro.selectedOptions[0];
  const contratoSel = fContrato.selectedOptions[0];
  return {
    codigo: fCodigo.value,
    titulo: fTitulo.value,
    descripcion: fDescripcion.value,
    transformadorId: fTransformador.value,
    transformadorCodigo: trCodigo,
    tipo: fTipoMain.value,
    prioridad: fPrioridadMain.value,
    estado: fEstadoMain.value,
    estado_v2: fEstadoV2.value,
    aliado_ejecutor: fAliado.value,
    macroactividadId: macroSel ? (macroSel.dataset.id || '') : '',
    macroactividad_codigo: fMacro.value,
    contratoId: contratoSel ? (contratoSel.dataset.id || '') : '',
    contrato_codigo: fContrato.value,
    causantes: causantesSel,
    tecnico: fTecnico.value,
    fecha_programada: fFechaProg.value,
    fecha_inicio: fFechaIni.value,
    fecha_cierre: fFechaCierre.value,
    duracion_horas: fDuracion.value,
    observaciones: fObs.value
  };
}

// Cargar catálogos v2 una sola vez al abrir el modal por primera vez.
let catalogosCargados = false;
async function cargarCatalogos() {
  if (catalogosCargados) return;
  try {
    const [macros, contratos, causantes] = await Promise.all([
      listarMacroactividades({ activo: true }).catch(() => []),
      listarContratos({ estado: 'vigente' }).catch(() => []),
      listarCausantes().catch(() => [])
    ]);
    fMacro.innerHTML = '<option value="">— ninguna —</option>' +
      macros.map((m) =>
        `<option value="${m.codigo}" data-id="${m.id || m.codigo}">${m.codigo} · ${m.nombre}</option>`
      ).join('');
    fContrato.innerHTML = '<option value="">— ninguno —</option>' +
      contratos.map((c) =>
        `<option value="${c.codigo}" data-id="${c.id}">${c.codigo} · ${c.aliado}</option>`
      ).join('');
    fCausantes.innerHTML = causantes.map((c) =>
      `<option value="${c.codigo}">${c.codigo} · ${c.nombre}</option>`
    ).join('');
    catalogosCargados = true;
  } catch (err) {
    console.warn('[admin-ordenes] error cargando catálogos v2:', err);
  }
}

async function renderHistorial(ordenId) {
  try {
    const items = await listarHistorial(ordenId);
    if (!items.length) {
      histList.innerHTML = '<div class="historial-empty">Sin eventos registrados.</div>';
      return;
    }
    histList.innerHTML = items.map((h) => {
      const fecha = h.at && h.at.toDate ? h.at.toDate().toLocaleString('es-CO') : '—';
      const transicion = (h.estado_previo && h.estado_nuevo)
        ? `${estadoOrdenLabel(h.estado_previo)} → ${estadoOrdenLabel(h.estado_nuevo)}`
        : (h.estado_nuevo ? estadoOrdenLabel(h.estado_nuevo) : '');
      return `
        <div class="historial-item">
          <span class="meta">${escHtml(fecha)} · ${escHtml(h.tipo_evento || 'evento')}</span>
          <div>${escHtml(transicion)}${h.nota ? ' — ' + escHtml(h.nota) : ''}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    histList.innerHTML = `<div class="historial-empty">Error cargando historial: ${escHtml(err.message || err)}</div>`;
  }
}

// ── Cargar (realtime, Fase 15) ──
let unsubscribe = null;

function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado. Completa assets/js/firebase-config.js para habilitar las órdenes.', 'err');
    tbody.innerHTML = '<tr><td colspan="8" class="td-empty">Sin conexión con Firestore.</td></tr>';
    return;
  }
  if (unsubscribe) { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
  showInfo('');
  tbody.innerHTML = '<tr><td colspan="8" class="td-empty">Cargando…</td></tr>';
  unsubscribe = suscribir(
    {
      estado:    fEstadoFilter.value    || undefined,
      tipo:      fTipoFilter.value      || undefined,
      prioridad: fPrioridadFilter.value || undefined
    },
    (rows) => render(rows),
    (err) => {
      console.error(err);
      showInfo('Error al listar: ' + (err.message || err), 'err');
      tbody.innerHTML = '<tr><td colspan="8" class="td-empty">Error de carga.</td></tr>';
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
      const o = await obtener(id);
      if (!o) return showInfo('Orden no encontrada.', 'err');
      fillForm(o);
      openModal(true);
      histWrap.style.display = 'block';
      histList.innerHTML = '<div class="historial-empty">Cargando historial…</div>';
      await renderHistorial(id);
    } catch (err) { showInfo('Error al cargar: ' + err.message, 'err'); }
    return;
  }

  if (act === 'del') {
    const o = await obtener(id);
    const label = o ? `${o.codigo} · ${o.titulo}` : id;
    if (!confirm(`¿Eliminar definitivamente la orden ${label}?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await eliminar(id);
      showInfo('✓ Orden eliminada.', 'ok');
      // La suscripción onSnapshot refresca la tabla automáticamente.
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
    const uid = (window.__sgmAdmin && window.__sgmAdmin.uid) || null;
    if (fId.value) {
      await actualizar(fId.value, data, uid);
      showInfo(`✓ Orden ${data.codigo} actualizada.`, 'ok');
    } else {
      await crear(data, uid);
      showInfo(`✓ Orden ${data.codigo} creada.`, 'ok');
    }
    closeModal();
    // La suscripción onSnapshot refresca la tabla automáticamente.
  } catch (err) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ ' + (err.message || err);
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = orig;
  }
});

// ── Eventos UI ──
$('btnNuevo').addEventListener('click', () => {
  form.reset(); fId.value = '';
  histWrap.style.display = 'none'; histList.innerHTML = '';
  openModal(false);
});
$('btnCancel').addEventListener('click', closeModal);
$('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
$('btnReload').addEventListener('click', cargar);
fEstadoFilter.addEventListener('change', cargar);
fTipoFilter.addEventListener('change', cargar);
fPrioridadFilter.addEventListener('change', cargar);

$('btnLogout').addEventListener('click', async () => {
  try { await logoutAdmin(); } catch (_) {}
  location.replace(ADMIN_ROUTES.login);
});
$('yr').textContent = new Date().getFullYear();

window.addEventListener('beforeunload', () => {
  if (unsubscribe) { try { unsubscribe(); } catch (_) {} }
});

// ── Init ──
fillSelects();
fillTransformadores();
cargar();
