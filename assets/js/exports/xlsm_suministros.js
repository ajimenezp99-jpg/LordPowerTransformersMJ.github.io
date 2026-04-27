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

// ── Catálogo de Suministros (Sheet2) ─────────────────────────────
// Estilos por columna inferidos del template (fila 4 placeholder):
//   B = ID         s=7  (sharedString → reemplazamos por inlineStr)
//   C = Nombre     s=8  (idem)
//   D = Unidad     s=7
//   E = Stock_Ini  s=9  (número)
//   F = SUMIFS Ingresos        s=9 (fórmula)
//   G = SUMIFS Egresos         s=9 (fórmula)
//   H = E+F-G                  s=9 (fórmula)
//   I = IF(H<=0,...)           s=7 (fórmula text)
//   J = Marcas                 s=7 (texto)
const SHEET2_STYLES = { B:7, C:8, D:7, E:9, F:9, G:9, H:9, I:7, J:7 };

/**
 * Genera la fila XML de un suministro del catálogo (sheet2).
 * Las fórmulas SUMIFS, stock_actual y alerta se escriben de forma
 * INDIVIDUAL por fila (no shared) — más verboso pero robusto frente
 * a cambios de número de filas. Excel las acepta sin problema.
 */
export function generarFilaCatalogoSuministro(s, rowIdx) {
  const r = rowIdx;
  const codigo = String(s.codigo || '');
  const nombre = String(s.nombre || '');
  const unidad = String(s.unidad || '');
  const stock  = (typeof s.stock_inicial === 'number') ? s.stock_inicial : (parseInt(s.stock_inicial, 10) || 0);
  const marcas = Array.isArray(s.marcas_disponibles) && s.marcas_disponibles.length > 0
                  ? s.marcas_disponibles.join(', ')
                  : '(edite)';
  // Fórmulas — referencian tblMovimientos (table4) con la misma sintaxis
  // del template original. Las funciones quedan vivas: cuando se añadan
  // movimientos en sheet6, los SUMIFS recalculan.
  const fIng = `SUMIFS(tblMovimientos[Cantidad],tblMovimientos[Suministro_ID],$B${r},tblMovimientos[Tipo],"INGRESO")`;
  const fEgr = `SUMIFS(tblMovimientos[Cantidad],tblMovimientos[Suministro_ID],$B${r},tblMovimientos[Tipo],"EGRESO")`;
  const fStk = `$E${r}+$F${r}-$G${r}`;
  const fAlt = `IF($H${r}<=0,"&#128308; SIN STOCK",IF($H${r}<=3,"&#128993; BAJO","&#128994; OK"))`;
  return [
    `<row r="${r}" spans="2:10">`,
      celda('B', r, codigo, SHEET2_STYLES.B),
      celda('C', r, nombre, SHEET2_STYLES.C),
      celda('D', r, unidad, SHEET2_STYLES.D),
      `<c r="E${r}" s="${SHEET2_STYLES.E}"><v>${stock}</v></c>`,
      `<c r="F${r}" s="${SHEET2_STYLES.F}"><f>${fIng}</f><v>0</v></c>`,
      `<c r="G${r}" s="${SHEET2_STYLES.G}"><f>${fEgr}</f><v>0</v></c>`,
      `<c r="H${r}" s="${SHEET2_STYLES.H}"><f>${fStk}</f><v>${stock}</v></c>`,
      // I se escribe como string + fórmula. El valor cacheado se calcula
      // localmente para que la fila se vea bien antes del recálculo.
      (() => {
        const txt = stock <= 0 ? '🔴 SIN STOCK' : (stock <= 3 ? '🟡 BAJO' : '🟢 OK');
        return `<c r="I${r}" s="${SHEET2_STYLES.I}" t="str"><f>${fAlt}</f><v>${escXml(txt)}</v></c>`;
      })(),
      celda('J', r, marcas, SHEET2_STYLES.J),
    `</row>`
  ].join('');
}

