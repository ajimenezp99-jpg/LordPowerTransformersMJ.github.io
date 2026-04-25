// Tests del sanitizador/validador de correcciones (F38).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarCorreccion, validarCorreccion
} from '../assets/js/domain/correccion_schema.js';

describe('sanitizarCorreccion', () => {
  test('tipo se normaliza a lowercase', () => {
    const d = sanitizarCorreccion({
      numero: 1, tipo: 'MATRICULA', ubicacion: 'Equipos!B45',
      valor_original: 'XX', valor_corregido: 'YY',
      justificacion: 'reportado por brigada'
    });
    assert.equal(d.tipo, 'matricula');
  });

  test('tipo desconocido se descarta', () => {
    const d = sanitizarCorreccion({ tipo: 'serial' });
    assert.equal(d.tipo, '');
  });

  test('numero string se convierte a número', () => {
    const d = sanitizarCorreccion({ numero: '3', tipo: 'tension' });
    assert.equal(d.numero, 3);
  });
});

describe('validarCorreccion', () => {
  test('numero=0 o no entero flaggea', () => {
    const errs = validarCorreccion(sanitizarCorreccion({
      numero: 0, tipo: 'matricula', ubicacion: 'X', justificacion: 'Y'
    }));
    assert.ok(errs.some((e) => e.includes('numero')));
  });

  test('justificacion vacía flaggea (regla skill: traceability)', () => {
    const errs = validarCorreccion(sanitizarCorreccion({
      numero: 1, tipo: 'tension', ubicacion: 'X'
    }));
    assert.ok(errs.some((e) => e.includes('justificacion')));
  });

  test('documento mínimo válido pasa', () => {
    const errs = validarCorreccion(sanitizarCorreccion({
      numero: 1, tipo: 'regulacion',
      ubicacion: 'control_suministros-2.jsx#L120',
      justificacion: 'serial duplicado en JSX, autorizado por Miguel'
    }));
    assert.deepEqual(errs, []);
  });
});
