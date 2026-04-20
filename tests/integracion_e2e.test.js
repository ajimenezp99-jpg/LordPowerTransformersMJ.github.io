// Tests de integración end-to-end (puro): importador → motor → bucket
// → estrategia → propuesta de orden.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parsearFilaTransformador } from '../assets/js/domain/importador.js';
import {
  estrategiaPorCondicion, generarPropuestaOrden, detectarCausantePrincipal
} from '../assets/js/domain/estrategias.js';
import { evaluarTransformador, calcularRangosCriticidad }
  from '../assets/js/domain/matriz_riesgo.js';
import { scorePI } from '../assets/js/domain/plan_inversion.js';
import { puedeAbrirOrden } from '../assets/js/domain/workflow.js';
import { transicionValida } from '../assets/js/domain/orden_schema.js';

describe('E2E · Cadena importador → motor → bucket → estrategia', () => {
  test('TX con CRG=5 + DGA degradada → propuesta correctivo mayor + matriz roja', () => {
    // 1. Importar fila Excel
    const { docV2, diagnostico } = parsearFilaTransformador({
      codigo: 'TX-CRT-01', nombre: 'TX Crítico', departamento: 'cesar',
      h2: 100, ch4: 100, c2h4: 100, c2h6: 50, c2h2: 6, co: 200, co2: 2000,
      rd: 25, ti: 1100, nn: 1, ppb: 3000,
      cp: 95, ap: 100,
      ano_fabricacion: 2010
    }, 'TX_Potencia');

    // 2. Motor F18 ya corrió en parser → CRG=5 forzó override
    assert.equal(docV2.salud_actual.calif_crg, 5);
    assert.ok(docV2.salud_actual.hi_final >= 4,
      `HI debería ser ≥4 por override CRG=5: ${docV2.salud_actual.hi_final}`);
    assert.ok(diagnostico.bucket_recalculado === 'pobre' ||
              diagnostico.bucket_recalculado === 'muy_pobre',
      `bucket: ${diagnostico.bucket_recalculado}`);

    // 3. Matriz Criticidad × Salud
    const rangos = calcularRangosCriticidad(48312);
    const eval0 = evaluarTransformador({
      ...docV2,
      criticidad: { nivel: 'mayor', usuarios_aguas_abajo: 35000 }
    }, rangos);
    assert.ok(['ROJ', 'NAR'].includes(eval0.color),
      `Esperaba celda crítica/alta, got ${eval0.color}`);

    // 4. Estrategia automática para condición 4-5
    const condicion = Math.round(docV2.salud_actual.hi_final);
    const est = estrategiaPorCondicion(condicion);
    assert.ok(['MACRO-CMA', 'MACRO-REP'].includes(est.macroactividad.codigo),
      `Esperaba macro CMA o REP, got ${est.macroactividad.codigo}`);

    // 5. Causante detectado debe ser CRG=5 (CAU-02)
    const causante = detectarCausantePrincipal(docV2.salud_actual);
    assert.equal(causante, 'CAU-02');

    // 6. Propuesta de orden generada
    const prop = generarPropuestaOrden(docV2, {
      condicion_nueva: condicion,
      causante_principal: causante
    });
    assert.equal(prop.estado, 'borrador');
    assert.ok(['correctivo', 'reemplazo'].includes(prop.tipo));
    assert.ok(['alta', 'critica'].includes(prop.prioridad));
    assert.deepEqual(prop.causantes, ['CAU-02']);
    assert.ok(prop.macroactividad_codigo.startsWith('MACRO-'));

    // 7. Plan de Inversión
    const txConCriticidad = {
      ...docV2,
      criticidad: { nivel: 'mayor', color: eval0.color, usuarios_aguas_abajo: 35000 }
    };
    const piScore = scorePI(txConCriticidad);
    assert.ok(piScore.score > 0.5,
      `score PI debería ser alto para HI≥4 + criticidad mayor: ${piScore.score}`);

    // 8. Workflow: la propuesta puede transicionar borrador → propuesta
    assert.equal(transicionValida('borrador', 'propuesta'), true);

    // 9. Bloqueo §A9.2 NO aplica (no hay fin_vida_util_papel)
    const ok = puedeAbrirOrden(docV2, { tipo: prop.tipo });
    assert.ok(ok.ok);
  });

  test('TX con FUR=5 aprobado → bloqueo de órdenes no-reemplazo', () => {
    const { docV2 } = parsearFilaTransformador({
      codigo: 'TX-FUR', nombre: 'X', departamento: 'bolivar',
      ppb: 6000  // CalifFUR=5
    }, 'TX_Potencia');
    assert.equal(docV2.salud_actual.calif_fur, 5);

    // Simulamos que el experto aprobó el reemplazo (bandera fin_vida_util_papel)
    const txAprobado = {
      ...docV2,
      salud_actual: { ...docV2.salud_actual, fin_vida_util_papel: true }
    };

    // Solo reemplazo / retiro / OTC permitidos
    assert.ok(puedeAbrirOrden(txAprobado, { tipo: 'reemplazo' }).ok);
    assert.ok(puedeAbrirOrden(txAprobado, { tipo: 'retiro' }).ok);
    assert.ok(puedeAbrirOrden(txAprobado, { tipo: 'operacion_temporal_controlada' }).ok);

    const blkPrev = puedeAbrirOrden(txAprobado, { tipo: 'preventivo' });
    assert.equal(blkPrev.ok, false);
    assert.ok(blkPrev.razon.includes('fin_vida_util_papel'));

    // PI: candidato forzoso
    const pi = scorePI(txAprobado);
    assert.equal(pi.candidato_forzoso, true);
  });

  test('TX joven y sano → estrategia PSM + score PI bajo + matriz verde', () => {
    const { docV2 } = parsearFilaTransformador({
      codigo: 'TX-OK', nombre: 'Sano', departamento: 'magdalena',
      h2: 10, ch4: 10, c2h4: 10, c2h6: 10, c2h2: 1, co: 50, co2: 500,
      rd: 45, ti: 2000, nn: 1, ppb: 800,
      cp: 40, ap: 100, ano_fabricacion: 2022
    }, 'TX_Potencia');

    assert.ok(docV2.salud_actual.hi_final < 2,
      `HI debería ser bajo: ${docV2.salud_actual.hi_final}`);

    const condicion = Math.round(docV2.salud_actual.hi_final);
    const est = estrategiaPorCondicion(condicion);
    assert.equal(est.macroactividad.codigo, 'MACRO-PSM');
    assert.equal(est.periodicidad_dias, 180);

    // PI bajo
    const pi = scorePI({
      ...docV2,
      criticidad: { nivel: 'minima', color: 'VRD', usuarios_aguas_abajo: 1000 }
    });
    assert.ok(pi.score < 0.3, `score: ${pi.score}`);
    assert.equal(pi.candidato_forzoso, false);

    // Matriz verde
    const rangos = calcularRangosCriticidad(48312);
    const eval0 = evaluarTransformador({
      ...docV2,
      criticidad: { nivel: 'minima' }
    }, rangos);
    assert.equal(eval0.color, 'VRD');
    assert.equal(eval0.prioridad, 4);
  });
});
