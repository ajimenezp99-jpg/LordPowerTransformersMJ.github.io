// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Controlador admin/usuarios (Fase 14)
// CRUD de perfiles en /usuarios/{uid}. La cuenta de Firebase Auth
// se crea manualmente en la consola antes de registrar el perfil.
// ══════════════════════════════════════════════════════════════

import {
  listar, obtener, crear, actualizar, eliminar,
  ROLES, labelRol, isReady
} from '../data/usuarios.js';
import { logout, getSession } from '../auth/session-guard.js';

const $ = (id) => document.getElementById(id);

// Estado en memoria.
let cache = [];

// ── Logout ──
$('btnLogout').addEventListener('click', () => logout());
$('yr').textContent = new Date().getFullYear();

// ── Carga inicial ──
async function cargar() {
  const tbody = $('tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="td-empty">⋯ Cargando…</td></tr>';
  if (!isReady()) {
    tbody.innerHTML = '<tr><td colspan="6" class="td-empty">Firebase no configurado.</td></tr>';
    return;
  }
  try {
    cache = await listar();
    render();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">Error: ${err.message}</td></tr>`;
  }
}

function render() {
  const fRol    = $('fRol').value;
  const fEstado = $('fEstado').value;
  const q       = $('fSearch').value.trim().toLowerCase();

  const filtrados = cache.filter((u) => {
    if (fRol && u.rol !== fRol) return false;
    if (fEstado === 'activo'   && u.activo !== true)  return false;
    if (fEstado === 'inactivo' && u.activo !== false) return false;
    if (q) {
      const hay = [u.nombre, u.email, u.uid].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const tbody = $('tbody');
  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="td-empty">Sin resultados.</td></tr>';
    return;
  }

  const meUid = getSession()?.user?.uid || '';

  tbody.innerHTML = filtrados.map((u) => {
    const estadoPill = u.activo === false
      ? '<span class="cod-pill inactivo">INACTIVO</span>'
      : '<span class="cod-pill activo">ACTIVO</span>';
    const rolPill = u.rol === 'admin'
      ? '<span class="rol-pill admin">ADMINISTRADOR</span>'
      : '<span class="rol-pill tecnico">TÉCNICO</span>';
    const isMe = u.uid === meUid;
    const deleteBtn = isMe
      ? '<button class="btn-mini" disabled title="No puede eliminarse a sí mismo">Eliminar</button>'
      : `<button class="btn-mini danger" data-action="delete" data-uid="${u.uid}">Eliminar</button>`;
    return `
      <tr>
        <td>${esc(u.nombre) || '<em style="color:var(--muted)">(sin nombre)</em>'}</td>
        <td>${esc(u.email || '—')}</td>
        <td>${rolPill}</td>
        <td>${estadoPill}</td>
        <td><span class="cod-hash">${esc(u.uid).slice(0, 10)}…</span></td>
        <td class="col-actions">
          <button class="btn-mini" data-action="edit" data-uid="${u.uid}">Editar</button>
          ${deleteBtn}
        </td>
      </tr>
    `;
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ── Filtros ──
['fRol', 'fEstado', 'fSearch'].forEach((id) => {
  $(id).addEventListener('input', render);
  $(id).addEventListener('change', render);
});
$('btnReload').addEventListener('click', cargar);

// ── Modal Nuevo ──
const mNuevo = $('modalNuevo');
$('btnNuevo').addEventListener('click', () => abrirNuevo());
$('modalNuevoClose').addEventListener('click', () => mNuevo.style.display = 'none');
$('btnCancelNuevo').addEventListener('click', () => mNuevo.style.display = 'none');

function abrirNuevo() {
  $('formNuevo').reset();
  $('fActivo').checked = true;
  $('fNuevoRol').value = 'tecnico';
  $('formMsg').textContent = '';
  mNuevo.style.display = 'flex';
  $('fUid').focus();
}

$('formNuevo').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const uid    = $('fUid').value.trim();
  const email  = $('fEmail').value.trim();
  const nombre = $('fNombre').value.trim();
  const rol    = $('fNuevoRol').value;
  const activo = $('fActivo').checked;
  const msgEl  = $('formMsg');

  if (!uid || uid.length < 8) {
    msgEl.className = 'msg err'; msgEl.textContent = 'UID inválido.'; return;
  }
  if (!email) {
    msgEl.className = 'msg err'; msgEl.textContent = 'Correo requerido.'; return;
  }
  if (!ROLES.includes(rol)) {
    msgEl.className = 'msg err'; msgEl.textContent = 'Rol inválido.'; return;
  }

  msgEl.className = 'msg'; msgEl.textContent = '⋯ Guardando…';
  try {
    const existing = await obtener(uid);
    if (existing) {
      msgEl.className = 'msg err';
      msgEl.textContent = 'Ya existe un perfil para ese UID.';
      return;
    }
    const me = getSession()?.user?.uid || null;
    await crear({ uid, email, nombre, rol, activo, createdBy: me });
    msgEl.className = 'msg ok'; msgEl.textContent = '✓ Usuario creado.';
    await cargar();
    setTimeout(() => { mNuevo.style.display = 'none'; }, 600);
  } catch (err) {
    console.error(err);
    msgEl.className = 'msg err'; msgEl.textContent = '✗ ' + err.message;
  }
});

// ── Modal Editar ──
const mEditar = $('modalEditar');
$('modalEditarClose').addEventListener('click', () => mEditar.style.display = 'none');
$('btnCancelEditar').addEventListener('click', () => mEditar.style.display = 'none');

async function abrirEditar(uid) {
  const u = cache.find((x) => x.uid === uid) || await obtener(uid);
  if (!u) { alert('Usuario no encontrado.'); return; }
  $('eUid').value    = u.uid;
  $('eEmail').value  = u.email || '';
  $('eNombre').value = u.nombre || '';
  $('eRol').value    = u.rol || 'tecnico';
  $('eActivo').checked = u.activo !== false;
  $('formEditarMsg').textContent = '';
  mEditar.style.display = 'flex';
  $('eNombre').focus();
}

$('formEditar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const uid    = $('eUid').value;
  const nombre = $('eNombre').value.trim();
  const rol    = $('eRol').value;
  const activo = $('eActivo').checked;
  const msgEl  = $('formEditarMsg');

  const meUid = getSession()?.user?.uid || '';
  if (uid === meUid && rol !== 'admin') {
    msgEl.className = 'msg err';
    msgEl.textContent = 'No puede quitarse a sí mismo el rol admin desde aquí.';
    return;
  }
  if (uid === meUid && !activo) {
    msgEl.className = 'msg err';
    msgEl.textContent = 'No puede desactivar su propia cuenta.';
    return;
  }

  msgEl.className = 'msg'; msgEl.textContent = '⋯ Guardando…';
  try {
    await actualizar(uid, { nombre, rol, activo });
    msgEl.className = 'msg ok'; msgEl.textContent = '✓ Guardado.';
    await cargar();
    setTimeout(() => { mEditar.style.display = 'none'; }, 600);
  } catch (err) {
    console.error(err);
    msgEl.className = 'msg err'; msgEl.textContent = '✗ ' + err.message;
  }
});

// ── Acciones sobre filas ──
$('tbody').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;
  const uid = btn.dataset.uid;
  if (btn.dataset.action === 'edit') {
    abrirEditar(uid);
  } else if (btn.dataset.action === 'delete') {
    const u = cache.find((x) => x.uid === uid);
    if (!u) return;
    const ok = confirm(`Eliminar el perfil de ${u.email}?\nLa cuenta de Firebase Auth NO se borra; deshabilite o elimine la cuenta en la consola de Firebase si ese es su objetivo.`);
    if (!ok) return;
    try {
      await eliminar(uid);
      await cargar();
    } catch (err) {
      alert('No se pudo eliminar: ' + err.message);
    }
  }
});

// ── Init ──
cargar();
