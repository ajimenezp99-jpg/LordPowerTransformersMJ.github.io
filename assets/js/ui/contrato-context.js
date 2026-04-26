// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — UI: contrato context · multi-contrato (N4 v2.4)
// ──────────────────────────────────────────────────────────────
// Helper que cualquier subscreen embebida en pages/contrato.html
// puede usar para detectar el contrato_id activo y propagarlo a
// sus queries Firestore.
//
// Uso típico en un controller:
//   import { getContratoActivo } from './ui/contrato-context.js';
//   const contrato_id = getContratoActivo();
//   suscribirSuministros({ contrato_id }, render, onError);
//
// Si la subscreen se carga standalone (no embebida) o sin
// ?contratoId, devuelve string vacío y los data layers funcionan
// como antes (sin filtro).
// ══════════════════════════════════════════════════════════════

import { CONTRATO_ID_PATTERN } from '../domain/schema.js';

let _cached = null;

/**
 * Devuelve el contrato_id activo del query string. Cachea la lectura
 * para que múltiples llamadas en la misma vista compartan el valor.
 * Valida contra CONTRATO_ID_PATTERN; si no matchea, devuelve ''.
 */
export function getContratoActivo() {
  if (_cached !== null) return _cached;
  try {
    const v = (new URLSearchParams(window.location.search).get('contratoId') || '').trim();
    _cached = (v && CONTRATO_ID_PATTERN.test(v)) ? v : '';
  } catch (_) {
    _cached = '';
  }
  return _cached;
}

/**
 * Construye un objeto de filtros para los data layers que respeta
 * el contrato activo. Mergea con cualquier filtro adicional pasado
 * por el caller.
 */
export function withContratoFiltro(extra = {}) {
  const cid = getContratoActivo();
  return cid ? { contrato_id: cid, ...extra } : { ...extra };
}
