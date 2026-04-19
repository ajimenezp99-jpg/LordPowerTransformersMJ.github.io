import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizarMuestra, validarMuestra, TIPOS_MUESTRA, EVENTOS_EXTERNOS
} from '../assets/js/domain/muestra_schema.js';

describe('sanitizarMuestra', () => {
  test('acepta shape plano con gases', () => {
    const m = sanitizarMuestra({
      transformadorId: 'TX-1',
      tipo: 'dga',
      fecha_muestra: '2026-01-10',
      H2: 50, CH4: 50, C2H4: 50, C2H6: 50, C2H2: 2
    });
    assert.equal(m.tipo, 'DGA');
    assert.equal(m.gases.H2, 50);
    assert.equal(m.gases.C2H2, 2);
  });

  test('acepta shape por secciones', () => {
    const m = sanitizarMuestra({
      transformadorId: 'TX-1', tipo: 'ADFQ', fecha_muestra: '2026-02-01',
      adfq: { rigidez_kv: 35, ti: 1000, nn: 1 }
    });
    assert.equal(m.adfq.rigidez_kv, 35);
    assert.equal(m.adfq.ti, 1000);
  });

  test('comas decimales se convierten', () => {
    const m = sanitizarMuestra({
      transformadorId: 'TX-1', tipo: 'DGA', fecha_muestra: '2026-01-10',
      H2: '4,5'
    });
    assert.equal(m.gases.H2, 4.5);
  });

  test('tipo fuera de catálogo → default DGA', () => {
    const m = sanitizarMuestra({
      transformadorId: 'TX-1', tipo: 'INVENTO', fecha_muestra: '2026-01-10'
    });
    assert.equal(m.tipo, 'DGA');
  });
});

describe('validarMuestra', () => {
  test('doc mínimo válido pasa', () => {
    const m = sanitizarMuestra({
      transformadorId: 'TX-1', tipo: 'DGA', fecha_muestra: '2026-01-01'
    });
    const errs = validarMuestra(m);
    assert.deepEqual(errs, []);
  });

  test('falta transformadorId → error', () => {
    const m = sanitizarMuestra({ tipo: 'DGA', fecha_muestra: '2026-01-01' });
    const errs = validarMuestra(m);
    assert.ok(errs.some((e) => e.includes('transformadorId')));
  });

  test('DGA con TDGC > 201 sin contexto → error A9.6', () => {
    const m = sanitizarMuestra({
      transformadorId: 'TX-1', tipo: 'DGA', fecha_muestra: '2026-01-01',
      H2: 100, CH4: 100, C2H4: 100, C2H6: 100, C2H2: 2
    });
    const errs = validarMuestra(m);
    assert.ok(errs.some((e) => e.includes('A9.6')));
  });

  test('DGA con TDGC > 201 CON contexto → válida', () => {
    const m = sanitizarMuestra({
      transformadorId: 'TX-1', tipo: 'DGA', fecha_muestra: '2026-01-01',
      H2: 100, CH4: 100, C2H4: 100, C2H6: 100, C2H2: 2,
      observacion_contextual_analista: 'Evento de carga extrema el 2026-01-08.'
    });
    const errs = validarMuestra(m);
    assert.deepEqual(errs, []);
  });

  test('C2H2=5 sin contexto → error A9.6', () => {
    const m = sanitizarMuestra({
      transformadorId: 'TX-1', tipo: 'DGA', fecha_muestra: '2026-01-01',
      H2: 5, CH4: 5, C2H4: 5, C2H6: 5, C2H2: 5
    });
    const errs = validarMuestra(m);
    assert.ok(errs.some((e) => e.includes('A9.6')));
  });
});

describe('Catálogos', () => {
  test('TIPOS_MUESTRA tiene DGA/ADFQ/FURANOS/COMBO', () => {
    const vs = TIPOS_MUESTRA.map((x) => x.value);
    assert.deepEqual(vs.sort(), ['ADFQ', 'COMBO', 'DGA', 'FURANOS']);
  });
  test('EVENTOS_EXTERNOS incluye descarga_atmosferica', () => {
    assert.ok(EVENTOS_EXTERNOS.some((e) => e.value === 'descarga_atmosferica'));
  });
});
