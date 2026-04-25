// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Public · Dashboard Suministros (Fase 48)
// 4 KPIs operativos + 4 KPIs económicos + 4 gráficas Chart.js +
// vista cruzada filtrable.
// ══════════════════════════════════════════════════════════════

import {
  suscribir as suscribirMovimientos, isReady
} from '../js/data/movimientos.js';
import {
  suscribir as suscribirSuministros
} from '../js/data/suministros.js';

const $ = (id) => document.getElementById(id);
const info = $('infoBox');

// KPIs
const kRegistros = $('kRegistros');
const kUnidades = $('kUnidades');
const kDescripciones = $('kDescripciones');
const kTxAtendidos = $('kTxAtendidos');
const kValContrato = $('kValContrato');
const kValConsumido = $('kValConsumido');
const kValDisponible = $('kValDisponible');
const kEjecucionPct = $('kEjecucionPct');

// Filtros cruzado
const fxZona = $('fxZona');
const fxDepto = $('fxDepto');
const cruzadoCount = $('cruzadoCount');

let cacheMovs = [];
let cacheSums = [];
let unsubM = null, unsubS = null;
let charts = {};

function showInfo(msg, kind) {
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = msg ? 'block' : 'none';
}
function fmtInt(v) {
  if (v == null || isNaN(+v)) return '—';
  return Number(v).toLocaleString('es-CO');
}
function fmtCOP(v) {
  if (v == null || isNaN(+v) || +v === 0) return '$0';
  return '$' + Math.round(+v).toLocaleString('es-CO');
}
function fmtPct(v) {
  if (v == null || isNaN(+v)) return '—';
  return (v * 100).toFixed(1) + ' %';
}

// Paleta Tailwind del skill.
const COLOR_BARS = [
  '#0F766E', '#0D9488', '#16A34A', '#22C55E', '#EAB308',
  '#F59E0B', '#EA580C', '#DC2626', '#7C3AED', '#2563EB'
];
const COLOR_BY_ZONA = {
  'BOLIVAR':   '#2563EB',
  'ORIENTE':   '#EA580C',
  'OCCIDENTE': '#16A34A'
};

function destroyCharts() {
  for (const k of Object.keys(charts)) {
    try { charts[k].destroy(); } catch (_) {}
  }
  charts = {};
}

function recomputarKPIs() {
  // Operativos
  const registros = cacheMovs.length;
  const unidades = cacheMovs.reduce((s, m) => s + (+m.cantidad || 0), 0);
  const descs = new Set(cacheMovs.map((m) => m.suministro_id).filter(Boolean));
  const trafos = new Set(cacheMovs.map((m) => m.transformador_id).filter(Boolean));
  kRegistros.textContent = fmtInt(registros);
  kUnidades.textContent  = fmtInt(unidades);
  kDescripciones.textContent = fmtInt(descs.size);
  kTxAtendidos.textContent = fmtInt(trafos.size);

  // Económicos: usa el catálogo para el valor de contrato
  const valContrato = cacheSums.reduce((s, x) =>
    s + (+x.stock_inicial || 0) * (+x.valor_unitario || 0), 0);
  const valConsumido = cacheMovs
    .filter((m) => m.tipo === 'EGRESO')
    .reduce((s, m) => s + (+m.valor_total || 0), 0);
  const valDisponible = Math.max(0, valContrato - valConsumido);
  const ejec = valContrato > 0 ? valConsumido / valContrato : 0;
  kValContrato.textContent = fmtCOP(valContrato);
  kValConsumido.textContent = fmtCOP(valConsumido);
  kValDisponible.textContent = fmtCOP(valDisponible);
  kEjecucionPct.textContent = fmtPct(ejec);
}

function rankingPor(field, valueFn, topN = 10) {
  const acc = new Map();
  for (const m of cacheMovs) {
    if (m.tipo !== 'EGRESO') continue;
    const k = m[field] || '—';
    acc.set(k, (acc.get(k) || 0) + valueFn(m));
  }
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}

