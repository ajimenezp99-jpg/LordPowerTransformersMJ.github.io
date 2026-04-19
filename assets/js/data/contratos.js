// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: contratos (F21)
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { sanitizarContrato, validarContrato } from '../domain/contrato_schema.js';

const COL = 'contratos';
function colRef() { return collection(getDbSafe(), COL); }
function docRef(id) { return doc(getDbSafe(), COL, id); }

export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }

export async function listar({ estado, aliado, limite = 100 } = {}) {
  const cs = [];
  if (estado) cs.push(where('estado', '==', estado));
  if (aliado) cs.push(where('aliado', '==', aliado));
  cs.push(orderBy('codigo'));
  if (limite) cs.push(limit(limite));
  const snap = await getDocs(query(colRef(), ...cs));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtros, onData, onError) {
  const cs = [];
  if (filtros && filtros.estado) cs.push(where('estado', '==', filtros.estado));
  cs.push(orderBy('codigo'));
  return onSnapshot(query(colRef(), ...cs),
    (s) => onData(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { if (onError) onError(err); });
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function crear(data, uid) {
  const payload = sanitizarContrato(data);
  const errs = validarContrato(payload);
  if (errs.length) throw new Error('Validación:\n  · ' + errs.join('\n  · '));
  const ref = await addDoc(colRef(), {
    ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: uid || null
  });
  return ref.id;
}

export async function actualizar(id, data) {
  const payload = sanitizarContrato(data);
  const errs = validarContrato(payload);
  if (errs.length) throw new Error('Validación:\n  · ' + errs.join('\n  · '));
  await updateDoc(docRef(id), { ...payload, updatedAt: serverTimestamp() });
}

export async function eliminar(id) { await deleteDoc(docRef(id)); }
