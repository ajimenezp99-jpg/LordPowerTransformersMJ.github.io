// Tests del sanitizador/validador de suministros (F38).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarSuministro, validarSuministro
} from '../assets/js/domain/suministro_schema.js';

describe('sanitizarSuministro', () => {
  test('normaliza codigo a uppercase y stock_inicial a número', () => {
    const d = sanitizarSuministro({
      codigo: 's02', nombre: 'Motoventiladores', unidad: 'Und',
      stock_inicial: '55', valor_unitario: '5233200',
      marcas_disponibles: ['ZIEHL ABEGG']
    });
    assert.equal(d.codigo, 'S02');
    assert.equal(d.stock_inicial, 55);
    assert.equal(d.valor_unitario, 5233200);
    assert.deepEqual(d.marcas_disponibles, ['ZIEHL ABEGG']);
  });

  test('unidad inválida cae a default Und', () => {
    const d = sanitizarSuministro({ codigo: 'S01', nombre: 'X', unidad: 'XYZ' });
    assert.equal(d.unidad, 'Und');
  });

  test('stock_inicial=0 se preserva (decisión 3·A)', () => {
    const d = sanitizarSuministro({ codigo: 'S03', nombre: 'X', unidad: 'Und', stock_inicial: 0 });
    assert.equal(d.stock_inicial, 0);
  });

  test('valores negativos se clamean a 0', () => {
    const d = sanitizarSuministro({ codigo: 'S04', nombre: 'X', unidad: 'Und',
      stock_inicial: -5, valor_unitario: -1000 });
    assert.equal(d.stock_inicial, 0);
    assert.equal(d.valor_unitario, 0);
  });

  test('marcas_disponibles no-array → []', () => {
    const d = sanitizarSuministro({ codigo: 'S05', nombre: 'X', unidad: 'Und',
      marcas_disponibles: 'TRENCH' });
    assert.deepEqual(d.marcas_disponibles, []);
  });
});

describe('validarSuministro', () => {
  test('codigo con patrón inválido flaggea', () => {
    const errs = validarSuministro(sanitizarSuministro({
      codigo: 'XYZ99', nombre: 'X', unidad: 'Und'
    }));
    assert.ok(errs.some((e) => e.includes('codigo inválido')));
  });

  test('documento mínimo válido pasa', () => {
    const errs = validarSuministro(sanitizarSuministro({
      codigo: 'S01', nombre: 'Coraza', unidad: 'Und'
    }));
    assert.deepEqual(errs, []);
  });

  test('faltan obligatorios devuelve múltiples errores', () => {
    const errs = validarSuministro(sanitizarSuministro({}));
    assert.ok(errs.length >= 2);
  });
});
