// Tests del sanitizador / validador de transformador v2 (F16).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarTransformador,
  validarTransformador,
  proyeccionV1
} from '../assets/js/domain/transformador_schema.js';

describe('sanitizarTransformador — shape canónico', () => {
  test('entrada vacía produce documento válido con defaults', () => {
    const d = sanitizarTransformador({});
    assert.equal(d.schema_version, 2);
    assert.equal(d.estado_servicio, 'operativo');
    assert.deepEqual(d.estados_especiales, []);
    assert.equal(typeof d.identificacion, 'object');
    assert.equal(d.identificacion.tipo_activo, 'POTENCIA');
    assert.equal(d.restricciones_operativas, null);
  });

  test('mapea shape plano v1 a secciones v2', () => {
    const d = sanitizarTransformador({
      codigo: 'tx-001', nombre: 'TX Cartagena 1',
      departamento: 'bolivar', municipio: 'Cartagena',
      subestacion: 'SE-CARTAGENA-1',
      potencia_kva: 50000, tension_primaria_kv: 110,
      tension_secundaria_kv: 13.8, marca: 'ABB',
      modelo: 'XF-110', serial: 'ABB-2020-001',
      fecha_fabricacion: '2020-05-15', fecha_instalacion: '2020-08-01',
      estado: 'operativo', latitud: 10.39, longitud: -75.51,
      observaciones: 'Unidad principal norte.'
    });
    assert.equal(d.identificacion.codigo, 'TX-001'); // uppercased
    assert.equal(d.identificacion.nombre, 'TX Cartagena 1');
    assert.equal(d.ubicacion.departamento, 'bolivar');
    assert.equal(d.ubicacion.subestacion_nombre, 'SE-CARTAGENA-1');
    assert.equal(d.placa.potencia_kva, 50000);
    assert.equal(d.electrico.tension_primaria_kv, 110);
    assert.equal(d.servicio.fecha_instalacion, '2020-08-01');
    assert.equal(d.ubicacion.latitud, 10.39);
  });

  test('mapea shape v2 estructurado sin tocar secciones válidas', () => {
    const entrada = {
      identificacion: {
        codigo: 'TX-002', nombre: 'TX Monteria',
        tipo_activo: 'TPT', uucc: 'N5T10', grupo: 'G2'
      },
      ubicacion: { departamento: 'cordoba', zona: 'OCCIDENTE' },
      estado_servicio: 'mantenimiento'
    };
    const d = sanitizarTransformador(entrada);
    assert.equal(d.identificacion.tipo_activo, 'TPT');
    assert.equal(d.identificacion.uucc, 'N5T10');
    assert.equal(d.identificacion.grupo, 'G2');
    assert.equal(d.ubicacion.zona, 'OCCIDENTE');
    assert.equal(d.estado_servicio, 'mantenimiento');
  });

  test('rechaza UUCC inválida dejando string vacío', () => {
    const d = sanitizarTransformador({
      identificacion: { codigo: 'TX', nombre: 'x', uucc: 'INVENTADA' }
    });
    assert.equal(d.identificacion.uucc, '');
  });

  test('tipo_activo inválido cae al default POTENCIA', () => {
    const d = sanitizarTransformador({
      identificacion: { codigo: 'X', nombre: 'x', tipo_activo: 'NUCLEAR' }
    });
    assert.equal(d.identificacion.tipo_activo, 'POTENCIA');
  });

  test('estado_servicio desconocido cae a default y "fallado" se acepta', () => {
    const a = sanitizarTransformador({ estado_servicio: 'fiesta' });
    assert.equal(a.estado_servicio, 'operativo');
    const b = sanitizarTransformador({ estado_servicio: 'fallado' });
    assert.equal(b.estado_servicio, 'fallado');
  });

  test('estados_especiales filtra valores no catalogados', () => {
    const d = sanitizarTransformador({
      estados_especiales: ['monitoreo_intensivo_c2h2', 'troll', 'pendiente_reemplazo']
    });
    assert.deepEqual(d.estados_especiales, [
      'monitoreo_intensivo_c2h2', 'pendiente_reemplazo'
    ]);
  });

  test('salud_actual.calif_* ∈ [1,5] y se redondea', () => {
    const d = sanitizarTransformador({
      salud_actual: {
        calif_tdgc: 7,       // fuera de rango → null
        calif_c2h2: 4.49,    // redondea a 4
        calif_rd: '3',
        eval_dga: 5.8,       // clamp a 5
        hi_final: -1,        // clamp a 1
        bucket: 'muy_bueno'
      }
    });
    assert.equal(d.salud_actual.calif_tdgc, null);
    assert.equal(d.salud_actual.calif_c2h2, 4);
    assert.equal(d.salud_actual.calif_rd, 3);
    assert.equal(d.salud_actual.eval_dga, 5.0);
    assert.equal(d.salud_actual.hi_final, 1.0);
    assert.equal(d.salud_actual.bucket, 'muy_bueno');
  });

  test('ubicacion_fuga_dominante acepta valores del catálogo', () => {
    const ok = sanitizarTransformador({
      salud_actual: { ubicacion_fuga_dominante: 'superiores' }
    });
    assert.equal(ok.salud_actual.ubicacion_fuga_dominante, 'superiores');
    const bad = sanitizarTransformador({
      salud_actual: { ubicacion_fuga_dominante: 'base' }
    });
    assert.equal(bad.salud_actual.ubicacion_fuga_dominante, '');
  });

  test('zona inválida se descarta', () => {
    const d = sanitizarTransformador({
      ubicacion: { departamento: 'bolivar', zona: 'MARTE' }
    });
    assert.equal(d.ubicacion.zona, '');
  });
});

