// Tests del helper composeDocId · multi-contrato (N3 v2.4).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { composeDocId, parseDocId } from '../assets/js/domain/contratos.js';

describe('composeDocId', () => {
  test('contrato_id + codigo → docId compuesto', () => {
    assert.equal(composeDocId('4123000081', 'S01'), '4123000081_S01');
    assert.equal(composeDocId('4125000143', 'S22'), '4125000143_S22');
  });

  test('codigo lowercase → uppercase en el docId', () => {
    assert.equal(composeDocId('4123000081', 's01'), '4123000081_S01');
  });

  test('contrato_id vacío → docId solo codigo (compat legacy)', () => {
    assert.equal(composeDocId('', 'S01'), 'S01');
    assert.equal(composeDocId(null, 'S01'), 'S01');
    assert.equal(composeDocId(undefined, 'S01'), 'S01');
  });

  test('codigo vacío lanza', () => {
    assert.throws(() => composeDocId('4123000081', ''), /codigo es obligatorio/);
    assert.throws(() => composeDocId('4123000081', null), /codigo es obligatorio/);
  });

  test('coerciona tipos no-string', () => {
    assert.equal(composeDocId(4125000143, 'S01'), '4125000143_S01');
  });
});

describe('parseDocId', () => {
  test('docId compuesto → contratoId + codigo', () => {
    assert.deepEqual(parseDocId('4123000081_S01'), { contratoId: '4123000081', codigo: 'S01' });
  });
  test('docId sin underscore → solo codigo (legacy)', () => {
    assert.deepEqual(parseDocId('S01'), { contratoId: '', codigo: 'S01' });
  });
  test('docId vacío → ambos vacíos', () => {
    assert.deepEqual(parseDocId(''), { contratoId: '', codigo: '' });
    assert.deepEqual(parseDocId(null), { contratoId: '', codigo: '' });
  });
  test('round trip: parse(compose(c,k)) → {c,k}', () => {
    const c = '4125000143', k = 'S22';
    const id = composeDocId(c, k);
    assert.deepEqual(parseDocId(id), { contratoId: c, codigo: k });
  });
});
