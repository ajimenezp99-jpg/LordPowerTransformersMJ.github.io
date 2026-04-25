// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Marcas de Suministros (Fase 44)
// CRUD + suscripción realtime sobre /marcas, con sync automático
// del array marcas_disponibles[] en /suministros (vive en data layer F39).
// ══════════════════════════════════════════════════════════════

import {
  obtener, crear, actualizar, eliminar, suscribir, isReady
} from '../data/marcas.js';
import {
  suscribir as suscribirSuministros
} from '../data/suministros.js';

// ── Elementos ──
const $ = (id) => document.getElementById(id);
const tbody             = $('tbody');
const info              = $('infoBox');
const modal             = $('modal');
const modalTitle        = $('modalTitle');
const form              = $('form');
const fId               = $('fId');
const fSuministroMain   = $('fSuministroMain');
const fMarca            = $('fMarca');
const fObs              = $('fObs');
const formMsg           = $('formMsg');
const btnSave           = $('btnSave');
const fSuministroFilter = $('fSuministro');
const fBusqueda         = $('fBusqueda');

// ── Estado local (alimentado por suscripciones) ──
let cacheMarcas = [];
let cacheSuministros = [];
let unsubMarcas = null;
let unsubSums   = null;

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

// ── Selects de suministros (filtro + form) ──
function rebuildSuministroSelects() {
  // Filtro tope: "Todos" + opciones.
  const prevFilter = fSuministroFilter.value;
  const prevForm   = fSuministroMain.value;
  fSuministroFilter.innerHTML = '<option value="">Todos los suministros</option>';
  fSuministroMain.innerHTML   = '<option value="">— seleccione —</option>';
  for (const s of cacheSuministros) {
    const label = `${s.codigo} · ${s.nombre}`;
    fSuministroFilter.insertAdjacentHTML('beforeend',
      `<option value="${escHtml(s.codigo)}">${escHtml(label)}</option>`);
    fSuministroMain.insertAdjacentHTML('beforeend',
      `<option value="${escHtml(s.codigo)}" data-nombre="${escHtml(s.nombre)}">${escHtml(label)}</option>`);
  }
  // Restaurar selección si seguía válida.
  if (prevFilter && cacheSuministros.some((s) => s.codigo === prevFilter)) fSuministroFilter.value = prevFilter;
  if (prevForm   && cacheSuministros.some((s) => s.codigo === prevForm))   fSuministroMain.value   = prevForm;
}

function nombreSuministro(codigo) {
  const s = cacheSuministros.find((x) => x.codigo === codigo);
  return s ? s.nombre : '—';
}

