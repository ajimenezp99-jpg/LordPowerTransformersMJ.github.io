// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Helpers de UI compartidos
// ──────────────────────────────────────────────────────────────
// Utilidades pequeñas reutilizadas entre admin/ y pages/.
// Mantener este archivo pequeño y sin dependencias externas.
// ══════════════════════════════════════════════════════════════

/**
 * Devuelve el color hex oficial (§A9.7 MO.00418) del bucket HI.
 */
export function bucketColor(b) {
  switch (b) {
    case 'muy_bueno': return '#1B8E3F';
    case 'bueno':     return '#4CB050';
    case 'medio':     return '#F5C518';
    case 'pobre':     return '#EF7820';
    case 'muy_pobre': return '#E53935';
    default:          return 'rgba(255,255,255,.1)';
  }
}

/**
 * Escapa HTML para evitar XSS cuando se inyecta texto en templates.
 */
export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/**
 * Formato ISO o timestamp Firestore a `YYYY-MM-DD HH:mm`.
 */
export function fmtTs(at) {
  if (!at) return '—';
  if (typeof at.toDate === 'function') {
    return at.toDate().toLocaleString('es-CO', { hour12: false });
  }
  if (typeof at === 'string') return at;
  if (at instanceof Date)     return at.toLocaleString('es-CO', { hour12: false });
  return '—';
}
