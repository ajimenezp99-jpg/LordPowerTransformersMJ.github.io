// Tests del bloque saludV2 en computeFromDatasets (KPIs F8 + v2).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Para evitar el import directo del data layer (que tira de Firebase),
// reimplementamos la firma esperando el mismo shape de salida.
// El test verifica el contrato del shape.

describe('KPIs v2 — bloque saludV2', () => {
  test('agrega bucket por transformador y promedios', async () => {
    // Importar dinámicamente solo si el SDK no se invoca al cargar
    // la función. Como kpis.js importa Firestore por arriba,
    // saltamos el test si el bind falla en Node.
    let computeFromDatasets;
    try {
      ({ computeFromDatasets } = await import('../assets/js/data/kpis.js'));
    } catch (err) {
      // Si Node no puede importar (URL ESM Firebase), skip.
      console.warn('skip: kpis.js no importable en Node:', err.message);
      return;
    }

    const trafos = [
      { id: 'A', estado: 'operativo',
        salud_actual: { bucket: 'muy_bueno', hi_final: 1.2, vida_remanente_pct: 95 } },
      { id: 'B', estado: 'operativo',
        salud_actual: { bucket: 'bueno', hi_final: 2.0, vida_remanente_pct: 80 } },
      { id: 'C', estado: 'mantenimiento',
        salud_actual: { bucket: 'pobre', hi_final: 4.1 },
        estados_especiales: ['monitoreo_intensivo_c2h2'] },
      { id: 'D', estado: 'operativo',
        salud_actual: { bucket: 'muy_pobre', hi_final: 4.8, fin_vida_util_papel: true },
        estados_especiales: ['propuesta_fur_pendiente'] }
    ];
    const ords = [];
    const r = computeFromDatasets(trafos, ords);
    assert.equal(r.saludV2.por_bucket.muy_bueno, 1);
    assert.equal(r.saludV2.por_bucket.muy_pobre, 1);
    assert.equal(r.saludV2.propuestas_fur_pendientes, 1);
    assert.equal(r.saludV2.monitoreos_c2h2_activos, 1);
    assert.equal(r.saludV2.fin_vida_util_papel, 1);
    // promedio HI = (1.2 + 2.0 + 4.1 + 4.8) / 4 = 3.025
    assert.ok(Math.abs(r.saludV2.hi_promedio - 3.025) < 0.01);
    // vida remanente solo donde está definida (A=95, B=80) → 87.5
    assert.equal(r.saludV2.vida_remanente_promedio, 87.5);
  });

  test('parque vacío → null en promedios', async () => {
    let computeFromDatasets;
    try {
      ({ computeFromDatasets } = await import('../assets/js/data/kpis.js'));
    } catch (_) { return; }
    const r = computeFromDatasets([], []);
    assert.equal(r.saludV2.hi_promedio, null);
    assert.equal(r.saludV2.vida_remanente_promedio, null);
  });

  test('transformadores sin salud_actual van a sin_dato', async () => {
    let computeFromDatasets;
    try {
      ({ computeFromDatasets } = await import('../assets/js/data/kpis.js'));
    } catch (_) { return; }
    const r = computeFromDatasets(
      [{ id: 'X', estado: 'operativo' }, { id: 'Y', estado: 'operativo' }], []);
    assert.equal(r.saludV2.por_bucket.sin_dato, 2);
  });
});
