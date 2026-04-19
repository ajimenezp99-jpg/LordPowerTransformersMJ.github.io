// Tests de la migración v1 → v2 (F16).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  migrarDocV1aV2, esV1, esV2, ejecutarMigracion
} from '../scripts/migrate/v1-to-v2-transformadores.js';

// ── Fixtures ──
const docV1 = Object.freeze({
  id: 'abc123',
  codigo: 'TX-SANTA-ANA-01',
  nombre: 'TX Santa Ana 01',
  departamento: 'magdalena',
  municipio: 'Santa Ana',
  subestacion: 'SE-SANTA-ANA',
  potencia_kva: 5000,
  tension_primaria_kv: 34.5,
  tension_secundaria_kv: 13.2,
  marca: 'SIEMENS', modelo: 'TSU-5000', serial: 'SIE-1999-042',
  fecha_fabricacion: '1995-11-20',
  fecha_instalacion: '1996-03-15',
  estado: 'operativo',
  latitud: 9.32, longitud: -74.57,
  observaciones: 'Unidad rural del Banco.'
});

const docV2 = Object.freeze({
  id: 'xyz789',
  schema_version: 2,
  estado_servicio: 'mantenimiento',
  estados_especiales: [],
  identificacion: { codigo: 'TX-V2', nombre: 'Dos', tipo_activo: 'TPT' },
  ubicacion: { departamento: 'bolivar', zona: 'BOLIVAR' }
});

describe('Detectores esV1 / esV2', () => {
  test('doc v1 clásico es v1 y no v2', () => {
    assert.equal(esV1(docV1), true);
    assert.equal(esV2(docV1), false);
  });

  test('doc v2 estructurado es v2 y no v1', () => {
    assert.equal(esV2(docV2), true);
    assert.equal(esV1(docV2), false);
  });

  test('null/undefined no son ni v1 ni v2', () => {
    assert.equal(esV1(null), false);
    assert.equal(esV2(null), false);
    assert.equal(esV1(undefined), false);
    assert.equal(esV2(undefined), false);
  });
});

describe('migrarDocV1aV2 — transformación pura', () => {
  test('produce shape v2 con sección identificacion y ubicacion', () => {
    const v2 = migrarDocV1aV2(docV1);
    assert.equal(v2.schema_version, 2);
    assert.equal(v2.identificacion.codigo, 'TX-SANTA-ANA-01');
    assert.equal(v2.identificacion.nombre, 'TX Santa Ana 01');
    assert.equal(v2.identificacion.tipo_activo, 'POTENCIA');
    assert.equal(v2.ubicacion.departamento, 'magdalena');
    assert.equal(v2.ubicacion.zona, 'ORIENTE'); // inferida desde magdalena
    assert.equal(v2.ubicacion.subestacion_nombre, 'SE-SANTA-ANA');
    assert.equal(v2.estado_servicio, 'operativo');
  });

  test('infere ano_fabricacion desde fecha_fabricacion ISO', () => {
    const v2 = migrarDocV1aV2(docV1);
    assert.equal(v2.fabricacion.ano_fabricacion, 1995);
  });

  test('agrega marca _migracion_v2 en salud_actual.overrides_aplicados', () => {
    const v2 = migrarDocV1aV2(docV1);
    assert.ok(v2.salud_actual.overrides_aplicados.includes('_migracion_v2'));
  });

  test('preserva proyección v1 aplanada al nivel raíz', () => {
    const v2 = migrarDocV1aV2(docV1);
    assert.equal(v2.codigo, 'TX-SANTA-ANA-01');
    assert.equal(v2.estado, 'operativo');
    assert.equal(v2.marca, 'SIEMENS');
    assert.equal(v2.potencia_kva, 5000);
  });

  test('es idempotente sobre un doc ya v2', () => {
    const v2a = migrarDocV1aV2(docV2);
    const v2b = migrarDocV1aV2(v2a);
    assert.equal(v2a.schema_version, 2);
    assert.equal(v2b.schema_version, 2);
    assert.equal(v2b.identificacion.codigo, 'TX-V2');
  });

  test('mapea los 5 departamentos a la zona correcta', () => {
    const cases = [
      ['bolivar',   'BOLIVAR'],
      ['cordoba',   'OCCIDENTE'],
      ['sucre',     'OCCIDENTE'],
      ['cesar',     'ORIENTE'],
      ['magdalena', 'ORIENTE']
    ];
    for (const [depto, zonaEsperada] of cases) {
      const v2 = migrarDocV1aV2({ ...docV1, departamento: depto });
      assert.equal(v2.ubicacion.zona, zonaEsperada, `depto=${depto}`);
    }
  });
});

describe('ejecutarMigracion — runner defensivo', () => {
  test('colección vacía → retorna reporte con 0 y sin errores', async () => {
    const r = await ejecutarMigracion({
      list: async () => [],
      write: async () => { throw new Error('no debería escribir'); },
      dryRun: true
    });
    assert.equal(r.escaneados, 0);
    assert.equal(r.migrados, 0);
    assert.equal(r.errores.length, 0);
  });

  test('dryRun NO llama a write', async () => {
    let writes = 0;
    const r = await ejecutarMigracion({
      list:  async () => [docV1, { ...docV1, id: 'b', codigo: 'TX-B' }],
      write: async () => { writes += 1; },
      dryRun: true
    });
    assert.equal(writes, 0);
    assert.equal(r.escaneados, 2);
    assert.equal(r.migrados, 2);
    assert.equal(r.dryRun, true);
  });

  test('dryRun=false escribe todos los v1 y salta los v2', async () => {
    const escritos = [];
    const r = await ejecutarMigracion({
      list:  async () => [docV1, docV2],
      write: async (id, payload) => { escritos.push({ id, payload }); },
      dryRun: false
    });
    assert.equal(r.escaneados, 2);
    assert.equal(r.migrados, 1);
    assert.equal(r.yaV2, 1);
    assert.equal(escritos.length, 1);
    assert.equal(escritos[0].id, 'abc123');
    assert.equal(escritos[0].payload.schema_version, 2);
  });

  test('respeta `limite`', async () => {
    const docs = Array.from({ length: 10 }, (_, i) => ({
      ...docV1, id: `x${i}`, codigo: `TX-${i}`
    }));
    const r = await ejecutarMigracion({
      list: async () => docs,
      write: async () => {},
      dryRun: false,
      limite: 3
    });
    assert.equal(r.migrados, 3);
  });

  test('un error en un doc no aborta los demás', async () => {
    const docs = [
      docV1,
      { id: 'bad', codigo: '', nombre: '' }, // inválido: falta codigo
      { ...docV1, id: 'c', codigo: 'TX-C' }
    ];
    const r = await ejecutarMigracion({
      list:  async () => docs,
      write: async () => {},
      dryRun: true
    });
    assert.equal(r.escaneados, 3);
    assert.equal(r.migrados, 2);
    assert.equal(r.errores.length, 1);
  });

  test('exige adaptador write cuando dryRun=false', async () => {
    await assert.rejects(
      () => ejecutarMigracion({ list: async () => [docV1], dryRun: false }),
      /adaptador `write` requerido/
    );
  });
});
