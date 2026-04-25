// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: importador suministros (Fase 42)
// ──────────────────────────────────────────────────────────────
// Parser puro (cero I/O Firebase, cero SheetJS aquí — los rows
// del .xlsm los extrae el data layer y los pasa ya tipados).
//
// Fuentes:
//   · .xlsm Sheet2 "Catalogo_Suministros" → /suministros (22 docs)
//   · .xlsm Sheet3 "Marcas"               → /marcas (22 docs) +
//                                            sync marcas_disponibles
//   · JSX TRANSFORMADORES                  → /transformadores (206)
//                                            (decisión 2·A: JSX gana)
//   · JSX correcciones hardcoded           → /correcciones (3 docs)
// ══════════════════════════════════════════════════════════════

import {
  sanitizarSuministro, validarSuministro
} from './suministro_schema.js';
import {
  sanitizarMarca, validarMarca
} from './marca_schema.js';
import {
  sanitizarCorreccion
} from './correccion_schema.js';
import {
  sanitizarTransformador, proyeccionV1
} from './transformador_schema.js';
import { UNIDADES, enValores } from './schema.js';

// ── Helpers internos ───────────────────────────────────────────
const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  // SheetJS con `raw:false` devuelve strings con comas/espacios.
  const cleaned = typeof v === 'string' ? v.replace(/[\s,]/g, '') : v;
  const n = +cleaned;
  return Number.isFinite(n) ? n : null;
};

/**
 * Normaliza encabezados del .xlsm a las keys canónicas del schema.
 * SheetJS usa los textos de la fila 1 (o el `header` row) como keys
 * del objeto. Los encabezados oficiales de F40 (.xlsm fuente) son:
 *   Sheet2: ID | Nombre | Unidad | Stock_Inicial | Total_Ingresado
 *           | Total_Egresado | Stock_Actual | Alerta | Marcas_Disponibles
 *   Sheet3: ID_Suministro | Nombre_Suministro | Marca
 *   Sheet5: Equipo_ID | Descripcion | Zona | Departamento |
 *           Subestacion | Matricula | Potencia_KVA | Grupo | Display
 */
function pickKey(row, ...candidatos) {
  for (const k of candidatos) {
    if (row[k] != null && row[k] !== '') return row[k];
  }
  return undefined;
}

// ── 1. Parser de Sheet2 (Catalogo_Suministros) ─────────────────
export function parsearCatalogoRows(rows) {
  const out = [];
  const errores = [];
  if (!Array.isArray(rows)) return { suministros: out, errores: ['rows no es array'] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const codigo = str(pickKey(r, 'ID', 'Id', 'id', 'Codigo', 'codigo'));
    if (!codigo) continue;  // fila vacía o totalsRow
    if (!/^S\d{2}$/i.test(codigo)) continue;  // header residual o totals
    const nombre = str(pickKey(r, 'Nombre', 'nombre', 'Descripcion', 'desc'));
    const unidadRaw = str(pickKey(r, 'Unidad', 'unidad', 'Unid', 'unid'));
    // Normalización de unidades comunes del fuente al enum F38.
    const unidadNorm = normalizarUnidad(unidadRaw);
    const stockInicial = num(pickKey(r, 'Stock_Inicial', 'StockInicial', 'stock_inicial', 'stock'));
    const valorUnit = num(pickKey(r, 'Valor_Unitario', 'ValorUnit', 'valU', 'valor_unitario'));
    const sane = sanitizarSuministro({
      codigo: codigo.toUpperCase(),
      nombre,
      unidad: unidadNorm,
      stock_inicial: stockInicial == null ? 0 : stockInicial,
      valor_unitario: valorUnit == null ? 0 : valorUnit
    });
    const errs = validarSuministro(sane);
    if (errs.length > 0) {
      errores.push({ fila: i + 2, codigo: sane.codigo, errores: errs });
      continue;
    }
    out.push(sane);
  }
  return { suministros: out, errores };
}

