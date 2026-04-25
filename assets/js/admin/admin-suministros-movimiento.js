// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Movimiento de Suministros (Fase 45)
// Formulario INGRESO/EGRESO con autocomplete cascada y validación
// atómica de stock (runTransaction vive en data/movimientos.js#crear,
// implementada en F39).
// ══════════════════════════════════════════════════════════════

import {
  crear as crearMovimiento, computarStock, isReady, StockInsuficienteError
} from '../data/movimientos.js';
import { suscribir as suscribirSuministros } from '../data/suministros.js';
import { suscribir as suscribirTransformadores } from '../data/transformadores.js';

const $ = (id) => document.getElementById(id);

// ── Elementos ──
const form          = $('form');
const info          = $('infoBox');
const formMsg       = $('formMsg');
const fAnio         = $('fAnio');
const fUsuario      = $('fUsuario');
const fSumId        = $('fSumId');
const dlSums        = $('dlSums');
const fMarca        = $('fMarca');
const fUnidad       = $('fUnidad');
const fValorUnit    = $('fValorUnit');
const fStockActual  = $('fStockActual');
const fMatricula    = $('fMatricula');
const dlTrafos      = $('dlTrafos');
const fSub          = $('fSub');
const fZona         = $('fZona');
const fDepto        = $('fDepto');
const fPotencia     = $('fPotencia');
const fCantidad     = $('fCantidad');
const fValorTotal   = $('fValorTotal');
const fOdt          = $('fOdt');
const fObs          = $('fObs');
const btnLimpiar    = $('btnLimpiar');
const btnGuardar    = $('btnGuardar');

// ── Cache realtime ──
let cacheSums = [];
let cacheTrafos = [];
let unsubSums = null;
let unsubTrafos = null;
// suministroSeleccionado / trafoSeleccionado: doc completo cacheado.
let sumSel = null;
let trafoSel = null;

// ── Helpers ──
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
function tipoSeleccionado() {
  const r = document.querySelector('input[name="tipo"]:checked');
  return r ? r.value : null;
}

// ── Poblar dropdown de años ──
function fillAnios() {
  const yearActual = new Date().getFullYear();
  const opts = [];
  for (let y = 2023; y <= yearActual + 2; y++) {
    opts.push(`<option value="${y}" ${y === yearActual ? 'selected' : ''}>${y}</option>`);
  }
  fAnio.innerHTML = opts.join('');
}

// ── Datalists ──
function rebuildDatalistSums() {
  dlSums.innerHTML = cacheSums.map((s) =>
    `<option value="${escHtml(s.codigo)}">${escHtml(s.codigo + ' · ' + s.nombre)}</option>`
  ).join('');
}
function rebuildDatalistTrafos() {
  dlTrafos.innerHTML = cacheTrafos.map((t) => {
    const id = t.identificacion || {};
    const ub = t.ubicacion || {};
    const matr = id.matricula || t.matricula || t.codigo || '';
    const sub  = ub.subestacion_nombre || t.subestacion || '';
    return `<option value="${escHtml(matr)}">${escHtml(matr + (sub ? ' · ' + sub : ''))}</option>`;
  }).join('');
}

// ── Lookup helpers ──
function buscarSuministro(input) {
  const v = String(input || '').trim().toUpperCase();
  if (!v) return null;
  // Match exacto por codigo, o si el usuario tipeó un nombre, por nombre.
  return cacheSums.find((s) => s.codigo === v) ||
         cacheSums.find((s) => s.nombre.toUpperCase() === v.toUpperCase()) ||
         cacheSums.find((s) => s.nombre.toUpperCase().includes(v)) ||
         null;
}
function buscarTrafo(input) {
  const v = String(input || '').trim().toUpperCase();
  if (!v) return null;
  return cacheTrafos.find((t) => {
    const matr = ((t.identificacion && t.identificacion.matricula) || t.matricula || t.codigo || '').toUpperCase();
    return matr === v;
  }) || null;
}

// ── Auto-fill suministro ──
async function aplicarSuministro() {
  const found = buscarSuministro(fSumId.value);
  sumSel = found;
  if (!found) {
    fMarca.value = '';
    fUnidad.value = '';
    fValorUnit.value = '';
    fStockActual.value = '';
    actualizarValorTotal();
    return;
  }
  // Marca: si hay 1 marca disponible, la pre-llena; si hay varias, muestra "(varias)".
  const marcas = Array.isArray(found.marcas_disponibles) ? found.marcas_disponibles : [];
  fMarca.value = marcas.length === 1 ? marcas[0] : (marcas.length > 1 ? `(${marcas.length} marcas)` : '—');
  fUnidad.value = found.unidad || 'Und';
  fValorUnit.value = fmtCOP(found.valor_unitario);
  // Stock actual via cómputo on-demand (puede fallar si las rules no permiten read agregado — best effort).
  fStockActual.value = '⋯';
  try {
    const stock = await computarStock(found.codigo);
    if (stock) fStockActual.value = `${stock.actual} (ini ${stock.inicial}, +${stock.ingresado}, -${stock.egresado})`;
    else fStockActual.value = '—';
  } catch (err) {
    console.warn('No se pudo computar stock:', err);
    fStockActual.value = '—';
  }
  actualizarValorTotal();
}

