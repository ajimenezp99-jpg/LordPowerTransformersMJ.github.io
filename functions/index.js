// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cloud Functions entry (F32)
// ──────────────────────────────────────────────────────────────
// Stubs para Firebase Cloud Functions v2. El despliegue requiere
// `firebase deploy --only functions` con las credenciales de
// servicio configuradas.
//
// Se mantiene como referencia arquitectónica; la activación
// real queda sujeta a permisos del proyecto (Blaze requerido
// para funciones programadas y salida a red externa).
// ══════════════════════════════════════════════════════════════

/* eslint-disable */

// NOTE: estos módulos solo se importan cuando se instala
// firebase-functions + firebase-admin + resend en el directorio
// functions/. En desarrollo local permanecen como placeholders.

const EMAIL_SUBJECT = 'SGM · TRANSPOWER — Resumen de alertas críticas';

/**
 * Handler shared — se adapta a onDocumentCreated de Firebase v2.
 * Recalcula salud_actual del transformador y registra historial_hi.
 */
export async function onMuestraCreateHandler(event, deps) {
  const { db, snapshotSaludCompleto } = deps;
  const data = event.data && event.data.data();
  if (!data || !data.transformadorId) return;

  const txRef = db.collection('transformadores').doc(data.transformadorId);
  const txSnap = await txRef.get();
  if (!txSnap.exists) return;
  const tx = { id: txSnap.id, ...txSnap.data() };

  // Últimas muestras por tipo
  const muestrasRef = db.collection('muestras')
    .where('transformadorId', '==', data.transformadorId)
    .orderBy('fecha_muestra', 'desc')
    .limit(10);
  const msSnap = await muestrasRef.get();
  const muestras = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const dga  = muestras.find((m) => m.tipo === 'DGA' || m.tipo === 'COMBO');
  const adfq = muestras.find((m) => m.tipo === 'ADFQ' || m.tipo === 'COMBO');
  const fur  = muestras.find((m) => m.tipo === 'FURANOS' || m.tipo === 'COMBO');

  const snap = snapshotSaludCompleto({
    transformador: tx,
    muestraDGA: dga, muestraADFQ: adfq, muestraFUR: fur,
    cargaActual: {
      cp: tx.salud_actual && tx.salud_actual.cp,
      ap: tx.electrico && tx.electrico.corriente_nominal_primaria_a
    },
    her: tx.salud_actual && tx.salud_actual.ubicacion_fuga_dominante,
    pyt: tx.salud_actual && tx.salud_actual.calif_pyt
  });

  await txRef.update({ salud_actual: snap });
  await txRef.collection('historial_hi').add({
    trigger: 'muestra_nueva',
    muestra_origen_ref: data.id,
    ...snap,
    createdAt: new Date()
  });
}

/**
 * Cron diario de resumen de alertas por email.
 * Requiere: Resend API key + destinatario en alertas_config/global.
 */
export async function cronAlertasDiariasHandler(_event, deps) {
  const { db, computarAlertas, sendEmail } = deps;
  const cfgSnap = await db.doc('alertas_config/global').get();
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  if (!cfg.notificaciones_enabled || !cfg.destinatario_email) return;

  const alertas = await computarAlertas();
  const criticas = (alertas || []).filter((a) => a.severidad === 'critica');
  if (criticas.length === 0) return;

  const htmlBody = `<h2>Resumen diario — ${new Date().toLocaleDateString('es-CO')}</h2>
    <p>Alertas críticas activas: <strong>${criticas.length}</strong>.</p>
    <ul>${criticas.slice(0, 20).map((a) =>
      `<li>${a.tipo}: ${a.descripcion || a.recurso_codigo}</li>`
    ).join('')}</ul>
    <p style="color:#888; font-size: 11px;">MO.00418.DE-GAC-AX.01 Ed. 02</p>`;

  await sendEmail({
    to: cfg.destinatario_email,
    subject: EMAIL_SUBJECT,
    html: htmlBody
  });

  await db.doc('alertas_config/global').update({
    ultima_notificacion_ts: new Date(),
    ultima_notificacion_count: criticas.length
  });
}

// Export de metadata para el deploy.
export const FUNCTION_METADATA = {
  version: 'v2.0.0',
  triggers: ['onMuestraCreate', 'cronAlertasDiarias'],
  notes: 'Requiere firebase-admin + resend + (opcional) firebase-functions v2.'
};
