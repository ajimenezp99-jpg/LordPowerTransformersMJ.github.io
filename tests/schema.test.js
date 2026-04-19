// Tests unitarios del schema v2 (Fase 16).
// Runner: node --test (nativo, sin dependencias).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  PESOS_HI, TIPOS_ACTIVO, ZONAS, GRUPOS, DEPARTAMENTOS,
  ESTADOS_SERVICIO, ESTADOS_ESPECIALES, CONDICIONES, BUCKETS_HI,
  NIVELES_CRITICIDAD, UBICACIONES_FUGA, ROLES, NORMATIVAS,
  UUCC_PATTERN, esUUCCValida, esUUCCRegulada, listarUUCCValidas,
  bucketDesdeHI, esRolValido, enValores,
  SCHEMA_VERSION, INSTITUCION
} from '../assets/js/domain/schema.js';

describe('PESOS_HI — MO.00418 Tabla 10 (fuente canónica)', () => {
  test('suma exactamente 1.0', () => {
    const suma = Object.values(PESOS_HI).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(suma - 1.0) < 1e-9, `suma = ${suma}`);
  });

  test('proporciones oficiales conforme Tabla 10', () => {
    assert.equal(PESOS_HI.DGA,  0.35);
    assert.equal(PESOS_HI.EDAD, 0.30);
    assert.equal(PESOS_HI.ADFQ, 0.15);
    assert.equal(PESOS_HI.FUR,  0.05);
    assert.equal(PESOS_HI.CRG,  0.05);
    assert.equal(PESOS_HI.PYT,  0.05);
    assert.equal(PESOS_HI.HER,  0.05);
  });

  test('PESOS_HI es inmutable', () => {
    assert.throws(() => { PESOS_HI.DGA = 0.99; });
  });
});

describe('Enums principales', () => {
  test('TIPOS_ACTIVO tiene exactamente POTENCIA, TPT, RESPALDO', () => {
    assert.equal(TIPOS_ACTIVO.length, 3);
    assert.ok(enValores(TIPOS_ACTIVO, 'POTENCIA'));
    assert.ok(enValores(TIPOS_ACTIVO, 'TPT'));
    assert.ok(enValores(TIPOS_ACTIVO, 'RESPALDO'));
    assert.ok(!enValores(TIPOS_ACTIVO, 'OTRO'));
  });

  test('ZONAS cubre BOLIVAR/ORIENTE/OCCIDENTE', () => {
    assert.equal(ZONAS.length, 3);
    ['BOLIVAR', 'ORIENTE', 'OCCIDENTE'].forEach((z) =>
      assert.ok(enValores(ZONAS, z), `falta zona ${z}`)
    );
  });

  test('GRUPOS tiene G1, G2, G3', () => {
    assert.equal(GRUPOS.length, 3);
    ['G1', 'G2', 'G3'].forEach((g) => assert.ok(enValores(GRUPOS, g)));
  });

  test('DEPARTAMENTOS asigna zona coherente', () => {
    const mapa = Object.fromEntries(DEPARTAMENTOS.map((d) => [d.value, d.zona]));
    assert.equal(mapa.bolivar,   'BOLIVAR');
    assert.equal(mapa.cordoba,   'OCCIDENTE');
    assert.equal(mapa.sucre,     'OCCIDENTE');
    assert.equal(mapa.cesar,     'ORIENTE');
    assert.equal(mapa.magdalena, 'ORIENTE');
  });

  test('ESTADOS_SERVICIO incluye "fallado" (v2)', () => {
    assert.ok(enValores(ESTADOS_SERVICIO, 'operativo'));
    assert.ok(enValores(ESTADOS_SERVICIO, 'mantenimiento'));
    assert.ok(enValores(ESTADOS_SERVICIO, 'fuera_servicio'));
    assert.ok(enValores(ESTADOS_SERVICIO, 'retirado'));
    assert.ok(enValores(ESTADOS_SERVICIO, 'fallado'));
  });

  test('ESTADOS_ESPECIALES lista los 6 esperados de A9', () => {
    const vs = ESTADOS_ESPECIALES.map((e) => e.value);
    assert.ok(vs.includes('monitoreo_intensivo_c2h2'));
    assert.ok(vs.includes('propuesta_fur_pendiente'));
    assert.ok(vs.includes('operacion_temporal_controlada'));
    assert.ok(vs.includes('pendiente_reemplazo'));
    assert.ok(vs.includes('reemplazado'));
    assert.ok(vs.includes('fin_vida_util_papel'));
  });

  test('CONDICIONES usa nombres oficiales (no "regular" ni "malo")', () => {
    const labels = CONDICIONES.map((c) => c.label.toLowerCase());
    assert.ok(labels.includes('muy bueno'));
    assert.ok(labels.includes('bueno'));
    assert.ok(labels.includes('medio'));
    assert.ok(labels.includes('pobre'));
    assert.ok(labels.includes('muy pobre'));
    // Términos descartados por MO.00418 §A9.7
    assert.ok(!labels.some((l) => l.includes('regular')));
    assert.ok(!labels.some((l) => l.includes('excelente')));
    assert.ok(!labels.some((l) => l.includes('malo')));
  });

  test('NIVELES_CRITICIDAD tiene 5 niveles (Mínima → Máxima) ordenados', () => {
    assert.equal(NIVELES_CRITICIDAD.length, 5);
    const ordenes = NIVELES_CRITICIDAD.map((n) => n.orden);
    assert.deepEqual(ordenes, [1, 2, 3, 4, 5]);
    assert.equal(NIVELES_CRITICIDAD[0].value, 'minima');
    assert.equal(NIVELES_CRITICIDAD[4].value, 'maxima');
  });
});

