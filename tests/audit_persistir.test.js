// Tests del helper `persistirAuditoria` en domain/audit.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { auditar, persistirAuditoria, diffSimple } from '../assets/js/domain/audit.js';

describe('persistirAuditoria — helper best-effort', () => {
  test('escribe en la colección auditoria con timestamp del server', async () => {
    const escritos = [];
    const deps = {
      db: { _db: true },
      addDoc: async (colRef, payload) => { escritos.push({ colRef, payload }); return { id: 'test1' }; },
      collection: (db, name) => ({ db, name }),
      serverTimestamp: () => '__ts__'
    };
    const entry = auditar({
      accion: 'crear', coleccion: 'ordenes', docId: 'X1',
      uid: 'u1', nota: 'alta'
    });
    await persistirAuditoria(deps, entry);
    assert.equal(escritos.length, 1);
    assert.equal(escritos[0].colRef.name, 'auditoria');
    assert.equal(escritos[0].payload.accion, 'crear');
    assert.equal(escritos[0].payload.at, '__ts__');
  });

  test('no lanza si el adaptador addDoc falla', async () => {
    const deps = {
      db: {},
      addDoc: async () => { throw new Error('network'); },
      collection: () => ({}),
      serverTimestamp: () => '__ts__'
    };
    // No debe lanzar
    await persistirAuditoria(deps, auditar({ accion: 'crear' }));
  });

  test('noop si faltan deps (evita crash cuando Firebase no está inicializado)', async () => {
    // No debe lanzar
    await persistirAuditoria(null, auditar({ accion: 'crear' }));
    await persistirAuditoria({}, auditar({ accion: 'crear' }));
    await persistirAuditoria({ db: null }, auditar({ accion: 'crear' }));
  });

  test('compone entry con at_iso del helper auditar', async () => {
    const escritos = [];
    const deps = {
      db: {},
      addDoc: async (_, payload) => { escritos.push(payload); },
      collection: () => ({}),
      serverTimestamp: () => 'SERVER_TS'
    };
    await persistirAuditoria(deps, auditar({
      accion: 'actualizar', coleccion: 'transformadores', docId: 'TX-1',
      diff: { estado: { antes: 'operativo', despues: 'mantenimiento' } }
    }));
    assert.ok(escritos[0].at_iso); // del auditar()
    assert.equal(escritos[0].at, 'SERVER_TS');
    assert.equal(escritos[0].diff.estado.despues, 'mantenimiento');
  });
});

describe('diffSimple — cobertura extra', () => {
  test('campos null/undefined tratados como ausentes', () => {
    const d = diffSimple({ a: null, b: undefined }, { a: 'x' });
    assert.ok(d.a);
    assert.equal(d.a.antes, null);
    assert.equal(d.a.despues, 'x');
  });

  test('valores idénticos → diff vacío', () => {
    const d = diffSimple({ a: 1, b: 'x' }, { a: 1, b: 'x' });
    assert.deepEqual(d, {});
  });

  test('arrays comparados por estructura', () => {
    const d = diffSimple({ zonas: ['A', 'B'] }, { zonas: ['A', 'B', 'C'] });
    assert.ok(d.zonas);
  });
});
