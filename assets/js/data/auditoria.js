// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: auditoría (F35)
// ══════════════════════════════════════════════════════════════
import {
  collection, getDocs, query, where, orderBy, limit, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

const COL = 'auditoria';
function colRef() { return collection(getDbSafe(), COL); }
export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }

export async function listar({ accion, coleccion, uid, limite = 200 } = {}) {
  const cs = [];
  if (accion)    cs.push(where('accion', '==', accion));
  if (coleccion) cs.push(where('coleccion', '==', coleccion));
  if (uid)       cs.push(where('uid', '==', uid));
  cs.push(orderBy('at', 'desc'));
  cs.push(limit(limite));
  const snap = await getDocs(query(colRef(), ...cs));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtros, onData, onError) {
  const cs = [];
  if (filtros && filtros.accion)    cs.push(where('accion', '==', filtros.accion));
  if (filtros && filtros.coleccion) cs.push(where('coleccion', '==', filtros.coleccion));
  if (filtros && filtros.uid)       cs.push(where('uid', '==', filtros.uid));
  cs.push(orderBy('at', 'desc'), limit(filtros?.limite || 200));
  return onSnapshot(query(colRef(), ...cs),
    (s) => onData(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { if (onError) onError(err); });
}