describe('UUCC — catálogo CREG 085/2018', () => {
  test('UUCC_PATTERN matches canonical values', () => {
    assert.ok(UUCC_PATTERN.test('N4T1'));
    assert.ok(UUCC_PATTERN.test('N4T19'));
    assert.ok(UUCC_PATTERN.test('N5T25'));
    assert.ok(UUCC_PATTERN.test('N3T5'));
    assert.ok(!UUCC_PATTERN.test('N2T1'));       // N2 no existe
    assert.ok(!UUCC_PATTERN.test('N4T999'));     // 3 dígitos fuera de rango
    assert.ok(!UUCC_PATTERN.test('hola'));
  });

  test('esUUCCValida reconoce N4T1–N4T19 y N5T1–N5T25', () => {
    assert.ok(esUUCCValida('N4T1'));
    assert.ok(esUUCCValida('N4T19'));
    assert.ok(!esUUCCValida('N4T20'));  // fuera del catálogo N4
    assert.ok(esUUCCValida('N5T25'));
    assert.ok(!esUUCCValida('N5T26'));
    assert.ok(esUUCCValida('N3T10'));    // N3 admitida con tope 25
    assert.ok(esUUCCValida('n4t1'));     // case-insensitive
  });

  test('esUUCCRegulada es true SOLO para N4T1–N4T19 y N5T1–N5T25', () => {
    assert.ok(esUUCCRegulada('N4T1'));
    assert.ok(esUUCCRegulada('N5T25'));
    // N3 NO está en la lista de CREG 085/2018 regulada.
    assert.ok(!esUUCCRegulada('N3T1'));
    assert.ok(!esUUCCRegulada('N3T25'));
    assert.ok(!esUUCCRegulada('N4T20'));
  });

  test('listarUUCCValidas devuelve lista ordenada sin duplicados', () => {
    const lista = listarUUCCValidas();
    const set = new Set(lista);
    assert.equal(set.size, lista.length);
    // N3T1…N3T25 (25) + N4T1…N4T19 (19) + N5T1…N5T25 (25) = 69
    assert.equal(lista.length, 69);
    assert.equal(lista[0], 'N3T1');
    assert.equal(lista[lista.length - 1], 'N5T25');
  });
});

