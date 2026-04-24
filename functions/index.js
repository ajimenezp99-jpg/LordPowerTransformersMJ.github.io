// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cloud Functions (F32)
// ──────────────────────────────────────────────────────────────
// DESPLIEGUE RECOMENDADO (sin email, sin secretos):
//   cd functions && npm install
//   cd ..
//   firebase deploy --only functions:onMuestraCreate
//
// DESPLIEGUE COMPLETO (cuando actives email via Resend):
//   1. https://console.developers.google.com/apis/api/secretmanager.googleapis.com
//      → botón Enable (habilita Secret Manager en el proyecto).
//   2. firebase functions:secrets:set RESEND_API_KEY   (pega API key de resend.com)
//   3. firebase deploy --only functions
//
// Triggers exportados:
//   · onMuestraCreate      — recálculo salud_actual + historial_hi
//                            cuando se escribe en /muestras/{id}.
//                            NO requiere secretos; deployable stand-alone.
//   · cronAlertasDiarias   — Pub/Sub schedule diario 07:00 Bogotá.
//                            Requiere Resend + Secret Manager habilitado.
// ══════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase-admin/app';
import { getFirestore }   from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule }        from 'firebase-functions/v2/scheduler';
import { defineSecret }      from 'firebase-functions/params';

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

const RESEND_KEY = defineSecret('RESEND_API_KEY');

// ── onMuestraCreate ───────────────────────────────────────────
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
    const dga  = muestras.find((m) => m.tipo === 'DGA'   || m.tipo === 'COMBO');
    const adfq = muestras.find((m) => m.tipo === 'ADFQ'  || m.tipo === 'COMBO');
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
export const cronAlertasDiarias = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'America/Bogota',
    region: 'southamerica-east1', secrets: [RESEND_KEY] },
  async () => {
    const cfgSnap = await db.doc('alertas_config/global').get();
    const cfg = cfgSnap.exists ? cfgSnap.data() : {};
    if (!cfg.notificaciones_enabled || !cfg.destinatario_email) return;

    const [trafosSnap, ordsSnap] = await Promise.all([
      db.collection('transformadores').get(),
      db.collection('ordenes').get()
    ]);
    const trafos = trafosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const ords   = ordsSnap.docs.map((d)   => ({ id: d.id, ...d.data() }));

    const criticas = computarAlertasCriticas(trafos, ords);
    if (criticas.length === 0) return;

    // Resend API
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_KEY.value());
    const html = `
      <h2>SGM · TRANSPOWER — Resumen diario</h2>
      <p><strong>${criticas.length}</strong> alerta(s) crítica(s) sin reconocer.</p>
      <ul>${criticas.slice(0, 30).map((a) =>
        `<li>${a.tipo} — ${a.titulo}</li>`).join('')}</ul>
      <p style="color:#888; font-size:12px">
        MO.00418.DE-GAC-AX.01 Ed. 02 · CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM
      </p>`;
    await resend.emails.send({
      from: 'sgm-transpower@no-reply.afinia.com.co',
      to:   cfg.destinatario_email,
      subject: `[SGM] ${criticas.length} alerta(s) crítica(s)`,
      html
    });

    await db.doc('alertas_config/global').update({
      ultima_notificacion_ts: new Date(),
      ultima_notificacion_count: criticas.length
    });
  }
);
