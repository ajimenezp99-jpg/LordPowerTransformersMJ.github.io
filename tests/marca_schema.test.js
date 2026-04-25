// Tests del sanitizador/validador de marcas (F38).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarMarca, validarMarca
} from '../assets/js/domain/marca_schema.js';

describe('sanitizarMarca', () => {
  test('normaliza suministro_id y marca a uppercase', () => {
    const d = sanitizarMarca({
      suministro_id: 's02', suministro_nombre: 'Motoventiladores',
      marca: 'ziehl abegg'
    });
    assert.equal(d.suministro_id, 'S02');
    assert.equal(d.marca, 'ZIEHL ABEGG');
  });

  test('observaciones default ""', () => {
    const d = sanitizarMarca({ suministro_id: 'S01', marca: 'ABB' });
    assert.equal(d.observaciones, '');
  });
});

describe('validarMarca', () => {
  test('falta suministro_id flaggea', () => {
    const errs = validarMarca(sanitizarMarca({ marca: 'ABB' }));
    assert.ok(errs.some((e) => e.includes('suministro_id')));
  });

  test('suministro_id con patrón inválido flaggea', () => {
    const errs = validarMarca(sanitizarMarca({ suministro_id: 'XYZ', marca: 'ABB' }));
    assert.ok(errs.some((e) => e.includes('suministro_id inválido')));
  });

  test('falta marca flaggea', () => {
    const errs = validarMarca(sanitizarMarca({ suministro_id: 'S01' }));
    assert.ok(errs.some((e) => e.includes('marca')));
  });

  test('documento mínimo válido pasa', () => {
    const errs = validarMarca(sanitizarMarca({ suministro_id: 'S02', marca: 'ZIEHL ABEGG' }));
    assert.deepEqual(errs, []);
  });
});
