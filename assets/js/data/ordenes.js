// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: órdenes de trabajo (Fase 7)
// CRUD sobre Firestore + historial inmutable de cambios de estado.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

const COL_NAME = 'ordenes';

// ── Enumeraciones ──
export const ESTADOS_ORDEN = [
  { value: 'planificada', label: 'Planificada' },
  { value: 'en_curso',    label: 'En curso' },
  { value: 'cerrada',     label: 'Cerrada' },
  { value: 'cancelada',   label: 'Cancelada' }
];

export const TIPOS_ORDEN = [
  { value: 'preventivo',  label: 'Preventivo' },
  { value: 'correctivo',  label: 'Correctivo' },
  { value: 'predictivo',  label: 'Predictivo' },
  { value: 'emergencia',  label: 'Emergencia' }
];

export const PRIORIDADES = [
  { value: 'baja',     label: 'Baja' },
  { value: 'media',    label: 'Media' },
  { value: 'alta',     label: 'Alta' },
  { value: 'critica',  label: 'Crítica' }
];

export function estadoOrdenLabel(v) {
  const e = ESTADOS_ORDEN.find((x) => x.value === v);
  return e ? e.label : v || '—';
}
export function tipoLabel(v) {
  const t = TIPOS_ORDEN.find((x) => x.value === v);
  return t ? t.label : v || '—';
}
export function prioridadLabel(v) {
  const p = PRIORIDADES.find((x) => x.value === v);
  return p ? p.label : v || '—';
}

// ── Helpers internos ──
function collRef() {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, COL_NAME);
}
function docRef(id) {
  return doc(getDbSafe(), COL_NAME, id);
}
function historialRef(id) {
  return collection(getDbSafe(), COL_NAME, id, 'historial');
}

// ── Sanitizador ──
function sanitize(input) {
  const src = input || {};
  const num = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;
  const str = (v) => (v == null) ? '' : String(v).trim();
  return {
    codigo:               str(src.codigo).toUpperCase(),
    titulo:               str(src.titulo),
    descripcion:          str(src.descripcion),
    transformadorId:      str(src.transformadorId),
    transformadorCodigo:  str(src.transformadorCodigo).toUpperCase(),
    tipo:                 str(src.tipo).toLowerCase()      || 'preventivo',
    prioridad:            str(src.prioridad).toLowerCase() || 'media',
    estado:               str(src.estado).toLowerCase()    || 'planificada',
    tecnico:              str(src.tecnico),
    fecha_programada:     str(src.fecha_programada),
    fecha_inicio:         str(src.fecha_inicio),
    fecha_cierre:         str(src.fecha_cierre),
    duracion_horas:       num(src.duracion_horas),
    observaciones:        str(src.observaciones)
  };
}

// ── API ──
export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

export async function listar(filtros = {}) {
  const constraints = [];
  if (filtros.estado)          constraints.push(where('estado',          '==', filtros.estado));
  if (filtros.tipo)            constraints.push(where('tipo',            '==', filtros.tipo));
  if (filtros.prioridad)       constraints.push(where('prioridad',       '==', filtros.prioridad));
  if (filtros.transformadorId) constraints.push(where('transformadorId', '==', filtros.transformadorId));
  constraints.push(orderBy('codigo', 'desc'));
  if (filtros.limite)          constraints.push(limit(filtros.limite));

  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Suscripción realtime a la colección con los mismos filtros que `listar`.
 * Devuelve una función `unsubscribe()`.
 */
export function suscribir(filtros = {}, onData, onError) {
  const constraints = [];
  if (filtros.estado)          constraints.push(where('estado',          '==', filtros.estado));
  if (filtros.tipo)            constraints.push(where('tipo',            '==', filtros.tipo));
  if (filtros.prioridad)       constraints.push(where('prioridad',       '==', filtros.prioridad));
  if (filtros.transformadorId) constraints.push(where('transformadorId', '==', filtros.transformadorId));
  constraints.push(orderBy('codigo', 'desc'));
  if (filtros.limite)          constraints.push(limit(filtros.limite));
  return onSnapshot(
    query(collRef(), ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[ordenes.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function crear(data, uid) {
  const payload = sanitize(data);
  if (!payload.codigo)          throw new Error('El código de orden es obligatorio.');
  if (!payload.titulo)          throw new Error('El título es obligatorio.');
  if (!payload.transformadorId) throw new Error('Debe seleccionar un transformador.');
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  payload.createdBy = uid || null;
  const ref = await addDoc(collRef(), payload);
  await registrarEvento(ref.id, {
    tipo_evento: 'creacion',
    estado_nuevo: payload.estado,
    nota: 'Orden creada.',
    uid: uid || null
  });
  return ref.id;
}

export async function actualizar(id, data, uid) {
  const prev = await obtener(id);
  const payload = sanitize(data);
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);

  if (prev && prev.estado !== payload.estado) {
    await registrarEvento(id, {
      tipo_evento: 'cambio_estado',
      estado_previo: prev.estado,
      estado_nuevo:  payload.estado,
      nota: 'Cambio de estado.',
      uid: uid || null
    });
  }
}

export async function eliminar(id) {
  await deleteDoc(docRef(id));
}

// ── Historial inmutable (append-only) ──
export async function registrarEvento(ordenId, evento) {
  const payload = {
    tipo_evento:   String(evento.tipo_evento || 'nota'),
    estado_previo: evento.estado_previo || null,
    estado_nuevo:  evento.estado_nuevo  || null,
    nota:          String(evento.nota   || ''),
    uid:           evento.uid || null,
    at:            serverTimestamp()
  };
  await addDoc(historialRef(ordenId), payload);
}

export async function listarHistorial(ordenId) {
  const snap = await getDocs(query(historialRef(ordenId), orderBy('at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Estadísticas rápidas (para KPIs del panel) ──
export async function contarPorEstado() {
  const items = await listar({});
  const acc = { planificada: 0, en_curso: 0, cerrada: 0, cancelada: 0 };
  for (const o of items) { if (acc[o.estado] != null) acc[o.estado] += 1; }
  return { total: items.length, ...acc };
}
