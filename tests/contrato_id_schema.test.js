// Tests del campo contrato_id en los schemas multi-contrato (N1 v2.4).
//
// Decisiones del refactor multi-contrato:
//   · contrato_id es OPCIONAL durante la migración (los docs viejos
//     no lo tienen y se rellenan vía script add-contrato-id en N2).
//   · Si está presente, debe matchear 8–14 dígitos (consecutivos del
//     cliente: 4123000081, 4125000143, etc.).
//   · El sanitizer SIEMPRE incluye el campo en la salida (string
//     vacío si no se provee), de modo que los Object.keys son estables.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizarSuministro, validarSuministro } from '../assets/js/domain/suministro_schema.js';
import { sanitizarMarca, validarMarca } from '../assets/js/domain/marca_schema.js';
import { sanitizarMovimiento, validarMovimiento } from '../assets/js/domain/movimiento_schema.js';
import { sanitizarCorreccion, validarCorreccion } from '../assets/js/domain/correccion_schema.js';
import { CONTRATO_ID_PATTERN } from '../assets/js/domain/schema.js';

describe('CONTRATO_ID_PATTERN', () => {
  test('acepta consecutivos del cliente entre 8 y 14 dígitos', () => {
    assert.ok(CONTRATO_ID_PATTERN.test('4123000081'));
    assert.ok(CONTRATO_ID_PATTERN.test('4125000143'));
    assert.ok(CONTRATO_ID_PATTERN.test('12345678'));
  });
  test('rechaza letras, espacios o longitudes fuera de rango', () => {
    assert.equal(CONTRATO_ID_PATTERN.test('ABC123'), false);
    assert.equal(CONTRATO_ID_PATTERN.test('1234'), false);
    assert.equal(CONTRATO_ID_PATTERN.test('1234 5678'), false);
    assert.equal(CONTRATO_ID_PATTERN.test('99999999999999999'), false);
  });
});

describe('sanitizarSuministro · contrato_id', () => {
  test('preserva el contrato_id cuando está presente', () => {
    const d = sanitizarSuministro({
      codigo: 'S01', nombre: 'Coraza', unidad: 'Und',
      contrato_id: '4125000143'
    });
    assert.equal(d.contrato_id, '4125000143');
  });
  test('default a string vacío cuando no se provee', () => {
    const d = sanitizarSuministro({ codigo: 'S01', nombre: 'X', unidad: 'Und' });
    assert.equal(d.contrato_id, '');
  });
});

describe('validarSuministro · contrato_id opcional', () => {
  test('contrato_id ausente → válido (caso legado)', () => {
    const errs = validarSuministro(sanitizarSuministro({
      codigo: 'S01', nombre: 'Coraza', unidad: 'Und'
    }));
    assert.deepEqual(errs, []);
  });
  test('contrato_id válido → válido', () => {
    const errs = validarSuministro(sanitizarSuministro({
      codigo: 'S01', nombre: 'Coraza', unidad: 'Und', contrato_id: '4125000143'
    }));
    assert.deepEqual(errs, []);
  });
  test('contrato_id inválido → flaggea', () => {
    const errs = validarSuministro(sanitizarSuministro({
      codigo: 'S01', nombre: 'Coraza', unidad: 'Und', contrato_id: 'BAD'
    }));
    assert.ok(errs.some((e) => e.includes('contrato_id')));
  });
});

describe('sanitizarMarca · contrato_id', () => {
  test('preserva el campo cuando se provee', () => {
    const d = sanitizarMarca({ suministro_id: 'S02', marca: 'ABB', contrato_id: '4123000081' });
    assert.equal(d.contrato_id, '4123000081');
  });
  test('default vacío', () => {
    const d = sanitizarMarca({ suministro_id: 'S02', marca: 'ABB' });
    assert.equal(d.contrato_id, '');
  });
});

describe('validarMarca · contrato_id', () => {
  test('contrato_id inválido → flaggea', () => {
    const errs = validarMarca(sanitizarMarca({
      suministro_id: 'S02', marca: 'ABB', contrato_id: '12'
    }));
    assert.ok(errs.some((e) => e.includes('contrato_id')));
  });
});

describe('sanitizarMovimiento · contrato_id', () => {
  test('preserva el campo en sanitizado', () => {
    const d = sanitizarMovimiento({
      contrato_id: '4125000143',
      anio: 2026, tipo: 'INGRESO', suministro_id: 'S01', cantidad: 1
    });
    assert.equal(d.contrato_id, '4125000143');
  });
});

describe('validarMovimiento · contrato_id', () => {
  test('válido con contrato_id correcto', () => {
    const sane = sanitizarMovimiento({
      codigo: 'MOV-2026-0001', anio: 2026, tipo: 'EGRESO',
      suministro_id: 'S02', cantidad: 4, valor_unitario: 100,
      transformador_id: 'abc', matricula: 'T1', zona: 'BOLIVAR',
      contrato_id: '4123000081'
    });
    assert.deepEqual(validarMovimiento(sane), []);
  });
  test('inválido con contrato_id mal formado', () => {
    const sane = sanitizarMovimiento({
      codigo: 'MOV-2026-0001', anio: 2026, tipo: 'EGRESO',
      suministro_id: 'S02', cantidad: 4, valor_unitario: 100,
      transformador_id: 'abc', matricula: 'T1', zona: 'BOLIVAR',
      contrato_id: 'XYZ'
    });
    assert.ok(validarMovimiento(sane).some((e) => e.includes('contrato_id')));
  });
});

describe('sanitizarCorreccion · contrato_id', () => {
  test('campo presente en sanitizado', () => {
    const d = sanitizarCorreccion({
      numero: 1, tipo: 'tension', ubicacion: 'X', justificacion: 'Y',
      contrato_id: '4123000081'
    });
    assert.equal(d.contrato_id, '4123000081');
  });
});