function normalizarUnidad(raw) {
  const u = str(raw);
  if (!u) return 'Und';
  const upper = u.toUpperCase();
  // Mapeo de variantes comunes al enum oficial.
  if (['UND', 'UN', 'U', 'UNIDAD', 'UNIDADES'].includes(upper)) return 'Und';
  if (['LT', 'L', 'LITRO', 'LITROS'].includes(upper))           return 'Lt';
  if (['KG', 'K', 'KILO', 'KILOS'].includes(upper))             return 'Kg';
  if (['M', 'MT', 'MTS', 'METRO', 'METROS'].includes(upper))    return 'Mt';
  if (['GAL', 'GALON', 'GALONES'].includes(upper))              return 'Gal';
  return enValores(UNIDADES, u) ? u : 'Otro';
}

// ── 2. Parser de Sheet3 (Marcas) ───────────────────────────────
export function parsearMarcasRows(rows) {
  const out = [];
  const errores = [];
  if (!Array.isArray(rows)) return { marcas: out, errores: ['rows no es array'] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const sumId = str(pickKey(r, 'ID_Suministro', 'id_suministro', 'IDSuministro', 'suministro_id'));
    if (!sumId || !/^S\d{2}$/i.test(sumId)) continue;
    const sane = sanitizarMarca({
      suministro_id:     sumId.toUpperCase(),
      suministro_nombre: str(pickKey(r, 'Nombre_Suministro', 'nombre_suministro', 'NombreSuministro')),
      marca:             str(pickKey(r, 'Marca', 'marca'))
    });
    const errs = validarMarca(sane);
    if (errs.length > 0) {
      errores.push({ fila: i + 2, suministro_id: sane.suministro_id, errores: errs });
      continue;
    }
    // Skip placeholders del .xlsm fuente — el item del catálogo
    // queda sin marca persistible hasta que el director edite.
    const placeholders = ['POR DEFINIR', '(EDITE)', 'EDITE', '—', '-'];
    if (placeholders.includes(sane.marca.toUpperCase())) continue;
    out.push(sane);
  }
  return { marcas: out, errores };
}

// ── 3. Parser del JSX (TRANSFORMADORES + correcciones) ──────────
/**
 * Extrae el array TRANSFORMADORES del texto del JSX usando regex
 * + JSON.parse con quoting fix. CERO eval / Function — superficie
 * de ataque innecesaria. Lanza si el formato no es reconocible.
 */
export function parsearJsxTransformadores(jsxText) {
  if (typeof jsxText !== 'string' || jsxText.length === 0) {
    throw new Error('parsearJsxTransformadores: input vacío.');
  }
  // Regex permisivo: matchea desde `[` hasta el primer `];` (con
  // posible whitespace/comma entre ellos). Soporta:
  //   · trailing comma en el último elemento (`...},\n];`)
  //   · indentación variable (`  ];`)
  //   · contenido en una o varias líneas
  const m = jsxText.match(/const\s+TRANSFORMADORES\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!m) throw new Error('parsearJsxTransformadores: no se encontró el array TRANSFORMADORES.');
  const literal = m[1];
  // El literal usa shorthand keys (`m:`, `sub:`, etc.) que no son
  // JSON válido. Lo convertimos:
  //   1. Las keys sin comillas (shorthand) → con comillas dobles.
  //   2. Trailing commas (las hay tras }) → quitar.
  //   3. `null` queda como está (válido en JSON).
  let normalized = literal
    .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[\]}])/g, '$1');
  let arr;
  try { arr = JSON.parse(normalized); } catch (err) {
    throw new Error('parsearJsxTransformadores: no es JSON válido tras normalización: ' + err.message);
  }
  if (!Array.isArray(arr)) throw new Error('parsearJsxTransformadores: el bloque no es un array.');
  return arr;
}

/**
 * Extrae el array CATALOGO del JSX (22 items con CAT-XX + valU + marca).
 * Mismo enfoque seguro que parsearJsxTransformadores: regex + JSON.parse.
 *
 * El .xlsm Sheet2 trae S01-S22 + stock_inicial pero NO el valor unitario.
 * El JSX CATALOGO sí lo trae. Se asume mismo orden (CAT-01 ↔ S01) para
 * hacer merge por posición en `enriquecerCatalogoConJsx`.
 */
