// Tests del motor de salud (F18).
// Conformidad numérica con MO.00418.DE-GAC-AX.01 Ed. 02.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularCalifTDGC, calcularCalifCO, calcularCalifCO2, calcularCalifC2H2,
  evaluarDGA,
  calcularCalifRD, calcularCalifIC, evaluarADFQ,
  calcularCalifFUR, calcularDP, calcularVidaUtilizada, calcularVidaRemanente,
  calcularCalifCRG,
  calcularEdadAnos, calcularCalifEDAD,
  calcularCalifHER, calcularCalifPYT,
  calcularHIBruto, aplicarOverrides, bucketizarHI,
  snapshotSaludCompleto
} from '../assets/js/domain/salud_activos.js';

// ── DGA · TDGC ────────────────────────────────────────────────
describe('calcularCalifTDGC — MO.00418 §A3.1 (a)', () => {
  test('bordes oficiales (solo 4 gases)', () => {
    const mk = (s) => ({ H2: s, CH4: 0, C2H4: 0, C2H6: 0 });
    assert.equal(calcularCalifTDGC(mk(94)),  1);
    assert.equal(calcularCalifTDGC(mk(95)),  2);
    assert.equal(calcularCalifTDGC(mk(200)), 2);
    assert.equal(calcularCalifTDGC(mk(201)), 2);   // 95 ≤ v ≤ 201 → 2
    assert.equal(calcularCalifTDGC(mk(202)), 3);   // 201 < v ≤ 301 → 3
    assert.equal(calcularCalifTDGC(mk(301)), 3);
    assert.equal(calcularCalifTDGC(mk(302)), 4);   // 301 < v ≤ 401 → 4
    assert.equal(calcularCalifTDGC(mk(401)), 4);
    assert.equal(calcularCalifTDGC(mk(402)), 5);   // v ≥ 401 & > 401 → 5
  });

  test('suma de los 4 gases canónicos', () => {
    const r = calcularCalifTDGC({ H2: 100, CH4: 100, C2H4: 100, C2H6: 50 });
    // 350 → 301 < v ≤ 401 → 4
    assert.equal(r, 4);
  });

  test('datos incompletos → null', () => {
    assert.equal(calcularCalifTDGC({ H2: 10 }), null);
    assert.equal(calcularCalifTDGC(null), null);
  });
});

// ── DGA · CO / CO2 ────────────────────────────────────────────
describe('calcularCalifCO', () => {
  test('bordes MO.00418', () => {
    assert.equal(calcularCalifCO(99),  1);
    assert.equal(calcularCalifCO(100), 1);    // CO ≤ 100 → 1 según tabla
    assert.equal(calcularCalifCO(101), 2);
    assert.equal(calcularCalifCO(300), 2);
    assert.equal(calcularCalifCO(301), 3);
    assert.equal(calcularCalifCO(550), 3);
    assert.equal(calcularCalifCO(551), 4);
    assert.equal(calcularCalifCO(750), 5);
    assert.equal(calcularCalifCO(1500),5);
  });
});

describe('calcularCalifCO2', () => {
  test('bordes', () => {
    assert.equal(calcularCalifCO2(1499), 1);
    assert.equal(calcularCalifCO2(1500), 1);
    assert.equal(calcularCalifCO2(1501), 2);
    assert.equal(calcularCalifCO2(3000), 2);
    assert.equal(calcularCalifCO2(3001), 3);
    assert.equal(calcularCalifCO2(5000), 3);
    assert.equal(calcularCalifCO2(5001), 4);
    assert.equal(calcularCalifCO2(7000), 4);
    assert.equal(calcularCalifCO2(7001), 5);
  });
});

// ── DGA · C2H2 (§D2 — umbrales 5× más estrictos) ──────────────
describe('calcularCalifC2H2 — MO.00418 §A3.1 (c)', () => {
  test('umbrales oficiales corrigen error Excel §D2', () => {
    assert.equal(calcularCalifC2H2(2),  1);
    assert.equal(calcularCalifC2H2(3),  2);
    assert.equal(calcularCalifC2H2(4.9),2);
    assert.equal(calcularCalifC2H2(5),  3);
    assert.equal(calcularCalifC2H2(6),  4);
    assert.equal(calcularCalifC2H2(6.9),4);
    assert.equal(calcularCalifC2H2(7),  5);
    assert.equal(calcularCalifC2H2(99), 5);
  });

  test('≥ 7 siempre es 5 (regla dura para arcos)', () => {
    for (const v of [7, 10, 15, 50, 100, 999]) {
      assert.equal(calcularCalifC2H2(v), 5);
    }
  });
});

