// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: subestaciones (Fase 16)
// ──────────────────────────────────────────────────────────────
// Entidad independiente que deja de ser un string embebido en
// cada transformador. Un transformador apunta a una subestación
// vía FK `ubicacion.subestacionId`. La subestación es la unidad
// geográfica y operativa que agrupa los activos.
//
// Funciones PURAS. I/O vive en assets/js/data/subestaciones.js.
// ══════════════════════════════════════════════════════════════

import { DEPARTAMENTOS, ZONAS, enValores } from './schema.js';

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};

/**
 * Sanitiza una entrada de subestación al shape canónico.
 */
export function sanitizarSubestacion(input) {
  const src = input || {};
  const depto = str(src.departamento).toLowerCase();
  const zona  = str(src.zona).toUpperCase();
  return {
    codigo:           str(src.codigo).toUpperCase(),
    nombre:           str(src.nombre),
    departamento:     enValores(DEPARTAMENTOS, depto) ? depto : '',
    municipio:        str(src.municipio),
    zona:             enValores(ZONAS, zona) ? zona : '',
    nivel_tension_kv: num(src.nivel_tension_kv),
    direccion:        str(src.direccion),
    latitud:          num(src.latitud),
    longitud:         num(src.longitud),
    observaciones:    str(src.observaciones),
    activa:           src.activa === false ? false : true
  };
}

export function validarSubestacion(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (!doc.codigo) errs.push('codigo es obligatorio.');
  if (!doc.nombre) errs.push('nombre es obligatorio.');
  if (!doc.departamento) {
    errs.push('departamento es obligatorio.');
  } else if (!enValores(DEPARTAMENTOS, String(doc.departamento).toLowerCase())) {
    errs.push(`departamento no catalogado: "${doc.departamento}".`);
  }
  if (doc.zona && !enValores(ZONAS, doc.zona)) {
    errs.push(`zona inválida: "${doc.zona}".`);
  }
  if (doc.latitud != null && (doc.latitud < -90 || doc.latitud > 90)) {
    errs.push(`latitud fuera de rango: ${doc.latitud}.`);
  }
  if (doc.longitud != null && (doc.longitud < -180 || doc.longitud > 180)) {
    errs.push(`longitud fuera de rango: ${doc.longitud}.`);
  }
  return errs;
}
