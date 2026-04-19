// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Alertas público (Fase 11)
// Vista solo-lectura con resumen, filtros y listado.
// ══════════════════════════════════════════════════════════════

import {
  computarAlertas,
  SEVERIDADES, TIPOS_ALERTA,
  severidadLabel, tipoAlertaLabel,
  isReady
} from './data/alertas.js';

const $ = (id) => document.getElementById(id);

const tbody = $('tbody');
const info  = $('infoBox');

const fSev    = $('fSeveridad');
const fTipo   = $('fTipo');
const fSearch = $('fSearch');
const fShow   = $('fShowRecon');
const btnRel  = $('btnReload');
const genAt   = $('generatedAt');

const kCrit = $('rCrit');
const kWarn = $('rWarn');
const kInfo = $('rInfo');
const kAct  = $('rAct');
const kRec  = $('rRecon');

let snapshot = null; // { alertas, resumen, config, generatedAt }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showInfo(msg, kind) {
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = msg ? 'block' : 'none';
}

function fillSelects() {
  for (const s of SEVERIDADES) {
    fSev.insertAdjacentHTML('beforeend', `<option value="${s.value}">${s.label}</option>`);
  }
  for (const t of TIPOS_ALERTA) {
    fTipo.insertAdjacentHTML('beforeend', `<option value="${t.value}">${t.label}</option>`);
  }
}

function recursoLinkPublic(rec) {
  if (!rec || !rec.clase) return '—';
  if (rec.clase === 'orden') {
    return `<a href="ordenes.html" style="color:var(--accent);text-decoration:none">📋 ${esc(rec.codigo || '—')}</a>`;
  }
  if (rec.clase === 'transformador') {
    return `<a href="inventario.html" style="color:var(--accent);text-decoration:none">⚡ ${esc(rec.codigo || '—')}</a>`;
  }
  return esc(rec.codigo || '—');
}

function renderResumen(resumen) {
  kCrit.textContent = resumen.criticas;
  kWarn.textContent = resumen.warnings;
  kInfo.textContent = resumen.info;
  kAct.textContent  = resumen.activas;
  kRec.textContent  = resumen.reconocidas;
}

function filtrar(all) {
  const sev   = fSev.value;
  const tipo  = fTipo.value;
  const q     = (fSearch.value || '').trim().toLowerCase();
  const show  = fShow.checked;
  return all.filter((a) => {
    if (!show && a.reconocida) return false;
    if (sev  && a.severidad !== sev)  return false;
    if (tipo && a.tipo      !== tipo) return false;
    if (q) {
      const hay = `${a.titulo} ${a.detalle} ${a.recurso?.codigo || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  if (!snapshot) return;
  renderResumen(snapshot.resumen);
  genAt.textContent = 'Calculado: ' + snapshot.generatedAt.toLocaleString('es-CO');

  const filas = filtrar(snapshot.alertas);
  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Sin alertas con los filtros seleccionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map((a) => {
    const sevCls  = esc(a.severidad);
    const tipoLbl = tipoAlertaLabel(a.tipo);
    const rec = a.reconocida
      ? `<span class="alert-ack-meta">✓ Reconocida</span>`
      : '';
    return `
      <tr class="alert-row ${a.reconocida ? 'reconocida' : ''}">
        <td><span class="sev-pill ${sevCls}">${esc(severidadLabel(a.severidad))}</span></td>
        <td><span class="alerta-tipo-pill">${esc(tipoLbl)}</span></td>
        <td>
          <span class="alert-title">${esc(a.titulo)}</span>
          <span class="alert-detail">${esc(a.detalle)}</span>
          ${rec}
        </td>
        <td style="font-family:var(--font-mono);font-size:.78rem">${esc(a.fecha_ref_fmt || '—')}</td>
        <td>${recursoLinkPublic(a.recurso)}</td>
      </tr>
    `;
  }).join('');
}

async function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado. No se pueden calcular alertas hasta completar la configuración.', 'err');
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Sin datos.</td></tr>`;
    return;
  }
  try {
    showInfo('');
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Recalculando…</td></tr>`;
    snapshot = await computarAlertas();
    render();
  } catch (err) {
    console.error(err);
    showInfo('Error al calcular alertas: ' + (err.message || err), 'err');
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Error.</td></tr>`;
  }
}

// ── Init ──
fillSelects();

fSev.addEventListener('change', render);
fTipo.addEventListener('change', render);
fSearch.addEventListener('input', render);
fShow.addEventListener('change', render);
btnRel.addEventListener('click', cargar);

// Logout unificado (Fase 14)
import('./auth/session-guard.js').then((m) => {
  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', () => m.logout());
});
$('yr').textContent = new Date().getFullYear();

cargar();
