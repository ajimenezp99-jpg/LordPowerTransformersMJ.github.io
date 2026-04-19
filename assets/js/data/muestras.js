// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: muestras (F19)
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { sanitizarMuestra, validarMuestra } from '../domain/muestra_schema.js';
import {
  calcularCalifTDGC, calcularCalifCO, calcularCalifCO2, calcularCalifC2H2,
  calcularCalifRD, calcularCalifIC, evaluarADFQ,
  calcularCalifFUR, calcularDP, calcularVidaUtilizada
} from '../domain/salud_activos.js';
import { diagnosticoDGA } from '../domain/dga_diagnostico.js';

const COL = 'muestras';
function colRef() { return collection(getDbSafe(), COL); }
function docRef(id) { return doc(getDbSafe(), COL, id); }

export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }

/**
 * Calcula campos derivados (calificaciones + diagnóstico DGA) en
 * el cliente antes de persistir, para que la muestra se almacene
 * con sus valores de referencia pre-computados.
 */
function derivarCampos(muestra) {
  const g = muestra.gases || {};
  const calif_tdgc = [g.H2, g.CH4, g.C2H4, g.C2H6].every((x) => x != null)
    ? calcularCalifTDGC(g) : null;
  const calif_c2h2 = g.C2H2 != null ? calcularCalifC2H2(g.C2H2) : null;
  const calif_co   = g.CO   != null ? calcularCalifCO(g.CO)    : null;
  const calif_co2  = g.CO2  != null ? calcularCalifCO2(g.CO2)  : null;
  const eval_dga   = (calif_tdgc != null || calif_c2h2 != null)
    ? Math.max(calif_tdgc ?? 0, calif_c2h2 ?? 0) || null : null;

  const adfq = muestra.adfq || {};
  const calif_rd = adfq.rigidez_kv != null ? calcularCalifRD(adfq.rigidez_kv) : null;
  const calif_ic = (adfq.ti != null && adfq.nn != null)
    ? calcularCalifIC({ ti: adfq.ti, nn: adfq.nn }) : null;
  const eval_adfq = evaluarADFQ(adfq);

  const calif_fur = muestra.furanos_ppb != null ? calcularCalifFUR(muestra.furanos_ppb) : null;
  const dp_est = muestra.furanos_ppb != null ? calcularDP(muestra.furanos_ppb) : null;
  const vida_utilizada_pct = dp_est != null ? calcularVidaUtilizada(dp_est) : null;

  const gasesCompletos = [g.H2, g.CH4, g.C2H4, g.C2H6, g.C2H2].every((x) => x != null);
  const diagnostico_dga = gasesCompletos ? diagnosticoDGA(g) : null;

  return {
    calif_tdgc, calif_c2h2, calif_co, calif_co2, eval_dga,
    calif_rd, calif_ic, eval_adfq,
    calif_fur, dp_estimado: dp_est, vida_utilizada_pct,
    vida_remanente_pct: vida_utilizada_pct != null
      ? Math.max(0, 100 - vida_utilizada_pct) : null,
    diagnostico_dga
  };
}

export async function crear(data, uid) {
  const payload = sanitizarMuestra(data);
  const errs = validarMuestra(payload);
  if (errs.length) throw new Error('Validación muestra:\n  · ' + errs.join('\n  · '));
  const derivados = derivarCampos(payload);
  const docCompleto = {
    ...payload, ...derivados,
    createdAt: serverTimestamp(),
    createdBy: uid || null
  };
  const ref = await addDoc(colRef(), docCompleto);
  return ref.id;
}

export async function actualizar(id, data, uid) {
  const payload = sanitizarMuestra(data);
  const errs = validarMuestra(payload);
  if (errs.length) throw new Error('Validación muestra:\n  · ' + errs.join('\n  · '));
  const derivados = derivarCampos(payload);
  await updateDoc(docRef(id), {
    ...payload, ...derivados,
    updatedAt: serverTimestamp(),
    updatedBy: uid || null
  });
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function eliminar(id) {
  await deleteDoc(docRef(id));
}

export async function listar({ transformadorId, tipo, laboratorio, limite = 200 } = {}) {
  const cs = [];
  if (transformadorId) cs.push(where('transformadorId', '==', transformadorId));
  if (tipo)            cs.push(where('tipo', '==', tipo));
  if (laboratorio)     cs.push(where('laboratorio', '==', laboratorio));
  cs.push(orderBy('fecha_muestra', 'desc'));
  if (limite) cs.push(limit(limite));
  const snap = await getDocs(query(colRef(), ...cs));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir({ transformadorId, tipo } = {}, onData, onError) {
  const cs = [];
  if (transformadorId) cs.push(where('transformadorId', '==', transformadorId));
  if (tipo)            cs.push(where('tipo', '==', tipo));
  cs.push(orderBy('fecha_muestra', 'desc'), limit(200));
  return onSnapshot(
    query(colRef(), ...cs),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { if (onError) onError(err); else console.warn('[muestras.suscribir]', err); }
  );
}

/**
 * Serie histórica de gases para gráficas. Ordenada cronológicamente.
 */
export async function serieHistoricaDGA(transformadorId, limite = 50) {
  const items = await listar({ transformadorId, limite });
  return items
    .filter((m) => m.tipo === 'DGA' || m.tipo === 'COMBO')
    .map((m) => ({
      id: m.id,
      fecha: m.fecha_muestra,
      H2: m.gases && m.gases.H2,
      CH4: m.gases && m.gases.CH4,
      C2H4: m.gases && m.gases.C2H4,
      C2H6: m.gases && m.gases.C2H6,
      C2H2: m.gases && m.gases.C2H2,
      CO: m.gases && m.gases.CO,
      CO2: m.gases && m.gases.CO2
    }))
    .reverse();
}