describe('evaluarDGA = MAX(TDGC, C2H2)', () => {
  test('TDGC alto domina', () => {
    const m = { gases: { H2: 500, CH4: 0, C2H4: 0, C2H6: 0, C2H2: 0 } };
    assert.equal(evaluarDGA(m), 5);
  });
  test('C2H2 alto domina sobre TDGC bajo', () => {
    const m = { gases: { H2: 10, CH4: 10, C2H4: 10, C2H6: 10, C2H2: 8 } };
    assert.equal(evaluarDGA(m), 5);
  });
});

// ── ADFQ · Rigidez dieléctrica ────────────────────────────────
describe('calcularCalifRD — MO.00418 §A3.2 (a) · NTC 3284', () => {
  test('bordes oficiales (no los del Excel §D3)', () => {
    assert.equal(calcularCalifRD(18),  5);
    assert.equal(calcularCalifRD(19),  4);
    assert.equal(calcularCalifRD(19.9),4);
    assert.equal(calcularCalifRD(20),  3);
    assert.equal(calcularCalifRD(24.9),3);
    assert.equal(calcularCalifRD(25),  2);
    assert.equal(calcularCalifRD(32.9),2);
    assert.equal(calcularCalifRD(33),  1);
    assert.equal(calcularCalifRD(60),  1);
  });
});

// ── ADFQ · IC ─────────────────────────────────────────────────
describe('calcularCalifIC (§A3.2 b)', () => {
  test('usa TI/NN, no los escalones del Excel §D4', () => {
    assert.equal(calcularCalifIC({ ti: 713,  nn: 1 }), 5);
    assert.equal(calcularCalifIC({ ti: 999,  nn: 1 }), 4);
    assert.equal(calcularCalifIC({ ti: 1130, nn: 1 }), 3);
    assert.equal(calcularCalifIC({ ti: 1499, nn: 1 }), 2);
    assert.equal(calcularCalifIC({ ti: 2000, nn: 1 }), 1);
  });

  test('NN=0 → null (división por cero)', () => {
    assert.equal(calcularCalifIC({ ti: 1000, nn: 0 }), null);
  });
});

describe('evaluarADFQ = promedio(RD, IC)', () => {
  test('promedio simple', () => {
    const v = evaluarADFQ({ rigidez_kv: 20, ti: 713, nn: 1 });
    // RD=3, IC=5 → (3+5)/2 = 4
    assert.equal(v, 4);
  });
  test('si falta uno, usa el otro', () => {
    assert.equal(evaluarADFQ({ rigidez_kv: 20 }), 3);
    assert.equal(evaluarADFQ({ ti: 713, nn: 1 }), 5);
  });
});

// ── FUR + Chedong ─────────────────────────────────────────────
describe('calcularCalifFUR (§A3.3)', () => {
  test('bordes oficiales', () => {
    assert.equal(calcularCalifFUR(2399), 1);
    assert.equal(calcularCalifFUR(2400), 2);
    assert.equal(calcularCalifFUR(3599), 2);
    assert.equal(calcularCalifFUR(3600), 3);
    assert.equal(calcularCalifFUR(4799), 3);
    assert.equal(calcularCalifFUR(4800), 4);
    assert.equal(calcularCalifFUR(5499), 4);
    assert.equal(calcularCalifFUR(5500), 5);
  });
});

describe('calcularDP / vida útil (Chedong · CIGRÉ 445)', () => {
  test('2FAL típico → DP razonable', () => {
    // 2FAL = 5000 ppb → DP ≈ 200–300
    const dp = calcularDP(5000);
    assert.ok(dp > 100 && dp < 500, `DP=${dp}`);
  });

  test('vida remanente baja para FUR alto', () => {
    const dp = calcularDP(6000);
    const rem = calcularVidaRemanente(dp);
    assert.ok(rem >= 0 && rem < 30, `vida rem=${rem}`);
  });

  test('vida remanente alta para FUR bajo', () => {
    const dp = calcularDP(500);
    const rem = calcularVidaRemanente(dp);
    assert.ok(rem > 60, `vida rem=${rem}`);
  });
});

