// Tests DGA diagnóstico (F18).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  duvalTriangle1, rogersRatios, doernenburg,
  diagnosticoDGA, alertaArcoD2
} from '../assets/js/domain/dga_diagnostico.js';

describe('Duval Triangle 1', () => {
  test('PD: CH4 dominante', () => {
    const r = duvalTriangle1({ CH4: 99, C2H4: 1, C2H2: 0 });
    assert.equal(r.codigo, 'PD');
  });

  test('D2: arco alta energía (C2H2 alto)', () => {
    const r = duvalTriangle1({ CH4: 20, C2H4: 30, C2H2: 50 });
    assert.equal(r.codigo, 'D2');
  });

  test('T3: térmica alta (C2H4 alto, C2H2 bajo)', () => {
    const r = duvalTriangle1({ CH4: 10, C2H4: 89, C2H2: 1 });
    assert.equal(r.codigo, 'T3');
  });

  test('T1: térmica baja', () => {
    const r = duvalTriangle1({ CH4: 90, C2H4: 10, C2H2: 0 });
    assert.equal(r.codigo, 'T1');
  });

  test('NORMAL con gases todos 0', () => {
    const r = duvalTriangle1({ CH4: 0, C2H4: 0, C2H2: 0 });
    assert.equal(r.codigo, 'NORMAL');
  });

  test('datos incompletos → INDETERMINADO', () => {
    const r = duvalTriangle1({ CH4: 10 });
    assert.equal(r.codigo, 'INDETERMINADO');
  });
});

describe('Rogers Ratios (IEEE C57.104)', () => {
  test('ratios calculados', () => {
    const r = rogersRatios({ H2: 100, CH4: 50, C2H6: 10, C2H4: 20, C2H2: 5 });
    assert.ok(r.ratios.R1 != null);
    assert.ok(r.ratios.R2 != null);
    assert.ok(r.ratios.R5 != null);
  });

  test('datos incompletos → INDETERMINADO', () => {
    const r = rogersRatios({ H2: 10 });
    assert.equal(r.codigo, 'INDETERMINADO');
  });
});

describe('Doernenburg', () => {
  test('ratios calculados', () => {
    const r = doernenburg({ H2: 100, CH4: 200, C2H6: 30, C2H4: 60, C2H2: 10 });
    assert.ok(r.ratios.R1 != null);
    assert.ok(r.ratios.R2 != null);
  });

  test('datos incompletos → INDETERMINADO', () => {
    const r = doernenburg({ H2: 10 });
    assert.equal(r.codigo, 'INDETERMINADO');
  });
});

describe('diagnosticoDGA — wrapper', () => {
  test('devuelve los 3 métodos', () => {
    const r = diagnosticoDGA({ H2: 100, CH4: 50, C2H6: 10, C2H4: 20, C2H2: 5 });
    assert.ok(r.duval);
    assert.ok(r.rogers);
    assert.ok(r.doernenburg);
  });
});

describe('alertaArcoD2 — §A9.1 C2H2/C2H4 ≥ 3', () => {
  test('ratio ≥ 3 dispara alerta', () => {
    assert.equal(alertaArcoD2({ C2H2: 30, C2H4: 10 }), true);
  });
  test('ratio < 3 no dispara', () => {
    assert.equal(alertaArcoD2({ C2H2: 5, C2H4: 10 }), false);
  });
  test('C2H4 = 0 no dispara', () => {
    assert.equal(alertaArcoD2({ C2H2: 5, C2H4: 0 }), false);
  });
});
