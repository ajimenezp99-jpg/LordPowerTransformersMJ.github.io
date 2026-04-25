// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Exports: XLSM Suministros (Fase 49)
// ──────────────────────────────────────────────────────────────
// Genera un .xlsm idéntico al template fuente (preserva VBA,
// Office Add-in, charts, formato condicional, themes y estilos)
// con los movimientos vivos inyectados en la hoja Movimientos.
//
// Estrategia: JSZip + parche XML quirúrgico.
//   · Cargamos el template como zip en memoria.
//   · Patcheamos sólo:
//       - xl/worksheets/sheet6.xml  (rows nuevos en sheetData)
//       - xl/tables/table4.xml      (ref actualizada)
//   · vbaProject.bin, webextensions/, charts/, theme/, sharedStrings,
//     styles y demás hojas no se tocan jamás.
//   · Recomprimimos. El resultado abre en Excel con macros operativas.
// ══════════════════════════════════════════════════════════════

// JSZip se importa dinámicamente dentro de generarXlsmExport()
// para que los helpers puros (parchearSheet6, parchearTable4,
// generarFilaMovimiento) sean testeables en Node sin la dependencia
// HTTPS del CDN.
async function loadJSZip() {
  const mod = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
  return mod.default || mod;
}

// Resuelve el path al template relativo a esta página.
function templateUrl() {
  // Este módulo se importa desde admin/*.html, por lo que el
  // template (en /assets/templates/) está accesible vía ../assets/templates/.
  return '../assets/templates/Gestion_Suministros_Transformadores-2.xlsm';
}

// Columnas oficiales de tblMovimientos (Sheet6 fila 4):
//   B Año · C Movimiento_ID · D Equipo_ID · E Equipo_Descripcion
//   F Zona · G Departamento · H Subestacion · I Matricula
//   J Suministro_ID · K Suministro_Nombre · L Marca · M Cantidad
//   N Tipo · O Usuario · P Observaciones · Q ODT
const COL_LETTERS = ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q'];

// Estilos por columna inferidos de la fila placeholder del template.
// Mantienen el formato visual (bordes, alineación, tipos numéricos).
const COL_STYLES  = {
  B: 38, C: 7, D: 7, E: 7, F: 7, G: 7, H: 7, I: 7,
  J: 7, K: 7, L: 7,
  M: 9,         // Cantidad — formato número
  N: 7, O: 7,
  P: 64,        // Observaciones — estilo extendido
  Q: 65         // ODT — estilo extendido
};

function escXml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
  }[c]));
}

/**
 * Genera una celda XML usando inline string para evitar tocar
 * sharedStrings.xml. Los números van como inline string también
 * por simplicidad — Excel reconvierte si la celda tiene formato
 * numérico (estilo s=9 o equivalente).
 */
function celda(col, row, valor, style) {
  if (valor == null || valor === '') {
    return `<c r="${col}${row}" s="${style}"/>`;
  }
  // Número en celdas con estilo numérico (M = Cantidad)
  if (col === 'M' && typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${col}${row}" s="${style}"><v>${valor}</v></c>`;
  }
  return `<c r="${col}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escXml(valor)}</t></is></c>`;
}

/**
 * Genera la fila XML completa de un movimiento.
 */
export function generarFilaMovimiento(mov, rowIdx) {
  const row = rowIdx;
  const valores = {
    B: mov.anio,
    C: mov.codigo,
    D: mov.transformador_id,
    E: mov.subestacion,           // Equipo_Descripcion
    F: mov.zona,
    G: mov.departamento,
    H: mov.subestacion,
    I: mov.matricula,
    J: mov.suministro_id,
    K: mov.suministro_nombre,
    L: mov.marca,
    M: typeof mov.cantidad === 'number' ? mov.cantidad : (parseInt(mov.cantidad, 10) || 0),
    N: mov.tipo,
    O: mov.usuario,
    P: mov.observaciones,
    Q: mov.odt
  };
  const cells = COL_LETTERS.map((col) => celda(col, row, valores[col], COL_STYLES[col])).join('');
  return `<row r="${row}" spans="2:17">${cells}</row>`;
}

/**
 * Reemplaza el bloque <sheetData>...</sheetData> de la hoja
 * Movimientos por uno nuevo que conserva título (row 2),
 * subtítulo (row 3), header (row 4) y añade N filas con los
 * movimientos. Si N=0, deja una fila placeholder vacía como
 * el template original.
 *
 * También actualiza el atributo `dimension` para reflejar el
 * nuevo último row.
 */
