// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: subestaciones (Fase 16)
// ──────────────────────────────────────────────────────────────
// Entidad FK referenciada desde transformadores.ubicacion.subestacionId.
// La UI dedicada (`admin/subestaciones.html`) entra en F20; F16
// sólo deja el data layer y las rules listos para que la
// importación (F17) pueda poblar la colección.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import {
  sanitizarSubestacion, validarSubestacion
} from '../domain/subestacion_schema.js';

const COL_NAME = 'subestaciones';

function collRef() {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, COL_NAME);
}
function docRef(id) { return doc(getDbSafe(), COL_NAME, id); }

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

export async function listar(filtros = {}) {
  const constraints = [];
  if (filtros.zona)         constraints.push(where('zona',         '==', filtros.zona));
  if (filtros.departamento) constraints.push(where('departamento', '==', filtros.departamento));
  if (filtros.activa != null) constraints.push(where('activa', '==', !!filtros.activa));
  constraints.push(orderBy('codigo'));
  if (filtros.limite)       constraints.push(limit(filtros.limite));
  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtros = {}, onData, onError) {
  const constraints = [];
  if (filtros.zona)         constraints.push(where('zona',         '==', filtros.zona));
  if (filtros.departamento) constraints.push(where('departamento', '==', filtros.departamento));
  if (filtros.activa != null) constraints.push(where('activa', '==', !!filtros.activa));
  constraints.push(orderBy('codigo'));
  if (filtros.limite)       constraints.push(limit(filtros.limite));
  return onSnapshot(
    query(collRef(), ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[subestaciones.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function crear(data, uid) {
  const payload = sanitizarSubestacion(data);
  const errs = validarSubestacion(payload);
  if (errs.length) throw new Error('Validación subestación:\n  · ' + errs.join('\n  · '));
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  payload.createdBy = uid || null;
  const ref = await addDoc(collRef(), payload);
  return ref.id;
}

export async function actualizar(id, data) {
  const payload = sanitizarSubestacion(data);
  const errs = validarSubestacion(payload);
  if (errs.length) throw new Error('Validación subestación:\n  · ' + errs.join('\n  · '));
  delete payload.createdAt;
  delete payload.createdBy;
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);
}

export async function eliminar(id) {
  await deleteDoc(docRef(id));
}
