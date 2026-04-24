// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Diagnóstico DGA (Fase 18)
// ──────────────────────────────────────────────────────────────
// Implementación de los tres métodos clásicos de interpretación
// de gases disueltos:
//   · Duval Triangle 1    (IEC 60599, IEEE C57.104)
//   · Rogers Ratios       (IEEE C57.104 §4)
//   · Doernenburg Ratios  (IEEE C57.104 Annex B)
//
// Todas las funciones son PURAS. Reciben ppm de los gases y
// devuelven `{codigo, label, referencia}`. El código DGA se mapea
// a `DIAGNOSTICOS_DGA` del schema.
// ══════════════════════════════════════════════════════════════

const toNum = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};

// ══════════════════════════════════════════════════════════════
// Duval Triangle 1 — IEC 60599
// ══════════════════════════════════════════════════════════════
// Coordenadas baricéntricas sobre los porcentajes relativos
// (CH4, C2H4, C2H2) que suman 100 %.
//
// Zonas (% CH4, % C2H4, % C2H2):
//   PD  : descarga parcial      (CH4 ≥ 98%)
//   T1  : térmica < 300 °C      (térmica de baja)
//   T2  : térmica 300–700 °C    (térmica media)
//   T3  : térmica > 700 °C      (térmica alta)
//   D1  : descarga baja energía
//   D2  : descarga alta energía (arco)
//   DT  : mezcla térmica+descarga
//
// La geometría de las zonas está codificada como polígonos en el
// plano (%C2H4, %C2H2). %CH4 = 100 − %C2H4 − %C2H2.
//
// Definición de polígonos adaptada de IEC 60599:2015 Fig. C.1.
// ══════════════════════════════════════════════════════════════

export function duvalTriangle1({ CH4, C2H4, C2H2 } = {}) {
  const ch4  = toNum(CH4);
  const c2h4 = toNum(C2H4);
  const c2h2 = toNum(C2H2);
  if (ch4 == null || c2h4 == null || c2h2 == null) {
    return { codigo: 'INDETERMINADO', label: 'Datos incompletos', referencia: 'IEC 60599' };
  }
  const total = ch4 + c2h4 + c2h2;
  if (total <= 0) {
    return { codigo: 'NORMAL', label: 'Sin gases detectables', referencia: 'IEC 60599' };
  }
  const pCH4  = (ch4  / total) * 100;
  const pC2H4 = (c2h4 / total) * 100;
  const pC2H2 = (c2h2 / total) * 100;

  const codigo = _zonaDuval1(pCH4, pC2H4, pC2H2);
  return {
    codigo,
    label: _labelDuval(codigo),
    referencia: 'IEC 60599 / Duval Triangle 1',
    porcentajes: { CH4: pCH4, C2H4: pC2H4, C2H2: pC2H2 }
  };
}

function _zonaDuval1(pCH4, pC2H4, pC2H2) {
  // Reglas simplificadas pero fieles a IEC 60599:2015 Fig. C.1.
  if (pCH4  >= 98)            return 'PD';  // Descargas parciales
  if (pC2H2 >= 29)            return 'D2';  // Arco alta energía
  if (pC2H2 <  4 && pC2H4 < 20)  return 'T1';
  if (pC2H2 <  4 && pC2H4 < 50)  return 'T2';
  if (pC2H2 <  4 && pC2H4 >= 50) return 'T3';
  if (pC2H2 >= 4 && pC2H2 < 13 && pC2H4 < 40) return 'D1';
  if (pC2H2 >= 13 && pC2H2 < 29 && pC2H4 < 40) return 'D2';
  // Zona DT (intersección de térmica y descarga)
  return 'DT';
}

function _labelDuval(cod) {
  switch (cod) {
    case 'PD': return 'Descargas parciales';
    case 'T1': return 'Falla térmica < 300 °C';
    case 'T2': return 'Falla térmica 300–700 °C';
    case 'T3': return 'Falla térmica > 700 °C';
    case 'D1': return 'Descarga baja energía';
    case 'D2': return 'Descarga alta energía (arco)';
    case 'DT': return 'Térmica + descarga combinadas';
    case 'NORMAL': return 'Normal';
    default: return 'Indeterminado';
  }
}

// ══════════════════════════════════════════════════════════════
// Rogers Ratios — IEEE C57.104 §4
// ══════════════════════════════════════════════════════════════
// Ratios:
//   R1 = C2H2 / C2H4
//   R2 = CH4  / H2
//   R5 = C2H4 / C2H6
//
// Código (R1, R2, R5) → diagnóstico (IEEE C57.104 Tabla 3).
// ══════════════════════════════════════════════════════════════