/**
 * Reemplaza los rows 4+ de Catalogo_Suministros (sheet2) con un
 * row por suministro. Conserva título (row 2), header (row 3),
 * cols, sheetViews, sheetFormatPr y todo lo demás.
 */
export function parchearSheet2(xmlStr, suministros) {
  const arr = Array.isArray(suministros) ? suministros : [];
  const n = Math.max(1, arr.length);
  const lastRow = 3 + n;

  let out = xmlStr.replace(
    /<dimension\s+ref="[^"]+"/,
    `<dimension ref="B2:J${lastRow}"`
  );

  const sheetDataRe = /(<sheetData>[\s\S]*?<row r="3"[\s\S]*?<\/row>)([\s\S]*?)(<\/sheetData>)/;
  const m = out.match(sheetDataRe);
  if (!m) throw new Error('parchearSheet2: estructura de sheetData no reconocida');
  const headerPart = m[1];
  const closing    = m[3];

  let newRows;
  if (arr.length === 0) {
    // Mantén una fila placeholder vacía para que la tabla siga viva.
    newRows = `<row r="4" spans="2:10">${
      ['B','C','D','E','F','G','H','I','J'].map((c) => celda(c, 4, '', SHEET2_STYLES[c])).join('')
    }</row>`;
  } else {
    newRows = arr.map((s, i) => generarFilaCatalogoSuministro(s, 4 + i)).join('');
  }
  return out.replace(sheetDataRe, `${headerPart}${newRows}${closing}`);
}

// ── Marcas (Sheet3) ──────────────────────────────────────────────
// Estilos por columna inferidos del template (fila 4 placeholder):
//   B = ID_Suministro     s=11 (text)
//   C = Nombre_Suministro s=12 (text)
//   D = Marca             s=11 (text)
const SHEET3_STYLES = { B: 11, C: 12, D: 11 };

/**
 * Genera la fila XML de un par (suministro, marca) para sheet3.
 * Cada par sale como una fila independiente — si un suministro
 * tiene N marcas, son N filas con el mismo B y C.
 */
export function generarFilaMarca(m, rowIdx) {
  const r = rowIdx;
  return [
    `<row r="${r}" spans="2:4">`,
      celda('B', r, m.suministro_id || '',     SHEET3_STYLES.B),
      celda('C', r, m.suministro_nombre || '', SHEET3_STYLES.C),
      celda('D', r, m.marca || '(edite)',      SHEET3_STYLES.D),
    `</row>`
  ].join('');
}

/**
 * Reemplaza los rows 4+ de Marcas (sheet3) con un row por marca.
 * Conserva título (row 2), header (row 3) y resto del worksheet.
 *
 * Si un suministro no tiene marca persistible (caso "(edite)"), el
 * caller decide: o pasa una entry con marca='(edite)' para mantener
 * el slot, o lo omite. Recomendado: pasar el catálogo COMPLETO con
 * "(edite)" como fallback para preservar paralelismo 1:1 con sheet2.
 */
export function parchearSheet3(xmlStr, marcas) {
  const arr = Array.isArray(marcas) ? marcas : [];
  const n = Math.max(1, arr.length);
  const lastRow = 3 + n;

  let out = xmlStr.replace(
    /<dimension\s+ref="[^"]+"/,
    `<dimension ref="B2:D${lastRow}"`
  );

  const sheetDataRe = /(<sheetData>[\s\S]*?<row r="3"[\s\S]*?<\/row>)([\s\S]*?)(<\/sheetData>)/;
  const m = out.match(sheetDataRe);
  if (!m) throw new Error('parchearSheet3: estructura de sheetData no reconocida');
  const headerPart = m[1];
  const closing    = m[3];

  let newRows;
  if (arr.length === 0) {
    newRows = `<row r="4" spans="2:4">${
      ['B','C','D'].map((c) => celda(c, 4, '', SHEET3_STYLES[c])).join('')
    }</row>`;
  } else {
    newRows = arr.map((m, i) => generarFilaMarca(m, 4 + i)).join('');
  }
  return out.replace(sheetDataRe, `${headerPart}${newRows}${closing}`);
}

