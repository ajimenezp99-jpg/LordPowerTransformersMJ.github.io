// Tests del sanitizador de subestaciones (F16).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarSubestacion, validarSubestacion
} from '../assets/js/domain/subestacion_schema.js';

describe('sanitizarSubestacion', () => {
  test('normaliza codigo y departamento', () => {
    const d = sanitizarSubestacion({
      codigo: 'se-monteria-1', nombre: 'SE Montería',
      departamento: 'Cordoba', zona: 'occidente',
      nivel_tension_kv: '110'
    });
    assert.equal(d.codigo, 'SE-MONTERIA-1');
    assert.equal(d.departamento, 'cordoba');
    assert.equal(d.zona, 'OCCIDENTE');
    assert.equal(d.nivel_tension_kv, 110);
    assert.equal(d.activa, true);
  });

  test('activa=false se respeta explícitamente', () => {
    const d = sanitizarSubestacion({
      codigo: 'X', nombre: 'y', departamento: 'bolivar', activa: false
    });
    assert.equal(d.activa, false);
  });

  test('zona inválida se descarta', () => {
    const d = sanitizarSubestacion({
      codigo: 'X', nombre: 'y', departamento: 'bolivar', zona: 'Z9'
    });
    assert.equal(d.zona, '');
  });
});

describe('validarSubestacion', () => {
  test('falta codigo o nombre devuelve errores', () => {
    const errs = validarSubestacion({ departamento: 'bolivar' });
    assert.ok(errs.some((e) => e.includes('codigo')));
    assert.ok(errs.some((e) => e.includes('nombre')));
  });

  test('departamento desconocido flaggea', () => {
    const errs = validarSubestacion({
      codigo: 'SE', nombre: 'x', departamento: 'amazonas'
    });
    assert.ok(errs.some((e) => e.includes('departamento')));
  });

  test('lat/lng fuera de rango flaggea', () => {
    const errs = validarSubestacion(sanitizarSubestacion({
      codigo: 'SE', nombre: 'x', departamento: 'bolivar',
      latitud: 120, longitud: -500
    }));
    assert.ok(errs.some((e) => e.includes('latitud')));
    assert.ok(errs.some((e) => e.includes('longitud')));
  });

  test('documento mínimo válido pasa sin errores', () => {
    const errs = validarSubestacion(sanitizarSubestacion({
      codigo: 'SE-01', nombre: 'SE 01', departamento: 'sucre'
    }));
    assert.deepEqual(errs, []);
  });
});
