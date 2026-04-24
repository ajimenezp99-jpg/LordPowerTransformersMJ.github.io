// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Matriz Criticidad × Salud (F36)
// ──────────────────────────────────────────────────────────────
// Implementa el componente central del Procedimiento A6 / §4.2
// del MO.00418: cruce entre criticidad operativa (usuarios aguas
// abajo) y condición de salud (HI).
//
// Fórmula de rangos (§A9.9):
//   Tamaño = (max_usuarios − min_usuarios) / 5
//   Con min = 1 y max = 48312 → pasos de 9662.
// ══════════════════════════════════════════════════════════════

export const NIVELES_ORDEN = Object.freeze([
  'minima', 'menor', 'moderada', 'mayor', 'maxima'
]);

export const LABELS_NIVEL = Object.freeze({
  minima:   'Mínima',
  menor:    'Menor',
  moderada: 'Moderada',
  mayor:    'Mayor',
  maxima:   'Máxima'
});

// Colores semáforo para celdas VRD/AMRL/NAR/ROJ
export const COLORES_CELDA = Object.freeze({
  VRD:  { hex: '#1B8E3F', label: 'Verde (OK)' },
  AMRL: { hex: '#F5C518', label: 'Amarillo (atención)' },
  NAR:  { hex: '#EF7820', label: 'Naranja (alta)' },
  ROJ:  { hex: '#E53935', label: 'Roja (crítica)' }
});

// Matriz 5×5 oficial (fila = HI, columna = criticidad)
// MO.00418 Tabla 11.
//                  minima  menor   moderada mayor   maxima
const MATRIZ = Object.freeze({
  5: { minima: 'AMRL', menor: 'NAR',  moderada: 'ROJ',  mayor: 'ROJ',  maxima: 'ROJ' },
  4: { minima: 'VRD',  menor: 'AMRL', moderada: 'NAR',  mayor: 'ROJ',  maxima: 'ROJ' },
  3: { minima: 'VRD',  menor: 'AMRL', moderada: 'AMRL', mayor: 'NAR',  maxima: 'ROJ' },
  2: { minima: 'VRD',  menor: 'VRD',  moderada: 'AMRL', mayor: 'NAR',  maxima: 'ROJ' },
  1: { minima: 'VRD',  menor: 'VRD',  moderada: 'VRD',  mayor: 'AMRL', maxima: 'NAR' }
});

/**
 * Calcula los rangos de criticidad para un tope dado.
 *
 * @param {number} maxUsuarios — tope dinámico (p.ej. 48312)
 * @param {number} [minUsuarios=1] — piso (§A9.9: 1, no 0)
 * @returns {Array<{nivel, min, max}>}
 */
export function calcularRangosCriticidad(maxUsuarios, minUsuarios = 1) {
  const max = Number(maxUsuarios);
  const min = Number(minUsuarios) || 1;
  if (!Number.isFinite(max) || max <= min) return [];
  const tam = Math.floor((max - min) / 5);
  const rangos = [];
  for (let i = 0; i < 5; i++) {
    const lo = min + i * tam;
    const hi = i === 4 ? max : (min + (i + 1) * tam) - 1;
    rangos.push({ nivel: NIVELES_ORDEN[i], min: lo, max: hi });
  }
  return rangos;
}

/**
 * Clasifica un número de usuarios en su nivel de criticidad.
 */
export function nivelPorUsuarios(usuarios, rangos) {
  if (usuarios == null || !Array.isArray(rangos) || rangos.length === 0) return null;
  const n = Number(usuarios);
  if (!Number.isFinite(n)) return null;
  for (const r of rangos) {
    if (n >= r.min && n <= r.max) return r.nivel;
  }
  // Por encima del máximo: asume el último nivel (maxima)
  if (n > rangos[rangos.length - 1].max) return rangos[rangos.length - 1].nivel;
  if (n < rangos[0].min) return rangos[0].nivel;
  return null;
}

/**
 * Devuelve el color de la celda (VRD/AMRL/NAR/ROJ) para una
 * combinación (HI_redondeado 1..5, nivel criticidad).
 */
export function colorCelda(hiEntero, nivelCriticidad) {
  const hi = Math.round(Math.min(5, Math.max(1, hiEntero)));
  const fila = MATRIZ[hi];
  if (!fila) return null;
  return fila[nivelCriticidad] || null;
}

/**
 * Prioridad numérica para ranking (1 = peor, 4 = OK).
 * Útil para el Plan de Inversión (F30).
 */
export function prioridadNumerica(color) {
  switch (color) {
    case 'ROJ':  return 1;
    case 'NAR':  return 2;
    case 'AMRL': return 3;
    case 'VRD':  return 4;
    default:     return 5;
  }
}

/**
 * Asigna el color a un transformador dado su `salud_actual.hi_final`
 * y su `criticidad.nivel`. Devuelve `null` si faltan datos.
 */
export function evaluarTransformador(tx, rangos) {
  if (!tx) return null;
  const hi = tx.salud_actual && tx.salud_actual.hi_final;
  let nivel = tx.criticidad && tx.criticidad.nivel;
  if (!nivel && tx.servicio) {
    nivel = nivelPorUsuarios(tx.servicio.usuarios_aguas_abajo, rangos);
  }
  if (hi == null || !nivel) return null;
  const color = colorCelda(Math.round(hi), nivel);
  return {
    hi, nivel, color,
    prioridad: prioridadNumerica(color)
  };
}

/**
 * Agrega conteos por celda para un universo de transformadores.
 * Devuelve estructura 5×5 lista para renderizar.
 */
export function agregarConteos(transformadores, rangos) {
  const out = {};
  for (const hi of [5, 4, 3, 2, 1]) {
    out[hi] = {};
    for (const n of NIVELES_ORDEN) out[hi][n] = { count: 0, color: colorCelda(hi, n), ids: [] };
  }
  for (const tx of transformadores) {
    const res = evaluarTransformador(tx, rangos);
    if (!res) continue;
    const filaHi = Math.round(res.hi);
    if (!out[filaHi] || !out[filaHi][res.nivel]) continue;
    out[filaHi][res.nivel].count += 1;
    out[filaHi][res.nivel].ids.push(tx.id || tx.codigo);
  }
  return out;
}