// ── ListasMarcas (Sheet4, hidden) ────────────────────────────────
// Hoja oculta que sirve de fuente para el data validation
// (dropdowns) de la columna Marca en sheet3. Layout estable:
//   Row 1 = ID  (Sxx)         — bold (s=13)
//   Row 2 = Nombre largo
//   Row 3 = Marca actual      — los definedName Sxx apuntan a $row3
// Una columna por suministro (A=S01, B=S02, …, Y=S25 si 25 SKUs).
//
// Importante: los definedName en workbook.xml apuntan SIEMPRE a la
// fila 3, así que esa fila debe poblarse con la marca "principal"
// del suministro (cuando hay marcas_disponibles, se toma la primera;
// cuando no hay, "(edite)" como placeholder).
const SHEET4_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M',
                        'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

/** Helper: índice 0-based → letra de columna A..Z (luego AA..). */
export function colLetter(idx) {
  if (idx < 0) throw new Error('colLetter: índice negativo');
  if (idx < 26) return SHEET4_LETTERS[idx];
  // 26+ → AA, AB, … (no esperado para ListasMarcas pero ok defensivo)
  const hi = Math.floor(idx / 26) - 1;
  const lo = idx % 26;
  return SHEET4_LETTERS[hi] + SHEET4_LETTERS[lo];
}

/**
 * Reemplaza completamente sheetData de ListasMarcas con el layout
 * canónico de 3 filas × n cols. Conserva sheetPr, sheetViews,
 * sheetFormatPr, pageMargins (todo lo que no es sheetData).
 *
 * @param {string}   xmlStr
 * @param {Array<{codigo,nombre,marcas_disponibles?}>} suministros
 *        Lista ordenada como el catálogo (S01, S02, …).
 */
export function parchearSheet4(xmlStr, suministros) {
  const arr = Array.isArray(suministros) ? suministros : [];
  if (arr.length === 0) {
    // Caso defensivo: si no hay suministros, deja sheetData vacío
    // pero válido (Excel acepta). dimension = A1:A1.
    let out = xmlStr.replace(/<dimension\s+ref="[^"]+"/, `<dimension ref="A1:A1"/>`);
    out = out.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData/>');
    return out;
  }
  const lastCol = colLetter(arr.length - 1);

  let out = xmlStr.replace(
    /<dimension\s+ref="[^"]+"/,
    `<dimension ref="A1:${lastCol}3"`
  );

  // Construye 3 filas × n cells.
  const r1Cells = arr.map((s, i) => {
    const c = colLetter(i);
    return `<c r="${c}1" s="13" t="inlineStr"><is><t xml:space="preserve">${escXml(s.codigo || '')}</t></is></c>`;
  }).join('');
  const r2Cells = arr.map((s, i) => {
    const c = colLetter(i);
    return `<c r="${c}2" t="inlineStr"><is><t xml:space="preserve">${escXml(s.nombre || '')}</t></is></c>`;
  }).join('');
  const r3Cells = arr.map((s, i) => {
    const c = colLetter(i);
    const marca = (Array.isArray(s.marcas_disponibles) && s.marcas_disponibles.length > 0)
                  ? s.marcas_disponibles[0]
                  : '(edite)';
    return `<c r="${c}3" t="inlineStr"><is><t xml:space="preserve">${escXml(marca)}</t></is></c>`;
  }).join('');

  const newSheetData =
    `<sheetData>` +
      `<row r="1" spans="1:${arr.length}">${r1Cells}</row>` +
      `<row r="2" spans="1:${arr.length}">${r2Cells}</row>` +
      `<row r="3" spans="1:${arr.length}">${r3Cells}</row>` +
    `</sheetData>`;

  out = out.replace(/<sheetData>[\s\S]*?<\/sheetData>/, newSheetData);
  return out;
}

