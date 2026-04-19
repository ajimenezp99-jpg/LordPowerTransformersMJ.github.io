// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Motor de Salud de Activos (Fase 18)
// ──────────────────────────────────────────────────────────────
// Implementa el Health Index ponderado oficial conforme
// MO.00418.DE-GAC-AX.01 Ed. 02 — CARIBEMAR DE LA COSTA S.A.S
// E.S.P (Afinia · Grupo EPM).
//
// Funciones PURAS. Cero side effects, cero I/O. Importable
// desde Node (tests), desde el navegador (UI/data layer) y
// desde Cloud Functions (F32).
//
// Fuente canónica: §A3 (variables y umbrales), §A4 (fórmula HI
// ponderada), §A5 (reglas de override), §A9 (protocolos).
// Cualquier cambio de umbral fuera de este módulo debe hacerse
// vía /umbrales_salud/global (Firestore) — los valores aquí son
// los BASELINES oficiales.
// ══════════════════════════════════════════════════════════════

import { PESOS_HI, UBICACIONES_FUGA, bucketDesdeHI } from './schema.js';

// ── Utilidades internas ────────────────────────────────────────
const toNum = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const calif15 = (v) => {
  const n = toNum(v);
  if (n == null) return null;
  return clamp(Math.round(n), 1, 5);
};

// ══════════════════════════════════════════════════════════════
// DGA — Análisis de Gases Disueltos  (§A3.1)
// ══════════════════════════════════════════════════════════════

// ── TDGC — Total de Gases Combustibles (4 gases) ───────────────
// MO.00418 §A3.1 (a) — SOLO H2+CH4+C2H4+C2H6. CO y CO2 aparte.
// Ref: IEEE C57.104, IEC 60599.
// Umbrales oficiales:
//   ∑TDGC ≥ 401            → 5
//   301 < ∑TDGC ≤ 401      → 4
//   201 < ∑TDGC ≤ 301      → 3
//    95 ≤ ∑TDGC ≤ 201      → 2
//   ∑TDGC < 95             → 1
export const UMBRALES_TDGC = Object.freeze([401, 301, 201, 95]);

/**
 * @param {{H2, CH4, C2H4, C2H6}} gases — ppm
 */
export function calcularCalifTDGC(gases) {
  if (!gases) return null;
  const { H2, CH4, C2H4, C2H6 } = gases;
  const h2   = toNum(H2);
  const ch4  = toNum(CH4);
  const c2h4 = toNum(C2H4);
  const c2h6 = toNum(C2H6);
  if ([h2, ch4, c2h4, c2h6].some((x) => x == null)) return null;
  const tdgc = h2 + ch4 + c2h4 + c2h6;
  // Convención estricta: la banda superior abre siempre con ">".
  // 401 → 4 (entra en 301 < v ≤ 401); > 401 → 5.
  if (tdgc >  401) return 5;
  if (tdgc >  301) return 4;
  if (tdgc >  201) return 3;
  if (tdgc >=  95) return 2;
  return 1;
}

// ── CO — Gas asociado a papel ──────────────────────────────────
// MO.00418 §A3.1 (b).
export const UMBRALES_CO = Object.freeze([
  { calif: 5, min: 750,  max: Infinity },
  { calif: 4, min: 550,  max: 750      },  // 550 < CO ≤ 750 (se toma 550+eps)
  { calif: 3, min: 300,  max: 550      },
  { calif: 2, min: 100,  max: 300      },
  { calif: 1, min: -Infinity, max: 100 }   // CO < 99 → usa ≤100 como frontera
]);

export function calcularCalifCO(co) {
  const v = toNum(co);
  if (v == null) return null;
  if (v >= 750) return 5;
  if (v >  550) return 4;
  if (v >  300) return 3;
  if (v >  100) return 2;
  return 1;
}

// ── CO2 — Gas asociado a papel ─────────────────────────────────
export function calcularCalifCO2(co2) {
  const v = toNum(co2);
  if (v == null) return null;
  if (v >= 7001) return 5;
  if (v >  5000) return 4;
  if (v >  3000) return 3;
  if (v >  1500) return 2;
  return 1;
}

// ── C2H2 — Acetileno ───────────────────────────────────────────
// MO.00418 §A3.1 (c) — umbrales OFICIALES (5× más estrictos que
// el Excel legacy, ver §D2).
export function calcularCalifC2H2(c2h2) {
  const v = toNum(c2h2);
  if (v == null) return null;
  if (v >= 7) return 5;
  if (v >= 6) return 4;
  if (v >= 5) return 3;
  if (v >= 3) return 2;
  return 1;
}

