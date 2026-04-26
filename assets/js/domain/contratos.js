// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: contratos · helpers puros (N3 v2.4)
// ──────────────────────────────────────────────────────────────
// Funciones puras para el manejo multi-contrato. Cero I/O.
// ══════════════════════════════════════════════════════════════

/**
 * Compone el docId de un suministro (u otro doc indexado por
 * codigo natural) a partir de contrato_id + codigo.
 *
 * Sin contrato_id (datos legacy) → solo codigo.
 * Con contrato_id → `{contrato_id}_{codigo}` para que dos contratos
 * con el mismo codigo (ej. S01) NO colisionen en Firestore.
 *
 * Codigo se eleva a uppercase para consistencia con el sanitizer.
 *
 * @param {string|number|null} contratoId
 * @param {string} codigo
 * @returns {string}
 */
export function composeDocId(contratoId, codigo) {
  const c = (contratoId == null) ? '' : String(contratoId).trim();
  const k = (codigo == null) ? '' : String(codigo).trim().toUpperCase();
  if (!k) throw new Error('composeDocId: codigo es obligatorio.');
  return c ? `${c}_${k}` : k;
}

/**
 * Inverso de composeDocId: extrae { contratoId, codigo } de un docId.
 * Si el docId no tiene `_`, asume que es un codigo legacy sin contrato.
 */
export function parseDocId(docId) {
  const s = String(docId || '');
  const idx = s.indexOf('_');
  if (idx < 0) return { contratoId: '', codigo: s };
  return {
    contratoId: s.slice(0, idx),
    codigo:     s.slice(idx + 1)
  };
}
