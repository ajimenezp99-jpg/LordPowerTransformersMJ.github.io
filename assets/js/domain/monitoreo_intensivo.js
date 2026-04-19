// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Monitoreo Intensivo C₂H₂ (Fase 18 · A9.1)
// ──────────────────────────────────────────────────────────────
// Lógica pura del régimen de monitoreo reforzado para
// transformadores con CalifC2H2 = 5 (C₂H₂ ≥ 7 ppm).
//
// El wiring Firestore (creación del estado, tareas programadas
// de muestreo, workflow de cierre) vive en F26 (`data/
// monitoreo-intensivo.js`); aquí sólo residen los cálculos puros
// y la decisión de reclasificación (§A9.1 reglas R1/R2/R3).
// ══════════════════════════════════════════════════════════════

const toNum = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};

// Baselines oficiales (editables en /umbrales_salud/global)
export const BASELINES_C2H2 = Object.freeze({
  frecuencia_muestreo_dias:    7,    // monitoreo intensivo semanal
  velocidad_critica_ppm_dia:   0.5,  // default §A9.1 (equiv. +25% en 7 d)
  umbral_transicion_critica:   15    // ppm — C2H2 sostenido bloqueante
});

/**
 * Cálculo de velocidad de generación C₂H₂ entre dos muestras
 * consecutivas (ppm/día).
 *
 * @param {{c2h2, fecha}} muestraPrev
 * @param {{c2h2, fecha}} muestraActual
 * @returns {number|null}
 */
export function calcularVelocidadC2H2(muestraPrev, muestraActual) {
  if (!muestraPrev || !muestraActual) return null;
  const c0 = toNum(muestraPrev.c2h2  ?? muestraPrev.C2H2);
  const c1 = toNum(muestraActual.c2h2 ?? muestraActual.C2H2);
  const t0 = new Date(muestraPrev.fecha  ?? muestraPrev.fecha_muestra);
  const t1 = new Date(muestraActual.fecha ?? muestraActual.fecha_muestra);
  if ([c0, c1].some((x) => x == null) || isNaN(t0) || isNaN(t1)) return null;
  const dias = (t1 - t0) / (1000 * 60 * 60 * 24);
  if (dias <= 0) return null;
  return (c1 - c0) / dias;
}

/**
 * Evalúa si se activa override de reclasificación a condición 4.
 *
 * Reglas §A9.1:
 *   R1: velocidad ≥ velocidad_critica_ppm_dia
 *   R2: C₂H₂ actual ≥ umbral_transicion_critica (ppm)
 *   R3: autorización manual del Profesional de Tx
 *
 * @returns {{reclasificar, razones[], referencia}}
 */
export function evaluarOverrideC2H2({
  velocidad_ppm_dia,
  c2h2_actual,
  autorizado_por_experto = false,
  umbrales = BASELINES_C2H2
} = {}) {
  const razones = [];
  const v = toNum(velocidad_ppm_dia);
  const c = toNum(c2h2_actual);
  if (v != null && v >= umbrales.velocidad_critica_ppm_dia) {
    razones.push(`R1: velocidad ${v.toFixed(3)} ppm/día ≥ ${umbrales.velocidad_critica_ppm_dia}`);
  }
  if (c != null && c >= umbrales.umbral_transicion_critica) {
    razones.push(`R2: C2H2 ${c} ppm ≥ ${umbrales.umbral_transicion_critica}`);
  }
  if (autorizado_por_experto) {
    razones.push('R3: autorización manual del Profesional de Tx');
  }
  return {
    reclasificar: razones.length > 0,
    razones,
    referencia: 'MO.00418 §A9.1 (Nota Técnica C₂H₂)'
  };
}

/**
 * Batería de pruebas especiales (ETU) disparada cuando se
 * aplica el override de A9.1. Lista pre-cargada no editable
 * sin justificación documentada (MO.00418 §A9.1).
 */
export const BATERIA_PRUEBAS_ETU = Object.freeze([
  {
    codigo: 'ELE-COMPLETO',
    descripcion: 'Pruebas eléctricas (resistencia aislamiento, factor de potencia, relación transformación, FRA)',
    norma: 'IEEE C57.152'
  },
  { codigo: 'FUR',      descripcion: 'Furanos 2FAL', norma: 'ASTM D5837-15' },
  { codigo: 'DP',       descripcion: 'Descargas parciales', norma: 'IEC 60270' },
  { codigo: 'PAPEL',    descripcion: 'Análisis superficial del papel aislante', norma: 'CIGRÉ 323' },
  { codigo: 'INSP-INT', descripcion: 'Inspección interna con el equipo desenergizado (si 1-4 lo justifican)', norma: 'IEC 60076-1' }
]);

/**
 * Estado inicial de un monitoreo intensivo a guardar en Firestore.
 * F26 consume este objeto para crear el doc.
 */
export function crearEstadoMonitoreoIntensivo({
  transformadorId,
  muestra_origen_id,
  c2h2_ppm,
  profesional_tx_uid,
  umbrales = BASELINES_C2H2,
  hoy = new Date()
} = {}) {
  return {
    transformadorId,
    tipo: 'C2H2',
    estado: 'activo',
    iniciado_ts: (hoy instanceof Date ? hoy : new Date(hoy)).toISOString(),
    frecuencia_muestreo_dias: umbrales.frecuencia_muestreo_dias,
    fin_estimado: null,
    responsable_profesional_tx: profesional_tx_uid || null,
    ultima_muestra_ref: muestra_origen_id || null,
    c2h2_inicio_ppm: c2h2_ppm ?? null,
    velocidad_generacion_c2h2_ppm_dia: null,
    referencia: 'MO.00418 §A9.1 Nota Técnica C₂H₂',
    historial: []
  };
}
