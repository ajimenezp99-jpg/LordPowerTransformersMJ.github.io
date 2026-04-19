// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer de Usuarios / Roles (Fase 14)
// Colección Firestore: /usuarios/{uid}
// Campos: { email, nombre, rol, activo, createdAt, createdBy }
// Roles: 'admin' | 'tecnico'
// ──────────────────────────────────────────────────────────────
// Reemplaza la allowlist estática `ADMIN_UIDS` de F5. Los perfiles
// y roles ahora viven en Firestore y el admin los gestiona desde
// /admin/usuarios.html. El bootstrap del primer admin se hace:
//   (a) creando la cuenta en Firebase Console → Authentication,
//   (b) creando el doc /usuarios/{uid} con rol='admin' desde la
//       consola de Firestore (o con el código maestro de bootstrap
//       de /admins/{uid} heredado de F5).
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

export const ROLES = ['admin', 'tecnico'];

export const ROLE_LABELS = {
  admin:   'Administrador',
  tecnico: 'Técnico'
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
export async function crear({ uid, email, nombre, rol = 'tecnico', activo = true, createdBy = null }) {
  if (!uid) throw new Error('UID requerido.');
  if (!email) throw new Error('Email requerido.');
  if (!ROLES.includes(rol)) throw new Error('Rol inválido.');
  const payload = {
    email: String(email).trim().toLowerCase(),
    nombre: String(nombre || '').trim(),
    rol,
    activo: !!activo,
    createdAt: serverTimestamp(),
    createdBy: createdBy || null
  };
  await setDoc(ref(uid), payload, { merge: false });
  return { uid, ...payload };
}

export async function actualizar(uid, patch) {
  if (!uid) throw new Error('UID requerido.');
  const clean = {};
  if ('nombre' in patch) clean.nombre = String(patch.nombre || '').trim();
  if ('rol'    in patch) {
    if (!ROLES.includes(patch.rol)) throw new Error('Rol inválido.');
    clean.rol = patch.rol;
  }
  if ('activo' in patch) clean.activo = !!patch.activo;
  if (Object.keys(clean).length === 0) return;
  await updateDoc(ref(uid), clean);
}

export async function eliminar(uid) {
  if (!uid) throw new Error('UID requerido.');
  await deleteDoc(ref(uid));
}
