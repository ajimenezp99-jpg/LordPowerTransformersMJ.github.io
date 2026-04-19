// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Schema de muestras de laboratorio (F19)
// ──────────────────────────────────────────────────────────────
// Colección `/muestras` como time-series de los 3 tipos de
// ensayo: DGA, ADFQ, FURANOS. Una muestra puede ser combo
// (tipo=COMBO) si el laboratorio reporta varios ensayos en el
// mismo informe.
//
// Cada muestra al guardarse dispara recálculo del snapshot
// `salud_actual` del transformador (trigger onMuestraCreate).
// El trigger vive en F32 (Cloud Functions); en F19 la UI admin
// puede invocar el recálculo vía `recalcularSaludTrafo` del
// motor F18.
// ══════════════════════════════════════════════════════════════

import { enValores } from './schema.js';

export const TIPOS_MUESTRA = Object.freeze([
  { value: 'DGA',      label: 'DGA — Gases disueltos'  },
  { value: 'ADFQ',     label: 'ADFQ — Físico-químico'  },
  { value: 'FURANOS',  label: 'Furanos (2FAL)'         },
  { value: 'COMBO',    label: 'Combo (varios ensayos)' }
]);

export const EVENTOS_EXTERNOS = Object.freeze([
  { value: 'descarga_atmosferica', label: 'Descarga atmosférica' },
  { value: 'falla_red_externa',    label: 'Falla de red externa' },
  { value: 'maniobra',             label: 'Maniobra operativa'   },
  { value: 'ninguno',              label: 'Ninguno'              }
]);

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'string') v = v.replace(/,/g, '.');
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const bool = (v) => (v === true || v === 'true' || v === 1 || v === '1');
const arr = (v) => Array.isArray(v) ? v.map(str).filter(Boolean) : [];

export function sanitizarMuestra(input) {
  const src = input || {};
  const tipo = enValores(TIPOS_MUESTRA, str(src.tipo).toUpperCase())
    ? str(src.tipo).toUpperCase()
    : 'DGA';
  return {
    schema_version:  1,
    transformadorId: str(src.transformadorId),
    transformadorCodigo: str(src.transformadorCodigo),
    tipo,
    fecha_muestra:   str(src.fecha_muestra),
    fecha_ensayo:    str(src.fecha_ensayo),
    laboratorio:     str(src.laboratorio),
    tecnico_muestrista: str(src.tecnico_muestrista),
    // Gases DGA
    gases: {
      H2:   num(src.gases && src.gases.H2)   ?? num(src.H2),
      CH4:  num(src.gases && src.gases.CH4)  ?? num(src.CH4),
      C2H4: num(src.gases && src.gases.C2H4) ?? num(src.C2H4),
      C2H6: num(src.gases && src.gases.C2H6) ?? num(src.C2H6),
      C2H2: num(src.gases && src.gases.C2H2) ?? num(src.C2H2),
      CO:   num(src.gases && src.gases.CO)   ?? num(src.CO),
      CO2:  num(src.gases && src.gases.CO2)  ?? num(src.CO2),
      O2:   num(src.gases && src.gases.O2)   ?? num(src.O2),
      N2:   num(src.gases && src.gases.N2)   ?? num(src.N2)
    },
    // ADFQ
    adfq: {
      rigidez_kv: num(src.adfq && src.adfq.rigidez_kv) ?? num(src.rigidez_kv),
      humedad_ppm: num(src.adfq && src.adfq.humedad_ppm) ?? num(src.humedad_ppm),
      ti: num(src.adfq && src.adfq.ti) ?? num(src.ti),
      nn: num(src.adfq && src.adfq.nn) ?? num(src.nn)
    },
    furanos_ppb: num(src.furanos_ppb ?? src.ppb2fal ?? src.ppb),
    validacion_calidad_toma: num(src.validacion_calidad_toma),
    // A9.6 — contexto operativo
    eventos_externos_asociados:
      arr(src.eventos_externos_asociados).filter((v) =>
        EVENTOS_EXTERNOS.some((e) => e.value === v) || v.length > 0
      ),
    hubo_intervencion_previa_30d: bool(src.hubo_intervencion_previa_30d),
    intervencion_descripcion:     str(src.intervencion_descripcion),
    observacion_contextual_analista: str(src.observacion_contextual_analista),
    observaciones: str(src.observaciones)
  };
}

export function validarMuestra(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (!doc.transformadorId)    errs.push('transformadorId es obligatorio.');
  if (!doc.tipo)               errs.push('tipo es obligatorio.');
  if (!doc.fecha_muestra)      errs.push('fecha_muestra es obligatoria.');

  // A9.6: si C2H2 o TDGC ≥ 3, el analista DEBE anotar contexto.
  const g = doc.gases || {};
  if (doc.tipo === 'DGA' || doc.tipo === 'COMBO') {
    const hayTDGC = [g.H2, g.CH4, g.C2H4, g.C2H6].every((x) => x != null);
    if (hayTDGC) {
      const tdgc = g.H2 + g.CH4 + g.C2H4 + g.C2H6;
      if ((tdgc > 201 || (g.C2H2 != null && g.C2H2 >= 5))
          && !doc.observacion_contextual_analista) {
        errs.push('Contexto operativo obligatorio (A9.6) cuando TDGC>201 o C2H2>=5.');
      }
    }
  }
  return errs;
}
