// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Desempeño de aliados/contratistas (F33)
// ──────────────────────────────────────────────────────────────
// KPIs por aliado: órdenes cerradas, tiempo medio de ejecución,
// desviación vs presupuesto, reincidencias (órdenes que vuelven
// al mismo TX antes de N días), y score de desempeño 0–100.
// ══════════════════════════════════════════════════════════════

const diasEntre = (a, b) => {
  const d1 = new Date(a); const d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return null;
  return (d2 - d1) / (1000 * 60 * 60 * 24);
};

export function calcularDesempenoAliado(aliado, ordenes, {
  dias_reincidencia = 90
} = {}) {
  const del = ordenes.filter((o) => o.aliado_ejecutor === aliado);
  if (del.length === 0) {
    return {
      aliado, ordenes_total: 0, cerradas: 0, canceladas: 0,
      tiempo_medio_h: null, desviacion_costo_pct: null,
      reincidencias: 0, score: null
    };
  }
  const cerradas = del.filter((o) => o.estado === 'cerrada' || o.estado_v2 === 'cerrada');
  const canceladas = del.filter((o) => o.estado === 'cancelada' || o.estado_v2 === 'cancelada');

  const horas = cerradas.map((o) => o.duracion_horas).filter((h) => h != null);
  const tiempoMedioH = horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null;

  const costos = cerradas.filter((o) => o.costo_estimado != null && o.costo_ejecutado != null);
  const desviaciones = costos.map((o) => ((o.costo_ejecutado - o.costo_estimado) / o.costo_estimado) * 100);
  const desviacionMedia = desviaciones.length
    ? desviaciones.reduce((a, b) => a + b, 0) / desviaciones.length
    : null;

  // Reincidencias: ordenes cerradas al mismo TX con < dias_reincidencia.
  const porTX = {};
  for (const o of cerradas) {
    const k = o.transformadorCodigo;
    if (!k) continue;
    (porTX[k] = porTX[k] || []).push(o.fecha_cierre);
  }
  let reincidencias = 0;
  for (const fechas of Object.values(porTX)) {
    fechas.sort();
    for (let i = 1; i < fechas.length; i++) {
      const d = diasEntre(fechas[i - 1], fechas[i]);
      if (d != null && d < dias_reincidencia) reincidencias += 1;
    }
  }

  // Score: 100 − penalizaciones
  let score = 100;
  if (desviacionMedia != null && desviacionMedia > 0) {
    score -= Math.min(30, desviacionMedia);   // hasta -30 por sobre costo
  }
  if (tiempoMedioH != null && tiempoMedioH > 48) {
    score -= Math.min(20, (tiempoMedioH - 48) / 4);
  }
  score -= reincidencias * 5;
  if (canceladas.length > 0) score -= Math.min(15, canceladas.length * 3);
  score = Math.max(0, Math.min(100, score));

  return {
    aliado,
    ordenes_total: del.length,
    cerradas: cerradas.length,
    canceladas: canceladas.length,
    tiempo_medio_h: tiempoMedioH,
    desviacion_costo_pct: desviacionMedia,
    reincidencias,
    score
  };
}

export function rankingAliados(aliados, ordenes, opts) {
  return aliados
    .map((a) => calcularDesempenoAliado(a, ordenes, opts))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}
