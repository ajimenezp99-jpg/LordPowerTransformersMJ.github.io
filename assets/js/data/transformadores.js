// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: transformadores (Fase 6)
// CRUD sobre Firestore, usado por admin y páginas públicas.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

const COL_NAME = 'transformadores';

// ── Enumeraciones ──
export const ESTADOS = [
  { value: 'operativo',       label: 'Operativo' },
  { value: 'mantenimiento',   label: 'En mantenimiento' },
  { value: 'fuera_servicio',  label: 'Fuera de servicio' },
  { value: 'retirado',        label: 'Retirado / Baja' }
];

export const DEPARTAMENTOS = [
  { value: 'bolivar',    label: 'Bolívar' },
  { value: 'cordoba',    label: 'Córdoba' },
  { value: 'sucre',      label: 'Sucre' },
  { value: 'cesar',      label: 'Cesar' },
  { value: 'magdalena',  label: 'Magdalena' }
];

export function estadoLabel(v) {
  const e = ESTADOS.find((x) => x.value === v);
  return e ? e.label : v || '—';
}
export function departamentoLabel(v) {
  const d = DEPARTAMENTOS.find((x) => x.value === v);
  return d ? d.label : v || '—';
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

// ── Sanitizador ──
function sanitize(input) {
  const src = input || {};
  const num = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;
  const str = (v) => (v == null) ? '' : String(v).trim();
  return {
    codigo:                str(src.codigo).toUpperCase(),
    nombre:                str(src.nombre),
    departamento:          str(src.departamento).toLowerCase(),
    municipio:             str(src.municipio),
    subestacion:           str(src.subestacion),
    potencia_kva:          num(src.potencia_kva),
    tension_primaria_kv:   num(src.tension_primaria_kv),
    tension_secundaria_kv: num(src.tension_secundaria_kv),
    marca:                 str(src.marca),
    modelo:                str(src.modelo),
    serial:                str(src.serial),
    fecha_fabricacion:     str(src.fecha_fabricacion),
    fecha_instalacion:     str(src.fecha_instalacion),
    estado:                str(src.estado).toLowerCase() || 'operativo',
    latitud:               num(src.latitud),
    longitud:              num(src.longitud),
    observaciones:         str(src.observaciones)
  };
}

// ── API ──
export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

export async function listar(filtros = {}) {
  const constraints = [];
  if (filtros.departamento) constraints.push(where('departamento', '==', filtros.departamento));
  if (filtros.estado)       constraints.push(where('estado',       '==', filtros.estado));
  constraints.push(orderBy('codigo'));
  if (filtros.limite)       constraints.push(limit(filtros.limite));

  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function crear(data, uid) {
  const payload = sanitize(data);
  if (!payload.codigo) throw new Error('El código es obligatorio.');
  if (!payload.nombre) throw new Error('El nombre es obligatorio.');
  if (!payload.departamento) throw new Error('Seleccione un departamento.');
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  payload.createdBy = uid || null;
  const ref = await addDoc(collRef(), payload);
  return ref.id;
}

export async function actualizar(id, data) {
  const payload = sanitize(data);
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);
}

export async function eliminar(id) {
  await deleteDoc(docRef(id));
}

// ── Estadísticas rápidas (para KPIs del panel) ──
export async function contarPorEstado() {
  const items = await listar({});
  const acc = { operativo: 0, mantenimiento: 0, fuera_servicio: 0, retirado: 0 };
  for (const t of items) { if (acc[t.estado] != null) acc[t.estado] += 1; }
  return { total: items.length, ...acc };
}