// ── Evaluación DGA agregada ────────────────────────────────────
// MO.00418 §A3.1 (d): EVAL_DGA = MAX(CalifTDGC, CalifC2H2).
// CO/CO2 quedan como indicadores complementarios (no entran al
// HI principal; disparan alertas propias).
export function evaluarDGA(muestra) {
  if (!muestra) return null;
  const tdgc = calcularCalifTDGC(muestra.gases || muestra);
  const c2h2 = calcularCalifC2H2((muestra.gases || muestra).C2H2);
  if (tdgc == null && c2h2 == null) return null;
  return Math.max(tdgc ?? 0, c2h2 ?? 0) || null;
}

// ══════════════════════════════════════════════════════════════
// ADFQ — Análisis Dieléctrico Físico-Químico  (§A3.2)
// Refs: NTC 3284, ASTM D1816, D974, D664, D924-23, etc.
// ══════════════════════════════════════════════════════════════

export function calcularCalifRD(rdKv) {
  const v = toNum(rdKv);
  if (v == null) return null;
  if (v < 19) return 5;
  if (v < 20) return 4;
  if (v < 25) return 3;
  if (v < 33) return 2;
  return 1;
}

/**
 * Índice de Calidad IC = TI / NN  (tensión interfacial / número
 * de neutralización).
 * @param {{ti, nn}} src
 */
export function calcularCalifIC({ ti, nn } = {}) {
  const iTi = toNum(ti);
  const iNn = toNum(nn);
  if (iTi == null || iNn == null || iNn === 0) return null;
  const ic = iTi / iNn;
  if (ic <= 713)  return 5;
  if (ic <= 999)  return 4;
  if (ic <= 1130) return 3;
  if (ic <= 1499) return 2;
  return 1;
}

/**
 * EVALUACION_ADFQ = promedio simple (CalifRD + CalifIC) / 2.
 * Si falta alguna, devuelve la otra; si faltan ambas, null.
 */
export function evaluarADFQ(muestra) {
  if (!muestra) return null;
  const rd = calcularCalifRD(muestra.rigidez_kv ?? muestra.rd);
  const ic = calcularCalifIC({
    ti: muestra.ti ?? muestra.tension_interfacial,
    nn: muestra.nn ?? muestra.numero_neutralizacion
  });
  if (rd == null && ic == null) return null;
  if (rd == null) return ic;
  if (ic == null) return rd;
  return (rd + ic) / 2;
}

// ══════════════════════════════════════════════════════════════
// FUR — Furanos + Vida útil remanente (Chedong)  (§A3.3)
// Ref: ASTM D5837-15, IEC 61198, CIGRÉ 445.
// ══════════════════════════════════════════════════════════════

export function calcularCalifFUR(ppb) {
  const v = toNum(ppb);
  if (v == null) return null;
  if (v >= 5500) return 5;
  if (v >= 4800) return 4;
  if (v >= 3600) return 3;
  if (v >= 2400) return 2;
  return 1;
}

/**
 * Grado de Polimerización (DP) estimado por 2FAL.
 * DP = [log10(2FAL × 0.88) − 4.51] / (−0.0035)
 *
 * Referencia: CIGRÉ 445 (Chedong curve).
 */
export function calcularDP(ppb2fal) {
  const v = toNum(ppb2fal);
  if (v == null || v <= 0) return null;
  return (Math.log10(v * 0.88) - 4.51) / -0.0035;
}

/**
 * % de vida utilizada a partir del DP.
 * %Vida_utilizada = [log10(DP) − 2.903] / (−0.006021)
 */
export function calcularVidaUtilizada(dp) {
  const v = toNum(dp);
  if (v == null || v <= 0) return null;
  return (Math.log10(v) - 2.903) / -0.006021;
}

export function calcularVidaRemanente(dp) {
  const u = calcularVidaUtilizada(dp);
  if (u == null) return null;
  return clamp(100 - u, 0, 100);
}

// ══════════════════════════════════════════════════════════════
// CRG — Cargabilidad  (§A3.4)
// Refs: IEEE C57.91, IEC 60076-7, CREG 085/2018.
// ══════════════════════════════════════════════════════════════

