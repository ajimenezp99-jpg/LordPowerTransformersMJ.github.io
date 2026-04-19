// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Baseline de umbrales (Fase 18)
// ──────────────────────────────────────────────────────────────
// Valores OFICIALES del MO.00418.DE-GAC-AX.01 Ed. 02. Este
// módulo es la SEMILLA de `/umbrales_salud/global`: cuando la
// colección Firestore no existe, las funciones del motor usan
// estos valores. Cuando un admin los edita via UI F18, el
// motor prefiere los valores persistidos.
//
// Cambiar un valor aquí sin justificación documentada del
// Profesional de Transformadores viola el procedimiento. La UI
// F18 muestra este baseline al lado del valor editado para que
// el director siempre vea la desviación respecto al oficial.
// ══════════════════════════════════════════════════════════════

import { BASELINES_C2H2 } from './monitoreo_intensivo.js';

export const BASELINE_UMBRALES_SALUD = Object.freeze({
  version: '1.0.0',
  referencia: 'MO.00418.DE-GAC-AX.01 Ed. 02',
  actualizado: '2025-10-14',

  // §A3.1 — DGA
  dga: Object.freeze({
    tdgc: Object.freeze({
      c5_min: 401,
      c4_min: 301,
      c3_min: 201,
      c2_min: 95
      // c1 = resto (< 95)
    }),
    co: Object.freeze({
      c5_min: 750,  c4_min_excl: 550,  c3_min_excl: 300,  c2_min_excl: 100
    }),
    co2: Object.freeze({
      c5_min: 7001, c4_min_excl: 5000, c3_min_excl: 3000, c2_min_excl: 1500
    }),
    c2h2: Object.freeze({
      c5_min: 7, c4_min: 6, c3_min: 5, c2_min: 3
    }),
    // §A9.1
    c2h2_monitoreo: BASELINES_C2H2,
    aggregacion: 'MAX(TDGC, C2H2)'
  }),

  // §A3.2 — ADFQ
  adfq: Object.freeze({
    rd_kv: Object.freeze({
      c5_max_excl: 19, c4_max_excl: 20, c3_max_excl: 25, c2_max_excl: 33
    }),
    ic: Object.freeze({
      c5_max: 713, c4_max: 999, c3_max: 1130, c2_max: 1499
    }),
    aggregacion: '(CalifRD + CalifIC) / 2'
  }),

  // §A3.3 — FUR
  fur: Object.freeze({
    c5_min: 5500, c4_min: 4800, c3_min: 3600, c2_min: 2400,
    // §A9.2 juicio experto
    requiere_juicio_experto_desde_calif: 4
  }),

  // §A3.4 — CRG
  crg: Object.freeze({
    c5_min_excl: 90,
    c4_min_excl: 75,
    c3_min_excl: 65,
    c2_min_excl: 60,
    override_hi_min: 4   // CRG=5 ⇒ HI ≥ 4
  }),

  // §A3.5 — EDAD
  edad: Object.freeze({
    c5_min: 30, c4_min: 26, c3_min: 19, c2_min: 7,
    vida_util_regulatoria_anos: 30,   // CREG 085/2018
    referencia_vida_util: 'CREG 085/2018 — N4T1–N4T19 y N5T1–N5T25'
  }),

  // §4.2.1 — Criticidad
  criticidad: Object.freeze({
    max_usuarios_baseline: 48312,
    min_usuarios: 1
  }),

  // §A5 — Reglas de override
  overrides: Object.freeze({
    fur_aprobado: { min_calif: 4, referencia: 'MO.00418 §4.1.2' },
    crg_max:      { min_calif: 5, hi_min: 4, referencia: 'MO.00418 §4.1.3' },
    c2h2_accel:   { velocidad_ppm_dia: BASELINES_C2H2.velocidad_critica_ppm_dia,
                    hi_min: 4, referencia: 'MO.00418 §A9.1' }
  })
});

/**
 * Merge profundo del baseline con valores custom de Firestore.
 * Valores ausentes en `custom` heredan del baseline.
 */
export function mergeConBaseline(custom) {
  if (!custom || typeof custom !== 'object') return BASELINE_UMBRALES_SALUD;
  return _deepMerge(BASELINE_UMBRALES_SALUD, custom);
}

function _deepMerge(base, over) {
  if (typeof over !== 'object' || over == null) return over;
  if (Array.isArray(over)) return over.slice();
  const out = {};
  for (const k of new Set([...Object.keys(base || {}), ...Object.keys(over)])) {
    const b = base ? base[k] : undefined;
    const o = over[k];
    if (o === undefined) out[k] = b;
    else if (typeof o === 'object' && o !== null && !Array.isArray(o)) {
      out[k] = _deepMerge(b || {}, o);
    } else {
      out[k] = o;
    }
  }
  return out;
}
