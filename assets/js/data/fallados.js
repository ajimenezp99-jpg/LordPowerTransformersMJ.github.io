// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: fallados (F25)
// ══════════════════════════════════════════════════════════════
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { sanitizarFallado, validarFallado } from '../domain/fallados_schema.js';

const COL = 'fallados';
function colRef() { return collection(getDbSafe(), COL); }
function docRef(id) { return doc(getDbSafe(), COL, id); }
export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }

export async function listar({ transformadorId, tipo_falla, limite = 100 } = {}) {
  const cs = [];
  if (transformadorId) cs.push(where('transformadorId', '==', transformadorId));
  if (tipo_falla)      cs.push(where('tipo_falla', '==', tipo_falla));
  cs.push(orderBy('fecha_falla', 'desc'));
  const snap = await getDocs(query(colRef(), ...cs));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function crear(data, uid) {
  const payload = sanitizarFallado(data);
  const errs = validarFallado(payload);
  if (errs.length) throw new Error('Validación:\n  · ' + errs.join('\n  · '));
  const ref = await addDoc(colRef(), {
    ...payload, createdAt: serverTimestamp(), createdBy: uid || null
  });
  return ref.id;
}

export async function actualizar(id, data) {
  const payload = sanitizarFallado(data);
  const errs = validarFallado(payload);
  if (errs.length) throw new Error('Validación:\n  · ' + errs.join('\n  · '));
  await updateDoc(docRef(id), { ...payload, updatedAt: serverTimestamp() });
}

export async function eliminar(id) { await deleteDoc(docRef(id)); }
