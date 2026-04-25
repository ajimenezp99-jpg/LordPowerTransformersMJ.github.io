// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: correcciones (Fase 39)
// ──────────────────────────────────────────────────────────────
// Apéndice de fidelidad. Append + update permitidos para fix de
// typos del registro. Delete bloqueado por rule (la rule de F40
// impide DELETE; aquí no exponemos `eliminar` para mantener la
// superficie consistente con la regla server-side).
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import {
  sanitizarCorreccion, validarCorreccion
} from '../domain/correccion_schema.js';
import { auditar, persistirAuditoria } from '../domain/audit.js';

const COL_NAME = 'correcciones';

export { sanitizarCorreccion, validarCorreccion };
export { TIPOS_CORRECCION, tipoCorreccionLabel } from '../domain/schema.js';

function db() {
  const d = getDbSafe();
  if (!d) throw new Error('Firebase no inicializado.');
  return d;
}
function collRef() { return collection(db(), COL_NAME); }
function docRef(id) { return doc(db(), COL_NAME, id); }

function prepararDoc(input, uid) {
  const sane = sanitizarCorreccion(input);
  const errs = validarCorreccion(sane);
  if (errs.length > 0) throw new Error('Validación falló:\n  · ' + errs.join('\n  · '));
  return { ...sane, createdBy: uid || null };
}

function auditarSeguro(entry) {
  return persistirAuditoria(
    { db: getDbSafe(), addDoc, collection, serverTimestamp },
    entry
  );
}

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

export async function listar(filtros = {}) {
  const constraints = [];
  if (filtros.tipo) constraints.push(where('tipo', '==', filtros.tipo));
  constraints.push(orderBy('tipo'));
  constraints.push(orderBy('numero'));
  if (filtros.limite) constraints.push(limit(filtros.limite));
  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtros = {}, onData, onError) {
  const constraints = [];
  if (filtros.tipo) constraints.push(where('tipo', '==', filtros.tipo));
  constraints.push(orderBy('tipo'));
  constraints.push(orderBy('numero'));
  if (filtros.limite) constraints.push(limit(filtros.limite));
  return onSnapshot(
    query(collRef(), ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[correcciones.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function crear(data, uid) {
  const payload = prepararDoc(data, uid);
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collRef(), payload);
  await auditarSeguro(auditar({
    accion: 'crear', coleccion: COL_NAME, docId: ref.id,
    uid, nota: `Corrección #${payload.numero} (${payload.tipo})`
  }));
  return ref.id;
}

export async function actualizar(id, data, opts = {}) {
  const payload = prepararDoc(data);
  delete payload.createdBy;
  await updateDoc(docRef(id), payload);
  await auditarSeguro(auditar({
    accion: 'actualizar', coleccion: COL_NAME, docId: id, uid: opts.uid
  }));
}

// NOTA: no se exporta `eliminar`. La rule F40 bloqueará delete
// server-side; no exponer aquí evita confusión en los callers.
