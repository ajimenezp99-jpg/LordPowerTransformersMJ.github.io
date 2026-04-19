// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — TPT Servicios Propios + TX Respaldo (F24)
// ──────────────────────────────────────────────────────────────
// Mismas reglas de salud que POTENCIA (MO.00418 aplica uniforme
// a los 3 parques); lo que cambia es:
//   · TPT: unidad de servicios propios (dentro de la subestación).
//   · RESPALDO: banco de repuesto; se activa cuando una unidad
//     de POTENCIA entra en OTC/reemplazo (§A9.3).
//
// Este módulo contiene la lógica pura de decisiones de cambio
// de rol + proyección de carga sobre la unidad de respaldo.
// ══════════════════════════════════════════════════════════════

import {
  tiempoAdmisible, proponerPlanMitigacionSobrecarga
} from './sobrecarga_admisible.js';

/**
 * Evalúa si una unidad de RESPALDO puede absorber temporalmente
 * la carga de una unidad de POTENCIA que entra en OTC o falla.
 *
 * @param {object} respaldo — transformador tipo_activo=RESPALDO
 * @param {number} cargaARedistribuir — A (amperios) a redirigir
 * @param {number} duracionMin — duración esperada del evento
 * @returns {{viable, factor_resultante, tiempo_admisible_min,
 *            aceleracion_envejecimiento, recomendacion}}
 */
export function evaluarActivacionRespaldo(respaldo, cargaARedistribuir, duracionMin) {
  if (!respaldo) return { viable: false, recomendacion: 'Respaldo inválido.' };
  const tipo = respaldo.identificacion && respaldo.identificacion.tipo_activo;
  if (tipo !== 'RESPALDO') {
    return { viable: false, recomendacion: 'El transformador no es tipo RESPALDO.' };
  }
  const ap = (respaldo.electrico && respaldo.electrico.corriente_nominal_primaria_a) || 0;
  if (!ap) return { viable: false, recomendacion: 'Respaldo sin ampacidad primaria registrada.' };

  // Carga actual del respaldo (si ya está operando)
  const cargaActual = (respaldo.salud_actual && respaldo.salud_actual.crg_pct_medido) || 0;
  const cargaActualA = (cargaActual / 100) * ap;
  const cargaFinal   = cargaActualA + cargaARedistribuir;
  const factor = cargaFinal / ap;

  const t = tiempoAdmisible(factor, (cargaActualA / ap) * 100, 30);

  const viable = factor <= 1.30 && duracionMin <= t.minutos;
  return {
    viable,
    factor_resultante: factor,
    tiempo_admisible_min: t.minutos,
    aceleracion_envejecimiento: t.aceleracion_envejecimiento,
    recomendacion: viable
      ? `Activación viable. Factor resultante ${factor.toFixed(2)}. Tiempo admisible: ${t.minutos} min.`
      : `RIESGO: factor ${factor.toFixed(2)} excede 1.30 o duración ${duracionMin} min > tiempo admisible ${t.minutos} min.`,
    referencia: 'IEEE C57.91 §7 + MO.00418 §4.1.3'
  };
}

/**
 * Sugiere el mejor candidato de RESPALDO para una unidad de
 * POTENCIA dada, ordenando por HI (mejor primero), zona cercana
 * y disponibilidad.
 */
export function seleccionarRespaldoOptimo(unidadPotencia, candidatosRespaldo) {
  if (!Array.isArray(candidatosRespaldo) || candidatosRespaldo.length === 0) {
    return null;
  }
  const zonaObj = unidadPotencia && unidadPotencia.ubicacion && unidadPotencia.ubicacion.zona;
  const activos = candidatosRespaldo.filter((r) =>
    r.estado_servicio === 'operativo' &&
    r.identificacion && r.identificacion.tipo_activo === 'RESPALDO'
  );

  // Ranking: misma zona primero, luego por HI ascendente (mejor estado), luego por potencia_kva descendente (mayor capacidad).
  activos.sort((a, b) => {
    const aZona = a.ubicacion && a.ubicacion.zona;
    const bZona = b.ubicacion && b.ubicacion.zona;
    const aMisma = aZona === zonaObj ? 0 : 1;
    const bMisma = bZona === zonaObj ? 0 : 1;
    if (aMisma !== bMisma) return aMisma - bMisma;
    const aHI = (a.salud_actual && a.salud_actual.hi_final) || 5;
    const bHI = (b.salud_actual && b.salud_actual.hi_final) || 5;
    if (aHI !== bHI) return aHI - bHI;
    const aKva = (a.placa && a.placa.potencia_kva) || 0;
    const bKva = (b.placa && b.placa.potencia_kva) || 0;
    return bKva - aKva;
  });
  return activos[0] || null;
}

export { tiempoAdmisible, proponerPlanMitigacionSobrecarga };