function chartHorizontalBar(canvasId, dataPairs, label, formatter = fmtInt, colorFn = (i) => COLOR_BARS[i % COLOR_BARS.length]) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) try { charts[canvasId].destroy(); } catch (_) {}
  const labels = dataPairs.map(([k]) => k);
  const data   = dataPairs.map(([_, v]) => v);
  const colors = dataPairs.map((_, i) => colorFn(i));
  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${label}: ${formatter(c.parsed.x)}` } }
      },
      scales: {
        x: { ticks: { callback: (v) => formatter(v) }, grid: { color: 'rgba(0,40,90,.06)' } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

function chartDoughnut(canvasId, dataPairs, label, colorMap = null) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) try { charts[canvasId].destroy(); } catch (_) {}
  const labels = dataPairs.map(([k]) => k);
  const data   = dataPairs.map(([_, v]) => v);
  const colors = colorMap
    ? labels.map((l) => colorMap[l] || '#94A3B8')
    : labels.map((_, i) => COLOR_BARS[i % COLOR_BARS.length]);
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtInt(c.parsed)}` } }
      },
      cutout: '55%'
    }
  });
}

function renderCharts() {
  // Top 10 suministros por unidades consumidas
  const rankUni = rankingPor('suministro_id', (m) => +m.cantidad || 0, 10)
    .map(([k, v]) => [`${k} ${nombreSum(k)}`, v]);
  chartHorizontalBar('chRankUnidades', rankUni, 'Unidades');

  // Top 10 suministros por valor consumido
  const rankVal = rankingPor('suministro_id', (m) => +m.valor_total || 0, 10)
    .map(([k, v]) => [`${k} ${nombreSum(k)}`, v]);
  chartHorizontalBar('chRankValor', rankVal, 'COP', fmtCOP, () => '#EA580C');

  // Distribución por zona (registros)
  const porZona = new Map();
  for (const m of cacheMovs) {
    if (m.tipo !== 'EGRESO') continue;
    const z = m.zona || 'sin zona';
    porZona.set(z, (porZona.get(z) || 0) + 1);
  }
  chartDoughnut('chZona', [...porZona.entries()], 'registros', COLOR_BY_ZONA);

  // Distribución por departamento (registros)
  const porDepto = new Map();
  for (const m of cacheMovs) {
    if (m.tipo !== 'EGRESO') continue;
    const d = (m.departamento || 'sin depto').toUpperCase();
    porDepto.set(d, (porDepto.get(d) || 0) + 1);
  }
  chartHorizontalBar('chDepto', [...porDepto.entries()], 'Egresos');
}

function nombreSum(codigo) {
  const s = cacheSums.find((x) => x.codigo === codigo);
  return s ? `· ${s.nombre.slice(0, 32)}` : '';
}

function renderCruzado() {
  const z = fxZona.value;
  const d = fxDepto.value;
  const filt = cacheMovs.filter((m) => {
    if (m.tipo !== 'EGRESO') return false;
    if (z && m.zona !== z) return false;
    if (d && m.departamento !== d) return false;
    return true;
  });
  cruzadoCount.textContent = `Mostrando ${filt.length} de ${cacheMovs.length} movimientos según filtros activos.`;
  const acc = new Map();
  for (const m of filt) {
    const k = m.suministro_id || '—';
    acc.set(k, (acc.get(k) || 0) + (+m.cantidad || 0));
  }
  const rank = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([k, v]) => [`${k} ${nombreSum(k)}`, v]);
  if (rank.length === 0) {
    if (charts['chCruzado']) try { charts['chCruzado'].destroy(); } catch (_) {}
    const ctx = document.getElementById('chCruzado');
    if (ctx) ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
    return;
  }
  chartHorizontalBar('chCruzado', rank, 'Unidades', fmtInt, () => '#7C3AED');
}

function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    return;
  }
  if (unsubM) try { unsubM(); } catch (_) {}
  if (unsubS) try { unsubS(); } catch (_) {}
  unsubS = suscribirSuministros({}, (rows) => {
    cacheSums = rows;
    recomputarKPIs();
    renderCharts();
    renderCruzado();
  }, (err) => console.warn('[sums]', err));
  unsubM = suscribirMovimientos({}, (rows) => {
    cacheMovs = rows;
    recomputarKPIs();
    renderCharts();
    renderCruzado();
  }, (err) => {
    console.error(err);
    showInfo('Error realtime: ' + (err.message || err), 'err');
  });
}
window.addEventListener('beforeunload', () => {
  if (unsubM) try { unsubM(); } catch (_) {}
  if (unsubS) try { unsubS(); } catch (_) {}
  destroyCharts();
});

fxZona.addEventListener('change', renderCruzado);
fxDepto.addEventListener('change', renderCruzado);

arrancar();
