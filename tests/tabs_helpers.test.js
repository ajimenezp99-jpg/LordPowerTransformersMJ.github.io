// Tests de los helpers puros del componente tabs (R0 · refactor v2.3).
// Sólo testeamos lógica de hash routing — el comportamiento DOM
// requiere browser y se valida manualmente con cada módulo migrado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseHash, buildHash, mergeHash } from '../assets/js/ui/tabs.js';

describe('parseHash', () => {
  test('parse simple #tab=catalogo', () => {
    assert.equal(parseHash('#tab=catalogo'), 'catalogo');
  });

  test('parse sin # inicial', () => {
    assert.equal(parseHash('tab=movimientos'), 'movimientos');
  });

  test('hash vacío → null', () => {
    assert.equal(parseHash(''), null);
    assert.equal(parseHash(null), null);
    assert.equal(parseHash(undefined), null);
  });

  test('key no presente → null', () => {
    assert.equal(parseHash('#otro=foo'), null);
  });

  test('key custom', () => {
    assert.equal(parseHash('#section=stock', 'section'), 'stock');
  });

  test('valor vacío → null', () => {
    assert.equal(parseHash('#tab='), null);
  });

  test('multi-param: extrae el correcto', () => {
    assert.equal(parseHash('#tab=catalogo&zoom=2'), 'catalogo');
    assert.equal(parseHash('#tab=catalogo&zoom=2', 'zoom'), '2');
  });
});

describe('buildHash', () => {
  test('construye #tab=value', () => {
    assert.equal(buildHash('tab', 'catalogo'), '#tab=catalogo');
  });

  test('value vacío o null → string vacío', () => {
    assert.equal(buildHash('tab', ''), '');
    assert.equal(buildHash('tab', null), '');
    assert.equal(buildHash('tab', undefined), '');
  });

  test('key vacío → string vacío', () => {
    assert.equal(buildHash('', 'foo'), '');
  });

  test('escapa valores con caracteres especiales', () => {
    assert.equal(buildHash('tab', 'a b'), '#tab=a+b');
    assert.equal(buildHash('tab', '#hash'), '#tab=%23hash');
  });

  test('coerciona a string', () => {
    assert.equal(buildHash('tab', 42), '#tab=42');
  });
});

describe('mergeHash', () => {
  test('agrega key a hash vacío', () => {
    assert.equal(mergeHash('', 'tab', 'catalogo'), '#tab=catalogo');
    assert.equal(mergeHash(null, 'tab', 'catalogo'), '#tab=catalogo');
  });

  test('preserva otros params', () => {
    const out = mergeHash('#zoom=2', 'tab', 'movimientos');
    // Orden de params no garantizado por URLSearchParams, así que
    // normalizamos.
    const params = new URLSearchParams(out.replace(/^#/, ''));
    assert.equal(params.get('zoom'), '2');
    assert.equal(params.get('tab'), 'movimientos');
  });

  test('reemplaza el valor existente', () => {
    const out = mergeHash('#tab=catalogo&zoom=2', 'tab', 'historico');
    const params = new URLSearchParams(out.replace(/^#/, ''));
    assert.equal(params.get('tab'), 'historico');
    assert.equal(params.get('zoom'), '2');
  });

  test('value=null elimina el key', () => {
    const out = mergeHash('#tab=catalogo&zoom=2', 'tab', null);
    assert.equal(out, '#zoom=2');
  });

  test('eliminar el último key devuelve string vacío', () => {
    assert.equal(mergeHash('#tab=catalogo', 'tab', null), '');
  });
});
