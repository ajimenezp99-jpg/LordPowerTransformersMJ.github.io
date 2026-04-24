// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Audit log global / bitácora (F35)
// ──────────────────────────────────────────────────────────────
// Colección /auditoria append-only. Helper `auditar` que
// produce un payload consistente listo para persistir.
// ISO 55001 §9.1 compliance.
// ══════════════════════════════════════════════════════════════

export const ACCIONES_AUDIT = Object.freeze([
  'crear', 'actualizar', 'eliminar',
  'reconocer_alerta', 'subir_documento', 'subir_evidencia',
  'cambiar_rol', 'login', 'logout',
  'importar_excel', 'exportar_reporte',
  'cambiar_umbrales', 'aprobar_fur', 'rechazar_fur',
  'abrir_monitoreo_c2h2', 'cerrar_monitoreo_c2h2',
  'generar_propuesta_orden', 'cambiar_estado_orden',
  'activar_respaldo'
]);

const str = (v) => (v == null) ? '' : String(v).trim();

/**
 * Construye un payload de auditoría.
 */
export function auditar({
  accion, coleccion, docId,
  uid, email, rol,
  diff, nota, referencia
} = {}) {
  if (!accion) throw new Error('auditar: accion es obligatoria.');
  return {
    accion: str(accion),
    coleccion: str(coleccion),
    docId: str(docId),
    uid: str(uid),
    email: str(email),
    rol: str(rol),
    diff: diff && typeof diff === 'object' ? diff : null,
    nota: str(nota),
    referencia: str(referencia),
    at_iso: new Date().toISOString()
  };
}

/**
 * Compara dos docs y produce diff por campo {antes, despues}.
 * Solo compara primitivos a 1 nivel (para audit trail legible).
 */
export function diffSimple(antes, despues) {
  const d = {};
  const keys = new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]);
  for (const k of keys) {
    const a = antes && antes[k];
    const b = despues && despues[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      d[k] = { antes: a ?? null, despues: b ?? null };
    }
  }
  return d;
}

/**
 * Persiste una entrada de auditoría en Firestore de forma
 * best-effort: si falla, no rompe la operación principal.
 *
 * Consumido por los data layers (usuarios, transformadores,
 * ordenes, documentos, umbrales_salud, importar, monitoreo_fur).
 *
 * @param {object} deps — `{ db, addDoc, collection, serverTimestamp }`
 *   inyectados por el caller (evita bindings cruzados con
 *   el SDK en este módulo puro).
 * @param {object} entry — resultado de `auditar({...})`.
 */
export async function persistirAuditoria(deps, entry) {
  if (!deps || !deps.db || !deps.addDoc || !deps.collection || !deps.serverTimestamp) {
    return;
  }
  try {
    await deps.addDoc(
      deps.collection(deps.db, 'auditoria'),
      { ...entry, at: deps.serverTimestamp() }
    );
  } catch (_) { /* best-effort */ }
}
