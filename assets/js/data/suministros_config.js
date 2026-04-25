// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: suministros_config (Fase 39)
// ──────────────────────────────────────────────────────────────
// Singleton /suministros_config/global. Controla el motor de stock:
//   · permitirNegativo (default false)
//   · umbral_critico_pct (0.20)
//   · umbral_medio_pct (0.50)
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  setDoc, getDoc, onSnapshot, serverTimestamp, addDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe } from '../firebase-init.js';
import { DEFAULT_SUMINISTROS_CONFIG } from '../domain/stock_calculo.js';
import { auditar, persistirAuditoria } from '../domain/audit.js';

const COL_NAME = 'suministros_config';
const DOC_ID   = 'global';

export { DEFAULT_SUMINISTROS_CONFIG };

function db() {
  const d = getDbSafe();
  if (!d) throw new Error('Firebase no inicializado.');
  return d;
}
function configRef() { return doc(db(), COL_NAME, DOC_ID); }

function auditarSeguro(entry) {
  return persistirAuditoria(
    { db: getDbSafe(), addDoc, collection, serverTimestamp },
    entry
  );
}

/**
 * Lee el config actual mergeado con defaults. Si el doc no existe
 * (caso inicial o sin permisos), devuelve los defaults sin lanzar.
 */
export async function obtenerConfig() {
  try {
    const s = await getDoc(configRef());
    if (s.exists()) return { ...DEFAULT_SUMINISTROS_CONFIG, ...s.data() };
  } catch (_) { /* sin permisos: defaults */ }
  return { ...DEFAULT_SUMINISTROS_CONFIG };
}

/**
 * Persiste cambios al config. Solo admin (rule F40).
 * `parches` es un objeto parcial que se mergea con los defaults.
 */
export async function guardarConfig(parches, uid) {
  const merged = { ...DEFAULT_SUMINISTROS_CONFIG, ...parches };
  // Saneo defensivo: types correctos.
  merged.permitirNegativo   = !!merged.permitirNegativo;
  merged.umbral_critico_pct = +merged.umbral_critico_pct || DEFAULT_SUMINISTROS_CONFIG.umbral_critico_pct;
  merged.umbral_medio_pct   = +merged.umbral_medio_pct   || DEFAULT_SUMINISTROS_CONFIG.umbral_medio_pct;
  merged.updatedAt = serverTimestamp();
  merged.updatedBy = uid || null;
  await setDoc(configRef(), merged, { merge: true });
  await auditarSeguro(auditar({
    accion: 'cambiar_umbrales', coleccion: COL_NAME, docId: DOC_ID,
    uid, nota: `permitirNegativo=${merged.permitirNegativo}, crit=${merged.umbral_critico_pct}, medio=${merged.umbral_medio_pct}`
  }));
}

/**
 * Suscripción realtime al config.
 */
export function suscribirConfig(onData, onError) {
  return onSnapshot(
    configRef(),
    (s) => onData(s.exists() ? { ...DEFAULT_SUMINISTROS_CONFIG, ...s.data() } : { ...DEFAULT_SUMINISTROS_CONFIG }),
    (err)  => { if (onError) onError(err); else console.warn('[suministros_config.suscribir]', err); }
  );
}