describe('bucketDesdeHI', () => {
  test('bordes de bucket según MO.00418 §4.2', () => {
    assert.equal(bucketDesdeHI(1.0),  'muy_bueno');
    assert.equal(bucketDesdeHI(1.49), 'muy_bueno');
    assert.equal(bucketDesdeHI(1.5),  'bueno');
    assert.equal(bucketDesdeHI(2.49), 'bueno');
    assert.equal(bucketDesdeHI(2.5),  'medio');
    assert.equal(bucketDesdeHI(3.49), 'medio');
    assert.equal(bucketDesdeHI(3.5),  'pobre');
    assert.equal(bucketDesdeHI(4.49), 'pobre');
    assert.equal(bucketDesdeHI(4.5),  'muy_pobre');
    assert.equal(bucketDesdeHI(5.0),  'muy_pobre');
  });

  test('input inválido devuelve null', () => {
    assert.equal(bucketDesdeHI(null),      null);
    assert.equal(bucketDesdeHI(undefined), null);
    assert.equal(bucketDesdeHI('3.0'),     null);
    assert.equal(bucketDesdeHI(Number.NaN),null);
  });

  test('clampea valores fuera de [1, 5]', () => {
    assert.equal(bucketDesdeHI(-10), 'muy_bueno');
    assert.equal(bucketDesdeHI(99),  'muy_pobre');
  });
});

describe('Roles RBAC (F28)', () => {
  test('5 roles operativos + admin sistema', () => {
    const vs = ROLES.map((r) => r.value);
    assert.ok(vs.includes('admin'));
    assert.ok(vs.includes('director_proyectos'));
    assert.ok(vs.includes('analista_tx'));
    assert.ok(vs.includes('gestor_contractual'));
    assert.ok(vs.includes('brigadista'));
    assert.ok(vs.includes('auditor_campo'));
  });

  test('esRolValido acepta legacy "tecnico" (migración en curso)', () => {
    assert.ok(esRolValido('tecnico'));
    assert.ok(esRolValido('admin'));
    assert.ok(esRolValido('director_proyectos'));
    assert.ok(!esRolValido('superuser'));
    assert.ok(!esRolValido(''));
  });
});

describe('Identidad institucional', () => {
  test('cita el procedimiento y la casa matriz correctos', () => {
    assert.equal(INSTITUCION.operador_marca, 'Afinia');
    assert.equal(INSTITUCION.casa_matriz,    'Grupo EPM');
    assert.equal(INSTITUCION.procedimiento_codigo, 'MO.00418.DE-GAC-AX.01');
    assert.equal(INSTITUCION.procedimiento_edicion, 'Ed. 02');
  });
});

describe('Otros', () => {
  test('SCHEMA_VERSION es 2', () => {
    assert.equal(SCHEMA_VERSION, 2);
  });

  test('BUCKETS_HI y CONDICIONES usan la misma paleta de colores A9.7', () => {
    // Mapeo key→color debe coincidir.
    const byKey = Object.fromEntries(CONDICIONES.map((c) => [c.key, c.color]));
    for (const b of BUCKETS_HI) {
      assert.equal(b.color, byKey[b.key], `color mismatch en ${b.key}`);
    }
  });

  test('UBICACIONES_FUGA mapea calificación 1..5', () => {
    const califs = UBICACIONES_FUGA.map((u) => u.calif).sort();
    assert.deepEqual(califs, [1, 2, 3, 4, 5]);
  });

  test('NORMATIVAS incluye las referencias clave de A8', () => {
    const vs = NORMATIVAS.map((n) => n.value);
    ['IEEE_C57_91','IEEE_C57_104','IEC_60076_7','IEC_60599',
     'CIGRE_445','ISO_55001','ISO_50001','ASTM_D1816','ASTM_D5837_15',
     'NTC_3284','CREG_085_2018'].forEach((v) =>
      assert.ok(vs.includes(v), `falta ${v} en NORMATIVAS`)
    );
  });
});