function aplicarTrafo() {
  const found = buscarTrafo(fMatricula.value);
  trafoSel = found;
  if (!found) {
    fSub.value = ''; fZona.value = ''; fDepto.value = ''; fPotencia.value = '';
    return;
  }
  const id = found.identificacion || {};
  const ub = found.ubicacion || {};
  const pl = found.placa || {};
  fSub.value      = ub.subestacion_nombre || found.subestacion || '';
  fZona.value     = ub.zona || found.zona || '';
  fDepto.value    = ub.departamento || found.departamento || '';
  fPotencia.value = pl.potencia_kva ?? found.potencia_kva ?? '';
}

function actualizarValorTotal() {
  const cant = +fCantidad.value || 0;
  const valU = sumSel ? +sumSel.valor_unitario || 0 : 0;
  const total = cant * valU;
  fValorTotal.value = total > 0 ? fmtCOP(total) : '—';
}

// ── Suscripciones ──
function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    return;
  }
  if (unsubSums)   try { unsubSums(); }   catch (_) {}
  if (unsubTrafos) try { unsubTrafos(); } catch (_) {}
  unsubSums = suscribirSuministros({}, (rows) => {
    cacheSums = rows; rebuildDatalistSums();
  }, (err) => console.warn('[sums]', err));
  unsubTrafos = suscribirTransformadores({}, (rows) => {
    cacheTrafos = rows; rebuildDatalistTrafos();
  }, (err) => console.warn('[trafos]', err));
}

// ── Eventos input ──
fSumId.addEventListener('input', aplicarSuministro);
fSumId.addEventListener('change', aplicarSuministro);
fMatricula.addEventListener('input', aplicarTrafo);
fMatricula.addEventListener('change', aplicarTrafo);
fCantidad.addEventListener('input', actualizarValorTotal);

btnLimpiar.addEventListener('click', () => {
  // Conserva Año + Tipo + Usuario per decisión del plan.
  const anio = fAnio.value;
  const usuario = fUsuario.value;
  const tipo = tipoSeleccionado();
  form.reset();
  fAnio.value = anio;
  fUsuario.value = usuario;
  if (tipo) document.querySelector(`input[name="tipo"][value="${tipo}"]`).checked = true;
  sumSel = null; trafoSel = null;
  formMsg.className = 'msg'; formMsg.textContent = '';
});

// ── Submit ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.className = 'msg'; formMsg.textContent = '';

  // Validación cliente (replica las reglas de F40 para feedback inmediato).
  if (!sumSel) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ Seleccione un suministro válido del catálogo.';
    fSumId.focus(); return;
  }
  if (!trafoSel) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ Seleccione una matrícula válida del parque.';
    fMatricula.focus(); return;
  }
  const tipo = tipoSeleccionado();
  if (!tipo) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ Seleccione INGRESO o EGRESO.';
    return;
  }
  const cantidad = parseInt(fCantidad.value, 10);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ Cantidad debe ser entero mayor o igual a 1.';
    fCantidad.focus(); return;
  }

  btnGuardar.disabled = true;
  const orig = btnGuardar.textContent;
  btnGuardar.textContent = 'GUARDANDO…';
  try {
    const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
    const id = trafoSel.identificacion || {};
    const ub = trafoSel.ubicacion || {};
    // El codigo del movimiento se genera dentro de la tx (data layer F39).
    // El sanitizer F38 lo ignora si traemos placeholder; el data layer F39
    // reescribe con el correlativo real del año.
    const movId = await crearMovimiento({
      anio: parseInt(fAnio.value, 10),
      tipo: tipo,
      suministro_id: sumSel.codigo,
      suministro_nombre: sumSel.nombre,
      marca: (sumSel.marcas_disponibles && sumSel.marcas_disponibles.length === 1) ? sumSel.marcas_disponibles[0] : '',
      cantidad: cantidad,
      valor_unitario: +sumSel.valor_unitario || 0,
      valor_total: cantidad * (+sumSel.valor_unitario || 0),
      transformador_id: trafoSel.id,
      matricula: id.matricula || trafoSel.matricula || trafoSel.codigo || '',
      subestacion: ub.subestacion_nombre || trafoSel.subestacion || '',
      zona: ub.zona || trafoSel.zona || '',
      departamento: ub.departamento || trafoSel.departamento || '',
      odt: fOdt.value.trim(),
      usuario: fUsuario.value.trim(),
      observaciones: fObs.value.trim()
    }, uid);
    formMsg.className = 'msg ok';
    formMsg.textContent = `✓ Movimiento ${tipo} guardado (id: ${movId}). Stock actualizado.`;
    showInfo(`✓ ${tipo} ${cantidad} × ${sumSel.codigo} → ${id.matricula || trafoSel.codigo}`, 'ok');
    // Limpieza parcial: conserva Año + Tipo + Usuario; recarga stock actual.
    btnLimpiar.click();
    setTimeout(() => showInfo(''), 5000);
  } catch (err) {
    formMsg.className = 'msg err';
    if (err && err.name === 'StockInsuficienteError') {
      formMsg.textContent = `✗ ${err.message}`;
    } else {
      formMsg.textContent = '✗ ' + (err.message || err);
    }
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = orig;
  }
});

window.addEventListener('beforeunload', () => {
  if (unsubSums)   try { unsubSums(); }   catch (_) {}
  if (unsubTrafos) try { unsubTrafos(); } catch (_) {}
});

// ── Init ──
fillAnios();
arrancar();
