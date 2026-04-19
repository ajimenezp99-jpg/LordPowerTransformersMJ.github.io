// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Motor de Estrategias por Condición (F37)
// ──────────────────────────────────────────────────────────────
// MO.00418 §4.3 — mapea CONDICION del activo (1..5) a la
// macroactividad + subactividades + mitigaciones + periodicidad
// sugerida. Alimenta la autogeneración de órdenes cuando cambia
// salud_actual.bucket.
// ══════════════════════════════════════════════════════════════

import { MACROACTIVIDADES_BASELINE, SUBACTIVIDADES_BASELINE }
  from './catalogos_baseline.js';

/**
 * Mapea un HI (1..5) a la macroactividad oficial + subactividades
 * + recomendaciones de mitigación.
 */
export function estrategiaPorCondicion(condicion) {
  const c = Math.max(1, Math.min(5, Math.round(+condicion || 1)));
  const macro = MACROACTIVIDADES_BASELINE.find(
    (m) => m.condicion_objetivo === c && !m.codigo.startsWith('MACRO-MIT')
  );
  const mitigacion = MACROACTIVIDADES_BASELINE.find(
    (m) => m.condicion_objetivo === c && m.codigo.startsWith('MACRO-MIT')
  );

  const subs = macro
    ? macro.subactividades.map((codigo) =>
        SUBACTIVIDADES_BASELINE.find((s) => s.codigo === codigo)
      ).filter(Boolean)
    : [];

  const mitSubs = mitigacion
    ? mitigacion.subactividades.map((codigo) =>
        SUBACTIVIDADES_BASELINE.find((s) => s.codigo === codigo)
      ).filter(Boolean)
    : [];

  return {
    condicion: c,
    macroactividad: macro,
    subactividades: subs,
    mitigacion: mitigacion
      ? { macroactividad: mitigacion, subactividades: mitSubs }
      : null,
    periodicidad_dias: macro ? macro.periodicidad_dias : null,
    referencia: macro ? macro.referencia : `MO.00418 §4.3 C${c}`
  };
}

export function periodicidadSugerida(condicion) {
  const est = estrategiaPorCondicion(condicion);
  return est.periodicidad_dias;
}

/**
 * Genera payload para una ORDEN en estado `borrador` a partir del
 * bucket del activo (trigger F37 cuando cambia salud_actual.bucket).
 *
 * @param {object} transformador — v2
 * @param {{condicion_nueva, causante_principal}} ctx
 */
export function generarPropuestaOrden(transformador, ctx = {}) {
  const { condicion_nueva, causante_principal } = ctx;
  const condicion = condicion_nueva ?? Math.round(
    (transformador.salud_actual && transformador.salud_actual.hi_final) || 3
  );
  const est = estrategiaPorCondicion(condicion);
  if (!est.macroactividad) return null;

  const prioridad = condicion >= 5 ? 'critica'
                  : condicion >= 4 ? 'alta'
                  : condicion >= 3 ? 'media'
                  : 'baja';

  const tipo = condicion >= 5 ? 'reemplazo'
             : condicion === 4 ? 'correctivo'
             : condicion === 3 ? 'correctivo'
             : 'preventivo';

  const codigoBase = (transformador.identificacion && transformador.identificacion.codigo)
                     || transformador.codigo || 'UNK';
  const sello = Date.now().toString(36).slice(-4).toUpperCase();

  return {
    codigo: `OT-${codigoBase}-${sello}`,
    titulo: `${est.macroactividad.nombre} — ${codigoBase}`,
    descripcion: `Propuesta auto-generada al cambiar condición a ${condicion}. Referencia: ${est.referencia}.`,
    macroactividad_codigo: est.macroactividad.codigo,
    transformadorId:    transformador.id || '',
    transformadorCodigo: codigoBase,
    tipo,
    prioridad,
    estado: 'borrador',
    condicion_objetivo: condicion,
    causantes: causante_principal ? [causante_principal] : [],
    observaciones: est.mitigacion
      ? `Mitigación sugerida: ${est.mitigacion.macroactividad.nombre}.`
      : ''
  };
}

/**
 * Detecta el causante principal a partir de las calificaciones
 * individuales del snapshot salud_actual.
 */
export function detectarCausantePrincipal(saludActual) {
  if (!saludActual) return null;
  const candidatos = [
    { codigo: 'CAU-06', valor: saludActual.calif_fur,  nombre: 'FUR' },
    { codigo: 'CAU-05', valor: saludActual.eval_dga,   nombre: 'DGA' },
    { codigo: 'CAU-07', valor: saludActual.calif_edad, nombre: 'EDAD' },
    { codigo: 'CAU-02', valor: saludActual.calif_crg,  nombre: 'CRG' },
    { codigo: 'CAU-01', valor: saludActual.eval_adfq,  nombre: 'ADFQ' },
    { codigo: 'CAU-08', valor: saludActual.calif_her,  nombre: 'HER' },
    { codigo: 'CAU-10', valor: saludActual.calif_pyt,  nombre: 'PYT' }
  ].filter((c) => c.valor != null);
  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => b.valor - a.valor);
  return candidatos[0].valor >= 4 ? candidatos[0].codigo : null;
}
