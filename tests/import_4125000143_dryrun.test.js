// Tests del archivo del contrato 4125000143 contra el parser puro
// del importador (FASE B del deploy del nuevo contrato).
//
// Carga el .xlsm real desde el repo, extrae rows con SheetJS, los
// pasa al parser puro del dominio, valida que (a) el parseo no
// pierde filas, (b) los 3 SKUs nuevos S23/S24/S25 cuadran con la
// validación, (c) el plan resultante contra Firestore VACÍO es
// 100 % "crear", y (d) las marcas del catálogo son consistentes.
//
// Cero Firebase. SheetJS solo para extraer rows del archivo real.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import * as XLSX from 'xlsx';

import {
  parsearCatalogoRows, parsearMarcasRows,
  prepararPlanImportacion
} from '../assets/js/domain/importador_suministros.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSM_PATH = resolve(__dirname, '..', 'Gestion_Suministros_Transformadores_4125000143.xlsm');

let wb, rowsCat, rowsMar;
before(() => {
  const buf = readFileSync(XLSM_PATH);
  wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  // Header real está en fila 3 del .xlsm (filas 1-2 son título mergeado).
  rowsCat = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Suministros'], { range: 2, raw: false, defval: '' });
  rowsMar = XLSX.utils.sheet_to_json(wb.Sheets['Marcas'],               { range: 2, raw: false, defval: '' });
});

describe('contrato 4125000143 · estructura del .xlsm', () => {
  test('tiene las 8 hojas esperadas', () => {
    assert.deepEqual(wb.SheetNames, [
      'README', 'Catalogo_Suministros', 'Marcas', 'ListasMarcas',
      'Equipos', 'Movimientos', 'Entrega', 'Dashboard'
    ]);
  });

  test('Catalogo_Suministros expone 25 filas (S01..S25)', () => {
    assert.equal(rowsCat.length, 25, `esperado 25 filas, got ${rowsCat.length}`);
    const ids = rowsCat.map((r) => r.ID);
    assert.deepEqual(ids.slice(0, 3), ['S01', 'S02', 'S03']);
    assert.deepEqual(ids.slice(-3),   ['S23', 'S24', 'S25']);
  });

  test('Marcas expone 25 filas paralelas al catálogo', () => {
    assert.equal(rowsMar.length, 25);
    const ids = rowsMar.map((r) => r.ID_Suministro);
    assert.deepEqual(ids.slice(-3), ['S23', 'S24', 'S25']);
  });

  test('Movimientos viene vacío (sin histórico a migrar)', () => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Movimientos'], { range: 3, raw: false, defval: '' });
    assert.equal(rows.length, 0);
  });
});

describe('contrato 4125000143 · parser de catálogo', () => {
  test('parsea 25 suministros sin errores de validación', () => {
    const { suministros, errores } = parsearCatalogoRows(rowsCat);
    assert.equal(errores.length, 0, JSON.stringify(errores));
    assert.equal(suministros.length, 25);
  });

  test('todos los códigos cumplen el patrón Sxx', () => {
    const { suministros } = parsearCatalogoRows(rowsCat);
    for (const s of suministros) {
      assert.match(s.codigo, /^S\d{2}$/, `código inválido: ${s.codigo}`);
    }
  });

  test('los 3 SKUs nuevos están presentes con stock_inicial correcto', () => {
    const { suministros } = parsearCatalogoRows(rowsCat);
    const byId = Object.fromEntries(suministros.map((s) => [s.codigo, s]));
    assert.ok(byId.S23, 'falta S23');
    assert.ok(byId.S24, 'falta S24');
    assert.ok(byId.S25, 'falta S25');
    // Stock inicial reportado en el .xlsm fuente.
    assert.equal(byId.S23.stock_inicial, 3);
    assert.equal(byId.S24.stock_inicial, 3);
    assert.equal(byId.S25.stock_inicial, 6);
    // Unidad normalizada.
    assert.equal(byId.S23.unidad, 'Und');
    assert.equal(byId.S24.unidad, 'Und');
    assert.equal(byId.S25.unidad, 'Und');
  });

  test('todas las unidades quedan en el catálogo enum', () => {
    const ENUM = ['Und', 'Mt', 'Lt', 'Kg', 'Gal', 'Otro'];
    const { suministros } = parsearCatalogoRows(rowsCat);
    for (const s of suministros) {
      assert.ok(ENUM.includes(s.unidad), `unidad fuera de catálogo: ${s.codigo} → ${s.unidad}`);
    }
  });
});

describe('contrato 4125000143 · parser de marcas', () => {
  test('descarta entries con marca placeholder "(edite)"', () => {
    const { marcas, errores } = parsearMarcasRows(rowsMar);
    assert.equal(errores.length, 0);
    // El catálogo del nuevo contrato tiene 8 entries con "(edite)"
    // (S01 coraza, S08 membrana, S11 silica gel, S16 indic temp,
    //  S19 gabinete, S20 buchholz, S21 válvula); el parser los filtra.
    // Lo que queda es lo que tiene marca real.
    assert.ok(marcas.length > 0 && marcas.length < 25,
      `esperado entre 1 y 24 marcas reales, got ${marcas.length}`);
    // Y todas las marcas reportadas son strings no vacíos.
    for (const m of marcas) {
      assert.ok(m.marca && typeof m.marca === 'string');
      assert.ok(!m.marca.toUpperCase().includes('(EDITE)'));
    }
  });

  test('captura las marcas conocidas de S23/S24/S25 (normalizadas a UPPER)', () => {
    // sanitizarMarca normaliza marca a UPPERCASE — política del dominio F38.
    const { marcas } = parsearMarcasRows(rowsMar);
    const byId = Object.fromEntries(marcas.map((m) => [m.suministro_id, m.marca]));
    assert.equal(byId.S23, 'CEDASPE');
    assert.equal(byId.S24, 'CEDASPE');
    assert.equal(byId.S25, 'RHM INTERNACIONAL USA');
  });
});

describe('contrato 4125000143 · plan de importación contra Firestore vacío', () => {
  test('25 suministros van a "crear", 0 a "actualizar"', () => {
    const { suministros } = parsearCatalogoRows(rowsCat);
    const { marcas }      = parsearMarcasRows(rowsMar);
    const plan = prepararPlanImportacion(
      { suministros, marcas, transformadores: [], correcciones: [] },
      { suministrosIds: new Set(), marcasKeys: new Set(), transformadoresPorMatricula: new Map() }
    );
    assert.equal(plan.suministros.crear.length,      25);
    assert.equal(plan.suministros.actualizar.length, 0);
    assert.equal(plan.suministros.huerfanos.length,  0);
    assert.equal(plan.resumen.suministros.total,     25);
    // Cada marca real entra como "crear".
    assert.equal(plan.marcas.crear.length, marcas.length);
  });

  test('si Firestore ya tiene S01..S22, los nuevos S23..S25 son los únicos en "crear"', () => {
    const { suministros } = parsearCatalogoRows(rowsCat);
    const previos = new Set(['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10',
                             'S11','S12','S13','S14','S15','S16','S17','S18','S19','S20','S21','S22']);
    const plan = prepararPlanImportacion(
      { suministros, marcas: [], transformadores: [], correcciones: [] },
      { suministrosIds: previos, marcasKeys: new Set(), transformadoresPorMatricula: new Map() }
    );
    assert.equal(plan.suministros.actualizar.length, 22);
    assert.equal(plan.suministros.crear.length,       3);
    const codigosCrear = plan.suministros.crear.map((s) => s.codigo).sort();
    assert.deepEqual(codigosCrear, ['S23', 'S24', 'S25']);
  });
});
