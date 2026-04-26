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
  parsearJsxCatalogo, enriquecerCatalogoConJsx,
  extraerCorreccionesEmbedded,
  reconciliarEquipos, prepararPlanImportacion
} from '../domain/importador_suministros.js';
import { composeDocId } from '../domain/contratos.js';

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
    // Match por matrícula. Fallback a codigo plano (shape viejo
    // pre-corrección donde se persistió matrícula como codigo).
    const m =
      (data.identificacion && data.identificacion.matricula) ||
      data.matricula ||
      (data.identificacion && data.identificacion.codigo) ||
      data.codigo || '';
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
  // El .xlsm fuente tiene un título mergeado en row 1 y los headers
  // reales en row 3. range: 2 le dice a SheetJS que la fila 3
  // (índice 2 zero-based) es el header.
  const rowsCat = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Suministros'] || {}, { range: 2, raw: false, defval: '' });
  const rowsMar = XLSX.utils.sheet_to_json(wb.Sheets['Marcas']               || {}, { range: 2, raw: false, defval: '' });

  const catRes = parsearCatalogoRows(rowsCat);
  const marRes = parsearMarcasRows(rowsMar);

  const jsxArr = parsearJsxTransformadores(jsxText);
  const transformadores = jsxArr.map((r) => jsxRowADocV2(r));

  // Enriquece el catálogo del .xlsm con valor_unitario del JSX CATALOGO
  // (merge por posición; el .xlsm fuente no incluye precios).
  let catalogoEnriquecido = catRes.suministros;
  try {
    const jsxCatalogo = parsearJsxCatalogo(jsxText);
    catalogoEnriquecido = enriquecerCatalogoConJsx(catRes.suministros, jsxCatalogo);
  } catch (err) {
    console.warn('[importador.parsearArchivos] no se pudo enriquecer con JSX CATALOGO:', err.message);
  }

  const correcciones = extraerCorreccionesEmbedded();

  // Hashes para auditoría.
  const xlsmSha = await sha256Hex(xlsmBuffer);
  const jsxSha  = await sha256Hex(jsxText);

  return {
    parsed: {
      suministros:     catalogoEnriquecido,
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
  contrato_id = '',
  dryRun = false, uid = null, onProgress = null
}) {
  if (!plan) throw new Error('plan es obligatorio.');
  const d = db();
  const t0 = Date.now();
  const cid = String(contrato_id || '').trim();

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
  // No incluimos marcas_disponibles en el payload aquí: ese campo
  // se mantiene vivo vía arrayUnion en el step 2 (marcas). Si
  // pasáramos marcas_disponibles=[] en cada import, sobrescribiría
  // las marcas previamente sincronizadas (merge reemplaza arrays).
  const limpiarPayloadSuministro = (s) => {
    const { marcas_disponibles, ...rest } = s;
    return rest;
  };
  // docId helper: si hay contrato_id, compone {cid}_{codigo}; si no,
  // mantiene el codigo plano (compat con docs legacy del 4123000081).
  const sumDocId = (codigo) => composeDocId(cid, codigo);
  let i = 0;
  for (const s of plan.suministros.crear) {
    if (!dryRun) {
      batch.set(doc(d, COL_SUMINISTROS, sumDocId(s.codigo)), {
        ...limpiarPayloadSuministro(s),
        contrato_id: cid,
        marcas_disponibles: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid
      });
    }
    idsCreados.suministros.push(sumDocId(s.codigo));
    await enqueue();
    reportProgress('suministros', ++i, plan.suministros.crear.length + plan.suministros.actualizar.length);
  }
  for (const s of plan.suministros.actualizar) {
    if (!dryRun) {
      batch.set(doc(d, COL_SUMINISTROS, sumDocId(s.codigo)), {
        ...limpiarPayloadSuministro(s),
        contrato_id: cid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    idsActualizados.suministros.push(sumDocId(s.codigo));
    await enqueue();
    reportProgress('suministros', ++i, plan.suministros.crear.length + plan.suministros.actualizar.length);
  }
  await flush();

  // ── 2. /marcas + sync marcas_disponibles ─────────────────────
  // Crear las que no existen.
  i = 0;
  for (const m of plan.marcas.crear) {
    if (!dryRun) {
      const ref = doc(collection(d, COL_MARCAS));
      batch.set(ref, {
        ...m,
        contrato_id: cid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid
      });
      idsCreados.marcas.push(ref.id);
    } else {
      idsCreados.marcas.push('(dry-run)');
    }
    await enqueue();
    reportProgress('marcas', ++i, plan.marcas.crear.length);
  }
  // Sync idempotente: reconstruye marcas_disponibles[] de cada
  // suministro afectado uniendo TODAS las marcas parseadas (no
  // solo las nuevas). Así la re-importación garantiza que el array
  // refleja el estado real de /marcas, incluso si en pasadas
  // anteriores quedó wipeado por bugs o ediciones manuales.
  if (!dryRun) {
    const marcasPorSum = new Map();
    for (const m of (parsed && parsed.marcas) || []) {
      if (!m.suministro_id || !m.marca) continue;
      if (!marcasPorSum.has(m.suministro_id)) marcasPorSum.set(m.suministro_id, []);
      marcasPorSum.get(m.suministro_id).push(m.marca);
    }
    for (const [sid, lista] of marcasPorSum) {
      batch.set(
        doc(d, COL_SUMINISTROS, sumDocId(sid)),
        { marcas_disponibles: arrayUnion(...lista), updatedAt: serverTimestamp() },
        { merge: true }
      );
      await enqueue();
    }
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
      // Idempotencia ahora considera también el contrato_id, para que
      // dos contratos puedan tener la misma corrección sin colisionar.
      const q = cid
        ? query(collection(d, COL_CORRECC),
            where('numero',      '==', c.numero),
            where('fuente',      '==', c.fuente),
            where('contrato_id', '==', cid))
        : query(collection(d, COL_CORRECC),
            where('numero',  '==', c.numero),
            where('fuente',  '==', c.fuente));
      const snap = await getDocs(q);
      if (snap.empty) {
        const ref = await addDoc(collection(d, COL_CORRECC), {
          ...c,
          contrato_id: cid,
          createdAt: serverTimestamp(),
          createdBy: uid
        });
        idsCreados.correcciones.push(ref.id);
      }
    }
  } else {
    for (const _ of plan.correcciones.crear) idsCreados.correcciones.push('(dry-run)');
  }

  // ── 4b. Registrar el contrato en /contratos/{id} ─────────────
  // Crea o actualiza el doc para que pages/contratos.html lo liste
  // automáticamente sin depender del semilla hardcoded.
  if (!dryRun && cid) {
    try {
      await setDoc(
        doc(d, 'contratos', cid),
        {
          numero: cid,
          tipo: 'suministros',
          nombre: (parsed && parsed.contrato_nombre) || 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
          estado: 'activo',
          ultima_importacion: serverTimestamp(),
          ultima_importacion_uid: uid || null,
          ultima_importacion_summary: {
            suministros_creados:     idsCreados.suministros.length,
            suministros_actualizados: idsActualizados.suministros.length,
            marcas_creadas:          idsCreados.marcas.length,
            transformadores_creados: idsCreados.transformadores.length,
            transformadores_actualizados: idsActualizados.transformadores.length,
            correcciones_creadas:    idsCreados.correcciones.length
          }
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[importador.contrato] no se pudo registrar /contratos/' + cid + ':', err);
    }
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