// ── CRG ────────────────────────────────────────────────────────
describe('calcularCalifCRG (§A3.4)', () => {
  test('toma MAX(CP/AP, CS/AS, CT/AT)', () => {
    // 85 % → banda 4
    const { calif, crg_pct } = calcularCalifCRG({
      cp: 85, ap: 100, cs: 50, as: 100
    });
    assert.equal(calif, 4);
    assert.equal(crg_pct, 85);
  });

  test('bordes oficiales (no los del Excel §D5)', () => {
    const get = (p) => calcularCalifCRG({ cp: p, ap: 100 }).calif;
    assert.equal(get(60),  1);
    assert.equal(get(60.1),2);
    assert.equal(get(65),  2);
    assert.equal(get(65.1),3);
    assert.equal(get(75),  3);
    assert.equal(get(75.1),4);
    assert.equal(get(90),  4);
    assert.equal(get(90.1),5);
    assert.equal(get(130), 5);
  });

  test('datos incompletos → null', () => {
    assert.equal(calcularCalifCRG({}).calif, null);
  });
});

// ── EDAD ───────────────────────────────────────────────────────
describe('calcularCalifEDAD (§A3.5 · CREG 085/2018)', () => {
  test('activo de 30 años ya es condición 5 (Excel §D6 permitía hasta 36)', () => {
    const hoy = new Date('2026-04-19');
    assert.equal(calcularCalifEDAD(1996, hoy), 5);
    assert.equal(calcularCalifEDAD(2000, hoy), 4);  // 26 años
    assert.equal(calcularCalifEDAD(2007, hoy), 3);  // 19 años
    assert.equal(calcularCalifEDAD(2019, hoy), 2);  // 7 años
    assert.equal(calcularCalifEDAD(2020, hoy), 1);  // 6 años → < 7 → 1
  });

  test('edad <7 = 1', () => {
    const hoy = new Date('2026-04-19');
    assert.equal(calcularCalifEDAD(2023, hoy), 1);
  });

  test('ano inválido → null', () => {
    assert.equal(calcularCalifEDAD(1800), null);
    assert.equal(calcularCalifEDAD('abc'), null);
  });
});

// ── HER / PYT ──────────────────────────────────────────────────
describe('calcularCalifHER por ubicación dominante', () => {
  test('mapeo §A3.6', () => {
    assert.equal(calcularCalifHER('sin_fugas'),      1);
    assert.equal(calcularCalifHER('laterales'),      2);
    assert.equal(calcularCalifHER('junction_block'), 3);
    assert.equal(calcularCalifHER('accesorios'),     4);
    assert.equal(calcularCalifHER('superiores'),     5);
  });
  test('ubicación fuera de catálogo → null', () => {
    assert.equal(calcularCalifHER('base_tanque'), null);
  });
});

describe('calcularCalifPYT', () => {
  test('acepta número directo', () => {
    assert.equal(calcularCalifPYT(3), 3);
    assert.equal(calcularCalifPYT('5'), 5);
  });
  test('acepta descriptor canónico', () => {
    assert.equal(calcularCalifPYT('integral_scada'), 1);
    assert.equal(calcularCalifPYT('sin_proteccion'), 5);
  });
  test('valor fuera de rango clampea', () => {
    assert.equal(calcularCalifPYT(10), 5);
    assert.equal(calcularCalifPYT(-3), 1);
  });
});

// ── HI ponderado + overrides ──────────────────────────────────
describe('calcularHIBruto — Tabla 10 canónica', () => {
  test('todas las variables en 3 → HI ≈ 3', () => {
    const hi = calcularHIBruto({
      eval_dga: 3, calif_edad: 3, eval_adfq: 3,
      calif_fur: 3, calif_crg: 3, calif_pyt: 3, calif_her: 3
    });
    assert.ok(Math.abs(hi - 3) < 1e-9, `hi=${hi}`);
  });

  test('DGA y EDAD dominan (pesos 0.35 y 0.30)', () => {
    const hi = calcularHIBruto({
      eval_dga: 5, calif_edad: 5, eval_adfq: 1,
      calif_fur: 1, calif_crg: 1, calif_pyt: 1, calif_her: 1
    });
    // 0.35*5 + 0.30*5 + 0.35*1 = 1.75 + 1.50 + 0.35 = 3.60
    assert.ok(hi > 3.5 && hi < 3.7, `hi=${hi}`);
  });

  test('redistribuye peso si falta una variable', () => {
    const hi = calcularHIBruto({
      eval_dga: 4, calif_edad: 4
      // resto null
    });
    assert.equal(hi, 4);
  });

  test('todas nulas → null', () => {
    assert.equal(calcularHIBruto({}), null);
  });
});

