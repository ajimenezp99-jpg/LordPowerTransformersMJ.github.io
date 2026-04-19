// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Importador Excel (Fase 17)
// ──────────────────────────────────────────────────────────────
// Funciones PURAS para el parseo y normalización de filas del
// archivo "Salud de Activos 2026.xlsx". El motor de F18 re-calcula
// las calificaciones y la CONDICION oficial durante la importación
// (la condición del Excel NO se confía — ver §D1–D17 del prompt).
//
// SheetJS (`xlsx`) y Firestore se consumen en la capa UI/data;
// aquí sólo residen las transformaciones.
// ══════════════════════════════════════════════════════════════

import {
  sanitizarTransformador, validarTransformador, proyeccionV1
} from './transformador_schema.js';
import { DEPARTAMENTOS } from './schema.js';
import {
  calcularCalifTDGC, calcularCalifCO, calcularCalifCO2, calcularCalifC2H2,
  calcularCalifRD, calcularCalifIC, evaluarADFQ,
  calcularCalifFUR, calcularDP, calcularVidaUtilizada,
  calcularCalifCRG, calcularCalifEDAD,
  calcularCalifHER, calcularCalifPYT,
  calcularHIBruto, aplicarOverrides, bucketizarHI
} from './salud_activos.js';

// ── Hojas Excel → tipo de activo ───────────────────────────────
export const HOJAS_TIPO_ACTIVO = Object.freeze({
  'TX_Potencia':   'POTENCIA',
  'TX_POTENCIA':   'POTENCIA',
  'Hoja1':         'POTENCIA',
  'TPT_Servicio':  'TPT',
  'TPT_SERVICIO':  'TPT',
  'TX_Respaldo':   'RESPALDO',
  'TX_RESPALDO':   'RESPALDO'
});

// ── Helpers de coerción ────────────────────────────────────────
const toStr = (v) => (v == null) ? '' : String(v).trim();
const toNum = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'string') {
    v = v.replace(/,/g, '.').replace(/\s/g, '');
  }
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const toBool = (v) => (v === true || v === 'SI' || v === 'si' || v === 'Sí' ||
                        v === 'TRUE' || v === 1 || v === '1');

// Fechas Excel → ISO YYYY-MM-DD.
function toISODate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    // Excel serial date (days since 1900-01-01, con bug de 1900).
    const d = new Date((v - 25569) * 86400 * 1000);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yy] = m;
    const year = yy.length === 2 ? (+yy < 50 ? 2000 + +yy : 1900 + +yy) : +yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // ISO directo
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function anoDesdeISOorNumero(iso) {
  const s = toStr(iso);
  if (/^\d{4}/.test(s)) return +s.slice(0, 4);
  const n = toNum(iso);
  return (n && n > 1900 && n < 2200) ? Math.floor(n) : null;
}

function inferZona(depto) {
  const d = toStr(depto).toLowerCase();
  const hit = DEPARTAMENTOS.find((x) => x.value === d);
  return hit ? hit.zona : '';
}

// ── Normalización de departamento ──────────────────────────────
function normDepto(v) {
  const s = toStr(v).toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u');
  const mapa = {
    'bolivar': 'bolivar',
    'cordoba': 'cordoba',
    'sucre':   'sucre',
    'cesar':   'cesar',
    'magdalena': 'magdalena'
  };
  for (const k of Object.keys(mapa)) {
    if (s.includes(k)) return mapa[k];
  }
  return '';
}

// ── Estado ─────────────────────────────────────────────────────
function normEstado(v) {
  const s = toStr(v).toLowerCase();
  if (s.includes('oper'))              return 'operativo';
  if (s.includes('mant'))              return 'mantenimiento';
  if (s.includes('fuera'))             return 'fuera_servicio';
  if (s.includes('ret')  || s.includes('bajа') || s.includes('baja')) return 'retirado';
  if (s.includes('fall'))              return 'fallado';
  return 'operativo';
}

