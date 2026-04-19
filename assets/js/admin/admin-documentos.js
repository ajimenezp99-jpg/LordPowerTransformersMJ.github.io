// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Gestión Documental (Fase 9)
// Controlador de la tabla + modal upload/edit sobre /documentos.
// ══════════════════════════════════════════════════════════════

import {
  listar, obtener, subir, actualizarMetadata, eliminar,
  CATEGORIAS_DOC, NORMAS_DOC,
  categoriaLabel, normaLabel,
  formatSize, iconoPorMime,
  isReady, MAX_FILE_MB
} from '../data/documentos.js';

import {
  listar as listarTransformadores,
  departamentoLabel
} from '../data/transformadores.js';

import { logoutAdmin, ADMIN_ROUTES } from './admin-auth.js';

// ── Elementos ──
const $ = (id) => document.getElementById(id);
const tbody    = $('tbody');
const info     = $('infoBox');
const modal    = $('modal');
const modalTitle = $('modalTitle');
const form     = $('form');
const fId      = $('fId');
const fCodigo  = $('fCodigo');
const fTitulo  = $('fTitulo');
const fDescripcion = $('fDescripcion');
const fCategoriaMain = $('fCategoriaMain');
const fNormaMain = $('fNormaMain');
const fFechaEmision = $('fFechaEmision');
const fTransformador = $('fTransformador');
const fAutor   = $('fAutor');
const fFile    = $('fFile');
const fileWrap = $('fileWrap');
const dropzone = $('dropzone');
const upProgress = $('upProgress');
const upBar    = $('upBar');
const upLabel  = $('upLabel');
const formMsg  = $('formMsg');
const btnSave  = $('btnSave');

const fCategoriaFilter = $('fCategoria');
const fNormaFilter     = $('fNorma');

// ── Poblar selects ──
function fillSelects() {
  for (const c of CATEGORIAS_DOC) {
    fCategoriaFilter.insertAdjacentHTML('beforeend', `<option value="${c.value}">${c.label}</option>`);
    fCategoriaMain.insertAdjacentHTML('beforeend',   `<option value="${c.value}">${c.label}</option>`);
  }
  for (const n of NORMAS_DOC) {
    fNormaFilter.insertAdjacentHTML('beforeend', `<option value="${n.value}">${n.label}</option>`);
    fNormaMain.insertAdjacentHTML('beforeend',   `<option value="${n.value}">${n.label}</option>`);
  }
}

async function fillTransformadores() {
  try {
    const items = await listarTransformadores({});
    fTransformador.innerHTML = '<option value="">— No asociado —</option>' +
      items.map((t) =>
        `<option value="${t.id}" data-codigo="${escAttr(t.codigo)}">` +
        `${escHtml(t.codigo)} · ${escHtml(t.nombre)} (${escHtml(departamentoLabel(t.departamento))})` +
        `</option>`
      ).join('');
  } catch (err) {
    console.warn('No se pudieron cargar transformadores:', err);
  }
}

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
function escAttr(s) { return escHtml(s); }