export function parchearSheet6(xmlStr, movimientos) {
  const n = Math.max(1, movimientos.length);  // fila placeholder mínima
  const lastRow = 4 + n;

  // 1. Actualizar <dimension ref="..."/>
  let out = xmlStr.replace(
    /<dimension\s+ref="[^"]+"/,
    `<dimension ref="B2:Q${lastRow}"`
  );

  // 2. Encontrar header (row 4) y conservarlo. Reemplazar todo lo
  //    que viene después (rows 5+) con las filas nuevas.
  const sheetDataRe = /(<sheetData>[\s\S]*?<row r="4"[\s\S]*?<\/row>)([\s\S]*?)(<\/sheetData>)/;
  const match = out.match(sheetDataRe);
  if (!match) {
    throw new Error('parchearSheet6: estructura de sheetData no reconocida');
  }
  const headerPart = match[1];
  const closing    = match[3];

  let newRows;
  if (movimientos.length === 0) {
    // Conservar la fila placeholder original para mantener tabla viva.
    newRows = `<row r="5" spans="2:17">${
      COL_LETTERS.map((col) => celda(col, 5, '', COL_STYLES[col])).join('')
    }</row>`;
  } else {
    newRows = movimientos.map((m, i) => generarFilaMovimiento(m, 5 + i)).join('');
  }

  out = out.replace(sheetDataRe, `${headerPart}${newRows}${closing}`);
  return out;
}

/**
 * Actualiza el ref de tblMovimientos en table4.xml.
 * Antes: ref="B4:Q5" autoFilter ref="B4:Q5"
 * Después: ref="B4:Q{4+max(n,1)}" en ambos.
 */
export function parchearTable4(xmlStr, nMovimientos) {
  const n = Math.max(1, nMovimientos);
  const lastRow = 4 + n;
  const newRef = `B4:Q${lastRow}`;
  return xmlStr
    .replace(/(\sref=")B4:Q\d+(")/g, `$1${newRef}$2`);
}

/**
 * Genera el .xlsm con los movimientos inyectados.
 *
 * @param {Array} movimientos — array de docs /movimientos.
 * @param {{templateBuffer?: ArrayBuffer}} [opts]
 * @returns {Promise<Uint8Array>}
 */
export async function generarXlsmExport(movimientos, opts = {}) {
  // 1. Cargar template (caller puede pasar buffer pre-cargado para tests).
  let buf = opts.templateBuffer;
  if (!buf) {
    const res = await fetch(templateUrl());
    if (!res.ok) throw new Error(`No se pudo cargar el template (${res.status} ${res.statusText})`);
    buf = await res.arrayBuffer();
  }

  // 2. Abrir como zip (JSZip lazy-loaded).
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(buf);

  // 3. Parchear sheet6 (Movimientos).
  const sheet6File = zip.file('xl/worksheets/sheet6.xml');
  if (!sheet6File) throw new Error('Template inválido: falta xl/worksheets/sheet6.xml');
  const sheet6Xml = await sheet6File.async('string');
  const sheet6New = parchearSheet6(sheet6Xml, movimientos || []);
  zip.file('xl/worksheets/sheet6.xml', sheet6New);

  // 4. Parchear table4 (tblMovimientos ref).
  const table4File = zip.file('xl/tables/table4.xml');
  if (!table4File) throw new Error('Template inválido: falta xl/tables/table4.xml');
  const table4Xml = await table4File.async('string');
  const table4New = parchearTable4(table4Xml, (movimientos || []).length);
  zip.file('xl/tables/table4.xml', table4New);

  // 5. NO tocamos: vbaProject.bin, webextensions/*, charts/*, theme/*,
  //    sharedStrings, styles, las otras 7 hojas, drawings, calcChain.
  //    Excel los conserva intactos al abrir.

  // 6. Generar blob.
  return await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12'
  });
}

/**
 * Helper de descarga del lado cliente.
 */
export function descargarXlsm(uint8, filename) {
  const blob = new Blob([uint8], {
    type: 'application/vnd.ms-excel.sheet.macroEnabled.12'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `SGM-Suministros-${new Date().toISOString().slice(0,10)}.xlsm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
