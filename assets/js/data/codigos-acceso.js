// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: códigos de acceso (Fase 12)
// Gate dinámico. Los códigos se almacenan HASHEADOS en Firestore
// (SHA-256 hex como docId). El plaintext nunca se envía ni se
// persiste — solo el admin que lo crea lo conoce.
//
// Reglas Firestore (ver firestore.rules):
//   - `get` público (requiere conocer el hash = conocer el código).
//   - `list` y `write` solo admins.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDoc, getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

const COL = 'gate_codes';

// Código maestro de bootstrap (fallback heredado de F0).
// Se mantiene para poder ingresar siempre que Firebase no esté
// configurado o que no exista ningún código activo en Firestore.
export const BOOTSTRAP_CODE = '97601992@';

// ── Helpers ──
function db() {
  const d = getDbSafe();
  if (!d) throw new Error('Firebase no configurado.');
  return d;
}

function colRef()       { return collection(db(), COL); }
function codeDocRef(id) { return doc(db(), COL, id);   }

/**
 * Hashea el código con SHA-256 y devuelve el hex en minúsculas.
 * El docId en Firestore es siempre este hash.
 */
export async function hashCode(plain) {
  const s = String(plain || '').trim();
  if (!s) return '';
  const data = new TextEncoder().encode(s);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Genera un código aleatorio alfanumérico (mayúsculas, minúsculas y
 * dígitos). Longitud por defecto 12.
 */
export function generarCodigoAleatorio(len = 12) {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += alfabeto[bytes[i] % alfabeto.length];
  return out;
}

function toIsoOrNull(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v.toDate) return v.toDate().toISOString();
  return null;
}

function sanitize(data, id) {
  return {
    id,
    label:        data.label || '',
    notes:        data.notes || '',
    active:       data.active !== false,
    expires_at:   toIsoOrNull(data.expires_at),
    created_at:   toIsoOrNull(data.created_at),
    created_by:   data.created_by || null
  };
}

/**
 * Devuelve `true` si el código en texto plano es válido:
 *   - match exacto con BOOTSTRAP_CODE, o
 *   - corresponde a un doc `gate_codes/{hash}` con active=true y sin
 *     expires_at vencido.
 *
 * No lanza: si Firebase no está configurado o falla la red, retorna
 * solo el resultado del fallback estático.
 */
export async function validarCodigo(plain) {
  const code = String(plain || '').trim();
  if (!code) return false;

  // 1. Bootstrap estático — siempre disponible para recuperación.
  if (code === BOOTSTRAP_CODE) return true;

  // 2. Lookup en Firestore (requiere conocer el hash).
  if (!isFirebaseConfigured) return false;
  try {
    const id   = await hashCode(code);
    const snap = await getDoc(codeDocRef(id));
    if (!snap.exists()) return false;
    const d = sanitize(snap.data(), id);
    if (d.active === false) return false;
    if (d.expires_at) {
      const exp = new Date(d.expires_at);
      if (!isNaN(exp) && exp.getTime() < Date.now()) return false;
    }
    return true;
  } catch (err) {
    console.warn('[SGM] validarCodigo falló:', err);
    return false;
  }
}

// ── CRUD admin ──

/**
 * Lista todos los códigos registrados (metadata, nunca el plaintext).
 * Requiere permisos admin por reglas Firestore.
 */
export async function listar() {
  if (!isFirebaseConfigured) return [];
  const snap = await getDocs(colRef());
  const rows = [];
  snap.forEach((docu) => rows.push(sanitize(docu.data(), docu.id)));
  rows.sort((a, b) => {
    const ta = a.created_at || '';
    const tb = b.created_at || '';
    return tb.localeCompare(ta);
  });
  return rows;
}

/**
 * Crea un nuevo código. Se recibe el plaintext, se hashea y se
 * guarda el hash como docId. El plaintext nunca se persiste.
 *
 * @param {string} plain  Texto plano del código
 * @param {object} meta   { label, notes, expires_at (ISO|null), active }
 * @param {string} uid    UID del admin que lo crea
 * @returns {Promise<{id:string}>}
 */
export async function crear(plain, meta = {}, uid = null) {
  const code = String(plain || '').trim();
  if (!code) throw new Error('Código vacío.');
  if (code.length < 4) throw new Error('El código debe tener al menos 4 caracteres.');

  const id = await hashCode(code);
  const ref = codeDocRef(id);

  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error('Ya existe un código con ese valor.');
  }

  const payload = {
    label:       String(meta.label || '').trim() || '(sin etiqueta)',
    notes:       String(meta.notes || '').trim(),
    active:      meta.active !== false,
    expires_at:  meta.expires_at || null,
    created_at:  serverTimestamp(),
    created_by:  uid || null
  };
  await setDoc(ref, payload);
  return { id };
}

/**
 * Actualiza solo la metadata (label, notes, active, expires_at).
 * No se puede editar el plaintext — si se quiere cambiar, se elimina
 * y se crea uno nuevo.
 */
export async function actualizarMetadata(id, meta = {}) {
  if (!id) throw new Error('id requerido.');
  const payload = {};
  if (typeof meta.label      === 'string')  payload.label      = meta.label.trim();
  if (typeof meta.notes      === 'string')  payload.notes      = meta.notes.trim();
  if (typeof meta.active     === 'boolean') payload.active     = meta.active;
  if (meta.expires_at !== undefined)        payload.expires_at = meta.expires_at || null;
  if (!Object.keys(payload).length) return;
  await updateDoc(codeDocRef(id), payload);
}

export async function eliminar(id) {
  if (!id) throw new Error('id requerido.');
  await deleteDoc(codeDocRef(id));
}

// ── Utilidades UI ──
export function estadoCodigo(row) {
  if (!row) return 'inactivo';
  if (row.active === false) return 'inactivo';
  if (row.expires_at) {
    const exp = new Date(row.expires_at);
    if (!isNaN(exp) && exp.getTime() < Date.now()) return 'vencido';
  }
  return 'activo';
}

export function hashPreview(id) {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return id.slice(0, 6) + '…' + id.slice(-4);
}
