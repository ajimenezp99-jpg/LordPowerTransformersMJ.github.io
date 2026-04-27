#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — CLI seeder de contratos · suministros
// ──────────────────────────────────────────────────────────────────
// Carga el catálogo de suministros + marcas de un .xlsm a Firestore
// para el contrato indicado, usando el MISMO parser puro del dominio
// que la UI web (assets/js/domain/importador_suministros.js).
//
// Sirve para CUALQUIER contrato — basta con apuntarlo al .xlsm
// correspondiente y pasar el contrato_id (8-14 dígitos).
//
// Uso:
//   node scripts/import-contrato.js \
//     --xlsm Gestion_Suministros_Transformadores_4125000143.xlsm \
//     --contrato-id 4125000143 \
//     --service-account ~/.firebase/sa-transpower.json \
//     [--dry-run] \
//     [--uid <admin-uid>] \
//     [--nombre "Suministros y Accesorios para Transformadores"]
//
// Idempotencia:
//   · /suministros/{cid}_Sxx → set merge (re-run no duplica).
//   · /marcas        → arrayUnion sobre /suministros/{cid}_Sxx.marcas_disponibles
//                     + addDoc solo si (cid, suministro_id, marca) no existe.
//   · /contratos/{cid} → set merge con estado=vigente y ultima_importacion.
//
// Auditoría:
//   · Una entrada en /audit con accion=bulk_import_suministros_cli y
//     metadata granular (sha256 del .xlsm, summary, ids tocados).
//
// Service account (cómo conseguirla):
//   Firebase Console → Project Settings → Service accounts → Generate
//   new private key. Guarda el JSON FUERA del repo.
// ══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import * as XLSX from 'xlsx';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import {
  parsearCatalogoRows, parsearMarcasRows, prepararPlanImportacion
} from '../assets/js/domain/importador_suministros.js';
import { composeDocId } from '../assets/js/domain/contratos.js';

// ─── CLI parsing ──────────────────────────────────────────────────
const ARG_DEFS = {
  '--xlsm':            { key: 'xlsm',           required: true,  desc: 'Path al .xlsm fuente' },
  '--contrato-id':     { key: 'contratoId',     required: true,  desc: '8-14 dígitos del número de contrato' },
  '--service-account': { key: 'serviceAccount', required: true,  desc: 'Path a JSON de service account de Firebase' },
  '--dry-run':         { key: 'dryRun',         flag: true,      desc: 'Reporta cifras sin escribir nada' },
  '--uid':             { key: 'uid',                              desc: 'UID del admin que ejecuta (opcional, va en createdBy)' },
  '--nombre':          { key: 'nombre',                          desc: 'Nombre humano del contrato (default: descripción genérica)' },
  '--help':            { key: 'help', flag: true,                desc: 'Muestra esta ayuda' }
};

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const def = ARG_DEFS[a];
    if (!def) { console.error('[error] flag desconocido:', a); printHelp(); process.exit(2); }
    if (def.flag) out[def.key] = true;
    else { out[def.key] = argv[++i]; if (!out[def.key]) { console.error('[error] valor faltante para', a); process.exit(2); } }
  }
  if (out.help) { printHelp(); process.exit(0); }
  for (const [flag, def] of Object.entries(ARG_DEFS)) {
    if (def.required && !out[def.key]) {
      console.error('[error] falta argumento obligatorio:', flag);
      printHelp(); process.exit(2);
    }
  }
  if (!/^[0-9]{8,14}$/.test(out.contratoId)) {
    console.error('[error] contrato_id inválido:', out.contratoId, '(esperado 8-14 dígitos).');
    process.exit(2);
  }
  return out;
}

function printHelp() {
  console.log('\nSeeder CLI · suministros multi-contrato\n');
  console.log('Uso:');
  console.log('  node scripts/import-contrato.js [flags]\n');
  for (const [flag, def] of Object.entries(ARG_DEFS)) {
    const r = def.required ? '*' : ' ';
    console.log(`  ${r} ${flag.padEnd(20)} ${def.desc}`);
  }
  console.log('\nEjemplo:');
  console.log('  node scripts/import-contrato.js \\');
  console.log('    --xlsm Gestion_Suministros_Transformadores_4125000143.xlsm \\');
  console.log('    --contrato-id 4125000143 \\');
  console.log('    --service-account ~/.firebase/sa-transpower.json \\');
  console.log('    --dry-run\n');
}

// ─── Firestore admin bootstrap ────────────────────────────────────
function bootstrapAdmin(saPath) {
  const abs = resolve(saPath.replace(/^~/, process.env.HOME || ''));
  if (!existsSync(abs)) {
    console.error('[error] service account no encontrado:', abs);
    process.exit(2);
  }
  const sa = JSON.parse(readFileSync(abs, 'utf8'));
  if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
  return getFirestore();
}

