// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Correcciones (Fase 46)
// CRUD limitado: crear + editar. Sin eliminar (rule F40 lo bloquea
// y data layer F39 no lo expone).
// ══════════════════════════════════════════════════════════════

import {
  obtener, crear, actualizar, suscribir,
  TIPOS_CORRECCION, tipoCorreccionLabel, isReady
} from '../data/correcciones.js';

const $ = (id) => document.getElementById(id);
const tbody       = $('tbody');
const info        = $('infoBox');
const modal       = $('modal');
const modalTitle  = $('modalTitle');
const form        = $('form');
const fId         = $('fId');
const fNumero     = $('fNumero');
const fTipoMain   = $('fTipoMain');
const fTipoFilter = $('fTipoFilter');
const fUbicacion  = $('fUbicacion');
const fOriginal   = $('fOriginal');
const fCorregido  = $('fCorregido');
const fJustificacion = $('fJustificacion');
const fFuente     = $('fFuente');
const fBusqueda   = $('fBusqueda');
const formMsg     = $('formMsg');
const btnSave     = $('btnSave');

let cacheRows = [];
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

function fillSelects() {
  for (const t of TIPOS_CORRECCION) {
    fTipoFilter.insertAdjacentHTML('beforeend', `<option value="${t.value}">${t.label}</option>`);
    fTipoMain  .insertAdjacentHTML('beforeend', `<option value="${t.value}">${t.label}</option>`);
  }
}

function aplicarFiltros() {
  const q = fBusqueda.value.trim().toLowerCase();
  const t = fTipoFilter.value;
  return cacheRows.filter((r) => {
    if (t && r.tipo !== t) return false;
    if (q) {
      const blob = `${r.ubicacion || ''} ${r.justificacion || ''} ${r.valor_original || ''} ${r.valor_corregido || ''} ${r.fuente || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  const rows = aplicarFiltros();
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="td-empty">${
      cacheRows.length === 0 ? 'Sin correcciones registradas.' : 'Sin coincidencias.'
    }</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((c) => `
    <tr data-id="${escHtml(c.id)}">
      <td><strong>${escHtml(c.numero)}</strong></td>
      <td><span class="unidad-pill">${escHtml(tipoCorreccionLabel(c.tipo))}</span></td>
      <td><code>${escHtml(c.ubicacion || '—')}</code></td>
      <td><small>${escHtml(c.valor_original || '—')}</small><br><small style="color: #16A34A">→ ${escHtml(c.valor_corregido || '—')}</small></td>
      <td>${escHtml(c.justificacion || '—')}</td>
      <td><small style="opacity:.7">${escHtml(c.fuente || '—')}</small></td>
      <td class="col-actions">
        <button class="row-btn" data-act="edit" data-id="${escHtml(c.id)}" title="Editar" aria-label="Editar"><i data-lucide="pencil"></i></button>
      </td>
    </tr>
  `).join('');
  window.sgmRefreshIcons?.();
}

function openModal(editing) {
  modalTitle.textContent = editing ? 'Editar corrección' : 'Nueva corrección';
  formMsg.className = 'msg'; formMsg.textContent = '';
  modal.style.display = 'flex';
  setTimeout(() => fNumero.focus(), 50);
}
function closeModal() {
  modal.style.display = 'none';
  form.reset();
  fId.value = '';
}
function fillForm(c) {
  fId.value = c.id || '';
  fNumero.value = c.numero || '';
  fTipoMain.value = c.tipo || '';
  fUbicacion.value = c.ubicacion || '';
  fOriginal.value = c.valor_original || '';
  fCorregido.value = c.valor_corregido || '';
  fJustificacion.value = c.justificacion || '';
  fFuente.value = c.fuente || '';
}
function readForm() {
  return {
    numero: parseInt(fNumero.value, 10),
    tipo: fTipoMain.value,
    ubicacion: fUbicacion.value.trim(),
    valor_original: fOriginal.value.trim(),
    valor_corregido: fCorregido.value.trim(),
    justificacion: fJustificacion.value.trim(),
    fuente: fFuente.value.trim() || 'manual'
  };
}

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (act === 'edit') {
    try {
      const c = await obtener(id);
      if (!c) return showInfo('Corrección no encontrada.', 'err');
      fillForm(c);
      openModal(true);
    } catch (err) { showInfo('Error: ' + err.message, 'err'); }
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.className = 'msg'; formMsg.textContent = '';
  btnSave.disabled = true;
  const orig = btnSave.textContent;
  btnSave.textContent = 'GUARDANDO…';
  try {
    const data = readForm();
    const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
    if (fId.value) {
      await actualizar(fId.value, data, { uid });
      showInfo(`✓ Corrección #${data.numero} actualizada.`, 'ok');
    } else {
      await crear(data, uid);
      showInfo(`✓ Corrección #${data.numero} creada.`, 'ok');
    }
    closeModal();
  } catch (err) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ ' + (err.message || err);
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = orig;
  }
});

$('btnNuevo').addEventListener('click', () => {
  form.reset(); fId.value = '';
  // Sugerir siguiente número
  const max = cacheRows.reduce((m, r) => Math.max(m, r.numero || 0), 0);
  fNumero.value = max + 1;
  openModal(false);
});
$('btnCancel').addEventListener('click', closeModal);
$('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
fBusqueda.addEventListener('input', render);
fTipoFilter.addEventListener('change', render);

function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    return;
  }
  if (unsub) try { unsub(); } catch (_) {}
  unsub = suscribir({}, (rows) => { cacheRows = rows; render(); }, (err) => {
    console.error(err);
    showInfo('Error realtime: ' + (err.message || err), 'err');
  });
}
window.addEventListener('beforeunload', () => { if (unsub) try { unsub(); } catch (_) {} });

fillSelects();
arrancar();
