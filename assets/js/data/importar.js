// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: importador (Fase 17)
// ──────────────────────────────────────────────────────────────
// Persistencia de los documentos v2 producidos por el parser
// puro (`domain/importador.js`). Graba además el job en
// `/importaciones/{jobId}` con el reporte de discrepancias
// Excel ↔ MO.00418 como entregable auditable.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, setDoc, getDoc, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { auditar } from '../domain/audit.js';

const COL_TX    = 'transformadores';
const COL_JOBS  = 'importaciones';

// Firestore batch: máximo 500 writes por batch.
const BATCH_LIMIT = 450;

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

function colTxRef() { return collection(getDbSafe(), COL_TX); }
function colJobsRef() { return collection(getDbSafe(), COL_JOBS); }

/**
 * Busca un transformador existente por `codigo` (clave natural).
 * @returns {string|null} docId si existe, null si es nuevo.
 */
async function buscarPorCodigo(codigo) {
  if (!codigo) return null;
  // Búsqueda no-indexada simple: getDoc por codigo como docId.
  // En v2, docIds son autogenerados, así que usamos query.
  const { query, where, getDocs, limit } = await import(
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'
  );
  const q = query(colTxRef(), where('codigo', '==', codigo), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * Persiste los payloads procesados. Idempotente por `codigo`:
 * si existe, hace update; si no, addDoc.
 *
 * @param {Array<{hoja, docV2, diagnostico}>} resultados
 * @param {object} reporte
 * @param {{uid, dryRun, nombre_archivo, onProgress}} opts
 */
export async function persistirImportacion(resultados, reporte, opts = {}) {
  const { uid, dryRun = false, nombre_archivo = '', onProgress } = opts;
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');

  let creados = 0, actualizados = 0, fallidos = 0;
  let batch = writeBatch(db);
  let count = 0;

  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];
    if (r.error) { fallidos += 1; continue; }
    const codigo = r.docV2 && r.docV2.codigo;
    try {
      const existingId = codigo ? await buscarPorCodigo(codigo) : null;
      if (existingId) {
        if (!dryRun) {
          batch.set(doc(db, COL_TX, existingId), {
            ...r.docV2,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        actualizados += 1;
      } else {
        if (!dryRun) {
          const newRef = doc(colTxRef());
          batch.set(newRef, {
            ...r.docV2,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: uid || null
          });
        }
        creados += 1;
      }
      count += 1;
      if (count >= BATCH_LIMIT) {
        if (!dryRun) await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
      if (onProgress) onProgress({ i: i + 1, total: resultados.length, codigo });
    } catch (err) {
      fallidos += 1;
      console.warn('[importar.persistir] fallo en', codigo, err);
    }
  }
  if (count > 0 && !dryRun) await batch.commit();

  // Registrar job
  const jobPayload = {
    nombre_archivo,
    dryRun,
    creados,
    actualizados,
    fallidos,
    reporte_reducido: {
      total_filas: reporte.total_filas,
      por_hoja:    reporte.por_hoja,
      exitosos:    reporte.exitosos,
      errores:     reporte.errores,
      discrepancias_count: reporte.discrepancias_excel_mo00418.length,
      primeras_30_discrepancias: reporte.discrepancias_excel_mo00418.slice(0, 30)
    },
    uid: uid || null,
    at: serverTimestamp()
  };
  let jobId = null;
  if (!dryRun) {
    const jobRef = await addDoc(colJobsRef(), jobPayload);
    jobId = jobRef.id;
    // Audit (F35) best-effort
    try {
      await addDoc(collection(db, 'auditoria'),
        { ...auditar({
            accion: 'importar_excel', coleccion: 'importaciones',
            docId: jobId, uid,
            nota: `${nombre_archivo} — creados=${creados}, actualizados=${actualizados}, fallidos=${fallidos}`
          }),
          at: serverTimestamp() });
    } catch (_) { /* ignore */ }
  }

  return { jobId, creados, actualizados, fallidos, dryRun };
}