// ── Filtros + render ──
function aplicarFiltros(rows) {
  const sFilt = fSuministroFilter.value;
  const q = fBusqueda.value.trim().toLowerCase();
  return rows.filter((r) => {
    if (sFilt && r.suministro_id !== sFilt) return false;
    if (q) {
      const blob = `${r.suministro_id} ${r.suministro_nombre || ''} ${r.marca || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  const rows = aplicarFiltros(cacheMarcas);
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="td-empty">${
      cacheMarcas.length === 0
        ? 'Sin marcas registradas. Use Importar Suministros o "Nueva marca".'
        : 'Sin coincidencias para los filtros.'
    }</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((m) => {
    const nombre = m.suministro_nombre || nombreSuministro(m.suministro_id);
    return `
    <tr data-id="${escHtml(m.id)}">
      <td>
        <code>${escHtml(m.suministro_id)}</code>
        <br><small style="opacity:.7">${escHtml(nombre)}</small>
      </td>
      <td><span class="marca-chip">${escHtml(m.marca || '—')}</span></td>
      <td>${escHtml(m.observaciones || '')}</td>
      <td class="col-actions">
        <button class="row-btn" data-act="edit" data-id="${escHtml(m.id)}" title="Editar" aria-label="Editar"><i data-lucide="pencil"></i></button>
        <button class="row-btn danger" data-act="del" data-id="${escHtml(m.id)}" title="Eliminar" aria-label="Eliminar"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`;
  }).join('');
  window.sgmRefreshIcons?.();
}

// ── Modal ──
function openModal(editing) {
  modalTitle.textContent = editing ? 'Editar marca' : 'Nueva marca';
  formMsg.className = 'msg';
  formMsg.textContent = '';
  // El suministro asociado es inmutable en edición; cambiar de
  // suministro = otra marca distinta. Para reasignar, eliminar y
  // crear nueva.
  fSuministroMain.disabled = !!editing;
  modal.style.display = 'flex';
  setTimeout(() => (editing ? fMarca : fSuministroMain).focus(), 50);
}
function closeModal() {
  modal.style.display = 'none';
  form.reset();
  fId.value = '';
  fSuministroMain.disabled = false;
}
function fillForm(m) {
  fId.value = m.id || '';
  fSuministroMain.value = m.suministro_id || '';
  fMarca.value = m.marca || '';
  fObs.value = m.observaciones || '';
}
function readForm() {
  const sumId = fSuministroMain.value;
  const opt = fSuministroMain.selectedOptions[0];
  return {
    suministro_id:     sumId,
    suministro_nombre: opt ? (opt.dataset.nombre || nombreSuministro(sumId)) : '',
    marca:             fMarca.value.trim().toUpperCase(),
    observaciones:     fObs.value.trim()
  };
}

// ── Suscripciones realtime ──
function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    tbody.innerHTML = '<tr><td colspan="4" class="td-empty">Sin conexión.</td></tr>';
    return;
  }
  if (unsubSums)   { try { unsubSums(); } catch (_) {} }
  if (unsubMarcas) { try { unsubMarcas(); } catch (_) {} }
  unsubSums = suscribirSuministros(
    {},
    (rows) => {
      cacheSuministros = rows;
      rebuildSuministroSelects();
      render();
    },
    (err) => console.warn('[suministros]', err)
  );
  unsubMarcas = suscribir(
    {},
    (rows) => { cacheMarcas = rows; render(); },
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
      const m = await obtener(id);
      if (!m) return showInfo('Marca no encontrada.', 'err');
      fillForm(m);
      openModal(true);
    } catch (err) { showInfo('Error al cargar: ' + err.message, 'err'); }
    return;
  }
  if (act === 'del') {
    const m = await obtener(id);
    if (!m) return showInfo('Marca no encontrada.', 'err');
    if (!confirm(`¿Eliminar la marca "${m.marca}" del suministro ${m.suministro_id}?\n\nSe quitará automáticamente del array marcas_disponibles del catálogo.`)) return;
    try {
      const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
      await eliminar(id, { uid, prev: m });
      showInfo(`✓ Marca eliminada de ${m.suministro_id}.`, 'ok');
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
    if (!data.suministro_id) throw new Error('Seleccione un suministro.');
    if (!data.marca)         throw new Error('Indique la marca.');
    // Detección de duplicado en cliente (la rule no impide duplicados,
    // pero el array marcas_disponibles usa arrayUnion por lo que no
    // duplicaría visualmente; mejor avisar antes de crear).
    if (!fId.value) {
      const dup = cacheMarcas.find(
        (x) => x.suministro_id === data.suministro_id && x.marca === data.marca
      );
      if (dup) throw new Error(`La marca "${data.marca}" ya está asignada a ${data.suministro_id}.`);
    }
    const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
    if (fId.value) {
      await actualizar(fId.value, data, { uid });
      showInfo(`✓ ${data.suministro_id} · ${data.marca} actualizada.`, 'ok');
    } else {
      await crear(data, uid);
      showInfo(`✓ ${data.suministro_id} · ${data.marca} creada.`, 'ok');
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

// ── Eventos UI ──
$('btnNuevo').addEventListener('click', () => { form.reset(); fId.value = ''; openModal(false); });
$('btnCancel').addEventListener('click', closeModal);
$('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
fSuministroFilter.addEventListener('change', render);
fBusqueda.addEventListener('input', render);

window.addEventListener('beforeunload', () => {
  if (unsubMarcas) try { unsubMarcas(); } catch (_) {}
  if (unsubSums)   try { unsubSums();   } catch (_) {}
});

// ── Init ──
arrancar();
