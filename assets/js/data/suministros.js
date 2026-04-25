// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: suministros (Fase 39)
// ──────────────────────────────────────────────────────────────
// CRUD + suscribir realtime sobre /suministros. Sigue la firma
// canónica del repo (transformadores.js como referencia).
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy, limit,
  onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import {
  sanitizarSuministro, validarSuministro
} from '../domain/suministro_schema.js';
import { auditar, diffSimple, persistirAuditoria } from '../domain/audit.js';

const COL_NAME = 'suministros';

export { sanitizarSuministro, validarSuministro };
export { UNIDADES, unidadLabel } from '../domain/schema.js';

function collRef() {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, COL_NAME);
}
function docRef(id) { return doc(getDbSafe(), COL_NAME, id); }

function prepararDoc(input, uid) {
  const sane = sanitizarSuministro(input);
  const errs = validarSuministro(sane);
  if (errs.length > 0) throw new Error('Validación falló:\n  · ' + errs.join('\n  · '));
  return { ...sane, createdBy: uid || null };
}

function auditarSeguro(entry) {
  return persistirAuditoria(
    { db: getDbSafe(), addDoc: setDoc, collection, serverTimestamp },
    entry
  );
}

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

export async function listar(filtros = {}) {
  const constraints = [orderBy('codigo')];
  if (filtros.limite) constraints.push(limit(filtros.limite));
  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtros = {}, onData, onError) {
  const constraints = [orderBy('codigo')];
  if (filtros.limite) constraints.push(limit(filtros.limite));
  return onSnapshot(
    query(collRef(), ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[suministros.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/**
 * `id` es opcional. Si se omite, se usa `data.codigo` como docId
 * (PK humana, decisión del plan: no auto-IDs para suministros).
 */
export async function crear(data, uid) {
  const payload = prepararDoc(data, uid);
  const id = payload.codigo;
  if (!id) throw new Error('codigo es obligatorio para crear un suministro.');
  const exists = await obtener(id);
  if (exists) throw new Error(`Suministro ${id} ya existe.`);
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  await setDoc(docRef(id), payload);
  await auditarSeguro(auditar({
    accion: 'crear', coleccion: COL_NAME, docId: id,
    uid, nota: `Alta de ${id}`
  }));
  return id;
}

export async function actualizar(id, data, opts = {}) {
  const prev = opts.prev || (await obtener(id));
  const payload = prepararDoc(data);
  delete payload.createdBy;
  // PK humana inmutable (decisión del plan).
  delete payload.codigo;
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);
  const camposClave = ['nombre', 'unidad', 'stock_inicial', 'valor_unitario', 'observaciones'];
  const a = {}; const b = {};
  for (const k of camposClave) { if (prev) a[k] = prev[k]; b[k] = payload[k]; }
  await auditarSeguro(auditar({
    accion: 'actualizar', coleccion: COL_NAME, docId: id,
    uid: opts.uid, diff: diffSimple(a, b)
  }));
}

export async function eliminar(id, opts = {}) {
  const prev = opts.prev || (await obtener(id));
  await deleteDoc(docRef(id));
  await auditarSeguro(auditar({
    accion: 'eliminar', coleccion: COL_NAME, docId: id,
    uid: opts.uid, nota: prev ? `Eliminado: ${prev.codigo} - ${prev.nombre}` : ''
  }));
}
