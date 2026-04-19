// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Render del dashboard KPIs (Fase 8)
// Pinta las tarjetas RAM + 5 gráficas Chart.js + tabla top-10.
// Se usa desde vistas públicas y admin; Chart.js llega por CDN.
// ══════════════════════════════════════════════════════════════

import { computeDashboard, isReady } from './data/kpis.js';
import {
  TIPOS_ORDEN, ESTADOS_ORDEN, PRIORIDADES,
  estadoOrdenLabel, tipoLabel, prioridadLabel
} from './data/ordenes.js';
import { DEPARTAMENTOS, departamentoLabel } from './data/transformadores.js';

const $ = (id) => document.getElementById(id);

// Paletas alineadas con las variables CSS.
const COL = {
  accent:   '#00c8ff',
  accent2:  '#f0a500',
  accent3:  '#00ff99',
  warn:     '#ff5577',
  muted:    '#4a6478',
  text:     '#c8d4e0',
  border:   'rgba(74,100,120,.35)'
};
const PAL = [COL.accent, COL.accent2, COL.accent3, COL.warn, '#7aa7ff', '#c388ff'];

const chartRegistry = new Map();

function destroyCharts() {
  for (const c of chartRegistry.values()) c.destroy();
  chartRegistry.clear();
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmtNum(n, dec = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-CO', {
    minimumFractionDigits: dec, maximumFractionDigits: dec
  });
}

function defaultChartOpts(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: COL.text, font: { family: 'Share Tech Mono' }, boxWidth: 12 }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,.88)',
        borderColor: COL.accent, borderWidth: 1,
        titleColor: COL.accent,
        bodyColor:  COL.text
      }
    },
    scales: {
      x: { ticks: { color: COL.muted, font: { family: 'Share Tech Mono' } },
           grid: { color: COL.border, drawBorder: false } },
      y: { beginAtZero: true,
           ticks: { color: COL.muted, precision: 0, font: { family: 'Share Tech Mono' } },
           grid: { color: COL.border, drawBorder: false } }
    },
    ...extra
  };
}

// ── Pinta tarjetas RAM ──
function renderRam(ram) {
  $('ramMtbf').textContent = fmtNum(ram.mtbf_dias, 1);
  $('ramMttr').textContent = fmtNum(ram.mttr_horas, 1);
  $('ramDisp').textContent = ram.disponibilidad_pct == null
    ? '—' : fmtNum(ram.disponibilidad_pct, 2);

  const metaMtbf = $('ramMtbfMeta');
  if (metaMtbf) {
    metaMtbf.textContent = `Muestra: ${ram.muestra_fallos} fallos · ` +
      `${fmtNum(ram.parque_dias_servicio)} días-equipo acumulados.`;
  }
  const metaMttr = $('ramMttrMeta');
  if (metaMttr) {
    metaMttr.textContent = ram.mttr_horas
      ? `Promedio sobre ${ram.muestra_fallos} órdenes correctivas cerradas.`
      : 'Sin órdenes correctivas cerradas aún.';
  }

  // Coloreado del card de disponibilidad
  const dispCard = $('ramDispCard');
  if (dispCard) {
    dispCard.classList.remove('good', 'warn');
    const v = ram.disponibilidad_pct;
    if (v != null) {
      if (v >= 95) dispCard.classList.add('good');
      else if (v < 85) dispCard.classList.add('warn');
    }
  }
}

// ── Charts ──
function doughnut(id, labels, values, colors) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  const chart = new window.Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: 'rgba(0,0,0,.35)',
      borderWidth: 1
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right',
                  labels: { color: COL.text, font: { family: 'Share Tech Mono' }, boxWidth: 12 } },
        tooltip: { backgroundColor: 'rgba(0,0,0,.88)',
                   borderColor: COL.accent, borderWidth: 1,
                   titleColor: COL.accent, bodyColor: COL.text }
      }
    }
  });
  chartRegistry.set(id, chart);
}

function barChart(id, labels, values, color, horizontal = false) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  const chart = new window.Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{
      data: values,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 1
    }]},
    options: defaultChartOpts({
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: false },
                 tooltip: { backgroundColor: 'rgba(0,0,0,.88)',
                            borderColor: COL.accent, borderWidth: 1,
                            titleColor: COL.accent, bodyColor: COL.text } }
    })
  });
  chartRegistry.set(id, chart);
}

