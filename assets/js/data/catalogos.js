// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: catálogos (F22)
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, getDoc, getDocs, setDoc,
  query, where, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import {
  SUBACTIVIDADES_BASELINE,
  MACROACTIVIDADES_BASELINE,
  CAUSANTES_BASELINE
} from '../domain/catalogos_baseline.js';

export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }

function colRef(nombre) { return collection(getDbSafe(), nombre); }

async function listarCol(nombre, opts = {}) {
  const cs = [];
  if (opts.activo != null) cs.push(where('activo', '==', !!opts.activo));
  cs.push(orderBy('codigo'));
  const snap = await getDocs(query(colRef(nombre), ...cs));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function upsertBatch(nombre, seed, uid) {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  const batch = writeBatch(db);
  // Usa `codigo` como docId para idempotencia.
  for (const item of seed) {
    const payload = {
      ...item,
      activo: true,
      seedMO00418: true,
      updatedAt: serverTimestamp(),
      updatedBy: uid || null
    };
    batch.set(doc(db, nombre, item.codigo), payload, { merge: true });
  }
  await batch.commit();
  return seed.length;
}

export const listarSubactividades   = (opts) => listarCol('subactividades', opts);
export const listarMacroactividades = (opts) => listarCol('macroactividades', opts);
export const listarCausantes        = (opts) => listarCol('causantes', opts);

/** Carga masiva (seed) de los tres catálogos baseline. Idempotente. */
export async function seedCatalogos({ uid } = {}) {
  const [nSub, nMacro, nCau] = await Promise.all([
    upsertBatch('subactividades',   SUBACTIVIDADES_BASELINE,   uid),
    upsertBatch('macroactividades', MACROACTIVIDADES_BASELINE, uid),
    upsertBatch('causantes',        CAUSANTES_BASELINE,        uid)
  ]);
  return { subactividades: nSub, macroactividades: nMacro, causantes: nCau };
}

export async function actualizarItem(coleccion, docId, patch) {
  await setDoc(doc(getDbSafe(), coleccion, docId), {
    ...patch, updatedAt: serverTimestamp()
  }, { merge: true });
}
