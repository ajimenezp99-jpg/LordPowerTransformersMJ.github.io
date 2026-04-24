// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: umbrales salud (Fase 18)
// ──────────────────────────────────────────────────────────────
// CRUD sobre `/umbrales_salud/global`. Un único documento con los
// umbrales activos del motor de salud. Se versiona via
// subcolección `/umbrales_salud/global/historial/{id}` (append-only).
// ══════════════════════════════════════════════════════════════

import {
  doc, collection, addDoc, getDoc, setDoc, onSnapshot,
  getDocs, query, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { BASELINE_UMBRALES_SALUD, mergeConBaseline } from '../domain/umbrales_salud_baseline.js';
import { auditar } from '../domain/audit.js';

const DOC_PATH   = ['umbrales_salud', 'global'];

function globalRef() {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return doc(db, ...DOC_PATH);
}
function historialRef() {
  const db = getDbSafe();
  return collection(db, ...DOC_PATH, 'historial');
}

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

/**
 * Devuelve el documento activo (o baseline si no existe).
 */
export async function obtenerUmbralesActivos() {
  if (!isReady()) return { ...BASELINE_UMBRALES_SALUD, _source: 'baseline' };
  try {
    const s = await getDoc(globalRef());
    if (!s.exists()) return { ...BASELINE_UMBRALES_SALUD, _source: 'baseline' };
    return { ...mergeConBaseline(s.data()), _source: 'firestore' };
  } catch (err) {
    console.warn('[umbrales_salud.obtener] fallback a baseline:', err);
    return { ...BASELINE_UMBRALES_SALUD, _source: 'baseline' };
  }
}

export function suscribirUmbrales(onData, onError) {
  if (!isReady()) {
    onData({ ...BASELINE_UMBRALES_SALUD, _source: 'baseline' });
    return () => {};
  }
  return onSnapshot(
    globalRef(),
    (s) => {
      if (!s.exists()) onData({ ...BASELINE_UMBRALES_SALUD, _source: 'baseline' });
      else onData({ ...mergeConBaseline(s.data()), _source: 'firestore' });
    },
    (err) => { if (onError) onError(err); else console.warn('[umbrales_salud.suscribir]', err); }
  );
}

/**
 * Guarda nuevos umbrales (reemplazo completo) y registra una
 * entrada en el historial.
 */
export async function guardarUmbrales(payload, { uid, razon } = {}) {
  const ref = globalRef();
  const now = serverTimestamp();
  // Escritura principal (merge=false: reemplazo explícito)
  await setDoc(ref, {
    ...payload,
    updatedAt: now,
    updatedBy: uid || null,
    schema_version: 'umbrales_v1'
  });
  // Log de cambio
  try {
    await addDoc(historialRef(), {
      at: now,
      uid: uid || null,
      razon: razon || '',
      payload
    });
  } catch (err) {
    console.warn('[umbrales_salud.historial] no se pudo registrar:', err);
  }
  // Audit global (F35)
  try {
    const { collection } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    await addDoc(collection(getDbSafe(), 'auditoria'),
      { ...auditar({
          accion: 'cambiar_umbrales', coleccion: 'umbrales_salud',
          docId: 'global', uid, nota: razon,
          referencia: 'MO.00418 §A3'
        }),
        at: now });
  } catch (_) { /* ignore */ }
}

/**
 * Restaura el baseline oficial MO.00418.
 */
export async function restaurarBaseline({ uid } = {}) {
  await guardarUmbrales(BASELINE_UMBRALES_SALUD, {
    uid,
    razon: 'Restauración al baseline oficial MO.00418.DE-GAC-AX.01 Ed. 02.'
  });
}

export async function listarHistorial({ limite = 50 } = {}) {
  if (!isReady()) return [];
  const q = query(historialRef(), orderBy('at', 'desc'), limit(limite));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { BASELINE_UMBRALES_SALUD };
