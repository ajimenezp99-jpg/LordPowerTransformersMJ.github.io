// Tests del baseline de umbrales + merge (F18).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASELINE_UMBRALES_SALUD, mergeConBaseline
} from '../assets/js/domain/umbrales_salud_baseline.js';

describe('BASELINE_UMBRALES_SALUD', () => {
  test('cita MO.00418 como referencia', () => {
    assert.ok(BASELINE_UMBRALES_SALUD.referencia.includes('MO.00418'));
  });

  test('tdgc umbrales oficiales', () => {
    assert.equal(BASELINE_UMBRALES_SALUD.dga.tdgc.c5_min, 401);
    assert.equal(BASELINE_UMBRALES_SALUD.dga.tdgc.c2_min, 95);
  });

  test('c2h2 umbrales oficiales (no los del Excel)', () => {
    assert.equal(BASELINE_UMBRALES_SALUD.dga.c2h2.c5_min, 7);
    assert.equal(BASELINE_UMBRALES_SALUD.dga.c2h2.c2_min, 3);
  });

  test('edad con vida útil regulatoria 30 años (CREG 085)', () => {
    assert.equal(BASELINE_UMBRALES_SALUD.edad.c5_min, 30);
    assert.equal(BASELINE_UMBRALES_SALUD.edad.vida_util_regulatoria_anos, 30);
  });

  test('criticidad max_usuarios_baseline = 48312', () => {
    assert.equal(BASELINE_UMBRALES_SALUD.criticidad.max_usuarios_baseline, 48312);
    assert.equal(BASELINE_UMBRALES_SALUD.criticidad.min_usuarios, 1);
  });
});

describe('mergeConBaseline', () => {
  test('null/undefined → baseline completo', () => {
    const r = mergeConBaseline(null);
    assert.equal(r, BASELINE_UMBRALES_SALUD);
  });

  test('override parcial preserva el resto', () => {
    const custom = { dga: { c2h2: { c5_min: 10 } } };
    const r = mergeConBaseline(custom);
    assert.equal(r.dga.c2h2.c5_min, 10);       // override
    assert.equal(r.dga.c2h2.c4_min, 6);        // baseline conservado
    assert.equal(r.dga.tdgc.c5_min, 401);      // baseline conservado
    assert.equal(r.edad.c5_min, 30);           // baseline conservado
  });

  test('override inyecta campos nuevos', () => {
    const r = mergeConBaseline({ extra: { campo: 'X' } });
    assert.equal(r.extra.campo, 'X');
    assert.equal(r.edad.c5_min, 30);
  });
});