// ── workbook.xml · definedName Sxx ───────────────────────────────
// Cada Sxx en sheet3 tiene un dropdown alimentado por
// definedName "Sxx" → ListasMarcas!${col}$3:${col}$3. El template
// trae 22 (S01..S22). Si el catálogo crece a S23+, hay que añadir
// los nuevos definedName apuntando a las columnas extendidas de
// sheet4 (W$3, X$3, Y$3, …).

/**
 * Reescribe el bloque <definedNames>…</definedNames> de workbook.xml
 * para que existan definedName Sxx para CADA suministro del catálogo
 * provisto. Conserva todos los demás definedName (ent_*, flt_*, etc.)
 * exactamente como vienen.
 *
 * Estrategia: parser regex acotado; modifica solo el subárbol de
 * definedNames sin tocar fileVersion, sheets, calcPr, extLst, etc.
 *
 * @param {string} xmlStr — contenido de xl/workbook.xml.
 * @param {Array<{codigo:string}>} suministros — orden establece la
 *        columna de ListasMarcas (idx 0 → A, 24 → Y, …).
 */
export function parchearWorkbookXml(xmlStr, suministros) {
  const arr = Array.isArray(suministros) ? suministros : [];
  if (arr.length === 0) return xmlStr;

  // 1. Parse del bloque definedNames existente.
  const dnRe = /<definedNames>([\s\S]*?)<\/definedNames>/;
  const m = xmlStr.match(dnRe);
  if (!m) {
    // Workbook sin <definedNames>: añadirlo después de <sheets>.
    const sxxs = arr.map((s, i) => buildDefinedNameSxx(s.codigo, i)).join('');
    const block = `<definedNames>${sxxs}</definedNames>`;
    return xmlStr.replace(/<\/sheets>/, `</sheets>${block}`);
  }
  const inner = m[1];

  // 2. Filtra los Sxx existentes (los reescribiremos en bloque); deja
  //    todos los demás definedName intactos.
  const otros = inner.replace(/<definedName\s+name="S\d{2}">[^<]*<\/definedName>/g, '');

  // 3. Construye los Sxx nuevos según el catálogo provisto.
  const sxxs = arr.map((s, i) => buildDefinedNameSxx(s.codigo, i)).join('');

  // 4. Reensambla — Sxx al final para mantener el orden visual del
  //    template (ent_* + flt_* + Sxx).
  const newInner = otros + sxxs;
  return xmlStr.replace(dnRe, `<definedNames>${newInner}</definedNames>`);
}

function buildDefinedNameSxx(codigo, idx) {
  const c = String(codigo || '');
  if (!/^S\d{2}$/.test(c)) return '';
  const col = colLetter(idx);
  return `<definedName name="${c}">ListasMarcas!$${col}$3:$${col}$3</definedName>`;
}

/**
 * Actualiza el ref de tblSuministros (table1) cuando cambia el
 * número de filas del catálogo en sheet2.
 * Antes: ref="B3:J25" autoFilter ref="B3:J25"
 * Después: ref="B3:J{3+max(n,1)}" en ambos.
 */
export function parchearTable1(xmlStr, nSuministros) {
  const n = Math.max(1, nSuministros);
  const lastRow = 3 + n;
  const newRef = `B3:J${lastRow}`;
  return xmlStr.replace(/(\sref=")B3:J\d+(")/g, `$1${newRef}$2`);
}

/**
 * Actualiza el ref de tblMarcas (table2) cuando cambia el
 * número de filas en sheet3.
 * Antes: ref="B3:D25" autoFilter ref="B3:D25"
 * Después: ref="B3:D{3+max(n,1)}".
 */
export function parchearTable2(xmlStr, nMarcas) {
  const n = Math.max(1, nMarcas);
  const lastRow = 3 + n;
  const newRef = `B3:D${lastRow}`;
  return xmlStr.replace(/(\sref=")B3:D\d+(")/g, `$1${newRef}$2`);
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
