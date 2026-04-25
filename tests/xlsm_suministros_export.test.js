// Tests del exporter XLSM (F49). Sólo helpers puros — la integración
// con JSZip + fetch del template se prueba manualmente desde la UI.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  generarFilaMovimiento, parchearSheet6, parchearTable4
} from '../assets/js/exports/xlsm_suministros.js';

describe('generarFilaMovimiento', () => {
  test('mapea las 16 columnas en orden B–Q con celdas inlineStr', () => {
    const xml = generarFilaMovimiento({
      anio: 2026,
      codigo: 'MOV-2026-0001',
      transformador_id: 'abc123',
      subestacion: 'BAYUNCA',
      zona: 'BOLIVAR',
      departamento: 'bolivar',
      matricula: 'T1A-A/M-BYC',
      suministro_id: 'S02',
      suministro_nombre: 'Motoventiladores',
      marca: 'ZIEHL ABEGG',
      cantidad: 4,
      tipo: 'EGRESO',
      usuario: 'Jose',
      observaciones: '—',
      odt: 'ODT-2026-001'
    }, 5);
    assert.match(xml, /^<row r="5" spans="2:17">/);
    assert.match(xml, /<\/row>$/);
    // Cada columna B–Q presente.
    for (const col of ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q']) {
      assert.match(xml, new RegExp(`r="${col}5"`), `falta celda ${col}5`);
    }
    // M (Cantidad) = 4 va como número, no inlineStr.
    assert.match(xml, /<c r="M5" s="9"><v>4<\/v><\/c>/);
    // N (Tipo) = "EGRESO" va como inlineStr.
    assert.match(xml, /<c r="N5"[^>]*t="inlineStr"><is><t[^>]*>EGRESO<\/t><\/is><\/c>/);
  });

  test('escapa XML entities (&, <, >)', () => {
    const xml = generarFilaMovimiento({
      anio: 2026, codigo: 'X', cantidad: 1, tipo: 'INGRESO',
      observaciones: 'A & B <special> "case"'
    }, 5);
    assert.match(xml, /A &amp; B &lt;special&gt; &quot;case&quot;/);
    // No debe quedar entity sin escapar.
    assert.doesNotMatch(xml, /A & B </);
  });

  test('campos faltantes generan celda vacía pero con estilo', () => {
    const xml = generarFilaMovimiento({}, 5);
    assert.match(xml, /<c r="B5" s="38"\/>/);
    assert.match(xml, /<c r="Q5" s="65"\/>/);
  });
});

describe('parchearSheet6', () => {
  // Mock del XML del template (estructura mínima reconocible).
  const TEMPLATE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="B2:Q5"/><sheetViews><sheetView/></sheetViews><sheetFormatPr/><cols><col min="1" max="1" width="3"/></cols><sheetData><row r="2" spans="2:17"><c r="B2" s="79" t="s"><v>847</v></c></row><row r="3" spans="2:17"><c r="B3" s="98" t="s"><v>848</v></c></row><row r="4" spans="2:17"><c r="B4" s="6" t="s"><v>849</v></c></row><row r="5" spans="2:17"><c r="B5" s="38"/><c r="Q5" s="65"/></row></sheetData><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`;

  test('preserva dimension/sheetData/tableParts y reemplaza rows >= 5', () => {
    const movimientos = [
      { anio: 2026, codigo: 'MOV-2026-0001', cantidad: 4, tipo: 'EGRESO', suministro_id: 'S02', matricula: 'T1' },
      { anio: 2026, codigo: 'MOV-2026-0002', cantidad: 1, tipo: 'INGRESO', suministro_id: 'S07', matricula: 'T2' }
    ];
    const out = parchearSheet6(TEMPLATE_XML, movimientos);
    // Dimension actualizada a B2:Q6 (header en row 4 + 2 movimientos = lastRow 6).
    assert.match(out, /<dimension ref="B2:Q6"\/>/);
    // Header (row 4) preservado.
    assert.match(out, /<row r="4"/);
    // Las dos filas nuevas presentes.
    assert.match(out, /<row r="5"[^>]*>[\s\S]*?MOV-2026-0001/);
    assert.match(out, /<row r="6"[^>]*>[\s\S]*?MOV-2026-0002/);
    // tableParts intacto.
    assert.match(out, /<tableParts/);
  });

  test('movimientos vacíos conserva fila placeholder en row 5', () => {
    const out = parchearSheet6(TEMPLATE_XML, []);
    assert.match(out, /<dimension ref="B2:Q5"\/>/);
    assert.match(out, /<row r="5"/);
    // No hay row 6.
    assert.doesNotMatch(out, /<row r="6"/);
  });

  test('lanza si la estructura no se reconoce', () => {
    assert.throws(() => parchearSheet6('<worksheet/>', []), /estructura de sheetData no reconocida/);
  });
});

describe('parchearTable4', () => {
  const TABLE4_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="4" name="tblMovimientos" displayName="tblMovimientos" ref="B4:Q5"><autoFilter ref="B4:Q5"/></table>`;

  test('actualiza ref del table y autoFilter', () => {
    const out = parchearTable4(TABLE4_XML, 5);
    // ref del table → B4:Q9 (header + 5 movs = lastRow 9).
    assert.match(out, / ref="B4:Q9"/);
    // No quedan refs viejos.
    assert.doesNotMatch(out, / ref="B4:Q5"/);
  });

  test('movimientos=0 deja el ref mínimo (B4:Q5)', () => {
    const out = parchearTable4(TABLE4_XML, 0);
    assert.match(out, / ref="B4:Q5"/);
  });
});
