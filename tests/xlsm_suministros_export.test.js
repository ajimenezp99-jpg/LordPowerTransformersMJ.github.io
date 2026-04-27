// Tests del exporter XLSM (F49). Sólo helpers puros — la integración
// con JSZip + fetch del template se prueba manualmente desde la UI.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  generarFilaMovimiento, parchearSheet6, parchearTable4,
  generarFilaCatalogoSuministro, parchearSheet2
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

describe('generarFilaCatalogoSuministro', () => {
  test('mapea las 9 columnas B–J con fórmulas SUMIFS / stock / alerta', () => {
    const xml = generarFilaCatalogoSuministro({
      codigo: 'S23',
      nombre: 'Buje 13,8 kV',
      unidad: 'Und',
      stock_inicial: 3,
      marcas_disponibles: ['CEDASPE']
    }, 25);
    assert.match(xml, /^<row r="25" spans="2:10">/);
    assert.match(xml, /<\/row>$/);
    // B = código, inlineStr.
    assert.match(xml, /<c r="B25"[^>]*t="inlineStr"><is><t[^>]*>S23<\/t><\/is><\/c>/);
    // E = stock_inicial como número.
    assert.match(xml, /<c r="E25" s="9"><v>3<\/v><\/c>/);
    // F y G tienen fórmula SUMIFS sobre tblMovimientos del row 25.
    assert.match(xml, /<c r="F25" s="9"><f>SUMIFS\(tblMovimientos\[Cantidad\],tblMovimientos\[Suministro_ID\],\$B25,tblMovimientos\[Tipo\],"INGRESO"\)<\/f>/);
    assert.match(xml, /<c r="G25" s="9"><f>SUMIFS\(tblMovimientos\[Cantidad\],tblMovimientos\[Suministro_ID\],\$B25,tblMovimientos\[Tipo\],"EGRESO"\)<\/f>/);
    // H = E+F-G del row 25.
    assert.match(xml, /<c r="H25" s="9"><f>\$E25\+\$F25-\$G25<\/f><v>3<\/v><\/c>/);
    // I = alerta — stock=3 cae en "🟡 BAJO".
    assert.match(xml, /<c r="I25" s="7" t="str"><f>IF/);
    assert.match(xml, /BAJO/);
    // J = marca formateada.
    assert.match(xml, /<c r="J25"[^>]*>[\s\S]*CEDASPE/);
  });

  test('marcas_disponibles vacío → "(edite)"', () => {
    const xml = generarFilaCatalogoSuministro({
      codigo: 'S01', nombre: 'Coraza', unidad: 'Mt', stock_inicial: 0
    }, 4);
    assert.match(xml, /<c r="J4"[^>]*>[\s\S]*\(edite\)/);
    // I con stock=0 → "🔴 SIN STOCK"
    assert.match(xml, /SIN STOCK/);
  });

  test('stock alto (>3) → "🟢 OK"', () => {
    const xml = generarFilaCatalogoSuministro({
      codigo: 'S11', nombre: 'Silica', unidad: 'Kg', stock_inicial: 425
    }, 14);
    assert.match(xml, /<c r="I14"[^>]*>[\s\S]*OK/);
  });
});

describe('parchearSheet2', () => {
  // Mínimo viable: dimension + sheetData con title (row 2) + header (row 3).
  const SHEET2_XML = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="B2:J25"/><sheetViews/><sheetFormatPr defaultRowHeight="15"/><cols/><sheetData><row r="2" spans="2:10"><c r="B2" s="79" t="s"><v>0</v></c></row><row r="3" spans="2:10"><c r="B3" s="6" t="s"><v>1</v></c><c r="C3" s="6" t="s"><v>2</v></c></row><row r="4" spans="2:10"><c r="B4" s="7" t="s"><v>46</v></c></row><row r="25" spans="2:10"><c r="B25" s="7" t="s"><v>X</v></c></row></sheetData></worksheet>`;

  test('inyecta una fila por suministro y actualiza dimension', () => {
    const out = parchearSheet2(SHEET2_XML, [
      { codigo: 'S01', nombre: 'Coraza', unidad: 'Mt', stock_inicial: 0 },
      { codigo: 'S02', nombre: 'Radiadores', unidad: 'Und', stock_inicial: 6, marcas_disponibles: ['TDM RADIATORS'] }
    ]);
    // Dimension actualizado: 2 sumins → lastRow 5.
    assert.match(out, /<dimension ref="B2:J5"/);
    // Header (row 3) preservado.
    assert.match(out, /<row r="3"[\s\S]*<c r="B3"/);
    // Las dos filas nuevas presentes.
    assert.match(out, /<row r="4"[\s\S]*S01/);
    assert.match(out, /<row r="5"[\s\S]*S02/);
    // Las filas placeholder originales (row 4/25 viejas) no quedan.
    assert.doesNotMatch(out, /<v>X<\/v>/);
  });

  test('25 suministros → dimension B2:J28', () => {
    const arr = Array.from({ length: 25 }, (_, i) => ({
      codigo: `S${String(i+1).padStart(2,'0')}`, nombre: `Item ${i+1}`,
      unidad: 'Und', stock_inicial: i
    }));
    const out = parchearSheet2(SHEET2_XML, arr);
    assert.match(out, /<dimension ref="B2:J28"/);
    // Primera y última.
    assert.match(out, /<row r="4"[\s\S]*S01/);
    assert.match(out, /<row r="28"[\s\S]*S25/);
  });

  test('suministros vacío → fila placeholder en row 4, dimension B2:J4', () => {
    const out = parchearSheet2(SHEET2_XML, []);
    assert.match(out, /<dimension ref="B2:J4"/);
    assert.match(out, /<row r="4"/);
  });

  test('escapa XML en nombre del suministro', () => {
    const out = parchearSheet2(SHEET2_XML, [
      { codigo: 'S01', nombre: 'A & B <special>', unidad: 'Und', stock_inicial: 0 }
    ]);
    assert.match(out, /A &amp; B &lt;special&gt;/);
  });

  test('lanza si la estructura de sheetData es desconocida', () => {
    assert.throws(() => parchearSheet2('<worksheet/>', []), /estructura de sheetData/);
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
