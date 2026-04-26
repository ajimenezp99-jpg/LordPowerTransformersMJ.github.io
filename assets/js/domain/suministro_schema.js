// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: suministros (Fase 38)
// ──────────────────────────────────────────────────────────────
// Catálogo contractual de repuestos. Cada item es una línea del
// contrato (Coraza, Motoventiladores, Radiadores, etc.) con un
// stock_inicial pactado y un valor_unitario.
//
// Stock_actual NO se persiste — se calcula agregando movimientos
// (ver assets/js/data/movimientos.js#computarStock en F39).
//
// Funciones PURAS. I/O vive en assets/js/data/suministros.js.
// ══════════════════════════════════════════════════════════════

import { UNIDADES, SUMINISTRO_CODIGO_PATTERN, CONTRATO_ID_PATTERN, enValores } from './schema.js';

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const arrStr = (v) => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter(Boolean);
};

export function sanitizarSuministro(input) {
  const src = input || {};
  const codigo = str(src.codigo).toUpperCase();
  const unidad = str(src.unidad);
  const stockIni = num(src.stock_inicial);
  return {
    contrato_id:          str(src.contrato_id),
    codigo,
    nombre:               str(src.nombre),
    unidad:               enValores(UNIDADES, unidad) ? unidad : 'Und',
    stock_inicial:        (stockIni == null || stockIni < 0) ? 0 : stockIni,
    valor_unitario:       (() => { const n = num(src.valor_unitario); return (n == null || n < 0) ? 0 : n; })(),
    marcas_disponibles:   arrStr(src.marcas_disponibles),
    observaciones:        str(src.observaciones)
  };
}

export function validarSuministro(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (!doc.codigo) {
    errs.push('codigo es obligatorio.');
  } else if (!SUMINISTRO_CODIGO_PATTERN.test(doc.codigo)) {
    errs.push(`codigo inválido: "${doc.codigo}". Esperado patrón Sxx.`);
  }
  // contrato_id es OPCIONAL durante la migración. Si está presente,
  // debe matchear el patrón. Si está ausente o vacío, el doc se
  // considera "legado" y será migrado por el script add-contrato-id.
  if (doc.contrato_id && !CONTRATO_ID_PATTERN.test(doc.contrato_id)) {
    errs.push(`contrato_id inválido: "${doc.contrato_id}". Esperado 8-14 dígitos.`);
  }
  if (!doc.nombre) errs.push('nombre es obligatorio.');
  if (!doc.unidad) {
    errs.push('unidad es obligatoria.');
  } else if (!enValores(UNIDADES, doc.unidad)) {
    errs.push(`unidad no catalogada: "${doc.unidad}".`);
  }
  if (typeof doc.stock_inicial !== 'number' || doc.stock_inicial < 0) {
    errs.push('stock_inicial debe ser número >= 0.');
  }
  if (typeof doc.valor_unitario !== 'number' || doc.valor_unitario < 0) {
    errs.push('valor_unitario debe ser número >= 0.');
  }
  return errs;
}
