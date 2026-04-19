// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Alertas (Fase 11)
// Reconocimiento de alertas y ajuste de umbrales del motor.
// ══════════════════════════════════════════════════════════════

import {
  computarAlertas,
  obtenerConfig, actualizarConfig,
  reconocer, desreconocer,
  SEVERIDADES, TIPOS_ALERTA,
  severidadLabel, tipoAlertaLabel,
  isReady, DEFAULT_CONFIG
} from '../data/alertas.js';

import { onAdminAuthChange, logoutAdmin, ADMIN_ROUTES } from './admin-auth.js';

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

const cProx    = $('cProx');
const cProl    = $('cProl');
const cMant    = $('cMant');
const cEmail   = $('cEmail');
const cEnabled = $('cEnabled');
const configMsg = $('configMsg');
const btnConfigSave   = $('btnConfigSave');
const btnConfigReload = $('btnConfigReload');

let snapshot = null;
let currentUid = null;

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

function showConfigMsg(msg, kind) {
  configMsg.textContent = msg || '';
  configMsg.style.color = kind === 'err' ? '#ff7a99'
                       : kind === 'ok'  ? 'var(--accent3)'
                       : 'var(--muted)';
}

function fillSelects() {
  for (const s of SEVERIDADES) {
    fSev.insertAdjacentHTML('beforeend', `<option value="${s.value}">${s.label}</option>`);
  }
  for (const t of TIPOS_ALERTA) {
    fTipo.insertAdjacentHTML('beforeend', `<option value="${t.value}">${t.label}</option>`);
  }
}

function recursoLinkAdmin(rec) {
  if (!rec || !rec.clase) return '—';
  if (rec.clase === 'orden') {
    return `<a href="ordenes.html#edit:${esc(rec.id)}" style="color:var(--accent);text-decoration:none">📋 ${esc(rec.codigo || '—')}</a>`;
  }
  if (rec.clase === 'transformador') {
    return `<a href="inventario.html#edit:${esc(rec.id)}" style="color:var(--accent);text-decoration:none">⚡ ${esc(rec.codigo || '—')}</a>`;
  }
  return esc(rec.codigo || '—');
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

function renderResumen(resumen) {
  kCrit.textContent = resumen.criticas;
  kWarn.textContent = resumen.warnings;
  kInfo.textContent = resumen.info;
  kAct.textContent  = resumen.activas;
  kRec.textContent  = resumen.reconocidas;
}

function render() {
  if (!snapshot) return;
  renderResumen(snapshot.resumen);
  genAt.textContent = 'Calculado: ' + snapshot.generatedAt.toLocaleString('es-CO');

  const filas = filtrar(snapshot.alertas);
  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">Sin alertas con los filtros seleccionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map((a) => {
    const sevCls  = esc(a.severidad);
    const tipoLbl = tipoAlertaLabel(a.tipo);
    const rec = a.reconocida
      ? `<span class="alert-ack-meta">✓ Reconocida</span>`
      : '';
    const acciones = a.reconocida
      ? `<button class="btn-unack" data-unack="${esc(a.id)}">Desreconocer</button>`
      : `<button class="btn-ack"   data-ack="${esc(a.id)}">Reconocer</button>`;
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
        <td>${recursoLinkAdmin(a.recurso)}</td>
        <td><div class="alert-actions">${acciones}</div></td>
      </tr>
    `;
  }).join('');
}

async function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado. No se pueden calcular alertas hasta completar la configuración.', 'err');
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">Sin datos.</td></tr>`;
    return;
  }
  try {
    showInfo('');
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">Recalculando…</td></tr>`;
    snapshot = await computarAlertas();
    render();
  } catch (err) {
    console.error(err);
    showInfo('Error al calcular alertas: ' + (err.message || err), 'err');
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">Error.</td></tr>`;
  }
}

async function cargarConfig() {
  try {
    const c = await obtenerConfig();
    cProx.value    = c.proxima_dias        ?? DEFAULT_CONFIG.proxima_dias;
    cProl.value    = c.prolongada_dias     ?? DEFAULT_CONFIG.prolongada_dias;
    cMant.value    = c.mantenimiento_dias  ?? DEFAULT_CONFIG.mantenimiento_dias;
    cEmail.value   = c.destinatario_email  || '';
    cEnabled.value = c.notificaciones_enabled ? 'true' : 'false';
    showConfigMsg('Config cargada.', 'ok');
  } catch (err) {
    showConfigMsg('No se pudo cargar config: ' + (err.message || err), 'err');
  }
}

async function guardarConfig() {
  try {
    btnConfigSave.disabled = true;
    showConfigMsg('Guardando…');
    await actualizarConfig({
      proxima_dias:           cProx.value,
      prolongada_dias:        cProl.value,
      mantenimiento_dias:     cMant.value,
      destinatario_email:     cEmail.value,
      notificaciones_enabled: cEnabled.value === 'true'
    }, currentUid);
    showConfigMsg('✓ Guardado. Recalculando alertas…', 'ok');
    await cargar();
  } catch (err) {
    showConfigMsg('Error al guardar: ' + (err.message || err), 'err');
  } finally {
    btnConfigSave.disabled = false;
  }
}

async function onTbodyClick(ev) {
  const ack = ev.target.closest('[data-ack]');
  const un  = ev.target.closest('[data-unack]');
  if (ack) {
    const alertId = ack.getAttribute('data-ack');
    const alerta = snapshot?.alertas.find((a) => a.id === alertId);
    if (!alerta) return;
    const nota = prompt(`Reconocer alerta:\n${alerta.titulo}\n\nNota (opcional):`, '');
    if (nota === null) return;
    try {
      ack.disabled = true;
      await reconocer(alertId, nota, currentUid);
      await cargar();
    } catch (err) {
      showInfo('No se pudo reconocer: ' + (err.message || err), 'err');
      ack.disabled = false;
    }
    return;
  }
  if (un) {
    const alertId = un.getAttribute('data-unack');
    if (!confirm('¿Quitar reconocimiento de esta alerta?')) return;
    try {
      un.disabled = true;
      await desreconocer(alertId);
      await cargar();
    } catch (err) {
      showInfo('No se pudo desreconocer: ' + (err.message || err), 'err');
      un.disabled = false;
    }
  }
}

// ── Init ──
fillSelects();
cargarConfig();

fSev.addEventListener('change', render);
fTipo.addEventListener('change', render);
fSearch.addEventListener('input', render);
fShow.addEventListener('change', render);
btnRel.addEventListener('click', cargar);
btnConfigSave.addEventListener('click', guardarConfig);
btnConfigReload.addEventListener('click', cargarConfig);
tbody.addEventListener('click', onTbodyClick);

onAdminAuthChange((user) => {
  currentUid = user?.uid || null;
});

$('btnLogout').addEventListener('click', async () => {
  try { await logoutAdmin(); } catch (_) {}
  location.replace(ADMIN_ROUTES.login);
});
$('yr').textContent = new Date().getFullYear();

cargar();
