// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Juicio experto FUR (Fase 18 · A9.2)
// ──────────────────────────────────────────────────────────────
// Workflow de PROPUESTA de reclasificación por fin de vida útil
// del papel aislante (FUR ≥ 4). NO es un override silencioso:
// requiere validación del Profesional de Transformadores.
//
// El wiring Firestore (cola de propuestas, notificaciones, banderas)
// vive en F26/F29. Aquí residen las funciones puras.
// ══════════════════════════════════════════════════════════════

import { calcularCalifFUR, calcularDP, calcularVidaUtilizada } from './salud_activos.js';

const toNum = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};

export const ESTADOS_PROPUESTA_FUR = Object.freeze([
  'pendiente_revision_experto',
  'aprobada_reemplazo',
  'aprobada_operacion_temporal_controlada',
  'rechazada'
]);

/**
 * Crea una propuesta de reclasificación cuando una muestra tiene
 * CalifFUR ∈ {4, 5}.
 *
 * @returns {object|null} `null` si FUR < 4 (no aplica).
 */
export function crearPropuestaReclasificacionFUR({
  transformadorId,
  muestra_id,
  ppb_2fal,
  hi_bruto_actual,
  hoy = new Date()
} = {}) {
  const ppb = toNum(ppb_2fal);
  const califFUR = calcularCalifFUR(ppb);
  if (califFUR == null || califFUR < 4) return null;

  const dp = calcularDP(ppb);
  const vidaUtil = calcularVidaUtilizada(dp);
  const ts = (hoy instanceof Date ? hoy : new Date(hoy)).toISOString();

  return {
    transformadorId,
    muestra_id,
    motivo: 'FUR≥4 fin vida útil papel aislante',
    calif_fur_actual: califFUR,
    ppb_2fal: ppb,
    dp_estimado: dp,
    vida_utilizada_pct: vidaUtil,
    vida_remanente_pct: vidaUtil != null ? Math.max(0, 100 - vidaUtil) : null,
    hi_bruto_actual: toNum(hi_bruto_actual),
    hi_propuesto: Math.max(toNum(hi_bruto_actual) ?? 0, califFUR),
    estado: 'pendiente_revision_experto',
    asignado_a: null,              // profesional_tx asignado por F26
    creada_ts: ts,
    resuelta_ts: null,
    resuelta_por: null,
    resolucion: null,
    nota_resolucion: null,
    referencia_normativa: 'MO.00418.DE-GAC-AX.01 §4.1.2 Nota Técnica FUR'
  };
}

/**
 * Transiciones válidas de estado de propuesta.
 */
export function aplicarDecisionExperto(propuesta, {
  decision,       // 'aprobar_reemplazo' | 'aprobar_otc' | 'rechazar'
  experto_uid,
  nota,
  hoy = new Date()
} = {}) {
  if (!propuesta || propuesta.estado !== 'pendiente_revision_experto') {
    throw new Error('Propuesta ya resuelta o inválida.');
  }
  const ts = (hoy instanceof Date ? hoy : new Date(hoy)).toISOString();
  let nuevoEstado;
  switch (decision) {
    case 'aprobar_reemplazo':
      nuevoEstado = 'aprobada_reemplazo';
      break;
    case 'aprobar_otc':
      nuevoEstado = 'aprobada_operacion_temporal_controlada';
      break;
    case 'rechazar':
      nuevoEstado = 'rechazada';
      break;
    default:
      throw new Error(`decision desconocida: ${decision}`);
  }

  const aprobada = nuevoEstado !== 'rechazada';

  return {
    ...propuesta,
    estado: nuevoEstado,
    resuelta_ts: ts,
    resuelta_por: experto_uid || null,
    resolucion: decision,
    nota_resolucion: nota || '',
    // Banderas consecuentes:
    fin_vida_util_papel: aprobada,  // bandera permanente si se aprueba
    bloqueo_ordenes_no_reemplazo: aprobada
  };
}

/**
 * Chequea si un activo puede recibir una nueva orden de mantenimiento
 * dada una propuesta FUR aprobada. Sólo se permiten órdenes de
 * reemplazo / retiro / OTC mientras `fin_vida_util_papel` es true.
 */
export function puedeAbrirOrden(transformador, tipoOrdenDestino) {
  const finVida = transformador?.salud_actual?.fin_vida_util_papel === true;
  if (!finVida) return { ok: true };
  const permitidas = ['reemplazo', 'retiro', 'operacion_temporal_controlada'];
  if (permitidas.includes(tipoOrdenDestino)) return { ok: true };
  return {
    ok: false,
    razon: 'Activo con bandera fin_vida_util_papel. Sólo se permiten órdenes de reemplazo / retiro / OTC.',
    referencia: 'MO.00418 §A9.2'
  };
}