describe('validarTransformador — errores duros', () => {
  test('doc vacío devuelve error', () => {
    const errs = validarTransformador(null);
    assert.ok(errs.length > 0);
  });

  test('falta codigo/nombre produce errores', () => {
    const errs = validarTransformador(sanitizarTransformador({}));
    assert.ok(errs.some((e) => e.includes('codigo')));
    assert.ok(errs.some((e) => e.includes('nombre')));
  });

  test('doc completo mínimo valida OK', () => {
    const d = sanitizarTransformador({
      identificacion: { codigo: 'TX-1', nombre: 'Uno', tipo_activo: 'POTENCIA' },
      ubicacion:      { departamento: 'cesar', zona: 'ORIENTE' },
      estado_servicio: 'operativo'
    });
    const errs = validarTransformador(d);
    assert.deepEqual(errs, []);
  });

  test('latitud/longitud fuera de rango se flaggea', () => {
    const d = sanitizarTransformador({
      identificacion: { codigo: 'TX', nombre: 'x' },
      ubicacion: { departamento: 'bolivar', latitud: 91, longitud: 181 }
    });
    const errs = validarTransformador(d);
    assert.ok(errs.some((e) => e.includes('latitud')));
    assert.ok(errs.some((e) => e.includes('longitud')));
  });
});

describe('proyeccionV1 — retrocompat', () => {
  test('aplana secciones a campos v1 del nivel raíz', () => {
    const v2 = sanitizarTransformador({
      identificacion: { codigo: 'TX-5', nombre: 'Cinco', tipo_activo: 'POTENCIA' },
      ubicacion: { departamento: 'magdalena', subestacion_nombre: 'SE-SANTA-ANA',
                   latitud: 9.33, longitud: -74.56 },
      placa: { marca: 'SIEMENS', potencia_kva: 25000 },
      electrico: { tension_primaria_kv: 34.5 },
      fabricacion: { fecha_fabricacion: '2015-01-01' },
      servicio: { fecha_instalacion: '2015-04-10', observaciones: 'Test' },
      estado_servicio: 'operativo'
    });
    const v1 = proyeccionV1(v2);
    assert.equal(v1.codigo, 'TX-5');
    assert.equal(v1.nombre, 'Cinco');
    assert.equal(v1.departamento, 'magdalena');
    assert.equal(v1.subestacion, 'SE-SANTA-ANA');
    assert.equal(v1.marca, 'SIEMENS');
    assert.equal(v1.potencia_kva, 25000);
    assert.equal(v1.tension_primaria_kv, 34.5);
    assert.equal(v1.fecha_fabricacion, '2015-01-01');
    assert.equal(v1.fecha_instalacion, '2015-04-10');
    assert.equal(v1.estado, 'operativo');
    assert.equal(v1.latitud, 9.33);
  });

  test('estado="fallado" se proyecta como "retirado" para vistas v1', () => {
    const v2 = sanitizarTransformador({
      identificacion: { codigo: 'X', nombre: 'x' },
      ubicacion: { departamento: 'bolivar' },
      estado_servicio: 'fallado'
    });
    const v1 = proyeccionV1(v2);
    assert.equal(v1.estado, 'retirado');
  });
});