/**
 * @param {{cp, ap, cs, as, ct, at}} datos — carga y ampacidad en
 *   primario/secundario/terciario. Puede faltar terciario.
 * @returns {{calif, crg_pct}} calificación 1–5 + % medido.
 */
export function calcularCalifCRG({ cp, ap, cs, as: asec, ct, at } = {}) {
  const pct = _cargaMaxPct({ cp, ap, cs, as: asec, ct, at });
  if (pct == null) return { calif: null, crg_pct: null };
  return { calif: _califCRGDesdePct(pct), crg_pct: pct };
}

function _cargaMaxPct({ cp, ap, cs, as: asec, ct, at }) {
  const r1 = _ratioPct(cp, ap);
  const r2 = _ratioPct(cs, asec);
  const r3 = _ratioPct(ct, at);
  const vs = [r1, r2, r3].filter((x) => x != null);
  return vs.length ? Math.max(...vs) : null;
}

function _ratioPct(carga, ampacidad) {
  const c = toNum(carga);
  const a = toNum(ampacidad);
  if (c == null || a == null || a === 0) return null;
  return (c / a) * 100;
}

function _califCRGDesdePct(pct) {
  if (pct > 90) return 5;
  if (pct > 75) return 4;
  if (pct > 65) return 3;
  if (pct > 60) return 2;
  return 1;
}

// ══════════════════════════════════════════════════════════════
// EDAD — Edad cronológica  (§A3.5)
// Ref: Resolución CREG 085/2018 (vida útil reconocida 30 años).
// ══════════════════════════════════════════════════════════════

export function calcularEdadAnos(anoFabricacion, hoy = new Date()) {
  const a = toNum(anoFabricacion);
  if (a == null || a < 1900 || a > 2200) return null;
  const y = (hoy instanceof Date ? hoy : new Date(hoy)).getUTCFullYear();
  return y - a;
}

export function calcularCalifEDAD(anoFabricacion, hoy = new Date()) {
  const edad = calcularEdadAnos(anoFabricacion, hoy);
  if (edad == null) return null;
  if (edad >= 30) return 5;
  if (edad >= 26) return 4;
  if (edad >= 19) return 3;
  if (edad >= 7)  return 2;
  return 1;
}

// ══════════════════════════════════════════════════════════════
// HER — Hermeticidad  (§A3.6)
// Calificación por UBICACIÓN DOMINANTE de la fuga (no por
// componente individual).
// ══════════════════════════════════════════════════════════════

export function calcularCalifHER(ubicacion) {
  if (ubicacion == null || ubicacion === '') return null;
  const hit = UBICACIONES_FUGA.find((u) => u.value === ubicacion);
  return hit ? hit.calif : null;
}

// ══════════════════════════════════════════════════════════════
// PYT — Protecciones y Telecontrol  (§A3.7)
// Escala 1–5 cualitativa. Se acepta directo o un descriptor.
// ══════════════════════════════════════════════════════════════

export const PYT_DESCRIPTORES = Object.freeze([
  { value: 'integral_scada',      calif: 1, label: 'Protección integral + SCADA operativo' },
  { value: 'integral_scada_parc', calif: 2, label: 'Protección completa + SCADA parcial' },
  { value: 'integral_sin_scada',  calif: 3, label: 'Protección completa sin SCADA' },
  { value: 'parcial_sin_scada',   calif: 4, label: 'Protección parcial sin SCADA' },
  { value: 'sin_proteccion',      calif: 5, label: 'Sin protección ni telecontrol' }
]);

export function calcularCalifPYT(evaluacion) {
  if (evaluacion == null || evaluacion === '') return null;
  // Si llega un número 1..5, lo respeta.
  const n = toNum(evaluacion);
  if (n != null) return calif15(n);
  // Si llega un descriptor canónico.
  const hit = PYT_DESCRIPTORES.find((p) => p.value === evaluacion);
  return hit ? hit.calif : null;
}

// ══════════════════════════════════════════════════════════════
// Health Index ponderado  (§A4)
// HI = 0.35·DGA + 0.30·EDAD + 0.15·ADFQ
//    + 0.05·(FUR + CRG + PYT + HER)
// Fuente canónica: Tabla 10 MO.00418 (§A9.8).
// ══════════════════════════════════════════════════════════════

