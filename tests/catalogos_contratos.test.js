import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUBACTIVIDADES_BASELINE,
  MACROACTIVIDADES_BASELINE,
  CAUSANTES_BASELINE
} from '../assets/js/domain/catalogos_baseline.js';
import { sanitizarContrato, validarContrato, ALIADOS, ESTADOS_CONTRATO }
  from '../assets/js/domain/contrato_schema.js';

describe('Catálogos baseline §A7', () => {
  test('cobertura por condición 1..5', () => {
    const byCond = {};
    for (const s of SUBACTIVIDADES_BASELINE) {
      byCond[s.condicion_objetivo] = (byCond[s.condicion_objetivo] || 0) + 1;
    }
    for (const c of [1, 2, 3, 4, 5]) {
      assert.ok(byCond[c] > 0, `Cond ${c} sin subactividades`);
    }
  });

  test('macroactividades referencian subactividades existentes', () => {
    const codigos = new Set(SUBACTIVIDADES_BASELINE.map((s) => s.codigo));
    for (const m of MACROACTIVIDADES_BASELINE) {
      for (const sub of m.subactividades) {
        assert.ok(codigos.has(sub), `Macro ${m.codigo} referencia subactividad inexistente: ${sub}`);
      }
    }
  });

  test('causantes cubren las 7 variables principales + eventos externos', () => {
    const origenes = new Set(CAUSANTES_BASELINE.map((c) => c.origen));
    ['DGA', 'ADFQ', 'FUR', 'EDAD', 'CRG', 'PYT', 'HER', 'EXT'].forEach((x) =>
      assert.ok(origenes.has(x), `Falta causante de origen ${x}`)
    );
  });

  test('cada subactividad tiene costo_ref y tiempo_h', () => {
    for (const s of SUBACTIVIDADES_BASELINE) {
      assert.ok(s.tiempo_h > 0, `${s.codigo} sin tiempo_h`);
      assert.ok(s.costo_ref > 0, `${s.codigo} sin costo_ref`);
    }
  });
});

describe('Contrato schema (F21)', () => {
  test('ALIADOS y ESTADOS_CONTRATO son arrays válidos', () => {
    assert.ok(ALIADOS.length >= 5);
    assert.ok(ESTADOS_CONTRATO.length >= 3);
  });

  test('sanitizarContrato calcula disponible = total - comprometido - ejecutado', () => {
    const c = sanitizarContrato({
      codigo: 'C-001', fecha_inicio: '2026-01-01',
      monto_total: 1000, presupuesto_comprometido: 300, presupuesto_ejecutado: 200
    });
    assert.equal(c.presupuesto_disponible, 500);
  });

  test('no permite disponible negativo (clampea a 0)', () => {
    const c = sanitizarContrato({
      codigo: 'C-002', fecha_inicio: '2026-01-01',
      monto_total: 100, presupuesto_comprometido: 150, presupuesto_ejecutado: 0
    });
    assert.equal(c.presupuesto_disponible, 0);
  });

  test('aliado fuera de catálogo → OTRO', () => {
    const c = sanitizarContrato({
      codigo: 'X', fecha_inicio: '2026-01-01', aliado: 'DESCONOCIDO', monto_total: 0
    });
    assert.equal(c.aliado, 'OTRO');
  });

  test('validarContrato detecta sobrecarga presupuesto', () => {
    const c = sanitizarContrato({
      codigo: 'C', fecha_inicio: '2026-01-01',
      monto_total: 100, presupuesto_comprometido: 80, presupuesto_ejecutado: 50
    });
    const errs = validarContrato(c);
    assert.ok(errs.some((e) => e.includes('supera')));
  });

  test('valida zonas_aplica solo catálogo', () => {
    const c = sanitizarContrato({
      codigo: 'C', fecha_inicio: '2026-01-01',
      monto_total: 1000, zonas_aplica: ['BOLIVAR', 'MARTE', 'ORIENTE']
    });
    assert.deepEqual(c.zonas_aplica, ['BOLIVAR', 'ORIENTE']);
  });
});
