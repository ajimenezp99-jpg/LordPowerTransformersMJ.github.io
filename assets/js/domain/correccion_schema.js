// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: correcciones (Fase 38)
// ──────────────────────────────────────────────────────────────
// Apéndice de fidelidad. Cada vez que se altera un dato fuente
// (típicamente del .xlsm o del JSX), se documenta aquí con tipo,
// ubicación, valor original, valor corregido y justificación.
//
// Append + update (para fix de typos del registro). Delete bloqueado
// por rule (decisión derivada del skill: traceability inmutable).
//
// Funciones PURAS. I/O vive en assets/js/data/correcciones.js.
// ══════════════════════════════════════════════════════════════

import { TIPOS_CORRECCION, CONTRATO_ID_PATTERN, enValores } from './schema.js';

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};

export function sanitizarCorreccion(input) {
  const src = input || {};
  const tipo = str(src.tipo).toLowerCase();
  return {
    contrato_id:    str(src.contrato_id),
    numero:         num(src.numero),
    tipo:           enValores(TIPOS_CORRECCION, tipo) ? tipo : '',
    ubicacion:      str(src.ubicacion),
    valor_original: str(src.valor_original),
    valor_corregido:str(src.valor_corregido),
    justificacion:  str(src.justificacion),
    fuente:         str(src.fuente)
  };
}

export function validarCorreccion(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (doc.contrato_id && !CONTRATO_ID_PATTERN.test(doc.contrato_id)) {
    errs.push(`contrato_id inválido: "${doc.contrato_id}". Esperado 8-14 dígitos.`);
  }
  if (!Number.isInteger(doc.numero) || doc.numero < 1) {
    errs.push('numero debe ser entero >= 1.');
  }
  if (!doc.tipo) {
    errs.push('tipo es obligatorio.');
  } else if (!enValores(TIPOS_CORRECCION, doc.tipo)) {
    errs.push(`tipo inválido: "${doc.tipo}".`);
  }
  if (!doc.ubicacion) errs.push('ubicacion es obligatoria.');
  if (!doc.justificacion) errs.push('justificacion es obligatoria.');
  return errs;
}
