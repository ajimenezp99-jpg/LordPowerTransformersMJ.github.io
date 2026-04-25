// Tests del helper estadoStock (F38). 6 estados del semáforo del
// skill `asset-tracking-system`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { estadoStock, ESTADOS_STOCK } from '../assets/js/domain/schema.js';

describe('estadoStock — los 6 cutoffs', () => {
  test('SIN_STOCK cuando inicial = 0 (decisión 3·A)', () => {
    assert.equal(estadoStock(0, 0), 'SIN_STOCK');
    assert.equal(estadoStock(10, 0), 'SIN_STOCK'); // inicial 0 gana
  });

  test('NEGATIVO cuando disponible < 0', () => {
    assert.equal(estadoStock(-1, 10), 'NEGATIVO');
    assert.equal(estadoStock(-100, 50), 'NEGATIVO');
  });

  test('AGOTADO cuando disponible = 0 e inicial > 0', () => {
    assert.equal(estadoStock(0, 10), 'AGOTADO');
  });

  test('CRITICO cuando 0 < %rest < 20%', () => {
    assert.equal(estadoStock(1, 10), 'CRITICO');   // 10%
    assert.equal(estadoStock(19, 100), 'CRITICO'); // 19%
  });

  test('MEDIO cuando 20% <= %rest < 50%', () => {
    assert.equal(estadoStock(20, 100), 'MEDIO');
    assert.equal(estadoStock(49, 100), 'MEDIO');
  });

  test('OK cuando %rest >= 50%', () => {
    assert.equal(estadoStock(50, 100), 'OK');
    assert.equal(estadoStock(100, 100), 'OK');
  });

  test('umbrales custom respetados', () => {
    assert.equal(estadoStock(30, 100, { umbral_critico_pct: 0.40 }), 'CRITICO');
    assert.equal(estadoStock(30, 100, { umbral_medio_pct: 0.20 }), 'OK');
  });

  test('inputs no numéricos: NaN inicial → SIN_STOCK', () => {
    assert.equal(estadoStock(10, 'foo'), 'SIN_STOCK');
  });

  test('disponible no numérico con inicial>0 → AGOTADO', () => {
    assert.equal(estadoStock('bar', 10), 'AGOTADO');
  });

  test('catálogo ESTADOS_STOCK tiene 6 entradas con prefix emoji', () => {
    assert.equal(ESTADOS_STOCK.length, 6);
    for (const e of ESTADOS_STOCK) {
      assert.ok(e.value);
      assert.ok(e.label);
      assert.ok(e.prefix);
      assert.ok(e.color);
    }
  });
});