describe('aplicarOverrides — §A5 + §A9', () => {
  test('CRG=5 fuerza HI ≥ 4', () => {
    const { hi_final, overrides_aplicados } = aplicarOverrides(2.5, { calif_crg: 5 });
    assert.equal(hi_final, 4);
    assert.ok(overrides_aplicados.some((x) => x.includes('CRG=5')));
  });

  test('FUR≥4 sin aprobación experto → NO cambia HI', () => {
    const { hi_final, overrides_aplicados } = aplicarOverrides(3.0, {
      calif_fur: 5, fin_vida_util_papel: false
    });
    assert.equal(hi_final, 3.0);
    assert.ok(!overrides_aplicados.some((x) => x.includes('FUR')));
  });

  test('FUR≥4 CON aprobación experto → HI = MAX(HI, CalifFUR)', () => {
    const { hi_final, overrides_aplicados } = aplicarOverrides(2.0, {
      calif_fur: 5, fin_vida_util_papel: true
    });
    assert.equal(hi_final, 5);
    assert.ok(overrides_aplicados.some((x) => x.includes('FUR')));
  });

  test('C2H2=5 sin aceleración → marker informativo, sin reclasificar', () => {
    const { hi_final, overrides_aplicados } = aplicarOverrides(3.0, {
      calif_c2h2: 5
    });
    assert.equal(hi_final, 3.0);
    assert.ok(overrides_aplicados.some((x) => x.includes('monitoreo intensivo')));
  });

  test('C2H2=5 con aceleración → HI ≥ 4 (regla R1 §A9.1)', () => {
    const { hi_final, overrides_aplicados } = aplicarOverrides(2.5, {
      calif_c2h2: 5
    }, { c2h2_aceleracion_detectada: true });
    assert.equal(hi_final, 4);
    assert.ok(overrides_aplicados.some((x) => x.includes('A9.1')));
  });

  test('combinación CRG=5 + FUR=5 aprobado', () => {
    const { hi_final } = aplicarOverrides(2.0, {
      calif_crg: 5, calif_fur: 5, fin_vida_util_papel: true
    });
    assert.equal(hi_final, 5);
  });
});

// ── Snapshot completo ─────────────────────────────────────────
describe('snapshotSaludCompleto', () => {
  test('integra los 7 factores y devuelve bucket coherente', () => {
    const snap = snapshotSaludCompleto({
      transformador: { fabricacion: { ano_fabricacion: 2005 } },
      muestraDGA: { id: 'd1', gases: { H2: 50, CH4: 50, C2H4: 50, C2H6: 50, C2H2: 2, CO: 200, CO2: 2000 } },
      muestraADFQ: { id: 'a1', rigidez_kv: 40, ti: 1000, nn: 1 },
      muestraFUR: { id: 'f1', ppb: 1000 },
      cargaActual: { cp: 70, ap: 100 },
      pyt: 2,
      her: 'laterales',
      hoy: new Date('2026-04-19')
    });
    assert.ok(snap.hi_final >= 1 && snap.hi_final <= 5, `hi=${snap.hi_final}`);
    assert.ok(typeof snap.bucket === 'string' && snap.bucket.length > 0);
    assert.equal(snap.calif_edad, 3);     // 2026-2005 = 21 → banda 3 (19..26)
    assert.equal(snap.calif_her, 2);
    assert.equal(snap.calif_pyt, 2);
    assert.ok(snap.dp_estimado > 0);
    assert.ok(snap.vida_remanente_pct > 0 && snap.vida_remanente_pct <= 100);
  });

  test('C2H2=7 dispara marker informativo sin reclasificar HI', () => {
    const snap = snapshotSaludCompleto({
      transformador: { fabricacion: { ano_fabricacion: 2020 } },
      muestraDGA: { gases: { H2: 10, CH4: 10, C2H4: 10, C2H6: 10, C2H2: 8 } },
      muestraADFQ: { rigidez_kv: 40, ti: 2000, nn: 1 },
      muestraFUR: { ppb: 500 },
      cargaActual: { cp: 50, ap: 100 },
      pyt: 1,
      her: 'sin_fugas',
      hoy: new Date('2026-04-19')
    });
    assert.ok(snap.overrides_aplicados.some((x) => x.includes('monitoreo intensivo')));
  });
});

// ── Bucket ─────────────────────────────────────────────────────
describe('bucketizarHI', () => {
  test('bucket por HI', () => {
    assert.equal(bucketizarHI(1.2),  'muy_bueno');
    assert.equal(bucketizarHI(2.0),  'bueno');
    assert.equal(bucketizarHI(3.0),  'medio');
    assert.equal(bucketizarHI(4.0),  'pobre');
    assert.equal(bucketizarHI(4.8),  'muy_pobre');
  });
});
