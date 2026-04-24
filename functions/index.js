// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cloud Functions (F32)
// ──────────────────────────────────────────────────────────────
// DESPLIEGUE RECOMENDADO (sin email):
//   cd functions && npm install
//   cd ..
//   firebase deploy --only functions:onMuestraCreate
//
// DESPLIEGUE COMPLETO (con email vía Firebase Extension + Gmail):
//   1. En Firebase Console → Extensions, instala
//      "Trigger Email from Firestore" con:
//      - SMTP URI:  smtps://TU_GMAIL:APP_PASSWORD@smtp.gmail.com:465
//      - From:      TU_GMAIL@gmail.com
//      - Collection: mail
//   2. firebase deploy --only functions:cronAlertasDiarias
//
// Triggers exportados:
//   · onMuestraCreate      — recálculo salud_actual + historial_hi
//                            cuando se escribe en /muestras/{id}.
//   · cronAlertasDiarias   — Pub/Sub schedule diario 07:00 Bogotá.
//                            Crea un doc en /mail que la Extension
//                            envía vía SMTP. No usa APIs externas
//                            (Resend, SendGrid) ni Secret Manager.
// ══════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase-admin/app';
import { getFirestore }   from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule }        from 'firebase-functions/v2/scheduler';

// Lógica pura del dominio (módulos sin imports de Firebase SDK).
// La carpeta ./domain/ se sincroniza automáticamente desde
// ../assets/js/domain/ por functions/prepare-deploy.mjs (predeploy hook).
import { snapshotSaludCompleto } from './domain/salud_activos.js';

// Compute mínimo de alertas críticas para el cron (subconjunto v2).
// Las reglas v1 ricas viven en assets/js/data/alertas.js (browser).
function computarAlertasCriticas(transformadores, ordenes) {
  const out = [];
  const hoy = new Date();
  for (const t of transformadores || []) {
    const s = t.salud_actual || {};
    const especiales = t.estados_especiales || [];
    if (s.hi_final != null && s.hi_final >= 4.5) {
      out.push({ tipo: 'hi_degradado', titulo: `${t.codigo} HI ${s.hi_final.toFixed(2)} (muy_pobre)` });
    }
    if (especiales.includes('propuesta_fur_pendiente')) {
      out.push({ tipo: 'propuesta_fur_pendiente', titulo: `${t.codigo} propuesta FUR pendiente experto` });
    }
    if (s.vida_remanente_pct != null && s.vida_remanente_pct < 10) {
      out.push({ tipo: 'vida_util_remanente_baja', titulo: `${t.codigo} vida útil ${s.vida_remanente_pct.toFixed(0)}%` });
    }
  }
  for (const o of ordenes || []) {
    if ((o.estado === 'planificada' || o.estado_v2 === 'programada') &&
        o.fecha_programada && new Date(o.fecha_programada) < hoy &&
        o.prioridad === 'critica') {
      out.push({ tipo: 'orden_critica_vencida', titulo: `${o.codigo} crítica vencida` });
    }
  }
  return out;
}

initializeApp();
const db = getFirestore();

// ── onMuestraCreate ───────────────────────────────────────────
// Trigger Firestore: cuando se crea una muestra de laboratorio,
// recalcula salud_actual del transformador y añade snapshot al
// historial_hi.
export const onMuestraCreate = onDocumentCreated(
  { document: 'muestras/{id}', region: 'southamerica-east1' },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data || !data.transformadorId) return;

    const txRef = db.collection('transformadores').doc(data.transformadorId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return;
    const tx = { id: txSnap.id, ...txSnap.data() };

    // Últimas 10 muestras del transformador para reconstruir snapshot.
    const ms = await db.collection('muestras')
      .where('transformadorId', '==', data.transformadorId)
      .orderBy('fecha_muestra', 'desc')
      .limit(10).get();
    const muestras = ms.docs.map((d) => ({ id: d.id, ...d.data() }));
    const dga  = muestras.find((m) => m.tipo === 'DGA'     || m.tipo === 'COMBO');
    const adfq = muestras.find((m) => m.tipo === 'ADFQ'    || m.tipo === 'COMBO');
    const fur  = muestras.find((m) => m.tipo === 'FURANOS' || m.tipo === 'COMBO');

    const snap = snapshotSaludCompleto({
      transformador: tx,
      muestraDGA: dga, muestraADFQ: adfq, muestraFUR: fur,
      her: tx.salud_actual && tx.salud_actual.ubicacion_fuga_dominante,
      pyt: tx.salud_actual && tx.salud_actual.calif_pyt
    });

    await txRef.update({ salud_actual: snap });
    await txRef.collection('historial_hi').add({
      trigger: 'muestra_nueva',
      muestra_origen_ref: event.params.id,
      ...snap, createdAt: new Date()
    });
  }
);