// ══════════════════════════════════════════════════════════════
// Parser de una fila Excel de transformador → documento v2
// ══════════════════════════════════════════════════════════════

/**
 * @param {object} fila — objeto con cabeceras como keys.
 * @param {string} hoja — nombre de la hoja (infiere tipo_activo).
 * @param {Date} [hoy]
 * @returns {{docV2, diagnostico_hi}} docV2 listo para persistir +
 *   diagnóstico con HI calculado oficialmente y comparación contra
 *   la CONDICION del Excel (si viene).
 */
export function parsearFilaTransformador(fila, hoja = '', hoy = new Date()) {
  if (!fila || typeof fila !== 'object') {
    throw new Error('parsearFilaTransformador: fila inválida.');
  }

  const tipoActivo = HOJAS_TIPO_ACTIVO[toStr(hoja)] || 'POTENCIA';

  // Headers aceptados (case-insensitive, alias varios).
  const g = (candidates) => {
    for (const c of candidates) {
      for (const k of Object.keys(fila)) {
        if (k.toLowerCase().trim() === c.toLowerCase()) return fila[k];
      }
    }
    return undefined;
  };

  const codigo  = toStr(g(['codigo', 'código', 'code', 'matricula']) || '').toUpperCase();
  const nombre  = toStr(g(['nombre', 'name', 'identificador']) || codigo);
  const subestacion = toStr(g(['subestacion', 'subestación', 'se', 'station']));
  const depto   = normDepto(g(['departamento', 'depto', 'dpto', 'state']));
  const zona    = toStr(g(['zona', 'region']) || inferZona(depto)).toUpperCase();
  const municipio = toStr(g(['municipio', 'ciudad', 'city']));
  const marca   = toStr(g(['marca', 'brand', 'fabricante']));
  const modelo  = toStr(g(['modelo', 'model']));
  const serial  = toStr(g(['serial', 'serie', 'sn']));
  const uucc    = toStr(g(['uucc']) || '').toUpperCase();
  const grupo   = toStr(g(['grupo', 'group']) || '').toUpperCase();

  const potKva  = toNum(g(['potencia_kva', 'potencia', 'kva', 'pot kva']));
  const tPri    = toNum(g(['tension_primaria_kv', 'tension primaria', 'tp', 'kv_pri']));
  const tSec    = toNum(g(['tension_secundaria_kv', 'tension secundaria', 'ts', 'kv_sec']));
  const tTer    = toNum(g(['tension_terciaria_kv', 'kv_ter']));
  const cp      = toNum(g(['carga_primaria', 'cp', 'corriente_primaria']));
  const ap      = toNum(g(['ampacidad_primaria', 'ap', 'i_nominal_primaria']));
  const cs      = toNum(g(['carga_secundaria', 'cs', 'corriente_secundaria']));
  const asec    = toNum(g(['ampacidad_secundaria', 'as', 'i_nominal_secundaria']));
  const ct      = toNum(g(['carga_terciaria', 'ct']));
  const at      = toNum(g(['ampacidad_terciaria', 'at']));

  const fabFecha = toISODate(g(['fecha_fabricacion', 'fab_fecha', 'fecha fabricacion']));
  const anoFab   = anoDesdeISOorNumero(fabFecha) ??
                   anoDesdeISOorNumero(g(['ano_fabricacion', 'año_fabricacion', 'año fabricacion', 'year']));
  const instFecha= toISODate(g(['fecha_instalacion', 'inst_fecha', 'fecha instalacion']));

  const latitud  = toNum(g(['latitud', 'lat']));
  const longitud = toNum(g(['longitud', 'lng', 'lon']));
  const observaciones = toStr(g(['observaciones', 'obs', 'notas']));

  const estadoServicio = normEstado(g(['estado', 'estado_servicio']));

  // Gases DGA (si vienen embebidos en la fila)
  const H2   = toNum(g(['h2', 'hidrogeno']));
  const CH4  = toNum(g(['ch4', 'metano']));
  const C2H2 = toNum(g(['c2h2', 'acetileno']));
  const C2H4 = toNum(g(['c2h4', 'etileno']));
  const C2H6 = toNum(g(['c2h6', 'etano']));
  const CO   = toNum(g(['co', 'monoxido']));
  const CO2  = toNum(g(['co2', 'dioxido']));

  const rdKv   = toNum(g(['rd', 'rigidez_dielectrica', 'rigidez', 'rigidez_kv']));
  const ti     = toNum(g(['ti', 'tension_interfacial']));
  const nn     = toNum(g(['nn', 'numero_neutralizacion', 'acidez']));
  const ppbFur = toNum(g(['ppb', 'furanos', '2fal', 'fal2', 'furanos_ppb']));

  const herUbic = toStr(g(['her', 'hermeticidad', 'ubicacion_fuga_dominante', 'fuga']))
                    .toLowerCase().replace(/\s+/g, '_');
  const pytRaw  = g(['pyt', 'protecciones', 'scada']);

  const condicionExcel = toNum(g(['condicion', 'condición', 'condicion_excel', 'hi_excel']));

  // ── Construir documento v2 ──
  const entradaV2 = {
    schema_version: 2,
    estado_servicio: estadoServicio,
    estados_especiales: [],
    identificacion: {
      codigo:      codigo || `UNK-${Date.now()}`,
      matricula:   codigo,
      nombre:      nombre || codigo,
      tipo_activo: tipoActivo,
      uucc:        uucc,
      grupo:       grupo
    },
    placa: {
      marca, modelo, serial,
      potencia_kva: potKva
    },
    ubicacion: {
      departamento: depto,
      municipio,
      zona,
      subestacion_nombre: subestacion,
      latitud, longitud
    },
    electrico: {
      tension_primaria_kv: tPri,
      tension_secundaria_kv: tSec,
      tension_terciaria_kv:  tTer,
      corriente_nominal_primaria_a:   ap,
      corriente_nominal_secundaria_a: asec,
      corriente_nominal_terciaria_a:  at
    },
    mecanico: {}, refrigeracion: {}, protecciones: {},
    fabricacion: { fecha_fabricacion: fabFecha, ano_fabricacion: anoFab },
    servicio:    { fecha_instalacion: instFecha, observaciones }
  };

  // ── Recalcular HI conforme MO.00418 (NO confiar en el Excel) ──
  let califTDGC = null, califC2H2 = null, califCO = null, califCO2 = null;
  let evalDGA = null;
  if ([H2, CH4, C2H4, C2H6].every((x) => x != null)) {
    califTDGC = calcularCalifTDGC({ H2, CH4, C2H4, C2H6 });
  }
  if (C2H2 != null) califC2H2 = calcularCalifC2H2(C2H2);
  if (CO   != null) califCO   = calcularCalifCO(CO);
  if (CO2  != null) califCO2  = calcularCalifCO2(CO2);
  if (califTDGC != null || califC2H2 != null) {
    evalDGA = Math.max(califTDGC ?? 0, califC2H2 ?? 0) || null;
  }

  const califRD = calcularCalifRD(rdKv);
  const califIC = calcularCalifIC({ ti, nn });
  const evalADFQ = evaluarADFQ({ rigidez_kv: rdKv, ti, nn });

  const califFUR = calcularCalifFUR(ppbFur);
  const dp       = calcularDP(ppbFur);
  const vidaU    = calcularVidaUtilizada(dp);

  const crg = calcularCalifCRG({ cp, ap, cs, as: asec, ct, at });

  const califEDAD = calcularCalifEDAD(anoFab, hoy);
  const califHER  = calcularCalifHER(herUbic);
  const califPYT  = calcularCalifPYT(pytRaw);

  const hiBruto = calcularHIBruto({
    eval_dga: evalDGA, calif_edad: califEDAD, eval_adfq: evalADFQ,
    calif_fur: califFUR, calif_crg: crg.calif,
    calif_pyt: califPYT, calif_her: califHER
  });
  const ov = aplicarOverrides(hiBruto, {
    calif_fur: califFUR, calif_crg: crg.calif, calif_c2h2: califC2H2,
    fin_vida_util_papel: false
  }, {});

  entradaV2.salud_actual = {
    ts_calculo: hoy.toISOString(),
    calif_tdgc: califTDGC, calif_co: califCO, calif_co2: califCO2,
    calif_c2h2: califC2H2, eval_dga: evalDGA,
    calif_rd: califRD, calif_ic: califIC, eval_adfq: evalADFQ,
    calif_fur: califFUR,
    dp_estimado: dp,
    vida_utilizada_pct: vidaU,
    vida_remanente_pct: vidaU != null ? Math.max(0, 100 - vidaU) : null,
    calif_crg: crg.calif, crg_pct_medido: crg.crg_pct,
    calif_edad: califEDAD,
    edad_anos: (hoy.getUTCFullYear() - (anoFab || hoy.getUTCFullYear())),
    calif_her: califHER,
    ubicacion_fuga_dominante: herUbic || '',
    calif_pyt: califPYT,
    hi_bruto: hiBruto, hi_final: ov.hi_final,
    bucket: bucketizarHI(ov.hi_final),
    overrides_aplicados: ['_importacion_v2', ...ov.overrides_aplicados],
    fin_vida_util_papel: false
  };

  const docV2 = sanitizarTransformador(entradaV2);
  const v1 = proyeccionV1(docV2);
  const final = { ...docV2, ...v1 };

  const errs = validarTransformador(docV2);

  // Diagnóstico: diferencia con condición del Excel
  const diagnostico = {
    codigo,
    hi_recalculado: ov.hi_final,
    condicion_excel: condicionExcel,
    diferencia: (ov.hi_final != null && condicionExcel != null)
      ? Math.abs(ov.hi_final - condicionExcel) : null,
    bucket_recalculado: bucketizarHI(ov.hi_final),
    overrides_aplicados: ov.overrides_aplicados,
    errores_validacion: errs
  };

  return { docV2: final, diagnostico };
}

