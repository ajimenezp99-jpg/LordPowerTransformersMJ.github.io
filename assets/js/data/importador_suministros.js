// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: importador suministros (Fase 42)
// ──────────────────────────────────────────────────────────────
// Runner del importador. Conecta SheetJS + Firestore al parser puro
// (domain/importador_suministros.js).
//
// Idempotente por:
//   · /suministros: docId == codigo (set merge).
//   · /marcas: clave (suministro_id, marca) — skip si ya existe.
//   · /transformadores: matchea por matrícula (identificacion.codigo).
//   · /correcciones: numero+fuente (skip si ya hay 3 de control_suministros-2.jsx).
//
// Audit: una sola entrada bulk_import_suministros con metadata
// granular del plan §3 decisión 7·A.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  setDoc, addDoc, getDocs, writeBatch, serverTimestamp,
  arrayUnion, query, where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import {
  parsearCatalogoRows, parsearMarcasRows,
  parsearJsxTransformadores, jsxRowADocV2,
  extraerCorreccionesEmbedded,
  reconciliarEquipos, prepararPlanImportacion
} from '../domain/importador_suministros.js';

const COL_SUMINISTROS = 'suministros';
const COL_MARCAS      = 'marcas';
const COL_TRAFOS      = 'transformadores';
const COL_CORRECC     = 'correcciones';
const COL_AUDIT       = 'auditoria';
const BATCH_LIMIT     = 450;

export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }
function db() { const d = getDbSafe(); if (!d) throw new Error('Firebase no inicializado.'); return d; }

// ── SHA-256 hex (browser crypto.subtle) ────────────────────────
async function sha256Hex(buffer) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  let bytes;
  if (buffer instanceof ArrayBuffer) bytes = buffer;
  else if (typeof buffer === 'string') bytes = new TextEncoder().encode(buffer);
  else return '';
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Lectura de existentes (snapshot del estado actual) ─────────
async function leerExistentes() {
  const d = db();
  const sumSnap = await getDocs(collection(d, COL_SUMINISTROS));
  const suministrosIds = new Set(sumSnap.docs.map((x) => x.id));

  const marSnap = await getDocs(collection(d, COL_MARCAS));
  const marcasKeys = new Set(
    marSnap.docs.map((x) => {
      const data = x.data();
      return `${data.suministro_id}::${data.marca}`;
    })
  );

  const txSnap = await getDocs(collection(d, COL_TRAFOS));
  const transformadoresPorMatricula = new Map();
  for (const x of txSnap.docs) {
    const data = x.data();
    const m = (data.identificacion && data.identificacion.codigo) || data.codigo || '';
    if (m) transformadoresPorMatricula.set(String(m).toUpperCase(), x.id);
  }

  return { suministrosIds, marcasKeys, transformadoresPorMatricula };
}

/**
 * Parsea los archivos fuente a estructuras de dominio. Usa SheetJS
 * inyectado por el caller (UI hace `loadSheetJS()`).
 */
export async function parsearArchivos({ xlsmBuffer, jsxText, XLSX }) {
  if (!XLSX) throw new Error('SheetJS (XLSX) no cargado.');
  if (!xlsmBuffer) throw new Error('xlsmBuffer es obligatorio.');
  if (!jsxText)    throw new Error('jsxText es obligatorio.');

  const wb = XLSX.read(xlsmBuffer, { type: 'array', cellDates: true });
  const rowsCat = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Suministros'] || {}, { raw: false, defval: '' });
  const rowsMar = XLSX.utils.sheet_to_json(wb.Sheets['Marcas']               || {}, { raw: false, defval: '' });

  const catRes = parsearCatalogoRows(rowsCat);
  const marRes = parsearMarcasRows(rowsMar);

  const jsxArr = parsearJsxTransformadores(jsxText);
  const transformadores = jsxArr.map((r) => jsxRowADocV2(r));

  const correcciones = extraerCorreccionesEmbedded();

  // Hashes para auditoría.
  const xlsmSha = await sha256Hex(xlsmBuffer);
  const jsxSha  = await sha256Hex(jsxText);

  return {
    parsed: {
      suministros:     catRes.suministros,
      marcas:          marRes.marcas,
      transformadores,
      correcciones
    },
    erroresParseo: {
      catalogo: catRes.errores,
      marcas:   marRes.errores
    },
    hashes: { xlsm: xlsmSha, jsx: jsxSha }
  };
}

/**
 * Construye el plan completo (parseo + diff contra Firestore).
 */
export async function planearImportacion({ xlsmBuffer, jsxText, XLSX }) {
  const { parsed, erroresParseo, hashes } = await parsearArchivos({ xlsmBuffer, jsxText, XLSX });
  const existentes = await leerExistentes();
  const plan = prepararPlanImportacion(parsed, existentes);
  return { plan, parsed, erroresParseo, hashes };
}

/**
 * Ejecuta la importación. dryRun=true solo reporta cifras.
 *
 * Audit: una sola entrada `bulk_import_suministros` con metadata
 * granular (sha256 de cada fuente, summary, ids creados/actualizados,
 * duración).
 */