export function parsearJsxCatalogo(jsxText) {
  if (typeof jsxText !== 'string' || jsxText.length === 0) {
    throw new Error('parsearJsxCatalogo: input vacío.');
  }
  const m = jsxText.match(/const\s+CATALOGO\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!m) throw new Error('parsearJsxCatalogo: no se encontró el array CATALOGO.');
  let normalized = m[1]
    .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[\]}])/g, '$1');
  let arr;
  try { arr = JSON.parse(normalized); } catch (err) {
    throw new Error('parsearJsxCatalogo: no es JSON válido tras normalización: ' + err.message);
  }
  if (!Array.isArray(arr)) throw new Error('parsearJsxCatalogo: el bloque no es un array.');
  return arr;
}

/**
 * Enriquece los suministros parseados desde el .xlsm con el
 * valor_unitario que vive en el JSX CATALOGO. Merge por posición:
 * catalogoXlsm[i] ← catalogoJsx[i].valU. Asume mismo orden 1-22.
 *
 * Si las longitudes difieren, completa lo que pueda y retorna el
 * resto sin enriquecer (el director ve valor_unitario=0 y puede
 * ajustarlo manualmente desde admin/catalogo).
 */
export function enriquecerCatalogoConJsx(catalogoXlsm, catalogoJsx) {
  if (!Array.isArray(catalogoXlsm) || !Array.isArray(catalogoJsx)) return catalogoXlsm || [];
  return catalogoXlsm.map((s, i) => {
    const jsxItem = catalogoJsx[i];
    if (!jsxItem) return s;
    const valU = num(jsxItem.valU);
    return {
      ...s,
      valor_unitario: (valU != null && valU >= 0) ? valU : s.valor_unitario
    };
  });
}

/**
 * Convierte una entrada JSX (formato compacto) al docV2 normalizado.
 * Mapping CORREGIDO de keys del JSX → secciones v2:
 *   m    → identificacion.matricula (matrícula operativa, ej. T1A-A/M-BYC)
 *   cod  → identificacion.codigo (código administrativo numérico, ej. 20016689)
 *   sub  → identificacion.nombre + ubicacion.subestacion_nombre
 *          (denominación humana del trafo = nombre de la subestación)
 *   zona → ubicacion.zona
 *   dep  → ubicacion.departamento (lowercase)
 *   ser  → placa.serial
 *   pot  → placa.potencia_kva
 *   gr   → identificacion.grupo
 *   rt   → refrigeracion.tipo_refrigeracion
 *   re   → repuesto.estado (sub-section F41)
 *   reg  → electrico.tipo_tap (NLTC/OLTC)
 *   vp/vs/vt → electrico.tension_primaria/secundaria/terciaria_kv
 *   uu   → identificacion.uucc
 *
 * Si `cod` viene null/vacío en el JSX (1 caso conocido: LA SALVACION),
 * se usa la matrícula como fallback para el codigo — no se inventa nada,
 * pero se garantiza que el doc tenga PK no vacía. La matrícula sigue
 * disponible siempre en `identificacion.matricula` para reconciliación.
 *
 * El sanitizador F41 toma `re` plano y lo eleva a `repuesto.estado`.
 */
export function jsxRowADocV2(jsxRow) {
  const r = jsxRow || {};
  const matricula  = str(r.m);
  const subestacion = str(r.sub);
  // cod puede venir como número, string o null. Stringify y fallback.
  const codigoAdmin = (r.cod != null && r.cod !== '') ? String(r.cod) : matricula;
  const docV2 = sanitizarTransformador({
    identificacion: {
      codigo: codigoAdmin,                    // código administrativo numérico (cod del JSX)
      matricula: matricula,                   // matrícula operativa (m del JSX)
      nombre: subestacion || matricula,       // nombre = subestación; fallback a matrícula
      tipo_activo: 'POTENCIA',
      grupo: str(r.gr),
      uucc:  str(r.uu)
    },
    placa: {
      potencia_kva: num(r.pot),
      marca:        '',
      modelo:       '',
      serial:       str(r.ser)
    },
    ubicacion: {
      departamento:        str(r.dep).toLowerCase(),
      zona:                str(r.zona).toUpperCase(),
      subestacion_nombre:  subestacion
    },
    electrico: {
      tension_primaria_kv:   num(r.vp),
      tension_secundaria_kv: num(r.vs),
      tension_terciaria_kv:  num(r.vt),
      tipo_tap:              str(r.reg)
    },
    refrigeracion: {
      tipo_refrigeracion: str(r.rt)
    },
    estado_servicio: 'operativo',
    re: r.re
  });
  return { ...docV2, ...proyeccionV1(docV2) };
}

