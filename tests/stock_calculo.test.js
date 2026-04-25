// Tests del motor puro de stock (F39).
// Todo testeado sin Firebase: I/O del data layer es thin glue
// alrededor de estos helpers.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  computarStockDesdeMovimientos,
  siguienteSecuencial,
  generarSiguienteCodigo,
  validarStockMovimiento,
  DEFAULT_SUMINISTROS_CONFIG
} from '../assets/js/domain/stock_calculo.js';

describe('computarStockDesdeMovimientos', () => {
  test('sin movimientos → actual = inicial', () => {
    const r = computarStockDesdeMovimientos(50, []);
    assert.deepEqual(r, { inicial: 50, ingresado: 0, egresado: 0, actual: 50 });
  });

  test('agrega INGRESO y EGRESO correctamente', () => {
    const r = computarStockDesdeMovimientos(10, [
      { tipo: 'INGRESO', cantidad: 5 },
      { tipo: 'EGRESO',  cantidad: 3 },
      { tipo: 'INGRESO', cantidad: 2 }
    ]);
    assert.equal(r.ingresado, 7);
    assert.equal(r.egresado, 3);
    assert.equal(r.actual, 14);
  });

  test('inicial = 0 con ingresos genera stock real', () => {
    const r = computarStockDesdeMovimientos(0, [
      { tipo: 'INGRESO', cantidad: 12 }
    ]);
    assert.equal(r.actual, 12);
  });

  test('cantidad <= 0 o no numérica se ignora', () => {
    const r = computarStockDesdeMovimientos(10, [
      { tipo: 'INGRESO', cantidad: 0 },
      { tipo: 'EGRESO', cantidad: -5 },
      { tipo: 'INGRESO', cantidad: 'foo' }
    ]);
    assert.equal(r.actual, 10);
  });

  test('tipo desconocido se ignora (no rompe)', () => {
    const r = computarStockDesdeMovimientos(10, [
      { tipo: 'TRANSFERENCIA', cantidad: 5 }
    ]);
    assert.equal(r.actual, 10);
  });

  test('inicial NaN → defaultea a 0', () => {
    const r = computarStockDesdeMovimientos('foo', [{ tipo: 'INGRESO', cantidad: 5 }]);
    assert.equal(r.actual, 5);
  });
});

describe('siguienteSecuencial', () => {
  test('lista vacía → 1', () => {
    assert.equal(siguienteSecuencial([], 2026), 1);
  });

  test('encuentra el max y suma 1', () => {
    assert.equal(siguienteSecuencial([
      'MOV-2026-0001', 'MOV-2026-0042', 'MOV-2026-0007'
    ], 2026), 43);
  });

  test('ignora códigos de otros años', () => {
    assert.equal(siguienteSecuencial([
      'MOV-2025-9999', 'MOV-2026-0001'
    ], 2026), 2);
  });

  test('ignora códigos con formato inválido', () => {
    assert.equal(siguienteSecuencial([
      'MOV-26-1', 'foo', 'MOV-2026-0005', null, 42
    ], 2026), 6);
  });

  test('anio inválido lanza', () => {
    assert.throws(() => siguienteSecuencial([], 'foo'), /anio inválido/);
  });
});

describe('generarSiguienteCodigo', () => {
  test('combina helpers correctamente', () => {
    assert.equal(generarSiguienteCodigo(['MOV-2026-0010'], 2026), 'MOV-2026-0011');
  });
});

describe('validarStockMovimiento', () => {
  test('INGRESO siempre OK', () => {
    const r = validarStockMovimiento(0, 'INGRESO', 10);
    assert.equal(r.ok, true);
    assert.equal(r.resultado, 10);
  });

  test('EGRESO con stock suficiente OK', () => {
    const r = validarStockMovimiento(10, 'EGRESO', 5);
    assert.equal(r.ok, true);
    assert.equal(r.resultado, 5);
  });

  test('EGRESO insuficiente con permitirNegativo=false rechaza con faltante', () => {
    const r = validarStockMovimiento(5, 'EGRESO', 8);
    assert.equal(r.ok, false);
    assert.equal(r.faltante, 3);
    assert.equal(r.resultado, -3);
  });

  test('EGRESO insuficiente con permitirNegativo=true acepta', () => {
    const r = validarStockMovimiento(5, 'EGRESO', 8, true);
    assert.equal(r.ok, true);
    assert.equal(r.resultado, -3);
  });

  test('cantidad inválida rechaza sin faltante', () => {
    const r = validarStockMovimiento(10, 'EGRESO', 0);
    assert.equal(r.ok, false);
    assert.equal(r.faltante, null);
  });

  test('stock NaN rechaza', () => {
    const r = validarStockMovimiento('foo', 'INGRESO', 1);
    assert.equal(r.ok, false);
  });
});

describe('DEFAULT_SUMINISTROS_CONFIG', () => {
  test('valores y forma esperados', () => {
    assert.equal(DEFAULT_SUMINISTROS_CONFIG.permitirNegativo, false);
    assert.equal(DEFAULT_SUMINISTROS_CONFIG.umbral_critico_pct, 0.20);
    assert.equal(DEFAULT_SUMINISTROS_CONFIG.umbral_medio_pct, 0.50);
  });

  test('está congelado (no mutable)', () => {
    assert.throws(() => { DEFAULT_SUMINISTROS_CONFIG.permitirNegativo = true; });
  });
});
