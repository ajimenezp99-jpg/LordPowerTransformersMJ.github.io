import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizarFallado, validarFallado, calcularRPN, nivelRiesgoRPN,
  TIPOS_FALLA, METODOS_RCA
} from '../assets/js/domain/fallados_schema.js';
import {
  evaluarActivacionRespaldo, seleccionarRespaldoOptimo
} from '../assets/js/domain/tpt_respaldo.js';

describe('Fallados F25', () => {
  test('sanitiza doc mínimo', () => {
    const f = sanitizarFallado({
      transformadorId: 'TX-1', fecha_falla: '2025-12-01', tipo_falla: 'termica'
    });
    assert.equal(f.transformadorId, 'TX-1');
    assert.equal(f.tipo_falla, 'termica');
    assert.equal(f.metodo_rca, '5_porques');
  });

  test('tipo_falla fuera de catálogo → desconocida', () => {
    const f = sanitizarFallado({
      transformadorId: 'T', fecha_falla: '2025-01-01', tipo_falla: 'inventada'
    });
    assert.equal(f.tipo_falla, 'desconocida');
  });

  test('valida FMEA con líneas', () => {
    const f = sanitizarFallado({
      transformadorId: 'T', fecha_falla: '2025-01-01', tipo_falla: 'electrica',
      metodo_rca: 'fmea',
      rca_fmea: [{ modo_falla: 'x', severidad: 7, ocurrencia: 3, deteccion: 4 }]
    });
    const errs = validarFallado(f);
    assert.deepEqual(errs, []);
    assert.equal(f.rca_fmea[0].rpn, 84);
  });

  test('FMEA vacío → error', () => {
    const f = sanitizarFallado({
      transformadorId: 'T', fecha_falla: '2025-01-01', tipo_falla: 'electrica',
      metodo_rca: 'fmea'
    });
    const errs = validarFallado(f);
    assert.ok(errs.some((e) => e.includes('FMEA')));
  });
});

describe('RPN y nivel riesgo', () => {
  test('calcularRPN válido', () => {
    assert.equal(calcularRPN({ severidad: 5, ocurrencia: 3, deteccion: 4 }), 60);
  });
  test('valores fuera de [1,10] → null', () => {
    assert.equal(calcularRPN({ severidad: 11, ocurrencia: 3, deteccion: 4 }), null);
    assert.equal(calcularRPN({ severidad: 0, ocurrencia: 3, deteccion: 4 }), null);
  });
  test('nivel riesgo', () => {
    assert.equal(nivelRiesgoRPN(300), 'critico');
    assert.equal(nivelRiesgoRPN(150), 'alto');
    assert.equal(nivelRiesgoRPN(70),  'medio');
    assert.equal(nivelRiesgoRPN(20),  'bajo');
    assert.equal(nivelRiesgoRPN(null),'desconocido');
  });
});

describe('TPT/Respaldo F24', () => {
  const respaldo = {
    id: 'R1',
    identificacion: { tipo_activo: 'RESPALDO' },
    estado_servicio: 'operativo',
    electrico: { corriente_nominal_primaria_a: 1000 },
    salud_actual: { crg_pct_medido: 30, hi_final: 1.8 },
    ubicacion: { zona: 'BOLIVAR' },
    placa: { potencia_kva: 100000 }
  };

  test('activación viable: factor < 1.30 y duración < t_admisible', () => {
    const r = evaluarActivacionRespaldo(respaldo, 400, 120);
    // carga final = 300 + 400 = 700 A → factor 0.7 (no sobrecarga)
    assert.equal(r.viable, true);
  });

  test('activación NO viable si factor > 1.30', () => {
    const r = evaluarActivacionRespaldo(respaldo, 1200, 60);
    // carga final = 300 + 1200 = 1500 A → factor 1.5
    assert.equal(r.viable, false);
    assert.ok(r.recomendacion.includes('RIESGO'));
  });

  test('rechaza si no es tipo RESPALDO', () => {
    const r = evaluarActivacionRespaldo(
      { ...respaldo, identificacion: { tipo_activo: 'POTENCIA' } }, 500, 60
    );
    assert.equal(r.viable, false);
  });

  test('seleccionarRespaldoOptimo prioriza misma zona', () => {
    const unidad = { ubicacion: { zona: 'ORIENTE' } };
    const cands = [
      { ...respaldo, id: 'R-BOL', ubicacion: { zona: 'BOLIVAR' }, salud_actual: { hi_final: 1.2 } },
      { ...respaldo, id: 'R-ORI', ubicacion: { zona: 'ORIENTE' }, salud_actual: { hi_final: 2.0 } }
    ];
    const elegido = seleccionarRespaldoOptimo(unidad, cands);
    assert.equal(elegido.id, 'R-ORI');
  });

  test('seleccionarRespaldoOptimo descarta no operativos', () => {
    const cands = [{ ...respaldo, estado_servicio: 'mantenimiento' }];
    const elegido = seleccionarRespaldoOptimo({ ubicacion: { zona: 'BOLIVAR' } }, cands);
    assert.equal(elegido, null);
  });
});

describe('Catálogos F25', () => {
  test('TIPOS_FALLA cubre 6 variantes', () => {
    assert.equal(TIPOS_FALLA.length, 6);
  });
  test('METODOS_RCA tiene 5porques/ishikawa/fmea', () => {
    const vs = METODOS_RCA.map((m) => m.value);
    assert.ok(vs.includes('5_porques'));
    assert.ok(vs.includes('ishikawa'));
    assert.ok(vs.includes('fmea'));
  });
});
