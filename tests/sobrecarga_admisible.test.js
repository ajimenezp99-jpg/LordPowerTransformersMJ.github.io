// Tests sobrecarga admisible IEEE C57.91 (F18 · A9.5).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  tiempoAdmisible, aceleracionEnvejecimiento,
  proponerPlanMitigacionSobrecarga
} from '../assets/js/domain/sobrecarga_admisible.js';

describe('aceleracionEnvejecimiento (FAA)', () => {
  test('FAA = 1 en el hotspot de referencia 110 °C', () => {
    const faa = aceleracionEnvejecimiento(110);
    assert.ok(Math.abs(faa - 1) < 0.01, `faa=${faa}`);
  });

  test('FAA > 1 sobre 110 °C (envejece más rápido)', () => {
    const faa = aceleracionEnvejecimiento(130);
    assert.ok(faa > 2, `faa=${faa}`);
  });

  test('FAA < 1 bajo 110 °C (envejece más lento)', () => {
    const faa = aceleracionEnvejecimiento(90);
    assert.ok(faa < 0.5, `faa=${faa}`);
  });
});

describe('tiempoAdmisible IEEE C57.91', () => {
  test('factor 1.15 + carga 75 → valor de tabla', () => {
    const r = tiempoAdmisible(1.15, 75, 30);
    assert.equal(r.minutos, 360);
    assert.equal(r.factor_usado, 1.15);
    assert.equal(r.carga_usada_pct, 75);
  });

  test('factor 1.30 reduce tiempo vs 1.10', () => {
    const r1 = tiempoAdmisible(1.10, 75, 30);
    const r3 = tiempoAdmisible(1.30, 75, 30);
    assert.ok(r3.minutos < r1.minutos);
  });

  test('factor ≤ 1 → sin sobrecarga', () => {
    const r = tiempoAdmisible(1.0, 50, 30);
    assert.equal(r.minutos, Infinity);
    assert.ok(r.advertencia.includes('no hay sobrecarga'));
  });

  test('temperatura ambiente alta reduce tiempo admisible', () => {
    const r30 = tiempoAdmisible(1.20, 75, 30);
    const r45 = tiempoAdmisible(1.20, 75, 45);
    assert.ok(r45.minutos < r30.minutos);
  });

  test('hotspot estimado > 110 cuando carga pico > 100%', () => {
    const r = tiempoAdmisible(1.30, 90, 30); // carga pico 117 %
    assert.ok(r.hotspot_estimado_c > 110);
  });
});

describe('proponerPlanMitigacionSobrecarga', () => {
  test('duración dentro del límite → ACEPTABLE', () => {
    const r = proponerPlanMitigacionSobrecarga(
      { id: 'TX-1' }, 1.10, 60
    );
    assert.ok(r.recomendacion.includes('ACEPTABLE'));
  });

  test('duración excede → RIESGO + redistribución', () => {
    const r = proponerPlanMitigacionSobrecarga(
      { id: 'TX-2' }, 1.50, 240
    );
    assert.ok(r.recomendacion.includes('RIESGO'));
    assert.ok(r.referencia.includes('IEEE C57.91'));
  });
});
