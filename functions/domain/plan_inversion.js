// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Plan de Inversión (F30)
// ──────────────────────────────────────────────────────────────
// Scoring multicriterio oficial (prompt v2.2 F30):
//   score = 0.40 × HI_norm
//         + 0.25 × criticidad_norm
//         + 0.15 × vida_utilizada_norm
//         + 0.10 × costo_reemplazo_inv_norm
//         + 0.10 × antiguedad_falla_reciente_norm
//
// Pesos editables en /umbrales_salud/pi por el director. Activos
// con fin_vida_util_papel o condición 5 entran automáticamente
// como candidatos bloqueados para retiro.
// ══════════════════════════════════════════════════════════════

import { prioridadNumerica } from './matriz_riesgo.js';

export const PESOS_PI_BASELINE = Object.freeze({
  hi:              0.40,
  criticidad:      0.25,
  vida_utilizada:  0.15,
  costo_reemplazo: 0.10,  // invertido: menor costo puntúa más
  falla_reciente:  0.10
});

// Normaliza a [0, 1] — 1 = mayor urgencia, 0 = menor.
const norm = (v, lo, hi) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, (n - lo) / (hi - lo)));
};

/**
 * Calcula score PI para un transformador.
 *
 * @param {object} tx — transformador v2
 * @param {{rangos, costo_max, hoy}} [ctx]
 * @param {object} [pesos]
 * @returns {{score, detalle, razones, candidato_forzoso}}
 */
export function scorePI(tx, ctx = {}, pesos = PESOS_PI_BASELINE) {
  const salud = tx.salud_actual || {};
  const crit  = tx.criticidad   || {};

  // HI normalizado: 1 → 0, 5 → 1
  const hiN = norm(salud.hi_final ?? 3, 1, 5);

  // Criticidad normalizada: minima→0, maxima→1
  const nivelOrden = ['minima', 'menor', 'moderada', 'mayor', 'maxima'];
  const idx = nivelOrden.indexOf(crit.nivel || '');
  const critN = idx >= 0 ? idx / 4 : 0;

  // Vida utilizada (Chedong): 0-100 % directo como 0-1
  const vidaN = norm(salud.vida_utilizada_pct ?? 0, 0, 100);

  // Costo reemplazo invertido: asumimos ctx.costo_max dinámico
  const costoMax = Number(ctx.costo_max) || 500000000;
  const costoTx  = Number(tx.placa && tx.placa.potencia_kva) * 6000 || costoMax / 2;  // heurística
  const costoInvN = 1 - norm(costoTx, 0, costoMax);

  // Falla reciente: si hay fallados en últimos 12 meses
  const fallaN = norm(
    ctx.fallas_12m_count != null ? ctx.fallas_12m_count : 0,
    0, 3
  );

  const score =
    pesos.hi * hiN +
    pesos.criticidad * critN +
    pesos.vida_utilizada * vidaN +
    pesos.costo_reemplazo * costoInvN +
    pesos.falla_reciente * fallaN;

  const razones = [];
  if (salud.fin_vida_util_papel) razones.push('Bandera fin_vida_util_papel (FUR≥4 aprobado)');
  if ((salud.hi_final ?? 0) >= 4.5) razones.push(`HI muy pobre (${salud.hi_final?.toFixed(2)})`);
  if ((salud.vida_utilizada_pct ?? 0) >= 70) razones.push(`Vida utilizada ${salud.vida_utilizada_pct?.toFixed(0)} %`);
  if (prioridadNumerica(crit.color) <= 2) razones.push(`Celda matriz ${crit.color}`);

  const candidatoForzoso = !!(salud.fin_vida_util_papel ||
                              (salud.hi_final != null && salud.hi_final >= 4.5));

  return {
    score,
    detalle: {
      hi: hiN, criticidad: critN, vida_utilizada: vidaN,
      costo_reemplazo_inv: costoInvN, falla_reciente: fallaN
    },
    razones,
    candidato_forzoso: candidatoForzoso
  };
}

/**
 * Rankea un universo de transformadores. Candidatos forzosos
 * aparecen al tope con score=1 y flag.
 */
export function rankearPlanInversion(transformadores, ctx = {}, pesos = PESOS_PI_BASELINE) {
  const scored = transformadores.map((tx) => ({
    id: tx.id,
    codigo: (tx.identificacion && tx.identificacion.codigo) || tx.codigo,
    ...scorePI(tx, ctx, pesos)
  }));
  // Forzosos primero, luego por score desc
  scored.sort((a, b) => {
    if (a.candidato_forzoso !== b.candidato_forzoso) {
      return a.candidato_forzoso ? -1 : 1;
    }
    return b.score - a.score;
  });
  return scored;
}

/**
 * Agrupa por nivel de recomendación.
 */
export function clasificarPropuestas(ranking) {
  return {
    forzosos:     ranking.filter((r) => r.candidato_forzoso),
    alta:         ranking.filter((r) => !r.candidato_forzoso && r.score >= 0.7),
    media:        ranking.filter((r) => !r.candidato_forzoso && r.score >= 0.5 && r.score < 0.7),
    baja:         ranking.filter((r) => !r.candidato_forzoso && r.score < 0.5)
  };
}