function render(rows) {
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Sin documentos registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((d) => {
    const link = d.downloadURL
      ? `<a href="${escAttr(d.downloadURL)}" target="_blank" rel="noopener" class="doc-link">${escHtml(d.filename || 'descargar')}</a>`
      : `<span style="color:var(--muted)">${escHtml(d.filename || '—')}</span>`;
    return `
    <tr data-id="${d.id}">
      <td><code>${escHtml(d.codigo)}</code></td>
      <td>${escHtml(d.titulo)}<br><small style="opacity:.6">${escHtml(d.descripcion || '')}</small></td>
      <td><span class="cat-pill ${escHtml(d.categoria)}">${escHtml(categoriaLabel(d.categoria))}</span></td>
      <td><span class="norma-pill">${escHtml(normaLabel(d.norma_aplicable))}</span></td>
      <td>
        <div class="doc-file">
          <span class="ico">${iconoPorMime(d.mime)}</span>
          <div>
            ${link}
            <div class="meta">${escHtml(formatSize(d.size))}</div>
          </div>
        </div>
      </td>
      <td><span class="doc-status ${escHtml(d.status || 'listo')}">${escHtml(d.status || 'listo')}</span></td>
      <td class="col-actions">
        <button class="row-btn" data-act="edit" data-id="${d.id}">Editar</button>
        <button class="row-btn danger" data-act="del" data-id="${d.id}">Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Modal ──
function openModal(editing) {
  modalTitle.textContent = editing ? 'Editar documento' : 'Subir documento';
  formMsg.className = 'msg';
  formMsg.textContent = '';
  // En edición, ocultar campo archivo (los binarios no se sustituyen en esta fase).
  fileWrap.style.display = editing ? 'none' : 'block';
  fFile.required = !editing;
  modal.style.display = 'flex';
  resetProgress();
  setTimeout(() => fCodigo.focus(), 50);
}
function closeModal() {
  modal.style.display = 'none';
  form.reset();
  fId.value = '';
  resetProgress();
}
function resetProgress() {
  upProgress.style.display = 'none';
  upLabel.style.display = 'none';
  upBar.style.width = '0%';
  upLabel.textContent = '0 %';
  dropzone.classList.remove('selected');
}

function fillForm(d) {
  fId.value = d.id || '';
  fCodigo.value = d.codigo || '';
  fTitulo.value = d.titulo || '';
  fDescripcion.value = d.descripcion || '';
  fCategoriaMain.value = d.categoria || 'otro';
  fNormaMain.value = d.norma_aplicable || 'NINGUNA';
  fFechaEmision.value = d.fecha_emision || '';
  fTransformador.value = d.transformadorId || '';
  fAutor.value = d.autor || '';
}
function readForm() {
  const sel = fTransformador.selectedOptions[0];
  const trCodigo = sel ? (sel.dataset.codigo || '') : '';
  return {
    codigo: fCodigo.value,
    titulo: fTitulo.value,
    descripcion: fDescripcion.value,
    categoria: fCategoriaMain.value,
    norma_aplicable: fNormaMain.value,
    fecha_emision: fFechaEmision.value,
    transformadorId: fTransformador.value,
    transformadorCodigo: trCodigo,
    autor: fAutor.value
  };
}

// ── Cargar ──
async function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado. Completa assets/js/firebase-config.js para habilitar la gestión documental.', 'err');
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Sin conexión con Firestore/Storage.</td></tr>';
    return;
  }
  try {
    showInfo('');
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Cargando…</td></tr>';
    const rows = await listar({
      categoria: fCategoriaFilter.value || undefined,
      norma:     fNormaFilter.value     || undefined
    });
    render(rows);
  } catch (err) {
    console.error(err);
    showInfo('Error al listar: ' + (err.message || err), 'err');
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Error de carga.</td></tr>';
  }
}

// ── Eventos tabla ──
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;

  if (act === 'edit') {
    try {
      const d = await obtener(id);
      if (!d) return showInfo('Documento no encontrado.', 'err');
      fillForm(d);
      openModal(true);
    } catch (err) { showInfo('Error al cargar: ' + err.message, 'err'); }
    return;
  }

  if (act === 'del') {
    const d = await obtener(id);
    const label = d ? `${d.codigo} · ${d.titulo}` : id;
    if (!confirm(`¿Eliminar definitivamente el documento ${label}?\n\nSe borrará también el archivo asociado en Storage. Esta acción no se puede deshacer.`)) return;
    try {
      await eliminar(id);
      showInfo('✓ Documento eliminado.', 'ok');
      await cargar();
    } catch (err) { showInfo('Error al eliminar: ' + err.message, 'err'); }
  }
});

// ── Input file ──
fFile.addEventListener('change', () => {
  if (fFile.files && fFile.files[0]) {
    dropzone.classList.add('selected');
  } else {
    dropzone.classList.remove('selected');
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
      // Edición: solo metadata.
      await actualizarMetadata(fId.value, data);
      showInfo(`✓ Documento ${data.codigo} actualizado.`, 'ok');
    } else {
      // Alta: requiere archivo + subida.
      const file = fFile.files && fFile.files[0];
      if (!file) throw new Error('Debe seleccionar un archivo.');
      upProgress.style.display = 'block';
      upLabel.style.display = 'block';
      btnSave.textContent = 'SUBIENDO…';
      await subir(data, file, (pct) => {
        upBar.style.width = pct + '%';
        upLabel.textContent = pct + ' %';
      }, uid);
      showInfo(`✓ Documento ${data.codigo} subido.`, 'ok');
    }
    closeModal();
    await cargar();
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
  openModal(false);
});
$('btnCancel').addEventListener('click', closeModal);
$('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
$('btnReload').addEventListener('click', cargar);
fCategoriaFilter.addEventListener('change', cargar);
fNormaFilter.addEventListener('change', cargar);

$('btnLogout').addEventListener('click', async () => {
  try { await logoutAdmin(); } catch (_) {}
  location.replace(ADMIN_ROUTES.login);
});
$('yr').textContent = new Date().getFullYear();

// ── Init ──
fillSelects();
fillTransformadores();
cargar();
// Exponer constante al HTML informativo si se quisiera mostrar en runtime.
void MAX_FILE_MB;
