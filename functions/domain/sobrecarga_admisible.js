// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Sobrecarga admisible (Fase 18 · A9.5)
// ──────────────────────────────────────────────────────────────
// Implementa el tiempo admisible de sobrecarga y la aceleración
// de pérdida de vida útil por temperatura, conforme:
//
//   IEEE C57.91 — "Loading Guide for Oil-Immersed Transformers",
//   Sección 7 (Cálculos de carga de emergencia).
//
// Uso:
//   · F24 — decisiones de cambio de rol temporal sobre TPT.
//   · F30 — justificación del Plan de Mitigación 90–110 %.
//   · F27 — widget informativo en el dashboard del ingeniero.
//
// Referencia del documento interno: MO.00418.DE-GAC-AX.01
// §4.1.3 Imagen 1 (curva tiempo-sobrecarga).
// ══════════════════════════════════════════════════════════════

const toNum = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Factor de aceleración de envejecimiento del aislamiento según
 * IEEE C57.91 Annex G (curva de Arrhenius aproximada). Referida
 * a la temperatura del punto caliente (hotspot) del devanado.
 *
 *   FAA = exp[(15000/383) − (15000/(HST + 273))]
 *
 * HST = hotspot temperature en °C.
 * FAA = 1 cuando HST = 110 °C (referencia de diseño).
 */
export function aceleracionEnvejecimiento(hotspotC) {
  const t = toNum(hotspotC);
  if (t == null) return null;
  return Math.exp((15000 / 383) - (15000 / (t + 273)));
}

// ── Tabla simplificada de tiempo admisible IEEE C57.91 ─────────
// Valores indicativos para transformador OA (ONAN) con carga
// inicial pre-existente y temperatura ambiente estándar. Son un
// resumen de IEEE C57.91 Tabla 6 (carga de emergencia de corto
// plazo) — la herramienta completa requiere entrada de curva
// térmica del fabricante; aquí damos una aproximación útil para
// ruteo de decisiones.
//
// Formato: { factor_sobrecarga: { carga_inicial_pct: minutos_admisibles } }
// Temperatura ambiente asumida: 30 °C (trópico).
const TABLA_IEEE_C57_91 = Object.freeze({
  1.10: { 50: 1440, 75: 720,  90: 360,  100: 180 },
  1.15: { 50: 720,  75: 360,  90: 180,  100: 90  },
  1.20: { 50: 360,  75: 180,  90: 90,   100: 45  },
  1.30: { 50: 120,  75: 60,   90: 30,   100: 15  },
  1.50: { 50: 30,   75: 15,   90: 10,   100: 5   }
});

/**
 * Tiempo admisible de sobrecarga en minutos.
 *
 * @param {number} factor — factor de sobrecarga aplicado
 *   (1.10 = 110 %, 1.50 = 150 %, etc.). Se clampea al valor
 *   discreto más cercano de la tabla.
 * @param {number} cargaInicialPct — % de carga sostenida antes
 *   del evento (50..100).
 * @param {number} tempAmbiente — °C. Valores >30 reducen el
 *   tiempo admisible (factor empírico −5 % por °C adicional).
 * @returns {{minutos, aceleracion_envejecimiento, factor_usado,
 *            carga_usada_pct, advertencia?}}
 */
export function tiempoAdmisible(factor, cargaInicialPct = 75, tempAmbiente = 30) {
  const f   = toNum(factor);
  const ci  = clamp(toNum(cargaInicialPct) ?? 75, 0, 100);
  const ta  = toNum(tempAmbiente) ?? 30;

  if (f == null || f <= 1) {
    return {
      minutos: Infinity,
      aceleracion_envejecimiento: 1,
      factor_usado: 1,
      carga_usada_pct: ci,
      advertencia: 'Factor ≤ 1: no hay sobrecarga.'
    };
  }

  // Snap al factor discreto más cercano.
  const factoresDiscretos = Object.keys(TABLA_IEEE_C57_91).map(Number).sort((a, b) => a - b);
  const fUsado = _snapCercano(f, factoresDiscretos);
  // Snap de carga inicial a múltiplos de 25 %.
  const cargasDiscretas = [50, 75, 90, 100];
  const ciUsado = _snapCercano(ci, cargasDiscretas);

  let minutos = TABLA_IEEE_C57_91[fUsado][ciUsado];

  // Ajuste por temperatura ambiente. IEEE C57.91 asume 30 °C;
  // cada °C adicional reduce el tiempo ~5 % (aproximación).
  if (ta > 30) {
    minutos = minutos * Math.pow(0.95, ta - 30);
  } else if (ta < 30) {
    minutos = minutos * Math.pow(1.05, 30 - ta);
  }

  // Hotspot estimado: 110 °C base + 8 °C por cada 10% adicional de carga.
  const cargaPicoPct = ci * f;
  const hotspotC = 110 + 0.8 * (cargaPicoPct - 100);
  const faa = aceleracionEnvejecimiento(hotspotC);

  const res = {
    minutos: Math.round(minutos),
    aceleracion_envejecimiento: faa,
    factor_usado: fUsado,
    carga_usada_pct: ciUsado,
    hotspot_estimado_c: hotspotC
  };

  if (fUsado !== f) {
    res.advertencia = `Factor snap ${f} → ${fUsado} (tabla IEEE C57.91 discreta).`;
  }
  return res;
}

function _snapCercano(v, lista) {
  let best = lista[0];
  let bestDiff = Math.abs(v - best);
  for (const x of lista) {
    const d = Math.abs(v - x);
    if (d < bestDiff) { best = x; bestDiff = d; }
  }
  return best;
}

/**
 * Sugerencia de plan de mitigación cuando un transformador opera
 * 90–110 % de nominal (§A7 Condición 4 mitigación).
 *
 * Entrada: transformador v2 + factor + duración prevista.
 * Salida: objeto con recomendación y referencias.
 */
export function proponerPlanMitigacionSobrecarga(transformador, factor, duracionMin) {
  const sobrecarga = tiempoAdmisible(factor, 75, 30);
  const excede = duracionMin > sobrecarga.minutos;

  return {
    recomendacion: excede
      ? 'RIESGO: la duración prevista excede el tiempo admisible IEEE C57.91. Redistribuir carga a TPT/Respaldo.'
      : 'ACEPTABLE: mantener monitoreo termográfico durante el evento.',
    tiempo_admisible_min: sobrecarga.minutos,
    duracion_prevista_min: duracionMin,
    aceleracion_envejecimiento: sobrecarga.aceleracion_envejecimiento,
    referencia: 'IEEE C57.91 §7 + MO.00418 §4.1.3 + §A7 Cond. 4',
    transformador_id: transformador && transformador.id,
    factor_evaluado: factor
  };
}
