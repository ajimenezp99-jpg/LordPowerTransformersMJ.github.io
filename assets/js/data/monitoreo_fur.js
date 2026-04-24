// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Monitoreo intensivo C2H2 + Propuestas FUR (F26)
// ══════════════════════════════════════════════════════════════
import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { crearEstadoMonitoreoIntensivo, calcularVelocidadC2H2, evaluarOverrideC2H2, BASELINES_C2H2 }
  from '../domain/monitoreo_intensivo.js';
import { crearPropuestaReclasificacionFUR, aplicarDecisionExperto }
  from '../domain/juicio_experto_fur.js';
import { auditar } from '../domain/audit.js';

const COL_MI  = 'monitoreo_intensivo';
const COL_FUR = 'propuestas_reclasificacion_fur';

export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }

// ── Contramuestras (F26 genérico) ──
const COL_CM = 'contramuestras';
export async function crearContramuestra(data, uid) {
  const payload = {
    transformadorId: String(data.transformadorId || ''),
    tipo: String(data.tipo || ''),    // cargabilidad, dga, adfq, fur
    motivo: String(data.motivo || ''),
    fecha_programada: String(data.fecha_programada || ''),
    frecuencia_dias:  Number(data.frecuencia_dias) || 30,
    estado: 'pendiente',
    generada_automatica: !!data.generada_automatica,
    createdAt: serverTimestamp(),
    createdBy: uid || null
  };
  const ref = await addDoc(collection(getDbSafe(), COL_CM), payload);
  return ref.id;
}

export async function listarContramuestras({ transformadorId, estado } = {}) {
  const cs = [];
  if (transformadorId) cs.push(where('transformadorId', '==', transformadorId));
  if (estado)          cs.push(where('estado', '==', estado));
  cs.push(orderBy('fecha_programada'));
  const snap = await getDocs(query(collection(getDbSafe(), COL_CM), ...cs));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Monitoreo intensivo C2H2 ──
export async function abrirMonitoreoIntensivo(params) {
  const payload = crearEstadoMonitoreoIntensivo(params);
  payload.createdAt = serverTimestamp();
  payload.createdBy = params.uid || null;
  const ref = await addDoc(collection(getDbSafe(), COL_MI), payload);
  return ref.id;
}

export async function listarMonitoreosActivos() {
  const q = query(
    collection(getDbSafe(), COL_MI),
    where('estado', '==', 'activo'),
    orderBy('iniciado_ts', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function registrarMuestraEnMonitoreo(monitoreoId, { muestra, muestraPrev }) {
  const velocidad = muestraPrev ? calcularVelocidadC2H2(muestraPrev, muestra) : null;
  const overrideEval = evaluarOverrideC2H2({
    velocidad_ppm_dia: velocidad,
    c2h2_actual: muestra && muestra.c2h2
  });
  const ref = doc(getDbSafe(), COL_MI, monitoreoId);
  await updateDoc(ref, {
    ultima_muestra_ref: muestra.id || null,
    ultima_muestra_ts:  muestra.fecha_muestra || '',
    velocidad_generacion_c2h2_ppm_dia: velocidad,
    override_evaluado_ts: serverTimestamp(),
    override_reclasificar: overrideEval.reclasificar,
    override_razones:      overrideEval.razones
  });
  return overrideEval;
}

export async function cerrarMonitoreoIntensivo(id, { razon, uid }) {
  await updateDoc(doc(getDbSafe(), COL_MI, id), {
    estado: 'cerrado',
    cerrado_ts: serverTimestamp(),
    cerrado_por: uid || null,
    razon_cierre: String(razon || '')
  });
}

// ── Propuestas FUR (A9.2) ──
export async function abrirPropuestaFUR(params) {
  const payload = crearPropuestaReclasificacionFUR(params);
  if (!payload) return null;
  payload.createdAt = serverTimestamp();
  payload.createdBy = params.uid || null;
  const ref = await addDoc(collection(getDbSafe(), COL_FUR), payload);
  return ref.id;
}

export async function listarPropuestasFUR({ estado } = {}) {
  const cs = [];
  if (estado) cs.push(where('estado', '==', estado));
  cs.push(orderBy('creada_ts', 'desc'));
  const snap = await getDocs(query(collection(getDbSafe(), COL_FUR), ...cs));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function resolverPropuestaFUR(id, { decision, experto_uid, nota }) {
  const ref = doc(getDbSafe(), COL_FUR, id);
  const s = await getDoc(ref);
  if (!s.exists()) throw new Error('Propuesta no existe.');
  const p2 = aplicarDecisionExperto(s.data(), { decision, experto_uid, nota });
  await updateDoc(ref, {
    estado: p2.estado,
    resuelta_ts: serverTimestamp(),
    resuelta_por: experto_uid || null,
    resolucion: decision,
    nota_resolucion: p2.nota_resolucion,
    fin_vida_util_papel: p2.fin_vida_util_papel,
    bloqueo_ordenes_no_reemplazo: p2.bloqueo_ordenes_no_reemplazo
  });
  // Audit (F35) — best-effort
  try {
    const accion = decision === 'rechazar' ? 'rechazar_fur' : 'aprobar_fur';
    await addDoc(collection(getDbSafe(), 'auditoria'),
      { ...auditar({
          accion, coleccion: COL_FUR, docId: id, uid: experto_uid,
          nota, referencia: 'MO.00418 §A9.2'
        }),
        at: serverTimestamp() });
  } catch (_) { /* ignore */ }
  return p2;
}

export { BASELINES_C2H2 };
