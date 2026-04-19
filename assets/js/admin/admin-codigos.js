// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Códigos de Acceso (Fase 12)
// ══════════════════════════════════════════════════════════════

import {
  listar, crear, actualizarMetadata, eliminar,
  generarCodigoAleatorio, estadoCodigo, hashPreview
} from '../data/codigos-acceso.js';

import { logoutAdmin, onAdminAuthChange, ADMIN_ROUTES }
  from './admin-auth.js';

const $ = (id) => document.getElementById(id);

// ── Estado ──
let rows = [];
let currentUid = null;

onAdminAuthChange((user) => { currentUid = user?.uid || null; });

// ── Util UI ──
function showInfo(text, kind = 'info') {
  const box = $('infoBox');
  if (!box) return;
  if (!text) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }
  box.style.display = 'block';
  box.className = 'info-msg ' + (kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : '');
  box.textContent = text;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function toIsoFromDateInput(v) {
  if (!v) return null;
  // `v` es "YYYY-MM-DD". Expira al final del día local (23:59:59).
  const d = new Date(v + 'T23:59:59');
  if (isNaN(d)) return null;
  return d.toISOString();
}

function toDateInputFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ── Filtros / render ──
function filtrar(all) {
  const estado = $('fEstado').value;
  const q = ($('fSearch').value || '').toLowerCase().trim();
  return all.filter((r) => {
    if (estado && estadoCodigo(r) !== estado) return false;
    if (q) {
      const hay = `${r.label || ''} ${r.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  const tbody = $('tbody');
  const vistos = filtrar(rows);
  if (!vistos.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="td-empty">Sin códigos registrados.</td></tr>';
    return;
  }
  const frags = vistos.map((r) => {
    const est = estadoCodigo(r);
    const pill = `<span class="cod-pill ${est}">${est}</span>`;
    const acciones = `
      <button class="btn-mini" data-edit="${r.id}">Editar</button>
      <button class="btn-mini"
              data-toggle="${r.id}">${r.active === false ? 'Activar' : 'Desactivar'}</button>
      <button class="btn-mini danger" data-del="${r.id}">Eliminar</button>
    `;
    return `
      <tr>
        <td>
          <div class="cod-label">${escapeHtml(r.label || '(sin etiqueta)')}</div>
          ${r.notes ? `<div class="cod-notes">${escapeHtml(r.notes)}</div>` : ''}
        </td>
        <td>${pill}</td>
        <td>${fmtDate(r.expires_at)}</td>
        <td>${fmtDateTime(r.created_at)}</td>
        <td><code class="cod-hash">${hashPreview(r.id)}</code></td>
        <td class="col-actions">${acciones}</td>
      </tr>
    `;
  });
  tbody.innerHTML = frags.join('');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

// ── Carga ──
async function cargar() {
  showInfo('Cargando códigos…');
  try {
    rows = await listar();
    showInfo('');
    render();
  } catch (err) {
    console.error(err);
    showInfo('Error al cargar: ' + (err.message || err), 'err');
    rows = [];
    render();
  }
}

// ── Modal NUEVO ──
function abrirNuevo() {
  $('fCodigo').value = '';
  $('fLabel').value  = '';
  $('fExpira').value = '';
  $('fNotas').value  = '';
  $('fActivo').checked = true;
  $('formMsg').textContent = '';
  $('formMsg').className = 'msg';
  $('modalNuevo').style.display = 'flex';
  setTimeout(() => $('fCodigo').focus(), 100);
}
function cerrarNuevo() { $('modalNuevo').style.display = 'none'; }

async function guardarNuevo(ev) {
  ev.preventDefault();
  const codigo = ($('fCodigo').value || '').trim();
  const label  = ($('fLabel').value  || '').trim();
  const notas  = ($('fNotas').value  || '').trim();
  const expira = toIsoFromDateInput($('fExpira').value);
  const activo = $('fActivo').checked;

  const msg = $('formMsg');
  msg.className = 'msg';
  msg.textContent = '';

  if (codigo.length < 4) {
    msg.className = 'msg err';
    msg.textContent = 'El código debe tener al menos 4 caracteres.';
    return;
  }
  if (!label) {
    msg.className = 'msg err';
    msg.textContent = 'La etiqueta es obligatoria.';
    return;
  }

  $('btnGuardarNuevo').disabled = true;
  try {
    await crear(codigo, {
      label, notes: notas, expires_at: expira, active: activo
    }, currentUid);
    cerrarNuevo();
    mostrarRevelar(codigo, { label, expires_at: expira });
    await cargar();
  } catch (err) {
    console.error(err);
    msg.className = 'msg err';
    msg.textContent = 'No se pudo crear: ' + (err.message || err);
  } finally {
    $('btnGuardarNuevo').disabled = false;
  }
}

function mostrarRevelar(codigo, meta) {
  $('revelarCode').textContent = codigo;
  const parts = [`Etiqueta: ${meta.label}`];
  if (meta.expires_at) parts.push(`Expira: ${fmtDate(meta.expires_at)}`);
  $('revelarMeta').textContent = parts.join(' · ');
  $('modalRevelar').style.display = 'flex';
}
function cerrarRevelar() {
  $('modalRevelar').style.display = 'none';
  $('revelarCode').textContent = '—';
}

// ── Modal EDITAR ──
function abrirEditar(id) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  $('eId').value    = r.id;
  $('eHash').value  = r.id;
  $('eLabel').value = r.label || '';
  $('eNotas').value = r.notes || '';
  $('eExpira').value = toDateInputFromIso(r.expires_at);
  $('eActivo').checked = r.active !== false;
  $('formEditarMsg').textContent = '';
  $('formEditarMsg').className = 'msg';
  $('modalEditar').style.display = 'flex';
  setTimeout(() => $('eLabel').focus(), 100);
}
function cerrarEditar() { $('modalEditar').style.display = 'none'; }

async function guardarEditar(ev) {
  ev.preventDefault();
  const id    = $('eId').value;
  const label = ($('eLabel').value || '').trim();
  const notas = ($('eNotas').value || '').trim();
  const exp   = toIsoFromDateInput($('eExpira').value);
  const activo = $('eActivo').checked;

  const msg = $('formEditarMsg');
  msg.className = 'msg';
  msg.textContent = '';

  if (!label) {
    msg.className = 'msg err';
    msg.textContent = 'La etiqueta es obligatoria.';
    return;
  }

  $('btnGuardarEditar').disabled = true;
  try {
    await actualizarMetadata(id, {
      label, notes: notas, expires_at: exp, active: activo
    });
    cerrarEditar();
    await cargar();
  } catch (err) {
    console.error(err);
    msg.className = 'msg err';
    msg.textContent = 'No se pudo guardar: ' + (err.message || err);
  } finally {
    $('btnGuardarEditar').disabled = false;
  }
}

// ── Toggle activo / eliminar desde la tabla ──
async function onTbodyClick(ev) {
  const t = ev.target;
  const edit = t.closest('[data-edit]');
  const tog  = t.closest('[data-toggle]');
  const del  = t.closest('[data-del]');

  if (edit) { abrirEditar(edit.getAttribute('data-edit')); return; }

  if (tog) {
    const id = tog.getAttribute('data-toggle');
    const r  = rows.find((x) => x.id === id);
    if (!r) return;
    const nuevoEstado = !(r.active !== false);
    try {
      await actualizarMetadata(id, { active: nuevoEstado });
      await cargar();
    } catch (err) {
      showInfo('No se pudo cambiar el estado: ' + (err.message || err), 'err');
    }
    return;
  }

  if (del) {
    const id = del.getAttribute('data-del');
    const r  = rows.find((x) => x.id === id);
    if (!r) return;
    if (!confirm(`¿Eliminar el código "${r.label || 'sin etiqueta'}"? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminar(id);
      await cargar();
    } catch (err) {
      showInfo('No se pudo eliminar: ' + (err.message || err), 'err');
    }
    return;
  }
}

// ── Wire up ──
function wire() {
  $('btnReload').addEventListener('click', cargar);
  $('btnNuevo').addEventListener('click', abrirNuevo);
  $('modalNuevoClose').addEventListener('click', cerrarNuevo);
  $('btnCancelNuevo').addEventListener('click', cerrarNuevo);
  $('formNuevo').addEventListener('submit', guardarNuevo);

  $('btnGenerar').addEventListener('click', () => {
    $('fCodigo').value = generarCodigoAleatorio(12);
    $('fCodigo').focus();
    $('fCodigo').select();
  });

  $('modalEditarClose').addEventListener('click', cerrarEditar);
  $('btnCancelEditar').addEventListener('click', cerrarEditar);
  $('formEditar').addEventListener('submit', guardarEditar);

  $('modalRevelarClose').addEventListener('click', cerrarRevelar);
  $('btnRevelarOk').addEventListener('click', cerrarRevelar);
  $('btnCopiar').addEventListener('click', async () => {
    const code = $('revelarCode').textContent || '';
    try {
      await navigator.clipboard.writeText(code);
      $('btnCopiar').textContent = '✓ Copiado';
      setTimeout(() => { $('btnCopiar').textContent = 'Copiar'; }, 1500);
    } catch (_) {
      /* clipboard API bloqueada — silencioso */
    }
  });

  $('tbody').addEventListener('click', onTbodyClick);
  $('fEstado').addEventListener('change', render);
  $('fSearch').addEventListener('input',  render);

  $('btnLogout').addEventListener('click', async () => {
    try { await logoutAdmin(); } catch (_) {}
    location.replace(ADMIN_ROUTES.login);
  });

  $('yr').textContent = new Date().getFullYear();
}

wire();
cargar();
