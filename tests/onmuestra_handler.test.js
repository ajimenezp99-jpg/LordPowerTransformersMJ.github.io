// Test del handler puro `onMuestraCreate` — verifica que dada una
// muestra DGA + transformador con datos previos, se construye un
// snapshot salud_actual coherente con el motor F18.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { snapshotSaludCompleto } from '../assets/js/domain/salud_activos.js';

describe('onMuestraCreate handler — pure logic', () => {
  test('muestra DGA + transformador → snapshot completo con HI', () => {
    const transformador = {
      id: 'TX-1',
      fabricacion: { ano_fabricacion: 2010 },
      salud_actual: {
        ubicacion_fuga_dominante: 'laterales',
        calif_pyt: 2
      }
    };
    const muestraDGA = { id: 'M-1', gases: {
      H2: 60, CH4: 60, C2H4: 60, C2H6: 60, C2H2: 3,
      CO: 200, CO2: 2200
    }};
    const snap = snapshotSaludCompleto({
      transformador,
      muestraDGA,
      her: 'laterales',
      pyt: 2
    });
    assert.ok(snap.eval_dga != null);
    assert.ok(snap.calif_edad != null);
    assert.ok(snap.hi_final != null);
    assert.ok(snap.bucket);
    assert.equal(snap.muestra_dga_ref, 'M-1');
  });

  test('muestra con C2H2 alto pero sin aceleración → marker informativo', () => {
    const snap = snapshotSaludCompleto({
      transformador: { fabricacion: { ano_fabricacion: 2018 } },
      muestraDGA: { gases: { H2: 5, CH4: 5, C2H4: 5, C2H6: 5, C2H2: 8, CO: 50, CO2: 500 }},
      muestraADFQ: { rigidez_kv: 35, ti: 1500, nn: 1 },
      muestraFUR: { ppb: 1000 },
      her: 'sin_fugas',
      pyt: 1
    });
    assert.equal(snap.calif_c2h2, 5);
    // C2H2=5 sin aceleración no debe forzar HI≥4 (regla §A9.1 R1)
    assert.ok(snap.overrides_aplicados.some((o) => o.includes('monitoreo intensivo')),
      'debe registrar marker informativo de monitoreo intensivo');
  });

  test('combo DGA + ADFQ + FUR produce snapshot completo y coherente', () => {
    const snap = snapshotSaludCompleto({
      transformador: { id: 'TX-X', fabricacion: { ano_fabricacion: 2008 } },
      muestraDGA: { id: 'D', gases: { H2: 30, CH4: 30, C2H4: 30, C2H6: 30, C2H2: 1, CO: 150, CO2: 1500 }},
      muestraADFQ: { id: 'A', rigidez_kv: 30, ti: 1000, nn: 1 },
      muestraFUR: { id: 'F', ppb: 4000 },
      cargaActual: { cp: 70, ap: 100 },
      pyt: 'integral_sin_scada',
      her: 'junction_block'
    });
    assert.equal(snap.calif_her, 3);
    assert.equal(snap.calif_pyt, 3);
    assert.ok(snap.dp_estimado > 0);
    assert.ok(snap.vida_remanente_pct >= 0 && snap.vida_remanente_pct <= 100);
    assert.equal(snap.muestra_dga_ref, 'D');
    assert.equal(snap.muestra_adfq_ref, 'A');
    assert.equal(snap.muestra_fur_ref, 'F');
  });
});