// ── cronAlertasDiarias ────────────────────────────────────────
// Schedule diario 07:00 Bogotá. Evalúa alertas críticas no
// reconocidas y delega el envío de email a la Firebase Extension
// "Trigger Email from Firestore" creando un doc en /mail.
//
// Formato de doc /mail esperado por la extension:
//   { to: 'destino@dominio.com',
//     message: { subject: '...', html: '...', text: '...' } }
//
// La extension lee el doc, envía por SMTP, y actualiza el doc con
// el estado del envío (success/error). Nuestro código nunca toca
// credenciales SMTP.
export const cronAlertasDiarias = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'America/Bogota', region: 'southamerica-east1' },
  async () => {
    const cfgSnap = await db.doc('alertas_config/global').get();
    const cfg = cfgSnap.exists ? cfgSnap.data() : {};
    if (!cfg.notificaciones_enabled || !cfg.destinatario_email) {
      console.log('[cronAlertasDiarias] Notificaciones deshabilitadas o sin destinatario.');
      return;
    }

    const [trafosSnap, ordsSnap] = await Promise.all([
      db.collection('transformadores').get(),
      db.collection('ordenes').get()
    ]);
    const trafos = trafosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const ords   = ordsSnap.docs.map((d)   => ({ id: d.id, ...d.data() }));

    const criticas = computarAlertasCriticas(trafos, ords);
    if (criticas.length === 0) {
      console.log('[cronAlertasDiarias] Sin alertas críticas; no se envía email.');
      return;
    }

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f6f8fb;color:#1a2440">
        <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,.05)">
          <h2 style="margin:0 0 8px;color:#3570e8;font-weight:600">SGM · TRANSPOWER</h2>
          <p style="margin:0 0 16px;color:#6a7c98;font-size:14px">Resumen diario de alertas críticas</p>
          <p style="font-size:16px;margin:0 0 16px"><strong style="color:#ff5a6e">${criticas.length}</strong> alerta(s) crítica(s) sin reconocer.</p>
          <ul style="padding-left:20px;line-height:1.7">
            ${criticas.slice(0, 30).map((a) =>
              `<li><code style="background:#eef3fb;padding:2px 6px;border-radius:4px;font-size:13px">${a.tipo}</code> &nbsp; ${a.titulo}</li>`
            ).join('')}
          </ul>
          ${criticas.length > 30 ? `<p style="color:#6a7c98;font-size:13px;margin-top:12px">…y ${criticas.length - 30} más. Revisa todas en <a href="https://ajimenezp99-jpg.github.io/LordPowerTransformersMJ.github.io/pages/alertas.html" style="color:#3570e8">la plataforma</a>.</p>` : ''}
          <hr style="border:none;border-top:1px solid #e4e9f2;margin:20px 0">
          <p style="color:#6a7c98;font-size:12px;margin:0">
            MO.00418.DE-GAC-AX.01 Ed. 02 · CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM
          </p>
        </div>
      </div>`;

    const textFallback = `SGM · TRANSPOWER — ${criticas.length} alerta(s) crítica(s) sin reconocer.\n\n` +
      criticas.slice(0, 30).map((a) => `- [${a.tipo}] ${a.titulo}`).join('\n') +
      (criticas.length > 30 ? `\n\n…y ${criticas.length - 30} más. Revisa todas en la plataforma.` : '');

    // Delega el envío a la Firebase Extension "Trigger Email".
    await db.collection('mail').add({
      to: cfg.destinatario_email,
      message: {
        subject: `[SGM] ${criticas.length} alerta(s) crítica(s)`,
        html,
        text: textFallback
      }
    });

    await db.doc('alertas_config/global').update({
      ultima_notificacion_ts: new Date(),
      ultima_notificacion_count: criticas.length
    });

    console.log('[cronAlertasDiarias] Email encolado en /mail:', criticas.length, 'alertas.');
  }
);