export async function ejecutarImportacion({
  plan, parsed, hashes,
  dryRun = false, uid = null, onProgress = null
}) {
  if (!plan) throw new Error('plan es obligatorio.');
  const d = db();
  const t0 = Date.now();

  const idsCreados = { suministros: [], marcas: [], correcciones: [], transformadores: [] };
  const idsActualizados = { suministros: [], transformadores: [] };

  let batch = writeBatch(d);
  let count = 0;
  const flush = async () => {
    if (count > 0 && !dryRun) await batch.commit();
    batch = writeBatch(d);
    count = 0;
  };
  const enqueue = async () => {
    if (++count >= BATCH_LIMIT) await flush();
  };

  const reportProgress = (etapa, i, total) => {
    if (onProgress) onProgress({ etapa, i, total });
  };

  // ── 1. /suministros ──────────────────────────────────────────
  let i = 0;
  for (const s of plan.suministros.crear) {
    if (!dryRun) {
      batch.set(doc(d, COL_SUMINISTROS, s.codigo), {
        ...s,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid
      });
    }
    idsCreados.suministros.push(s.codigo);
    await enqueue();
    reportProgress('suministros', ++i, plan.suministros.crear.length + plan.suministros.actualizar.length);
  }
  for (const s of plan.suministros.actualizar) {
    if (!dryRun) {
      batch.set(doc(d, COL_SUMINISTROS, s.codigo), {
        ...s,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    idsActualizados.suministros.push(s.codigo);
    await enqueue();
    reportProgress('suministros', ++i, plan.suministros.crear.length + plan.suministros.actualizar.length);
  }
  await flush();

  // ── 2. /marcas + sync marcas_disponibles ─────────────────────
  i = 0;
  for (const m of plan.marcas.crear) {
    if (!dryRun) {
      const ref = doc(collection(d, COL_MARCAS));
      batch.set(ref, {
        ...m,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid
      });
      // arrayUnion en el suministro padre (en el mismo batch).
      batch.set(
        doc(d, COL_SUMINISTROS, m.suministro_id),
        { marcas_disponibles: arrayUnion(m.marca), updatedAt: serverTimestamp() },
        { merge: true }
      );
      idsCreados.marcas.push(ref.id);
    } else {
      idsCreados.marcas.push('(dry-run)');
    }
    await enqueue();
    await enqueue();  // dos writes por marca
    reportProgress('marcas', ++i, plan.marcas.crear.length);
  }
  await flush();

  // ── 3. /transformadores (dual-write F41) ─────────────────────
  i = 0;
  const txTotal = plan.transformadores.crear.length + plan.transformadores.actualizar.length;
  for (const t of plan.transformadores.crear) {
    if (!dryRun) {
      const ref = doc(collection(d, COL_TRAFOS));
      const { _existingId, ...payload } = t;
      batch.set(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid
      });
      idsCreados.transformadores.push(ref.id);
    } else {
      idsCreados.transformadores.push('(dry-run)');
    }
    await enqueue();
    reportProgress('transformadores', ++i, txTotal);
  }
  for (const t of plan.transformadores.actualizar) {
    const { _existingId, ...payload } = t;
    if (!dryRun) {
      batch.set(doc(d, COL_TRAFOS, _existingId), {
        ...payload,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    idsActualizados.transformadores.push(_existingId);
    await enqueue();
    reportProgress('transformadores', ++i, txTotal);
  }
  await flush();

  // ── 4. /correcciones ─────────────────────────────────────────
  // Idempotencia por (numero, fuente): si ya existen 3 de
  // control_suministros-2.jsx, skip. Implementación simple: query.
  if (!dryRun) {
    for (const c of plan.correcciones.crear) {
      const q = query(
        collection(d, COL_CORRECC),
        where('numero',  '==', c.numero),
        where('fuente',  '==', c.fuente)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        const ref = await addDoc(collection(d, COL_CORRECC), {
          ...c,
          createdAt: serverTimestamp(),
          createdBy: uid
        });
        idsCreados.correcciones.push(ref.id);
      }
    }
  } else {
    for (const _ of plan.correcciones.crear) idsCreados.correcciones.push('(dry-run)');
  }

  // ── 5. Audit entry granular ──────────────────────────────────
  const duracion_ms = Date.now() - t0;
  const summary = {
    suministros: {
      creados: idsCreados.suministros.length,
      actualizados: idsActualizados.suministros.length,
      huerfanos: plan.suministros.huerfanos.length
    },
    marcas: { creadas: idsCreados.marcas.length },
    transformadores: {
      creados: idsCreados.transformadores.length,
      actualizados: idsActualizados.transformadores.length,
      huerfanos: plan.transformadores.huerfanos.length
    },
    correcciones: { creadas: idsCreados.correcciones.length }
  };
  const auditPayload = {
    accion: 'bulk_import_suministros',
    fuente_xlsm_sha256: hashes && hashes.xlsm || '',
    fuente_jsx_sha256:  hashes && hashes.jsx  || '',
    summary,
    ids_creados: idsCreados,
    ids_actualizados: idsActualizados,
    huerfanos: {
      suministros: plan.suministros.huerfanos,
      transformadores: plan.transformadores.huerfanos
    },
    duracion_ms,
    dryRun,
    uid: uid || null,
    at: serverTimestamp(),
    at_iso: new Date().toISOString()
  };
  let auditId = null;
  if (!dryRun) {
    try {
      const aref = await addDoc(collection(d, COL_AUDIT), auditPayload);
      auditId = aref.id;
    } catch (err) {
      console.warn('[importador_suministros.audit] fallo audit (no bloqueante):', err);
    }
  }

  return { dryRun, summary, idsCreados, idsActualizados, auditId, duracion_ms };
}
