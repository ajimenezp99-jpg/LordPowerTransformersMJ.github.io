// Tests monitoreo intensivo C2H2 y juicio experto FUR (F18 · A9.1/A9.2).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularVelocidadC2H2, evaluarOverrideC2H2,
  crearEstadoMonitoreoIntensivo, BATERIA_PRUEBAS_ETU, BASELINES_C2H2
} from '../assets/js/domain/monitoreo_intensivo.js';

import {
  crearPropuestaReclasificacionFUR, aplicarDecisionExperto,
  puedeAbrirOrden, ESTADOS_PROPUESTA_FUR
} from '../assets/js/domain/juicio_experto_fur.js';

describe('calcularVelocidadC2H2', () => {
  test('7 ppm en 14 días → 0.5 ppm/día', () => {
    const v = calcularVelocidadC2H2(
      { c2h2: 3, fecha: '2026-01-01' },
      { c2h2: 10, fecha: '2026-01-15' }
    );
    assert.equal(v, 0.5);
  });

  test('misma fecha → null (div cero)', () => {
    const v = calcularVelocidadC2H2(
      { c2h2: 3, fecha: '2026-01-01' },
      { c2h2: 10, fecha: '2026-01-01' }
    );
    assert.equal(v, null);
  });

  test('datos incompletos → null', () => {
    assert.equal(calcularVelocidadC2H2(null, {}), null);
  });
});

describe('evaluarOverrideC2H2 — §A9.1 R1/R2/R3', () => {
  test('R1: velocidad ≥ umbral dispara reclasificación', () => {
    const r = evaluarOverrideC2H2({ velocidad_ppm_dia: 0.8 });
    assert.equal(r.reclasificar, true);
    assert.ok(r.razones.some((x) => x.startsWith('R1')));
  });

  test('R2: C2H2 ≥ 15 ppm (default) dispara', () => {
    const r = evaluarOverrideC2H2({ c2h2_actual: 20 });
    assert.equal(r.reclasificar, true);
    assert.ok(r.razones.some((x) => x.startsWith('R2')));
  });

  test('R3: autorización manual dispara', () => {
    const r = evaluarOverrideC2H2({ autorizado_por_experto: true });
    assert.equal(r.reclasificar, true);
    assert.ok(r.razones.some((x) => x.startsWith('R3')));
  });

  test('ninguna razón → no reclasifica', () => {
    const r = evaluarOverrideC2H2({ velocidad_ppm_dia: 0.1, c2h2_actual: 5 });
    assert.equal(r.reclasificar, false);
    assert.deepEqual(r.razones, []);
  });

  test('umbrales editables sustituyen los defaults', () => {
    const r = evaluarOverrideC2H2({
      velocidad_ppm_dia: 0.3,
      umbrales: { velocidad_critica_ppm_dia: 0.2, umbral_transicion_critica: 15, frecuencia_muestreo_dias: 7 }
    });
    assert.equal(r.reclasificar, true);
  });
});

describe('crearEstadoMonitoreoIntensivo', () => {
  test('crea doc inicial con shape completo', () => {
    const e = crearEstadoMonitoreoIntensivo({
      transformadorId: 'TX-1',
      muestra_origen_id: 'M-99',
      c2h2_ppm: 8,
      profesional_tx_uid: 'UID-PROF',
      hoy: new Date('2026-04-19')
    });
    assert.equal(e.estado, 'activo');
    assert.equal(e.tipo, 'C2H2');
    assert.equal(e.frecuencia_muestreo_dias, BASELINES_C2H2.frecuencia_muestreo_dias);
    assert.equal(e.responsable_profesional_tx, 'UID-PROF');
    assert.ok(e.iniciado_ts.startsWith('2026-04-19'));
  });
});

describe('BATERIA_PRUEBAS_ETU', () => {
  test('contiene las 5 pruebas de §A9.1', () => {
    assert.equal(BATERIA_PRUEBAS_ETU.length, 5);
    const codigos = BATERIA_PRUEBAS_ETU.map((p) => p.codigo);
    assert.ok(codigos.includes('ELE-COMPLETO'));
    assert.ok(codigos.includes('FUR'));
    assert.ok(codigos.includes('DP'));
    assert.ok(codigos.includes('INSP-INT'));
  });
});

// ═════════ JUICIO EXPERTO FUR (A9.2) ═════════