// ══════════════════════════════════════════════════════════════
// Importador masivo
// ══════════════════════════════════════════════════════════════

/**
 * Procesa un array de filas por hoja y devuelve payloads listos
 * para persistir + reporte con discrepancias Excel ↔ MO.00418.
 *
 * @param {Array<{hoja, filas}>} hojas
 * @param {Date} [hoy]
 */
export function procesarLibro(hojas, hoy = new Date()) {
  const resultados = [];
  const reporte = {
    total_filas: 0,
    por_hoja: {},
    exitosos: 0,
    errores: 0,
    discrepancias_excel_mo00418: [],
    cambios_de_bucket: { hacia_peor: 0, hacia_mejor: 0 }
  };

  for (const { hoja, filas } of hojas) {
    const arr = Array.isArray(filas) ? filas : [];
    reporte.por_hoja[hoja] = arr.length;
    reporte.total_filas += arr.length;

    for (const fila of arr) {
      try {
        const { docV2, diagnostico } = parsearFilaTransformador(fila, hoja, hoy);
        resultados.push({ hoja, docV2, diagnostico });
        reporte.exitosos += 1;

        if (diagnostico.diferencia != null && diagnostico.diferencia > 0.5) {
          reporte.discrepancias_excel_mo00418.push({
            hoja,
            codigo: diagnostico.codigo,
            hi_recalculado: diagnostico.hi_recalculado,
            condicion_excel: diagnostico.condicion_excel,
            diferencia: diagnostico.diferencia,
            bucket: diagnostico.bucket_recalculado
          });
        }
      } catch (err) {
        reporte.errores += 1;
        resultados.push({
          hoja,
          error: err && err.message || String(err),
          fila_original: fila
        });
      }
    }
  }

  return { resultados, reporte };
}
