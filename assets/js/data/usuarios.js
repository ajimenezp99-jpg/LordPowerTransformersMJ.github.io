// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer de Usuarios / Roles (F14 → F28)
// Colección Firestore: /usuarios/{uid}
// Campos v2:
//   { email, nombre, rol, activo, zonas[], contratos[],
//     permisos_extra[], createdAt, createdBy }
// Roles F28: admin · director_proyectos · analista_tx ·
//            gestor_contractual · brigadista · auditor_campo
// Rol legacy F14 aceptado: tecnico (debe migrarse).
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { auditar } from '../domain/audit.js';
import { sanitizarPerfilRBAC } from '../domain/rbac.js';

export const ROLES = [
  'admin', 'director_proyectos', 'analista_tx',
  'gestor_contractual', 'brigadista', 'auditor_campo',
  'tecnico'  // legacy F14
];

export const ROLE_LABELS = {
  admin:               'Administrador',
  director_proyectos:  'Ing. Director de Proyectos',
  analista_tx:         'Analista de Transformadores',
  gestor_contractual:  'Gestión Contractual',
  brigadista:          'Brigadista',
  auditor_campo:       'Auditor de Campo',
  tecnico:             'Técnico (legacy)'
};

export function labelRol(r) {
  return ROLE_LABELS[r] || r || '—';
}

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

function col() {
  const db = getDbSafe();
  if (!db) throw new Error('Firestore no inicializado.');
  return collection(db, 'usuarios');
}

function ref(uid) {
  const db = getDbSafe();
  if (!db) throw new Error('Firestore no inicializado.');
  return doc(db, 'usuarios', uid);
}

// ── Lecturas ──────────────────────────────────────────────────
export async function listar() {
  if (!isReady()) return [];
  const q = query(col(), orderBy('email'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function obtener(uid) {
  if (!isReady() || !uid) return null;
  const snap = await getDoc(ref(uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

// ── Escrituras ────────────────────────────────────────────────
// El uid DEBE ser el de Firebase Auth (creado antes en la consola
// o mediante el flujo de registro del admin). Esta API no crea la
// cuenta Auth, solo persiste el perfil/rol.
export async function crear({
  uid, email, nombre, rol = 'analista_tx', activo = true,
  zonas = [], contratos = [], permisos_extra = [],
  createdBy = null
}) {
  if (!uid) throw new Error('UID requerido.');
  if (!email) throw new Error('Email requerido.');
  if (!ROLES.includes(rol)) throw new Error('Rol inválido.');
  const rbac = sanitizarPerfilRBAC({ zonas, contratos, permisos_extra });
  const payload = {
    email: String(email).trim().toLowerCase(),
    nombre: String(nombre || '').trim(),
    rol,
    activo: !!activo,
    zonas: rbac.zonas,
    contratos: rbac.contratos,
    permisos_extra: rbac.permisos_extra,
    createdAt: serverTimestamp(),
    createdBy: createdBy || null
  };
  await setDoc(ref(uid), payload, { merge: false });
  // Audit (F35) — best-effort, no rompe la operación si falla.
  try {
    const { addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    await addDoc(collection(getDbSafe(), 'auditoria'),
      { ...auditar({ accion: 'crear', coleccion: 'usuarios', docId: uid,
                     uid: createdBy, nota: `Alta de ${email} con rol ${rol}` }),
        at: serverTimestamp() });
  } catch (_) { /* ignore */ }
  return { uid, ...payload };
}

export async function actualizar(uid, patch, { actorUid } = {}) {
  if (!uid) throw new Error('UID requerido.');
  const prev = await obtener(uid);
  const clean = {};
  if ('nombre'   in patch) clean.nombre   = String(patch.nombre || '').trim();
  if ('rol'      in patch) {
    if (!ROLES.includes(patch.rol)) throw new Error('Rol inválido.');
    clean.rol = patch.rol;
  }
  if ('activo'   in patch) clean.activo = !!patch.activo;
  if ('zonas'    in patch || 'contratos' in patch || 'permisos_extra' in patch) {
    const rbac = sanitizarPerfilRBAC({
      zonas: patch.zonas ?? (prev && prev.zonas),
      contratos: patch.contratos ?? (prev && prev.contratos),
      permisos_extra: patch.permisos_extra ?? (prev && prev.permisos_extra)
    });
    clean.zonas = rbac.zonas;
    clean.contratos = rbac.contratos;
    clean.permisos_extra = rbac.permisos_extra;
  }
  if (Object.keys(clean).length === 0) return;
  await updateDoc(ref(uid), clean);
  try {
    const { addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    await addDoc(collection(getDbSafe(), 'auditoria'),
      { ...auditar({ accion: 'actualizar', coleccion: 'usuarios', docId: uid,
                     uid: actorUid, diff: clean }),
        at: serverTimestamp() });
  } catch (_) { /* ignore */ }
}

export async function eliminar(uid, { actorUid } = {}) {
  if (!uid) throw new Error('UID requerido.');
  await deleteDoc(ref(uid));
  try {
    const { addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    await addDoc(collection(getDbSafe(), 'auditoria'),
      { ...auditar({ accion: 'eliminar', coleccion: 'usuarios', docId: uid, uid: actorUid }),
        at: serverTimestamp() });
  } catch (_) { /* ignore */ }
}
