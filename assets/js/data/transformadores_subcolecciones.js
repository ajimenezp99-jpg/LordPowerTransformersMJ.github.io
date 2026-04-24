// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: subcolecciones de transformadores
// ──────────────────────────────────────────────────────────────
// Fase 16 crea dos subcolecciones append-only:
//
//   /transformadores/{id}/placas_historicas/{eventoId}
//       Retrofits y cambios de placa (potencia / tensión /
//       refrigeración / otros). Trazabilidad regulatoria.
//
//   /transformadores/{id}/historial_hi/{calculoId}
//       Snapshots históricos del Health Index. Cada entrada es el
//       resultado de una re-evaluación (muestra nueva, ajuste de
//       umbrales, override manual). Permite reconstruir la
//       evolución de salud del activo.
//
// Append-only: las rules bloquean update/delete.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, getDocs, query, orderBy, limit, where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe } from '../firebase-init.js';

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};

// ══════════════════════════════════════════════════════════════
// /transformadores/{id}/placas_historicas
// ══════════════════════════════════════════════════════════════

const TIPOS_CAMBIO_PLACA = [
  'potencia', 'tension', 'refrigeracion', 'tap', 'otro'
];

function placaHistoricaRef(trafoId) {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, 'transformadores', trafoId, 'placas_historicas');
}

export function sanitizarPlacaHistorica(input) {
  const src = input || {};
  const tipo = str(src.tipo_cambio).toLowerCase();
  return {
    tipo_cambio:      TIPOS_CAMBIO_PLACA.includes(tipo) ? tipo : 'otro',
    campo:            str(src.campo),
    valor_anterior:   src.valor_anterior ?? null,
    valor_nuevo:      src.valor_nuevo    ?? null,
    razon:            str(src.razon),
    autorizado_por:   str(src.autorizado_por),
    orden_ref:        str(src.orden_ref),
    nota:             str(src.nota)
  };
}

export async function registrarCambioPlaca(trafoId, data, uid) {
  const payload = sanitizarPlacaHistorica(data);
  payload.ts_cambio = serverTimestamp();
  payload.createdBy = uid || null;
  const ref = await addDoc(placaHistoricaRef(trafoId), payload);
  return ref.id;
}

export async function listarPlacasHistoricas(trafoId, { limite = 50 } = {}) {
  const q = query(
    placaHistoricaRef(trafoId),
    orderBy('ts_cambio', 'desc'),
    limit(limite)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ══════════════════════════════════════════════════════════════
// /transformadores/{id}/historial_hi
// ══════════════════════════════════════════════════════════════

const TRIGGERS_HISTORIAL = [
  'muestra_nueva',
  'parametros_actualizados',
  'migracion_v2',
  'manual',
  'override_experto',
  'recalculo_masivo'
];

function historialHIRef(trafoId) {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, 'transformadores', trafoId, 'historial_hi');
}

export function sanitizarEntradaHistorialHI(input) {
  const src = input || {};
  const trigger = str(src.trigger).toLowerCase();
  const clamp = (v, lo, hi) => {
    const n = num(v);
    if (n == null) return null;
    return Math.max(lo, Math.min(hi, n));
  };
  const califInt = (v) => {
    const n = num(v);
    if (n == null) return null;
    const r = Math.round(n);
    return (r >= 1 && r <= 5) ? r : null;
  };
  return {
    trigger:             TRIGGERS_HISTORIAL.includes(trigger) ? trigger : 'manual',
    muestra_origen_ref:  str(src.muestra_origen_ref),
    // Calificaciones por variable (MO.00418 §4.2)
    calif_tdgc:          califInt(src.calif_tdgc),
    calif_c2h2:          califInt(src.calif_c2h2),
    eval_dga:            clamp(src.eval_dga, 1, 5),
    calif_rd:            califInt(src.calif_rd),
    calif_ic:            califInt(src.calif_ic),
    eval_adfq:           clamp(src.eval_adfq, 1, 5),
    calif_fur:           califInt(src.calif_fur),
    calif_crg:           califInt(src.calif_crg),
    calif_edad:          califInt(src.calif_edad),
    calif_her:           califInt(src.calif_her),
    calif_pyt:           califInt(src.calif_pyt),
    // HI (con y sin overrides)
    hi_bruto:            clamp(src.hi_bruto, 1, 5),
    hi_final:            clamp(src.hi_final, 1, 5),
    bucket:              str(src.bucket),
    overrides_aplicados: Array.isArray(src.overrides_aplicados)
      ? src.overrides_aplicados.map((x) => str(x)).filter(Boolean)
      : [],
    nota:                str(src.nota)
  };
}

export async function registrarHI(trafoId, snapshot, uid) {
  const payload = sanitizarEntradaHistorialHI(snapshot);
  payload.ts_calculo = serverTimestamp();
  payload.createdBy = uid || null;
  const ref = await addDoc(historialHIRef(trafoId), payload);
  return ref.id;
}

export async function listarHistorialHI(trafoId, { limite = 200 } = {}) {
  const q = query(
    historialHIRef(trafoId),
    orderBy('ts_calculo', 'desc'),
    limit(limite)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listarHistorialPorTrigger(trafoId, trigger, { limite = 100 } = {}) {
  const q = query(
    historialHIRef(trafoId),
    where('trigger', '==', trigger),
    orderBy('ts_calculo', 'desc'),
    limit(limite)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { TIPOS_CAMBIO_PLACA, TRIGGERS_HISTORIAL };
