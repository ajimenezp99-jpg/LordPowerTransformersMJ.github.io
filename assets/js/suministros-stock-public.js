// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Public · Stock Dashboard (Fase 47)
// Vista solo-lectura del stock de los 22 suministros con semáforo
// de 6 estados. Usa suscribirStockGlobal de F39.
// ══════════════════════════════════════════════════════════════

import { suscribirStockGlobal, isReady } from '../js/data/movimientos.js';
import { estadoStock, ESTADOS_STOCK } from '../js/domain/schema.js';

const $ = (id) => document.getElementById(id);
const tbody    = $('tbody');
const info     = $('infoBox');
const counter  = $('counter');
const fBusqueda = $('fBusqueda');
const fEstado  = $('fEstado');
const kStockIni       = $('kStockIni');
const kDisponible     = $('kDisponible');
const kConsumido      = $('kConsumido');
const kCriticos       = $('kCriticos');
const kValorContrato  = $('kValorContrato');
const kValorConsumido = $('kValorConsumido');
const kValorDisponible = $('kValorDisponible');
const kEjecucion      = $('kEjecucion');

let cacheRows = [];   // {...suministro, stock: {inicial, ingresado, egresado, actual}}
let configCache = null;
let unsub = null;

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
function fmtInt(v) {
  if (v == null || isNaN(+v)) return '—';
  return Number(v).toLocaleString('es-CO');
}
function fmtCOP(v) {
  if (v == null || isNaN(+v) || +v === 0) return '—';
  return '$' + Math.round(+v).toLocaleString('es-CO');
}
function fmtPct(v) {
  if (v == null || isNaN(+v)) return '—';
  return (v * 100).toFixed(1) + ' %';
}
function estadoMeta(key) {
  return ESTADOS_STOCK.find((e) => e.value === key) || { value: key, label: key, prefix: '·', color: '#8093ad' };
}

function aplicarFiltros() {
  const q = fBusqueda.value.trim().toLowerCase();
  const e = fEstado.value;
  return cacheRows.filter((r) => {
    if (q) {
      const blob = `${r.codigo} ${r.nombre || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (e && r._estado !== e) return false;
    return true;
  });
}

function calcularEstadoYRest(r) {
  const stock = r.stock || { inicial: r.stock_inicial || 0, ingresado: 0, egresado: 0, actual: r.stock_inicial || 0 };
  const opts = configCache || {};
  const est = estadoStock(stock.actual, stock.inicial, {
    umbral_critico_pct: opts.umbral_critico_pct,
    umbral_medio_pct:   opts.umbral_medio_pct
  });
  const pctRest = (stock.inicial > 0) ? (stock.actual / stock.inicial) : null;
  return { stock, est, pctRest };
}

function actualizarKPIs() {
  let stockIni = 0, dispon = 0, consum = 0, criticos = 0;
  let valorContrato = 0, valorConsumido = 0;
  for (const r of cacheRows) {
    const { stock, est } = r._calc;
    stockIni += stock.inicial;
    dispon   += Math.max(0, stock.actual);
    consum   += stock.egresado;
    if (est === 'CRITICO' || est === 'AGOTADO' || est === 'NEGATIVO') criticos += 1;
    const valU = +r.valor_unitario || 0;
    valorContrato  += stock.inicial * valU;
    valorConsumido += stock.egresado * valU;
  }
  const valorDisponible = Math.max(0, valorContrato - valorConsumido);
  const ejec = valorContrato > 0 ? valorConsumido / valorContrato : 0;
  kStockIni.textContent       = fmtInt(stockIni);
  kDisponible.textContent     = fmtInt(dispon);
  kConsumido.textContent      = fmtInt(consum);
  kCriticos.textContent       = String(criticos);
  kValorContrato.textContent  = fmtCOP(valorContrato);
  kValorConsumido.textContent = fmtCOP(valorConsumido);
  kValorDisponible.textContent = fmtCOP(valorDisponible);
  kEjecucion.textContent      = fmtPct(ejec);
}

function render() {
  const rows = aplicarFiltros();
  counter.textContent = `Catálogo · ${rows.length} de ${cacheRows.length} ítems`;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="td-empty">${
      cacheRows.length === 0 ? 'Sin suministros sembrados.' : 'Sin coincidencias.'
    }</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r) => {
    const { stock, est, pctRest } = r._calc;
    const meta = estadoMeta(est);
    const valU = +r.valor_unitario || 0;
    const valDisp = Math.max(0, stock.actual) * valU;
    return `
    <tr data-id="${escHtml(r.codigo)}">
      <td><code>${escHtml(r.codigo)}</code></td>
      <td>${escHtml(r.nombre)}</td>
      <td>${(r.marcas_disponibles && r.marcas_disponibles.length) ? r.marcas_disponibles.map((m) => `<span class="marca-chip">${escHtml(m)}</span>`).join(' ') : '—'}</td>
      <td><span class="unidad-pill">${escHtml(r.unidad || 'Und')}</span></td>
      <td style="text-align:right; font-family: var(--font-mono);">${fmtInt(stock.inicial)}</td>
      <td style="text-align:right; font-family: var(--font-mono); color:#16A34A;">+${fmtInt(stock.ingresado)}</td>
      <td style="text-align:right; font-family: var(--font-mono); color:#EA580C;">−${fmtInt(stock.egresado)}</td>
      <td style="text-align:right; font-family: var(--font-mono); font-weight:700;">${fmtInt(stock.actual)}</td>
      <td style="text-align:right; font-family: var(--font-mono);">${pctRest != null ? fmtPct(pctRest) : '—'}</td>
      <td><span class="estado-stock-pill ${meta.value}">${meta.prefix} ${escHtml(meta.label)}</span></td>
      <td style="text-align:right; font-family: var(--font-mono);">${fmtCOP(valDisp)}</td>
    </tr>`;
  }).join('');
  window.sgmRefreshIcons?.();
}

function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    tbody.innerHTML = '<tr><td colspan="11" class="td-empty">Sin conexión.</td></tr>';
    return;
  }
  if (unsub) try { unsub(); } catch (_) {}
  unsub = suscribirStockGlobal(({ suministros, config }) => {
    configCache = config || null;
    cacheRows = suministros.map((s) => {
      const calc = calcularEstadoYRest(s);
      return { ...s, _calc: calc, _estado: calc.est };
    });
    actualizarKPIs();
    render();
  }, (err) => {
    console.error(err);
    showInfo('Error realtime: ' + (err.message || err), 'err');
  });
}
window.addEventListener('beforeunload', () => { if (unsub) try { unsub(); } catch (_) {} });

fBusqueda.addEventListener('input', render);
fEstado.addEventListener('change', render);

arrancar();