export function calcularHIBruto(califs, pesos = PESOS_HI) {
  if (!califs) return null;
  const c = {
    DGA:  toNum(califs.eval_dga ?? califs.DGA ?? califs.dga),
    EDAD: toNum(califs.calif_edad ?? califs.EDAD ?? califs.edad),
    ADFQ: toNum(califs.eval_adfq ?? califs.ADFQ ?? califs.adfq),
    FUR:  toNum(califs.calif_fur ?? califs.FUR ?? califs.fur),
    CRG:  toNum(califs.calif_crg ?? califs.CRG ?? califs.crg),
    PYT:  toNum(califs.calif_pyt ?? califs.PYT ?? califs.pyt),
    HER:  toNum(califs.calif_her ?? califs.HER ?? califs.her)
  };

  // Suma ponderada sólo con variables disponibles. Si falta una,
  // se redistribuye el peso proporcionalmente para no sesgar el
  // resultado a cero.
  let wTotal = 0;
  let acc = 0;
  for (const key of Object.keys(pesos)) {
    const v = c[key];
    if (v != null) {
      acc     += pesos[key] * v;
      wTotal  += pesos[key];
    }
  }
  if (wTotal === 0) return null;
  return clamp(acc / wTotal, 1, 5);
}

// ══════════════════════════════════════════════════════════════
// Overrides  (§A5 + §A9.1 regla R1)
// Orden de aplicación:
//   1. FUR ≥ 4 → HI := MAX(HI, CalifFUR)
//   2. CRG = 5 → HI := MAX(HI, 4)
//   3. C2H2 = 5 + velocidad detectada → HI := MAX(HI, 4)
// Cada override deja registro en `overrides_aplicados[]`.
// ══════════════════════════════════════════════════════════════

export function aplicarOverrides(hiBruto, califs, contexto = {}) {
  if (hiBruto == null) {
    return { hi_final: null, overrides_aplicados: [] };
  }
  let hi = hiBruto;
  const marks = [];

  const fur  = calif15(califs.calif_fur ?? califs.fur ?? califs.FUR);
  const crg  = calif15(califs.calif_crg ?? califs.crg ?? califs.CRG);
  const c2h2 = calif15(califs.calif_c2h2 ?? califs.c2h2 ?? califs.C2H2);
  const finVida = Boolean(califs.fin_vida_util_papel || contexto.fin_vida_util_papel);

  // 1. FUR ≥ 4 — SOLO si fue aprobado por Profesional de Tx
  //    (§A9.2 "juicio experto"). Se aplica automáticamente sólo
  //    cuando la bandera `fin_vida_util_papel` está en true; de
  //    lo contrario, queda como propuesta pendiente.
  if (fur != null && fur >= 4 && finVida) {
    if (fur > hi) { hi = fur; }
    marks.push(`FUR>=${fur} aprobado (fin_vida_util_papel) — MO.00418 §4.1.2`);
  }

  // 2. CRG = 5 — override duro automático (§A5 + §4.1.3).
  if (crg === 5) {
    if (hi < 4) hi = 4;
    marks.push('CRG=5 automático — MO.00418 §4.1.3');
  }

  // 3. C2H2 = 5 + aceleración detectada (§A9.1 R1/R2/R3).
  const c2h2Accel = Boolean(
    contexto.c2h2_aceleracion_detectada ||
    contexto.velocidad_c2h2_ppm_dia != null &&
      contexto.umbral_velocidad_c2h2 != null &&
      contexto.velocidad_c2h2_ppm_dia >= contexto.umbral_velocidad_c2h2
  );
  if (c2h2 === 5 && c2h2Accel) {
    if (hi < 4) hi = 4;
    marks.push('C2H2=5 + aceleración detectada — MO.00418 §A9.1');
  } else if (c2h2 === 5) {
    // Sólo marcador informativo: el override dispara monitoreo
    // intensivo (F26/A9.1), no sube HI hasta ver aceleración.
    marks.push('C2H2=5 — dispara monitoreo intensivo (§A9.1), HI no modificado sin aceleración');
  }

  return { hi_final: clamp(hi, 1, 5), overrides_aplicados: marks };
}

// ══════════════════════════════════════════════════════════════
// Snapshot completo (API pública de alto nivel)
// ══════════════════════════════════════════════════════════════

export function bucketizarHI(hi) {
  return bucketDesdeHI(hi);
}

/**
 * Calcula el snapshot completo de salud para un transformador
 * dado el contexto más reciente (muestras + cargabilidad + PYT).
 *
 * @param {{transformador, muestraDGA?, muestraADFQ?, muestraFUR?,
 *          cargaActual?, pyt?, her?,
 *          hoy?, contextoOverrides?}} ctx
 * @returns {object} snapshot conforme a `salud_actual` del
 *   schema v2.
 */