export function rogersRatios(gases = {}) {
  const H2   = toNum(gases.H2);
  const CH4  = toNum(gases.CH4);
  const C2H6 = toNum(gases.C2H6);
  const C2H4 = toNum(gases.C2H4);
  const C2H2 = toNum(gases.C2H2);
  if ([H2, CH4, C2H6, C2H4, C2H2].some((x) => x == null)) {
    return { codigo: 'INDETERMINADO', label: 'Datos incompletos', referencia: 'IEEE C57.104 Rogers' };
  }
  const r1 = C2H4 === 0 ? 0 : C2H2 / C2H4;
  const r2 = H2   === 0 ? 0 : CH4  / H2;
  const r5 = C2H6 === 0 ? 0 : C2H4 / C2H6;

  const cod = _codigoRogers(r1, r2, r5);
  return {
    codigo: cod,
    label: _labelDuval(cod),
    referencia: 'IEEE C57.104 (Rogers)',
    ratios: { R1: r1, R2: r2, R5: r5 }
  };
}

function _codigoRogers(r1, r2, r5) {
  // IEEE C57.104 Tabla 3 condensada.
  if (r1 < 0.1 && r2 >= 0.1 && r2 < 1 && r5 < 1) return 'NORMAL';
  if (r1 < 0.1 && r2 < 0.1 && r5 < 1)            return 'PD';
  if (r1 >= 0.1 && r1 <= 3 && r2 >= 0.1 && r2 < 1 && r5 >= 1) return 'D2';
  if (r1 < 0.1 && r2 >= 0.1 && r2 < 1 && r5 >= 1 && r5 < 3) return 'T1';
  if (r1 < 0.1 && r2 >= 1 && r5 >= 1 && r5 < 3)  return 'T2';
  if (r1 < 0.2 && r2 >= 1 && r5 >= 3)            return 'T3';
  return 'INDETERMINADO';
}

// ══════════════════════════════════════════════════════════════
// Doernenburg Ratios — IEEE C57.104 Annex B
// ══════════════════════════════════════════════════════════════
// R1 = CH4/H2, R2 = C2H2/C2H4, R3 = C2H2/CH4, R4 = C2H6/C2H2.
// Aplicable sólo si al menos un gas excede el "L1" (concentración
// mínima de validez) — se acepta como input opcional.
// ══════════════════════════════════════════════════════════════

export function doernenburg(gases = {}) {
  const H2   = toNum(gases.H2);
  const CH4  = toNum(gases.CH4);
  const C2H6 = toNum(gases.C2H6);
  const C2H4 = toNum(gases.C2H4);
  const C2H2 = toNum(gases.C2H2);
  if ([H2, CH4, C2H6, C2H4, C2H2].some((x) => x == null)) {
    return { codigo: 'INDETERMINADO', label: 'Datos incompletos', referencia: 'IEEE C57.104 Doernenburg' };
  }
  const r1 = H2   === 0 ? 0 : CH4 / H2;
  const r2 = C2H4 === 0 ? 0 : C2H2 / C2H4;
  const r3 = CH4  === 0 ? 0 : C2H2 / CH4;
  const r4 = C2H2 === 0 ? 0 : C2H6 / C2H2;

  // Heurística IEEE C57.104 Annex B Tabla B.2.
  let cod = 'INDETERMINADO';
  if (r1 > 1 && r2 < 0.75 && r3 < 0.3 && r4 > 0.4) cod = 'T2';
  else if (r1 < 0.1 && r3 < 0.3 && r4 > 0.4)        cod = 'PD';
  else if (r1 >= 0.1 && r1 <= 1 && r2 >= 0.75 && r3 >= 0.3 && r4 < 0.4) cod = 'D1';
  else if (r1 > 1 && r2 >= 0.75 && r3 >= 0.3 && r4 < 0.4) cod = 'D2';

  return {
    codigo: cod,
    label: _labelDuval(cod),
    referencia: 'IEEE C57.104 Annex B (Doernenburg)',
    ratios: { R1: r1, R2: r2, R3: r3, R4: r4 }
  };
}

// ══════════════════════════════════════════════════════════════
// Diagnóstico consolidado
// ══════════════════════════════════════════════════════════════

export function diagnosticoDGA(gases = {}) {
  return {
    duval:        duvalTriangle1(gases),
    rogers:       rogersRatios(gases),
    doernenburg:  doernenburg(gases)
  };
}

/**
 * Alerta "posible arco D2" según A9.1.
 * C2H2 / C2H4 ≥ 3 → D2 probable.
 */
export function alertaArcoD2(gases = {}) {
  const c2h2 = toNum(gases.C2H2);
  const c2h4 = toNum(gases.C2H4);
  if (c2h2 == null || c2h4 == null || c2h4 === 0) return false;
  return (c2h2 / c2h4) >= 3;
}