describe('crearPropuestaReclasificacionFUR', () => {
  test('FUR < 4 → null (no aplica)', () => {
    const p = crearPropuestaReclasificacionFUR({
      transformadorId: 'T', ppb_2fal: 3000
    });
    assert.equal(p, null);
  });

  test('FUR=4 → propuesta pendiente', () => {
    const p = crearPropuestaReclasificacionFUR({
      transformadorId: 'TX-5', muestra_id: 'M-20',
      ppb_2fal: 4800, hi_bruto_actual: 3.0,
      hoy: new Date('2026-04-19')
    });
    assert.equal(p.estado, 'pendiente_revision_experto');
    assert.equal(p.calif_fur_actual, 4);
    assert.equal(p.hi_propuesto, 4);  // MAX(3, 4)
    assert.ok(p.dp_estimado > 0);
    assert.equal(p.referencia_normativa, 'MO.00418.DE-GAC-AX.01 §4.1.2 Nota Técnica FUR');
  });

  test('FUR=5 → propuesta con hi_propuesto=5', () => {
    const p = crearPropuestaReclasificacionFUR({
      transformadorId: 'TX-6', ppb_2fal: 6000, hi_bruto_actual: 2.5
    });
    assert.equal(p.calif_fur_actual, 5);
    assert.equal(p.hi_propuesto, 5);
  });
});

describe('aplicarDecisionExperto — transiciones', () => {
  const makeProp = () => crearPropuestaReclasificacionFUR({
    transformadorId: 'TX', ppb_2fal: 5000, hi_bruto_actual: 2.5,
    hoy: new Date('2026-04-19')
  });

  test('aprobar_reemplazo', () => {
    const p2 = aplicarDecisionExperto(makeProp(), {
      decision: 'aprobar_reemplazo', experto_uid: 'uid-1', nota: 'Reemplazo Q2'
    });
    assert.equal(p2.estado, 'aprobada_reemplazo');
    assert.equal(p2.fin_vida_util_papel, true);
    assert.equal(p2.bloqueo_ordenes_no_reemplazo, true);
  });

  test('aprobar_otc — bandera activa', () => {
    const p2 = aplicarDecisionExperto(makeProp(), {
      decision: 'aprobar_otc', experto_uid: 'uid-1'
    });
    assert.equal(p2.estado, 'aprobada_operacion_temporal_controlada');
    assert.equal(p2.fin_vida_util_papel, true);
  });

  test('rechazar — no activa banderas', () => {
    const p2 = aplicarDecisionExperto(makeProp(), {
      decision: 'rechazar', experto_uid: 'uid-1', nota: 'Contramuestra OK'
    });
    assert.equal(p2.estado, 'rechazada');
    assert.equal(p2.fin_vida_util_papel, false);
  });

  test('propuesta ya resuelta no se puede re-decidir', () => {
    const p = makeProp();
    const p2 = aplicarDecisionExperto(p, { decision: 'rechazar', experto_uid: 'u' });
    assert.throws(
      () => aplicarDecisionExperto(p2, { decision: 'aprobar_reemplazo', experto_uid: 'u' }),
      /ya resuelta/
    );
  });

  test('decision desconocida lanza error', () => {
    assert.throws(
      () => aplicarDecisionExperto(makeProp(), { decision: 'otra' }),
      /decision desconocida/
    );
  });
});

describe('puedeAbrirOrden — bloqueo post fin_vida_util_papel', () => {
  test('sin bandera: ok para cualquier tipo', () => {
    assert.equal(puedeAbrirOrden({}, 'mantenimiento').ok, true);
  });
  test('con bandera: solo reemplazo/retiro/OTC', () => {
    const tx = { salud_actual: { fin_vida_util_papel: true } };
    assert.equal(puedeAbrirOrden(tx, 'reemplazo').ok, true);
    assert.equal(puedeAbrirOrden(tx, 'retiro').ok,    true);
    assert.equal(puedeAbrirOrden(tx, 'operacion_temporal_controlada').ok, true);
    const x = puedeAbrirOrden(tx, 'preventivo');
    assert.equal(x.ok, false);
    assert.ok(x.razon.includes('fin_vida_util_papel'));
  });
});

describe('ESTADOS_PROPUESTA_FUR', () => {
  test('contiene los 4 estados esperados', () => {
    assert.equal(ESTADOS_PROPUESTA_FUR.length, 4);
    assert.ok(ESTADOS_PROPUESTA_FUR.includes('pendiente_revision_experto'));
    assert.ok(ESTADOS_PROPUESTA_FUR.includes('aprobada_reemplazo'));
    assert.ok(ESTADOS_PROPUESTA_FUR.includes('aprobada_operacion_temporal_controlada'));
    assert.ok(ESTADOS_PROPUESTA_FUR.includes('rechazada'));
  });
});
