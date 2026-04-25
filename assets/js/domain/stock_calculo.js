// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: motor puro de stock (Fase 39)
// ──────────────────────────────────────────────────────────────
// Helpers puros para:
//   · agregar movimientos (INGRESO/EGRESO) y derivar stock_actual,
//   · generar el siguiente correlativo MOV-YYYY-NNNN sin colisión,
//   · validar si un movimiento dejaría stock negativo.
//
// Vive en /domain/ (no en /data/) porque NO hace I/O. Lo importan
// tanto el data layer (movimientos.js) dentro de runTransaction
// como los tests unitarios.
// ══════════════════════════════════════════════════════════════

import { generarCodigoMov, MOVIMIENTO_CODIGO_PATTERN } from './schema.js';

/**
 * Agrega ingresos y egresos de un suministro.
 * Args:
 *   stockInicial — número (puede ser 0).
 *   movimientos  — array de {tipo, cantidad}. Otros campos ignorados.
 * Returns:
 *   { inicial, ingresado, egresado, actual }
 */
export function computarStockDesdeMovimientos(stockInicial, movimientos) {
  const ini = Number.isFinite(+stockInicial) ? +stockInicial : 0;
  let ingresado = 0;
  let egresado = 0;
  if (Array.isArray(movimientos)) {
    for (const m of movimientos) {
      const cant = Number.isFinite(+m?.cantidad) ? +m.cantidad : 0;
      if (cant <= 0) continue;
      if (m.tipo === 'INGRESO') ingresado += cant;
      else if (m.tipo === 'EGRESO') egresado += cant;
    }
  }
  return {
    inicial:   ini,
    ingresado: ingresado,
    egresado:  egresado,
    actual:    ini + ingresado - egresado
  };
}

/**
 * Calcula el siguiente secuencial dado un set de códigos del año.
 * Args:
 *   codigosExistentes — array de strings con formato MOV-YYYY-NNNN
 *                       (puede mezclar años; se filtra al pedido).
 *   anio              — año target.
 * Returns:
 *   integer >= 1.
 *
 * El caller (en runTransaction) garantiza que `codigosExistentes`
 * fue leído en el mismo batch que el create, evitando race condition.
 */
export function siguienteSecuencial(codigosExistentes, anio) {
  const a = +anio;
  if (!Number.isInteger(a)) throw new Error('siguienteSecuencial: anio inválido');
  let max = 0;
  if (Array.isArray(codigosExistentes)) {
    for (const c of codigosExistentes) {
      if (typeof c !== 'string') continue;
      if (!MOVIMIENTO_CODIGO_PATTERN.test(c)) continue;
      const [, anioStr, secStr] = c.match(/^MOV-(\d{4})-(\d{4})$/);
      if (+anioStr !== a) continue;
      const sec = +secStr;
      if (sec > max) max = sec;
    }
  }
  return max + 1;
}

/**
 * Conveniencia: combina siguienteSecuencial + generarCodigoMov.
 */
export function generarSiguienteCodigo(codigosExistentes, anio) {
  return generarCodigoMov(anio, siguienteSecuencial(codigosExistentes, anio));
}

/**
 * Valida que un movimiento no dejaría stock negativo.
 * Args:
 *   stockActual       — agregado actual del suministro.
 *   tipo              — 'INGRESO' | 'EGRESO'.
 *   cantidad          — entero >= 1.
 *   permitirNegativo  — bool, default false.
 * Returns:
 *   { ok: bool, faltante: number|null, resultado: number }
 *   faltante > 0 sólo cuando ok=false (stock no alcanza).
 */
export function validarStockMovimiento(stockActual, tipo, cantidad, permitirNegativo = false) {
  const a = +stockActual;
  const c = +cantidad;
  if (!Number.isFinite(a)) {
    return { ok: false, faltante: null, resultado: NaN };
  }
  if (!Number.isInteger(c) || c < 1) {
    return { ok: false, faltante: null, resultado: a };
  }
  const delta = (tipo === 'INGRESO') ? c : (tipo === 'EGRESO' ? -c : 0);
  const resultado = a + delta;
  if (resultado < 0 && !permitirNegativo) {
    return { ok: false, faltante: -resultado, resultado };
  }
  return { ok: true, faltante: null, resultado };
}

/**
 * Configuración por defecto del módulo (alineada con
 * /suministros_config/global). El data layer hace merge con el
 * doc remoto.
 */
export const DEFAULT_SUMINISTROS_CONFIG = Object.freeze({
  permitirNegativo:    false,
  umbral_critico_pct:  0.20,
  umbral_medio_pct:    0.50
});