// ── 4. Correcciones embebidas en el JSX ────────────────────────
/**
 * Las 3 correcciones que el JSX (vista `correcciones` original)
 * lista hardcoded sobre el documento fuente del parque. Devuelve
 * docs listos para insertar en /correcciones.
 *
 * Estas son verdades del director: matrículas duplicadas, tensiones
 * mal capturadas, regulación inferida. Se inyectan SIEMPRE en cada
 * importación con `numero=1,2,3` para que la traceability sea consistente.
 */
export function extraerCorreccionesEmbedded() {
  return [
    sanitizarCorreccion({
      numero: 1,
      tipo: 'matricula',
      ubicacion: 'control_suministros-2.jsx#TRANSFORMADORES',
      valor_original: 'Matrículas duplicadas en parque BOLIVAR',
      valor_corregido: 'Reasignación según criterio operativo del director',
      justificacion: 'Reasignación autorizada por el director para deduplicar matrícula en zona BOLIVAR',
      fuente: 'control_suministros-2.jsx'
    }),
    sanitizarCorreccion({
      numero: 2,
      tipo: 'tension',
      ubicacion: 'control_suministros-2.jsx#TRANSFORMADORES',
      valor_original: 'Tensiones primarias/secundarias inconsistentes en algunos registros',
      valor_corregido: 'Normalización a vp/vs/vt según placa real',
      justificacion: 'Tensiones inferidas a partir del UUCC y verificadas en sitio',
      fuente: 'control_suministros-2.jsx'
    }),
    sanitizarCorreccion({
      numero: 3,
      tipo: 'regulacion',
      ubicacion: 'control_suministros-2.jsx#TRANSFORMADORES',
      valor_original: 'Regulación NLTC/OLTC ambigua en parque mixto',
      valor_corregido: 'Asignada según ficha técnica',
      justificacion: 'Regulación clasificada según ficha técnica del fabricante',
      fuente: 'control_suministros-2.jsx'
    })
  ];
}

// ── 5. Reconciliación XLSM Sheet5 ↔ JSX TRANSFORMADORES ────────
/**
 * Decisión 2·A: el JSX gana en conflictos. Esta función fusiona
 * los dos orígenes por `matricula`:
 *   · matricula presente en JSX → se usa el JSX (autoritativo).
 *   · matricula presente solo en XLSM → se mantiene del XLSM.
 *   · marcas que aparecen en ambos → JSX, conflicto reportado.
 */
export function reconciliarEquipos(equiposXlsm, equiposJsx) {
  const porMatricula = new Map();
  const conflictos = [];
  // Helper: extrae matrícula del shape v2 o de variantes legacy.
  const extractMat = (e) => str(
    (e.identificacion && e.identificacion.matricula) ||
    e.matricula ||
    (e.identificacion && e.identificacion.codigo) ||
    e.codigo || ''
  ).toUpperCase();
  if (Array.isArray(equiposXlsm)) {
    for (const e of equiposXlsm) {
      const k = extractMat(e);
      if (k) porMatricula.set(k, { ...e, _origen: 'xlsm' });
    }
  }
  if (Array.isArray(equiposJsx)) {
    for (const e of equiposJsx) {
      const k = extractMat(e);
      if (!k) continue;
      if (porMatricula.has(k)) conflictos.push(k);
      porMatricula.set(k, { ...e, _origen: 'jsx' });
    }
  }
  return { equipos: Array.from(porMatricula.values()), conflictos };
}

