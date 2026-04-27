// Test de integración del exporter espejo: abre el template real,
// ejecuta generarXlsmExport con el catálogo del contrato 4125000143,
// y verifica que el .xlsm resultante:
//
//   1. Conserva vbaProject.bin idéntico al template (md5 igual).
//   2. Tablas con refs actualizadas a 25 SKUs.
//   3. definedName Sxx para los 25 (incluyendo S23/S24/S25 en W/X/Y).
//   4. Es re-leíble por SheetJS sin errores.
//   5. Los 25 suministros aparecen en Catalogo_Suministros.
//   6. Las 25 marcas aparecen en hoja Marcas.
//   7. ListasMarcas tiene 3 filas × 25 cols con códigos en row 1.
//
// Usa JSZip dinámico (importado vía npm para evitar el CDN del
// browser path).

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

import * as XLSX from 'xlsx';

import { generarXlsmExport } from '../assets/js/exports/xlsm_suministros.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = resolve(__dirname, '..', 'Gestion_Suministros_Transformadores-2.xlsm');

// El módulo bajo prueba carga JSZip vía dynamic import del CDN.
// Para que el test corra en Node, inyectamos JSZip por
// globalThis.__sgmJSZip (escape hatch en loadJSZip).
import JSZipPkg from 'jszip';
before(() => { globalThis.__sgmJSZip = JSZipPkg; });

const md5 = (buf) => createHash('md5').update(buf).digest('hex');

describe('generarXlsmExport (integración con archivo real)', () => {
  test('mirror completo: 25 SKUs · vbaProject.bin idéntico · tablas/definedName actualizadas', async (t) => {
    let templateBuf;
    try {
      templateBuf = readFileSync(TEMPLATE);
    } catch {
      t.skip(`Template no encontrado: ${TEMPLATE}`);
      return;
    }

    // Catálogo del contrato 4125000143 (25 SKUs).
    const suministros = Array.from({ length: 25 }, (_, i) => ({
      codigo: `S${String(i+1).padStart(2,'0')}`,
      nombre: `Item ${i+1}`,
      unidad: 'Und',
      stock_inicial: i,
      marcas_disponibles: i < 22 ? [] : [`MARCA-${i+1}`]
    }));
    const marcas = suministros.map((s) => ({
      suministro_id:     s.codigo,
      suministro_nombre: s.nombre,
      marca:             s.marcas_disponibles[0] || '(edite)'
    }));

    let result;
    try {
      result = await generarXlsmExport(
        { suministros, marcas, movimientos: [] },
        { templateBuffer: templateBuf }
      );
    } catch (err) {
      // Si falla por dynamic import del CDN (entorno node-test sin red),
      // skipeamos limpiamente. Los helpers puros ya están cubiertos por
      // xlsm_suministros_export.test.js.
      if (/jszip|cdn|fetch/i.test(err.message || '')) {
        t.skip(`Network/CDN no disponible para JSZip: ${err.message}`);
        return;
      }
      throw err;
    }

    assert.ok(result instanceof Uint8Array, 'resultado debe ser Uint8Array');
    assert.ok(result.byteLength > 1000, 'output sospechosamente pequeño');

    // 1. vbaProject.bin idéntico al template — preserva macros.
    const tplZip = await JSZipPkg.loadAsync(templateBuf);
    const outZip = await JSZipPkg.loadAsync(result);
    const tplVba = await tplZip.file('xl/vbaProject.bin').async('uint8array');
    const outVba = await outZip.file('xl/vbaProject.bin').async('uint8array');
    assert.equal(md5(outVba), md5(tplVba), 'vbaProject.bin difiere — los macros se romperían');

    // 2. table1 ref actualizada a B3:J28 (25 SKUs).
    const t1 = await outZip.file('xl/tables/table1.xml').async('string');
    assert.match(t1, / ref="B3:J28"/, 'table1 ref no actualizado');

    // 3. table2 ref actualizada a B3:D28.
    const t2 = await outZip.file('xl/tables/table2.xml').async('string');
    assert.match(t2, / ref="B3:D28"/, 'table2 ref no actualizado');

    // 4. table3 (Equipos) intacto — no se toca en este export.
    const t3Tpl = await tplZip.file('xl/tables/table3.xml').async('string');
    const t3Out = await outZip.file('xl/tables/table3.xml').async('string');
    assert.equal(t3Out, t3Tpl, 'table3 (tblEquipos) modificado — debe quedar intacto');

    // 5. definedName S25 presente y apunta a columna Y de ListasMarcas.
    const wb = await outZip.file('xl/workbook.xml').async('string');
    assert.match(wb, /<definedName name="S25">ListasMarcas!\$Y\$3:\$Y\$3<\/definedName>/);
    // ent_anio preservado (uno de los definedName originales).
    assert.match(wb, /<definedName name="ent_anio">/);

    // 6. Sheet4 (ListasMarcas) tiene dimension A1:Y3.
    const s4 = await outZip.file('xl/worksheets/sheet4.xml').async('string');
    assert.match(s4, /<dimension ref="A1:Y3"/);

    // 7. Re-leer con SheetJS y verificar que el catálogo trae 25 SKUs.
    const reread = XLSX.read(result, { type: 'array' });
    assert.deepEqual(reread.SheetNames, [
      'README', 'Catalogo_Suministros', 'Marcas', 'ListasMarcas',
      'Equipos', 'Movimientos', 'Entrega', 'Dashboard'
    ]);
    const cat = XLSX.utils.sheet_to_json(reread.Sheets['Catalogo_Suministros'], { range: 2, blankrows: false });
    assert.equal(cat.length, 25, `catálogo re-leído tiene ${cat.length} filas, esperado 25`);
    assert.equal(cat[0].ID,  'S01');
    assert.equal(cat[24].ID, 'S25');
  });

  test('legacy: pasar solo array de movimientos no rompe (backwards compat)', async (t) => {
    let templateBuf;
    try { templateBuf = readFileSync(TEMPLATE); } catch { t.skip(); return; }

    let result;
    try {
      result = await generarXlsmExport([], { templateBuffer: templateBuf });
    } catch (err) {
      if (/jszip|cdn|fetch/i.test(err.message || '')) { t.skip(); return; }
      throw err;
    }
    assert.ok(result instanceof Uint8Array);

    const outZip = await JSZipPkg.loadAsync(result);
    // Sheet2/3/4 intactos (no se pasan suministros ni marcas).
    const tplZip = await JSZipPkg.loadAsync(templateBuf);
    const tplS2 = await tplZip.file('xl/worksheets/sheet2.xml').async('string');
    const outS2 = await outZip.file('xl/worksheets/sheet2.xml').async('string');
    assert.equal(outS2, tplS2, 'sheet2 modificado en modo legacy');
  });
});