// ─── Lectores Firestore (estado existente) ────────────────────────
async function leerExistentes(db, contratoId) {
  // Suministros del contrato (filtra por contrato_id si existe; los
  // legacy sin contrato_id quedan fuera del scope de este import).
  const sumSnap = await db.collection('suministros').where('contrato_id', '==', contratoId).get();
  const suministrosIds = new Set(sumSnap.docs.map((d) => d.data().codigo));

  // Marcas: clave compuesta suministro_id::marca (para detectar dupes
  // dentro del mismo contrato).
  const marSnap = await db.collection('marcas').where('contrato_id', '==', contratoId).get();
  const marcasKeys = new Set(marSnap.docs.map((d) => {
    const x = d.data();
    return `${x.suministro_id}::${(x.marca || '').toUpperCase()}`;
  }));

  return {
    suministrosIds,
    marcasKeys,
    transformadoresPorMatricula: new Map(),  // este seeder NO toca /transformadores
    rawSumDocs: sumSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    rawMarDocs: marSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  };
}

// ─── Writes via batch admin SDK ───────────────────────────────────
async function escribirPlan(db, plan, parsed, ctx) {
  const { contratoId, uid, dryRun } = ctx;
  const COL_SUMINISTROS = 'suministros';
  const COL_MARCAS      = 'marcas';
  const BATCH_LIMIT     = 450;

  const idsCreados = { suministros: [], marcas: [] };
  const idsActualizados = { suministros: [] };

  const sumDocId = (codigo) => composeDocId(contratoId, codigo);

  // 1. Suministros (set merge — idempotente).
  const writes = [];
  for (const s of plan.suministros.crear) {
    writes.push({
      kind: 'create',
      ref: db.collection(COL_SUMINISTROS).doc(sumDocId(s.codigo)),
      // En CREATE incluimos marcas_disponibles=[] (campo nuevo).
      payload: {
        ...stripMarcasArr(s),
        contrato_id: contratoId,
        marcas_disponibles: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: uid || null
      }
    });
    idsCreados.suministros.push(sumDocId(s.codigo));
  }
  for (const s of plan.suministros.actualizar) {
    writes.push({
      kind: 'update',
      ref: db.collection(COL_SUMINISTROS).doc(sumDocId(s.codigo)),
      // En UPDATE NO tocamos marcas_disponibles (lo mantiene el step 2).
      payload: { ...stripMarcasArr(s), contrato_id: contratoId, updatedAt: FieldValue.serverTimestamp() }
    });
    idsActualizados.suministros.push(sumDocId(s.codigo));
  }

  // 2. Marcas: addDoc por cada (cid, sumId, marca) nueva +
  //    arrayUnion(marca) en suministros/{cid}_{sid}.marcas_disponibles.
  const marcasPorSum = new Map();  // sumId → Set(marcas)
  for (const m of plan.marcas.crear) {
    const ref = db.collection(COL_MARCAS).doc();
    writes.push({
      kind: 'create',
      ref,
      payload: { ...m, contrato_id: contratoId, createdAt: FieldValue.serverTimestamp(),
                 updatedAt: FieldValue.serverTimestamp(), createdBy: uid || null }
    });
    idsCreados.marcas.push(ref.id);
    if (!marcasPorSum.has(m.suministro_id)) marcasPorSum.set(m.suministro_id, new Set());
    marcasPorSum.get(m.suministro_id).add(m.marca);
  }
  for (const [sid, marcasSet] of marcasPorSum.entries()) {
    writes.push({
      kind: 'update',
      ref: db.collection(COL_SUMINISTROS).doc(sumDocId(sid)),
      payload: {
        marcas_disponibles: FieldValue.arrayUnion(...[...marcasSet]),
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  }

  // 3. /contratos/{cid} — registro / actualización.
  const contratoPayload = {
    schema_version: 1,
    codigo:  contratoId,
    alcance: ctx.nombre,
    aliado:  'OTRO',
    aliado_otro: '',
    fecha_inicio: hoyISO(),
    fecha_fin: '',
    monto_total: 0,
    presupuesto_comprometido: 0,
    presupuesto_ejecutado: 0,
    presupuesto_disponible: 0,
    moneda: 'COP',
    zonas_aplica: [],
    tipo_activo_elegible: ['POTENCIA'],
    estado: 'vigente',  // ← coincide con el enum del contrato_schema y rules
    observaciones: '',
    // Metadata de la última importación (vive junto al schema F21).
    ultima_importacion: FieldValue.serverTimestamp(),
    ultima_importacion_uid: uid || null,
    ultima_importacion_summary: {
      suministros_creados:     idsCreados.suministros.length,
      suministros_actualizados: idsActualizados.suministros.length,
      marcas_creadas:          idsCreados.marcas.length
    },
    updatedAt: FieldValue.serverTimestamp()
  };
  writes.push({
    kind: 'merge',
    ref: db.collection('contratos').doc(contratoId),
    payload: contratoPayload
  });

  if (dryRun) {
    console.log(`\n[dry-run] ${writes.length} writes preparados (no se ejecutan).`);
    return { idsCreados, idsActualizados, writesCount: writes.length, dryRun: true };
  }

  // 4. Ejecuta writes en batches de 450.
  let pending = 0;
  let batch = db.batch();
  let totalWrites = 0;
  for (const w of writes) {
    if      (w.kind === 'create') batch.set(w.ref, w.payload);
    else if (w.kind === 'update') batch.set(w.ref, w.payload, { merge: true });
    else                          batch.set(w.ref, w.payload, { merge: true });
    pending++; totalWrites++;
    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();

  return { idsCreados, idsActualizados, writesCount: totalWrites, dryRun: false };
}

// ─── Auditoría ───────────────────────────────────────────────────
async function auditar(db, ctx, summary, sha256) {
  if (ctx.dryRun) return null;
  const ref = db.collection('audit').doc();
  await ref.set({
    accion: 'bulk_import_suministros_cli',
    coleccion: 'suministros',
    docId: null,
    uid: ctx.uid || null,
    contrato_id: ctx.contratoId,
    metadata: {
      xlsm_path: ctx.xlsmPath,
      xlsm_sha256: sha256,
      summary,
      cli_version: 1
    },
    at: FieldValue.serverTimestamp()
  });
  return ref.id;
}

// ─── Helpers ──────────────────────────────────────────────────────
function stripMarcasArr(s) { const { marcas_disponibles, ...rest } = s; return rest; }
function hoyISO() { return new Date().toISOString().slice(0, 10); }
function sha256OfBuffer(buf) { return createHash('sha256').update(buf).digest('hex'); }

// ─── main ─────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  console.log('SGM seeder · contrato', args.contratoId);
  console.log('  xlsm:', args.xlsm);
  console.log('  dry-run:', !!args.dryRun);
  console.log('  uid:', args.uid || '(none)');

  const xlsmPath = resolve(args.xlsm);
  if (!existsSync(xlsmPath)) {
    console.error('[error] .xlsm no encontrado:', xlsmPath);
    process.exit(2);
  }
  const buf = readFileSync(xlsmPath);
  const sha = sha256OfBuffer(buf);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });

  // Header real está en fila 3 (range:2 en SheetJS).
  const rowsCat = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Suministros'] || {}, { range: 2, raw: false, defval: '' });
  const rowsMar = XLSX.utils.sheet_to_json(wb.Sheets['Marcas']               || {}, { range: 2, raw: false, defval: '' });

  const catRes = parsearCatalogoRows(rowsCat);
  const marRes = parsearMarcasRows(rowsMar);
  if (catRes.errores.length > 0) {
    console.error('[error] errores parseando catálogo:');
    for (const e of catRes.errores) console.error('  ·', JSON.stringify(e));
    process.exit(1);
  }
  console.log('\n· Catálogo parseado :', catRes.suministros.length, 'suministros');
  console.log('· Marcas parseadas  :', marRes.marcas.length, '(filtradas placeholders)');

  const db = bootstrapAdmin(args.serviceAccount);
  console.log('· Firestore conectado al proyecto.');

  const existentes = await leerExistentes(db, args.contratoId);
  console.log('· Existentes en Firestore para contrato', args.contratoId + ':');
  console.log('    suministros:', existentes.suministrosIds.size);
  console.log('    marcas    :', existentes.marcasKeys.size);

  const plan = prepararPlanImportacion(
    { suministros: catRes.suministros, marcas: marRes.marcas, transformadores: [], correcciones: [] },
    existentes
  );

  console.log('\n=== PLAN ===');
  console.log('  suministros · crear     :', plan.suministros.crear.length);
  console.log('  suministros · actualizar:', plan.suministros.actualizar.length);
  console.log('  suministros · huérfanos :', plan.suministros.huerfanos.length, '(no se borran)');
  console.log('  marcas      · crear     :', plan.marcas.crear.length);

  if (plan.suministros.huerfanos.length > 0) {
    console.warn('\n[advertencia] hay suministros en Firestore para este contrato que no aparecen en el .xlsm:');
    for (const id of plan.suministros.huerfanos) console.warn('    ·', id);
    console.warn('  No se eliminan (decisión del plan). Si son obsoletos, bórralos manualmente desde admin/suministros-catalogo.');
  }

  const ctx = {
    contratoId: args.contratoId,
    uid: args.uid || null,
    dryRun: !!args.dryRun,
    xlsmPath,
    nombre: args.nombre || 'Suministro de Elementos y Accesorios para Transformadores de Potencia'
  };

  const t0 = Date.now();
  const res = await escribirPlan(db, plan, { suministros: catRes.suministros, marcas: marRes.marcas }, ctx);
  const dt = Date.now() - t0;

  console.log('\n=== RESULTADO ===');
  console.log('  writes ejecutados:', res.writesCount, res.dryRun ? '(DRY-RUN, no se escribió nada)' : '');
  console.log('  duración:', dt, 'ms');

  const summary = {
    suministros: { crear: plan.suministros.crear.length, actualizar: plan.suministros.actualizar.length },
    marcas:      { crear: plan.marcas.crear.length },
    duracion_ms: dt,
    contrato_id: args.contratoId
  };
  const auditId = await auditar(db, ctx, summary, sha);
  if (auditId) console.log('  audit doc:', '/audit/' + auditId);

  console.log('\nOK.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[fatal]', err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