// ── 6. Plan de importación ─────────────────────────────────────
/**
 * Genera el plan que el data layer ejecuta. Idempotente: re-ejecutar
 * con los mismos inputs produce el mismo plan.
 *
 * Args:
 *   parsed        — { suministros, marcas, transformadores, correcciones }
 *   existentes    — { suministrosIds: Set, marcasKeys: Set,
 *                     transformadoresPorMatricula: Map }
 *
 * Returns:
 *   {
 *     suministros: { crear: [...], actualizar: [...], skip: [] },
 *     marcas:      { crear: [...], skip: [] },
 *     transformadores: { crear: [...], actualizar: [...], skip: [] },
 *     correcciones: { crear: [...], skip: [] },
 *     resumen: { ... }
 *   }
 */
export function prepararPlanImportacion(parsed, existentes) {
  const ex = existentes || {};
  const exSumIds = ex.suministrosIds instanceof Set ? ex.suministrosIds : new Set();
  const exMarKeys = ex.marcasKeys instanceof Set ? ex.marcasKeys : new Set();
  const exTrafos = ex.transformadoresPorMatricula instanceof Map
    ? ex.transformadoresPorMatricula
    : new Map();

  const sumCrear = [], sumActualizar = [];
  for (const s of (parsed.suministros || [])) {
    if (exSumIds.has(s.codigo)) sumActualizar.push(s);
    else sumCrear.push(s);
  }

  const marCrear = [];
  for (const m of (parsed.marcas || [])) {
    const k = `${m.suministro_id}::${m.marca}`;
    if (!exMarKeys.has(k)) marCrear.push(m);
  }

  const trafoCrear = [], trafoActualizar = [];
  for (const t of (parsed.transformadores || [])) {
    const matricula = String(
      (t.identificacion && t.identificacion.matricula) ||
      t.matricula ||
      (t.identificacion && t.identificacion.codigo) ||
      t.codigo || ''
    ).toUpperCase();
    const docId = exTrafos.get(matricula);
    if (docId) trafoActualizar.push({ ...t, _existingId: docId });
    else trafoCrear.push(t);
  }

  // Correcciones: se crean siempre las 3; si ya existen por (numero, fuente)
  // se considera idempotente y se skipean. La validación fina se hace en data layer.
  const corCrear = [...(parsed.correcciones || [])];

  // Huérfanos: existentes en Firestore que no aparecen en el plan.
  // Se reportan en summary; NO se eliminan (decisión 2·A no autoriza DELETE).
  const sumIdsPlan = new Set((parsed.suministros || []).map((s) => s.codigo));
  const sumHuerfanos = [...exSumIds].filter((id) => !sumIdsPlan.has(id));
  const trafoMatriculasPlan = new Set(
    (parsed.transformadores || []).map((t) => String(
      (t.identificacion && t.identificacion.matricula) ||
      t.matricula ||
      (t.identificacion && t.identificacion.codigo) ||
      t.codigo || ''
    ).toUpperCase())
  );
  const trafoHuerfanos = [...exTrafos.keys()].filter((m) => !trafoMatriculasPlan.has(m));

  return {
    suministros:     { crear: sumCrear, actualizar: sumActualizar, skip: [], huerfanos: sumHuerfanos },
    marcas:          { crear: marCrear, skip: [] },
    transformadores: { crear: trafoCrear, actualizar: trafoActualizar, skip: [], huerfanos: trafoHuerfanos },
    correcciones:    { crear: corCrear, skip: [] },
    resumen: {
      suministros: { total: (parsed.suministros || []).length, crear: sumCrear.length, actualizar: sumActualizar.length, huerfanos: sumHuerfanos.length },
      marcas:      { total: (parsed.marcas || []).length, crear: marCrear.length },
      transformadores: { total: (parsed.transformadores || []).length, crear: trafoCrear.length, actualizar: trafoActualizar.length, huerfanos: trafoHuerfanos.length },
      correcciones: { total: corCrear.length }
    }
  };
}
