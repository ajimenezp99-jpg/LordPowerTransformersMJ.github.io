// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Workflow F29
// ──────────────────────────────────────────────────────────────
// Integra:
//   1. Transiciones de estado de ÓRDENES (completando F23).
//   2. Estados ESPECIALES de activo (§A9.3) — banderas
//      simultáneas no excluyentes en `estados_especiales[]`.
//   3. Guard anti-conflicto: restricciones OTC bloquean cambios
//      de carga sobre activos en operación temporal controlada.
// ══════════════════════════════════════════════════════════════

import { transicionValida as transicionOrden, TRANSICIONES_VALIDAS } from './orden_schema.js';
import { puedeAbrirOrden as puedeAbrirOrdenFUR } from './juicio_experto_fur.js';

// ── Permisos por rol para cada transición ──────────────────────
export const PERMISOS_TRANSICION = Object.freeze({
  // borrador → propuesta: analista_tx / brigadista
  'borrador:propuesta':    ['admin', 'director_proyectos', 'analista_tx', 'brigadista'],
  // propuesta → revisada: ingeniero_zona / director
  'propuesta:revisada':    ['admin', 'director_proyectos', 'analista_tx'],
  // revisada → autorizada: SOLO director
  'revisada:autorizada':   ['admin', 'director_proyectos'],
  'autorizada:programada': ['admin', 'director_proyectos', 'analista_tx'],
  'programada:en_ejecucion': ['admin', 'brigadista'],
  'en_ejecucion:ejecutada':  ['admin', 'brigadista'],
  // ejecutada → verificada: auditor o director
  'ejecutada:verificada':  ['admin', 'director_proyectos', 'auditor_campo'],
  // verificada → cerrada: director o gestor
  'verificada:cerrada':    ['admin', 'director_proyectos', 'gestor_contractual'],
  // rechazos
  'propuesta:rechazada':   ['admin', 'director_proyectos'],
  'revisada:rechazada':    ['admin', 'director_proyectos'],
  'propuesta:cancelada':   ['admin', 'director_proyectos'],
  'revisada:cancelada':    ['admin', 'director_proyectos'],
  'autorizada:cancelada':  ['admin', 'director_proyectos'],
  'programada:cancelada':  ['admin', 'director_proyectos'],
  'en_ejecucion:cancelada':['admin', 'director_proyectos'],
  'borrador:cancelada':    ['admin', 'director_proyectos', 'analista_tx']
});

/**
 * Chequea si una transición de orden es válida y si el rol la puede ejecutar.
 */
export function puedeTransicionar(from, to, rol) {
  if (!transicionOrden(from, to)) {
    return { ok: false, razon: `Transición no permitida: ${from} → ${to}` };
  }
  const key = `${from}:${to}`;
  const roles = PERMISOS_TRANSICION[key];
  if (!roles) return { ok: false, razon: `Sin política para ${key}` };
  if (!roles.includes(rol)) {
    return {
      ok: false,
      razon: `Rol ${rol} no autorizado para ${key}. Requiere: ${roles.join(' | ')}.`
    };
  }
  return { ok: true };
}

// ── Estados especiales del activo (§A9.3) ──────────────────────

export const ESTADOS_ESPECIALES_ACTIVO = Object.freeze([
  'monitoreo_intensivo_c2h2',
  'propuesta_fur_pendiente',
  'operacion_temporal_controlada',
  'pendiente_reemplazo',
  'reemplazado',
  'fin_vida_util_papel'
]);

/**
 * Verifica si un activo puede recibir una orden dado su estado
 * especial. Integra §A9.2 (FUR bloqueo) + §A9.3 (OTC restricciones).
 *
 * @param {object} transformador v2
 * @param {object} ordenPropuesta — {tipo, implica_cargabilidad?, factor?}
 */
export function puedeAbrirOrden(transformador, ordenPropuesta) {
  if (!transformador) return { ok: true };
  const especiales = transformador.estados_especiales || [];
  const tipo = ordenPropuesta && ordenPropuesta.tipo;

  // Bloqueo §A9.2 — fin_vida_util_papel
  const blkFUR = puedeAbrirOrdenFUR(transformador, tipo);
  if (!blkFUR.ok) return blkFUR;

  // §A9.3 OTC: restringe órdenes que aumenten cargabilidad
  if (especiales.includes('operacion_temporal_controlada')) {
    const rest = transformador.restricciones_operativas || {};
    if (ordenPropuesta && ordenPropuesta.implica_cargabilidad &&
        rest.cargabilidad_max_pct != null) {
      const factor = +ordenPropuesta.factor || 1;
      const pctResultante = (+transformador?.salud_actual?.crg_pct_medido || 0) * factor;
      if (pctResultante > rest.cargabilidad_max_pct) {
        return {
          ok: false,
          razon: `Activo en OTC con cargabilidad_max_pct=${rest.cargabilidad_max_pct}. ` +
                 `Carga resultante ${pctResultante.toFixed(1)} % la excede.`,
          referencia: 'MO.00418 §A9.3'
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Aplica una transición al documento de orden, devolviendo el
 * siguiente payload listo para persistir. Lanza si no es válida.
 */
export function aplicarTransicion(orden, nuevoEstado, { uid, rol, nota } = {}) {
  const prev = orden.estado_v2 || orden.estado;
  const check = puedeTransicionar(prev, nuevoEstado, rol);
  if (!check.ok) throw new Error(check.razon);
  return {
    ...orden,
    estado_v2: nuevoEstado,
    transiciones_log: [
      ...(orden.transiciones_log || []),
      { from: prev, to: nuevoEstado, uid, rol, at: new Date().toISOString(), nota: nota || '' }
    ]
  };
}

export { TRANSICIONES_VALIDAS };