export function snapshotSaludCompleto(ctx = {}) {
  const {
    transformador = {},
    muestraDGA, muestraADFQ, muestraFUR,
    cargaActual,
    pyt,
    her,
    hoy = new Date(),
    contextoOverrides = {}
  } = ctx;

  // Variables por separado
  const dga = muestraDGA || {};
  const califTDGC = calcularCalifTDGC(dga.gases || dga);
  const califC2H2 = calcularCalifC2H2((dga.gases || dga).C2H2);
  const califCO   = calcularCalifCO((dga.gases || dga).CO);
  const califCO2  = calcularCalifCO2((dga.gases || dga).CO2);
  const evalDGA   = Math.max(califTDGC ?? 0, califC2H2 ?? 0) || null;

  const adfq = muestraADFQ || {};
  const califRD = calcularCalifRD(adfq.rigidez_kv ?? adfq.rd);
  const califIC = calcularCalifIC({
    ti: adfq.ti ?? adfq.tension_interfacial,
    nn: adfq.nn ?? adfq.numero_neutralizacion
  });
  const evalADFQ = evaluarADFQ(adfq);

  const fur = muestraFUR || {};
  const ppb = toNum(fur.ppb ?? fur.furanos_ppb ?? fur['2fal'] ?? fur.fal2);
  const califFUR = calcularCalifFUR(ppb);
  const dpEst    = calcularDP(ppb);
  const vidaUtil = calcularVidaUtilizada(dpEst);
  const vidaRem  = vidaUtil != null ? clamp(100 - vidaUtil, 0, 100) : null;

  const crgRes = calcularCalifCRG(cargaActual || {});
  const califEDAD = calcularCalifEDAD(
    (transformador.fabricacion && transformador.fabricacion.ano_fabricacion)
    ?? transformador.ano_fabricacion,
    hoy
  );
  const edadAnos = calcularEdadAnos(
    (transformador.fabricacion && transformador.fabricacion.ano_fabricacion)
    ?? transformador.ano_fabricacion,
    hoy
  );
  const califHER = calcularCalifHER(her);
  const califPYT = calcularCalifPYT(pyt);

  const califsHI = {
    eval_dga:    evalDGA,
    calif_edad:  califEDAD,
    eval_adfq:   evalADFQ,
    calif_fur:   califFUR,
    calif_crg:   crgRes.calif,
    calif_pyt:   califPYT,
    calif_her:   califHER
  };

  const hiBruto = calcularHIBruto(califsHI);
  const ov = aplicarOverrides(hiBruto, {
    ...califsHI,
    calif_c2h2: califC2H2,
    fin_vida_util_papel:
      transformador?.salud_actual?.fin_vida_util_papel === true
  }, contextoOverrides);

  return {
    ts_calculo: hoy.toISOString(),
    muestra_dga_ref:  dga.id  || '',
    muestra_adfq_ref: adfq.id || '',
    muestra_fur_ref:  fur.id  || '',
    calif_tdgc: califTDGC,
    calif_co:   califCO,
    calif_co2:  califCO2,
    calif_c2h2: califC2H2,
    eval_dga:   evalDGA,
    calif_rd:   califRD,
    calif_ic:   califIC,
    eval_adfq:  evalADFQ,
    calif_fur:  califFUR,
    dp_estimado: dpEst,
    vida_utilizada_pct: vidaUtil,
    vida_remanente_pct: vidaRem,
    calif_crg:  crgRes.calif,
    crg_pct_medido: crgRes.crg_pct,
    calif_edad: califEDAD,
    edad_anos:  edadAnos,
    calif_her:  califHER,
    ubicacion_fuga_dominante: her || '',
    calif_pyt:  califPYT,
    hi_bruto:   hiBruto,
    hi_final:   ov.hi_final,
    bucket:     bucketDesdeHI(ov.hi_final),
    overrides_aplicados: ov.overrides_aplicados,
    fin_vida_util_papel:
      transformador?.salud_actual?.fin_vida_util_papel === true
  };
}

// ── Helpers privados ───────────────────────────────────────────
function _bandaUmbral(valor, tabla) {
  for (const b of tabla) {
    if (valor >= b.min && valor < b.max) return b.calif;
  }
  // Fallback: usar la última banda.
  return tabla[tabla.length - 1].calif;
}
