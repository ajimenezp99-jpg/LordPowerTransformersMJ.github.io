// Tests del sanitizador/validador de movimientos + generarCodigoMov (F38).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarMovimiento, validarMovimiento
} from '../assets/js/domain/movimiento_schema.js';
import { generarCodigoMov } from '../assets/js/domain/schema.js';

describe('generarCodigoMov', () => {
  test('correlativo se padea a 4 dígitos', () => {
    assert.equal(generarCodigoMov(2026, 1), 'MOV-2026-0001');
    assert.equal(generarCodigoMov(2026, 42), 'MOV-2026-0042');
    assert.equal(generarCodigoMov(2026, 9999), 'MOV-2026-9999');
  });

  test('año fuera de rango lanza', () => {
    assert.throws(() => generarCodigoMov(1999, 1), /año inválido/);
    assert.throws(() => generarCodigoMov(2200, 1), /año inválido/);
  });

  test('secuencial fuera de rango lanza', () => {
    assert.throws(() => generarCodigoMov(2026, 0), /secuencial inválido/);
    assert.throws(() => generarCodigoMov(2026, 10000), /secuencial inválido/);
  });
});

describe('sanitizarMovimiento', () => {
  test('valor_total se deriva si no se provee', () => {
    const d = sanitizarMovimiento({
      codigo: 'MOV-2026-0001', anio: 2026, tipo: 'EGRESO',
      suministro_id: 'S02', cantidad: 4, valor_unitario: 5233200,
      transformador_id: 'abc', matricula: 'T1A-A/M-BYC',
      zona: 'BOLIVAR', departamento: 'bolivar'
    });
    assert.equal(d.valor_total, 4 * 5233200);
  });

  test('valor_total provisto se respeta (snapshot)', () => {
    const d = sanitizarMovimiento({
      codigo: 'MOV-2026-0001', anio: 2026, tipo: 'INGRESO',
      suministro_id: 'S02', cantidad: 4, valor_unitario: 100, valor_total: 999,
      transformador_id: 'abc', matricula: 'X', zona: 'BOLIVAR'
    });
    assert.equal(d.valor_total, 999);
  });

  test('tipo lowercase se eleva a uppercase', () => {
    const d = sanitizarMovimiento({ tipo: 'ingreso' });
    assert.equal(d.tipo, 'INGRESO');
  });

  test('tipo inválido se descarta', () => {
    const d = sanitizarMovimiento({ tipo: 'TRANSFERENCIA' });
    assert.equal(d.tipo, '');
  });

  test('cantidad fraccional se descarta', () => {
    const d = sanitizarMovimiento({ cantidad: 2.5 });
    assert.equal(d.cantidad, null);
  });
});

describe('validarMovimiento', () => {
  test('documento completo válido pasa sin errores', () => {
    const errs = validarMovimiento(sanitizarMovimiento({
      codigo: 'MOV-2026-0001', anio: 2026, tipo: 'EGRESO',
      suministro_id: 'S02', cantidad: 4, valor_unitario: 100,
      transformador_id: 'abc123', matricula: 'T1A-A/M-BYC',
      zona: 'BOLIVAR'
    }));
    assert.deepEqual(errs, []);
  });

  test('cantidad cero flaggea', () => {
    const errs = validarMovimiento(sanitizarMovimiento({
      codigo: 'MOV-2026-0001', anio: 2026, tipo: 'INGRESO',
      suministro_id: 'S01', cantidad: 0, transformador_id: 'x', matricula: 'm'
    }));
    assert.ok(errs.some((e) => e.includes('cantidad')));
  });

  test('codigo con patrón inválido flaggea', () => {
    const errs = validarMovimiento(sanitizarMovimiento({
      codigo: 'MOV-26-1', anio: 2026, tipo: 'INGRESO',
      suministro_id: 'S01', cantidad: 1, transformador_id: 'x', matricula: 'm'
    }));
    assert.ok(errs.some((e) => e.includes('codigo inválido')));
  });
});
