// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Gestión Documental · Vista pública (Fase 9)
// Solo lectura, con KPIs, filtros y búsqueda local.
// ══════════════════════════════════════════════════════════════

import {
  listar,
  CATEGORIAS_DOC, NORMAS_DOC,
  categoriaLabel, normaLabel,
  formatSize, iconoPorMime,
  isReady
} from './data/documentos.js';

const $ = (id) => document.getElementById(id);
const tbody    = $('tbody');
const info     = $('infoBox');
const counter  = $('counter');

const fCategoria = $('fCategoria');
const fNorma     = $('fNorma');
const fSearch    = $('fSearch');

const kTotal = $('kTotal');
const kProt  = $('kProt');
const kInf   = $('kInf');
const kPeso  = $('kPeso');

let cache = [];

function fillSelects() {
  for (const c of CATEGORIAS_DOC) {
    fCategoria.insertAdjacentHTML('beforeend', `<option value="${c.value}">${c.label}</option>`);
  }
  for (const n of NORMAS_DOC) {
    fNorma.insertAdjacentHTML('beforeend', `<option value="${n.value}">${n.label}</option>`);
  }
}

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

function updateKpis(items) {
  kTotal.textContent = items.length;
  kProt.textContent  = items.filter((d) => d.categoria === 'protocolo').length;
  kInf.textContent   = items.filter((d) => d.categoria === 'informe').length;
  const bytes = items.reduce((acc, d) => acc + (+d.size || 0), 0);
  kPeso.textContent = formatSize(bytes);
}

function render(rows) {
  counter.textContent = `${rows.length} resultado${rows.length === 1 ? '' : 's'}`;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Sin documentos que coincidan.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((d) => {
    const link = d.downloadURL
      ? `<a href="${escAttr(d.downloadURL)}" target="_blank" rel="noopener" class="doc-link">${escHtml(d.filename || 'descargar')}</a>`
      : `<span style="color:var(--muted)">${escHtml(d.filename || '—')}</span>`;
    return `
    <tr>
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
      <td>${escHtml(d.fecha_emision || '—')}</td>
      <td>${escHtml(d.autor || '—')}</td>
    </tr>`;
  }).join('');
}

function aplicarFiltros() {
  const q = String(fSearch.value || '').trim().toLowerCase();
  const cat = fCategoria.value;
  const norma = fNorma.value;
  const filtered = cache.filter((d) => {
    if (cat && d.categoria !== cat) return false;
    if (norma && d.norma_aplicable !== norma) return false;
    if (!q) return true;
    const hay = [
      d.codigo, d.titulo, d.descripcion, d.autor,
      d.transformadorCodigo, d.filename
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  render(filtered);
}

async function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado. Los documentos aparecerán cuando se complete la configuración.', 'err');
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Sin conexión con Firestore/Storage.</td></tr>';
    kTotal.textContent = kProt.textContent = kInf.textContent = '—';
    kPeso.textContent = '—';
    return;
  }
  try {
    showInfo('');
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Cargando…</td></tr>';
    cache = await listar({});
    updateKpis(cache);
    aplicarFiltros();
  } catch (err) {
    console.error(err);
    showInfo('Error al listar: ' + (err.message || err), 'err');
    tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Error de carga.</td></tr>';
  }
}

// ── Eventos ──
fCategoria.addEventListener('change', aplicarFiltros);
fNorma.addEventListener('change', aplicarFiltros);
fSearch.addEventListener('input', aplicarFiltros);

$('btnLogout').addEventListener('click', () => {
  try { sessionStorage.removeItem('sgm.access'); } catch (_) {}
  location.href = '../index.html';
});
$('yr').textContent = new Date().getFullYear();

// ── Init ──
fillSelects();
cargar();