function lineChart(id, labels, values, color) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  const chart = new window.Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{
      data: values,
      borderColor: color,
      backgroundColor: color + '22',
      tension: .25,
      fill: true,
      pointBackgroundColor: color,
      pointRadius: 3
    }]},
    options: defaultChartOpts({
      plugins: { legend: { display: false },
                 tooltip: { backgroundColor: 'rgba(0,0,0,.88)',
                            borderColor: COL.accent, borderWidth: 1,
                            titleColor: COL.accent, bodyColor: COL.text } }
    })
  });
  chartRegistry.set(id, chart);
}

// ── Top 10 tabla ──
function renderTop(rows) {
  const tbody = $('topTbody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--muted);font-style:italic">Sin datos suficientes.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td><code>${escHtml(r.codigo)}</code></td>
      <td>${escHtml(r.nombre)}</td>
      <td>${escHtml(r.departamento)}</td>
      <td class="num">${r.count}</td>
    </tr>
  `).join('');
}

// ── Totales (tarjetas superiores) ──
function renderTotales(t) {
  if ($('tTrafos')) $('tTrafos').textContent = t.transformadores;
  if ($('tOps'))    $('tOps').textContent    = t.operativos;
  if ($('tOrds'))   $('tOrds').textContent   = t.ordenes;
  if ($('tCurso'))  $('tCurso').textContent  = t.ordenes_en_curso;
}

function renderSello(ts) {
  const el = $('dashTs');
  if (el) el.textContent = `Actualizado: ${new Date(ts).toLocaleString('es-CO')}`;
}

function showError(msg) {
  const box = $('infoBox');
  if (!box) return;
  box.className = 'info-msg err';
  box.textContent = msg;
  box.style.display = 'block';
}
function clearError() {
  const box = $('infoBox');
  if (!box) return;
  box.style.display = 'none';
}

// ── Entrada pública ──
export async function loadDashboard() {
  if (!isReady()) {
    showError('⚠ Firebase aún no configurado — el dashboard no puede consultar datos.');
    return null;
  }
  if (typeof window.Chart === 'undefined') {
    showError('⚠ Chart.js no se cargó correctamente. Reintente en unos segundos.');
    return null;
  }
  try {
    clearError();
    const snap = await computeDashboard();
    destroyCharts();
    renderTotales(snap.totales);
    renderRam(snap.ram);
    renderSello(snap.ts);

    // Órdenes por estado
    doughnut('chEstado',
      ESTADOS_ORDEN.map((e) => estadoOrdenLabel(e.value)),
      ESTADOS_ORDEN.map((e) => snap.porEstado[e.value] || 0),
      [COL.accent, COL.accent2, COL.accent3, COL.muted]
    );

    // Órdenes por tipo
    barChart('chTipo',
      TIPOS_ORDEN.map((t) => tipoLabel(t.value)),
      TIPOS_ORDEN.map((t) => snap.porTipo[t.value] || 0),
      COL.accent
    );

    // Órdenes por prioridad
    barChart('chPrioridad',
      PRIORIDADES.map((p) => prioridadLabel(p.value)),
      PRIORIDADES.map((p) => snap.porPrioridad[p.value] || 0),
      COL.accent2
    );

    // Órdenes por departamento (horizontal bar)
    barChart('chDepto',
      DEPARTAMENTOS.map((d) => departamentoLabel(d.value)),
      DEPARTAMENTOS.map((d) => snap.porDepartamento[d.value] || 0),
      COL.accent3, true
    );

    // Órdenes por mes
    const meses = Object.keys(snap.porMes);
    lineChart('chMes',
      meses.map((m) => m.slice(2)),   // mostrar '26-04'
      meses.map((m) => snap.porMes[m]),
      COL.accent
    );

    renderTop(snap.topTransformadores);
    return snap;
  } catch (err) {
    console.error(err);
    showError('Error al cargar KPIs: ' + (err.message || err));
    return null;
  }
}

// ── Helpers exportados (para admin-kpis: export CSV) ──
export { escHtml, fmtNum };
