import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularRangosCriticidad, nivelPorUsuarios, colorCelda,
  prioridadNumerica, evaluarTransformador, agregarConteos
} from '../assets/js/domain/matriz_riesgo.js';
import {
  estrategiaPorCondicion, generarPropuestaOrden,
  detectarCausantePrincipal, periodicidadSugerida
} from '../assets/js/domain/estrategias.js';

describe('Matriz Criticidad — F36', () => {
  test('rangos con max=48312 min=1 producen pasos de ~9662', () => {
    const r = calcularRangosCriticidad(48312, 1);
    assert.equal(r.length, 5);
    assert.equal(r[0].nivel, 'minima');
    assert.equal(r[0].min, 1);
    assert.equal(r[4].nivel, 'maxima');
    assert.equal(r[4].max, 48312);
    // Verifica que primer rango cubre ~[1, 9662]
    assert.ok(Math.abs(r[0].max - 9662) <= 1);
  });

  test('nivelPorUsuarios clasifica correctamente', () => {
    const r = calcularRangosCriticidad(48312);
    assert.equal(nivelPorUsuarios(1, r), 'minima');
    assert.equal(nivelPorUsuarios(9662, r), 'minima');
    assert.equal(nivelPorUsuarios(10000, r), 'menor');
    assert.equal(nivelPorUsuarios(20000, r), 'moderada');
    assert.equal(nivelPorUsuarios(48312, r), 'maxima');
  });

  test('colorCelda respeta la matriz Tabla 11', () => {
    assert.equal(colorCelda(5, 'maxima'),  'ROJ');
    assert.equal(colorCelda(5, 'minima'),  'AMRL');
    assert.equal(colorCelda(1, 'minima'),  'VRD');
    assert.equal(colorCelda(1, 'maxima'),  'NAR');
    assert.equal(colorCelda(3, 'moderada'), 'AMRL');
    assert.equal(colorCelda(4, 'mayor'),   'ROJ');
  });

  test('prioridadNumerica ROJ=1 peor, VRD=4 OK', () => {
    assert.equal(prioridadNumerica('ROJ'), 1);
    assert.equal(prioridadNumerica('NAR'), 2);
    assert.equal(prioridadNumerica('AMRL'),3);
    assert.equal(prioridadNumerica('VRD'), 4);
  });

  test('evaluarTransformador integra hi+nivel', () => {
    const r = calcularRangosCriticidad(48312);
    const tx = {
      salud_actual: { hi_final: 4.2 },
      servicio: { usuarios_aguas_abajo: 35000 }
    };
    const e = evaluarTransformador(tx, r);
    assert.equal(e.nivel, 'mayor');
    assert.equal(e.color, 'ROJ');
    assert.equal(e.prioridad, 1);
  });

  test('agregarConteos agrega ids por celda', () => {
    const r = calcularRangosCriticidad(48312);
    const txs = [
      { id: 'A', salud_actual: { hi_final: 5 }, servicio: { usuarios_aguas_abajo: 45000 } },
      { id: 'B', salud_actual: { hi_final: 5 }, servicio: { usuarios_aguas_abajo: 45000 } },
      { id: 'C', salud_actual: { hi_final: 1 }, servicio: { usuarios_aguas_abajo: 5000 } }
    ];
    const out = agregarConteos(txs, r);
    assert.equal(out[5]['maxima'].count, 2);
    assert.equal(out[1]['minima'].count, 1);
    assert.deepEqual(out[5]['maxima'].ids.sort(), ['A', 'B']);
  });
});

describe('Estrategias — F37', () => {
  test('condicion 1 mapea a MACRO-PSM', () => {
    const e = estrategiaPorCondicion(1);
    assert.equal(e.macroactividad.codigo, 'MACRO-PSM');
    assert.equal(e.periodicidad_dias, 180);
    assert.ok(e.subactividades.length >= 5);
  });

  test('condicion 3 incluye mitigación', () => {
    const e = estrategiaPorCondicion(3);
    assert.equal(e.macroactividad.codigo, 'MACRO-CM');
    assert.ok(e.mitigacion);
    assert.equal(e.mitigacion.macroactividad.codigo, 'MACRO-MIT-C3');
  });

  test('condicion 5 → reemplazo', () => {
    const e = estrategiaPorCondicion(5);
    assert.equal(e.macroactividad.codigo, 'MACRO-REP');
  });

  test('periodicidadSugerida coherente con macro', () => {
    assert.equal(periodicidadSugerida(1), 180);
    assert.equal(periodicidadSugerida(2),  90);
    assert.equal(periodicidadSugerida(5), null);
  });

  test('generarPropuestaOrden con condicion=4 → tipo correctivo + prioridad alta', () => {
    const tx = { id: 'TX-X', identificacion: { codigo: 'TX-X' },
                 salud_actual: { hi_final: 4.1 } };
    const prop = generarPropuestaOrden(tx, { condicion_nueva: 4 });
    assert.equal(prop.tipo, 'correctivo');
    assert.equal(prop.prioridad, 'alta');
    assert.equal(prop.estado, 'borrador');
    assert.equal(prop.condicion_objetivo, 4);
    assert.equal(prop.macroactividad_codigo, 'MACRO-CMA');
  });

  test('generarPropuestaOrden con condicion=5 → tipo reemplazo', () => {
    const tx = { id: 'TX', identificacion: { codigo: 'TX' } };
    const prop = generarPropuestaOrden(tx, { condicion_nueva: 5 });
    assert.equal(prop.tipo, 'reemplazo');
    assert.equal(prop.prioridad, 'critica');
  });

  test('detectarCausantePrincipal devuelve FUR si es ≥4', () => {
    const cau = detectarCausantePrincipal({
      calif_fur: 5, eval_dga: 2, calif_edad: 3
    });
    assert.equal(cau, 'CAU-06');
  });

  test('detectarCausantePrincipal null si todo < 4', () => {
    const cau = detectarCausantePrincipal({
      calif_fur: 2, eval_dga: 2, calif_edad: 3
    });
    assert.equal(cau, null);
  });

  test('incluye causante detectado en la propuesta', () => {
    const tx = { id: 'T', identificacion: { codigo: 'T' } };
    const prop = generarPropuestaOrden(tx, {
      condicion_nueva: 4, causante_principal: 'CAU-05'
    });
    assert.deepEqual(prop.causantes, ['CAU-05']);
  });
});
