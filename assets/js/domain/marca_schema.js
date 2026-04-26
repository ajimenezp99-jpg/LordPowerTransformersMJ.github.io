// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: marcas (Fase 38)
// ──────────────────────────────────────────────────────────────
// Mapeo Suministro → Marca(s). Mirror de tblMarcas (Sheet3) del
// .xlsm fuente. Un suministro puede tener N marcas; el panel
// admin (F44) sincroniza este array con el campo
// /suministros/{id}.marcas_disponibles[] vía arrayUnion.
//
// Funciones PURAS. I/O vive en assets/js/data/marcas.js.
// ══════════════════════════════════════════════════════════════

import { SUMINISTRO_CODIGO_PATTERN, CONTRATO_ID_PATTERN } from './schema.js';

const str = (v) => (v == null) ? '' : String(v).trim();

export function sanitizarMarca(input) {
  const src = input || {};
  return {
    contrato_id:       str(src.contrato_id),
    suministro_id:     str(src.suministro_id).toUpperCase(),
    suministro_nombre: str(src.suministro_nombre),
    marca:             str(src.marca).toUpperCase(),
    observaciones:     str(src.observaciones)
  };
}

export function validarMarca(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (doc.contrato_id && !CONTRATO_ID_PATTERN.test(doc.contrato_id)) {
    errs.push(`contrato_id inválido: "${doc.contrato_id}". Esperado 8-14 dígitos.`);
  }
  if (!doc.suministro_id) {
    errs.push('suministro_id es obligatorio.');
  } else if (!SUMINISTRO_CODIGO_PATTERN.test(doc.suministro_id)) {
    errs.push(`suministro_id inválido: "${doc.suministro_id}". Esperado patrón Sxx.`);
  }
  if (!doc.marca) errs.push('marca es obligatoria.');
  return errs;
}
