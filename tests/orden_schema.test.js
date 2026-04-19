import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizarOrden, validarOrden, transicionValida,
  ESTADOS_ORDEN_V2, TIPOS_ORDEN, PRIORIDADES
} from '../assets/js/domain/orden_schema.js';

describe('sanitizarOrden v2', () => {
  test('mapea estados legacy v1 → v2', () => {
    assert.equal(sanitizarOrden({ estado: 'planificada' }).estado, 'programada');
    assert.equal(sanitizarOrden({ estado: 'en_curso' }).estado,   'en_ejecucion');
    assert.equal(sanitizarOrden({ estado: 'cerrada' }).estado,    'cerrada');
    assert.equal(sanitizarOrden({ estado: 'cancelada' }).estado,  'cancelada');
  });

  test('estado desconocido cae a borrador', () => {
    assert.equal(sanitizarOrden({ estado: 'inventada' }).estado, 'borrador');
  });

  test('tipo ETU y reemplazo son válidos (v2)', () => {
    assert.equal(sanitizarOrden({ tipo: 'etu' }).tipo, 'etu');
    assert.equal(sanitizarOrden({ tipo: 'reemplazo' }).tipo, 'reemplazo');
    assert.equal(sanitizarOrden({ tipo: 'retiro' }).tipo, 'retiro');
  });

  test('causantes se convierten a array de strings', () => {
    const o = sanitizarOrden({ causantes: ['CAU-05', 'CAU-06'] });
    assert.deepEqual(o.causantes, ['CAU-05', 'CAU-06']);
  });

  test('FK macroactividad se preservan', () => {
    const o = sanitizarOrden({
      macroactividadId: 'ABC', macroactividad_codigo: 'MACRO-PSM',
      contratoId: 'XYZ', contrato_codigo: 'C-001'
    });
    assert.equal(o.macroactividad_codigo, 'MACRO-PSM');
    assert.equal(o.contrato_codigo, 'C-001');
  });
});

describe('validarOrden', () => {
  test('doc mínimo válido pasa', () => {
    const o = sanitizarOrden({
      codigo: 'OT-001', titulo: 'X', transformadorId: 'TX-1', estado: 'borrador'
    });
    assert.deepEqual(validarOrden(o), []);
  });
  test('falta transformadorId → error', () => {
    const o = sanitizarOrden({ codigo: 'OT', titulo: 'X' });
    const errs = validarOrden(o);
    assert.ok(errs.some((e) => e.includes('transformadorId')));
  });
  test('condicion_objetivo fuera de rango', () => {
    const o = sanitizarOrden({
      codigo: 'OT', titulo: 'X', transformadorId: 'TX', condicion_objetivo: 7
    });
    const errs = validarOrden(o);
    assert.ok(errs.some((e) => e.includes('condicion_objetivo')));
  });
});

describe('Workflow F29 — transiciones', () => {
  test('borrador → propuesta OK', () => {
    assert.ok(transicionValida('borrador', 'propuesta'));
  });
  test('programada → en_ejecucion OK', () => {
    assert.ok(transicionValida('programada', 'en_ejecucion'));
  });
  test('borrador → ejecutada NO', () => {
    assert.ok(!transicionValida('borrador', 'ejecutada'));
  });
  test('cerrada → cualquiera NO', () => {
    assert.ok(!transicionValida('cerrada', 'en_ejecucion'));
    assert.ok(!transicionValida('cerrada', 'verificada'));
  });
  test('rechazada es terminal', () => {
    assert.ok(!transicionValida('rechazada', 'borrador'));
  });
});

describe('Catálogos', () => {
  test('ESTADOS_ORDEN_V2 tiene 11 estados', () => {
    assert.equal(ESTADOS_ORDEN_V2.length, 11);
  });
  test('TIPOS_ORDEN incluye etu, reemplazo, retiro', () => {
    const vs = TIPOS_ORDEN.map((t) => t.value);
    assert.ok(vs.includes('etu'));
    assert.ok(vs.includes('reemplazo'));
    assert.ok(vs.includes('retiro'));
  });
});
