// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: gestión documental (Fase 9)
// Metadatos en Firestore (`documentos`) + binarios en Storage
// (`documentos/{docId}/{filename}`).
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc, setDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import {
  ref as storageRef,
  uploadBytesResumable, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

import { getDbSafe, getStorageSafe, isFirebaseConfigured } from '../firebase-init.js';

const COL_NAME = 'documentos';
const STORAGE_PREFIX = 'documentos';

// Límite por archivo (coherente con storage.rules).
export const MAX_FILE_MB = 20;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// ── Enumeraciones ──
export const CATEGORIAS_DOC = [
  { value: 'protocolo',   label: 'Protocolo' },
  { value: 'informe',     label: 'Informe técnico' },
  { value: 'certificado', label: 'Certificado' },
  { value: 'manual',      label: 'Manual / Ficha' },
  { value: 'reporte',     label: 'Reporte de ensayo' },
  { value: 'otro',        label: 'Otro' }
];

export const NORMAS_DOC = [
  { value: 'ISO_50001',     label: 'ISO 50001:2018' },
  { value: 'IEEE_C57_12',   label: 'IEEE C57.12' },
  { value: 'IEC_60076',     label: 'IEC 60076' },
  { value: 'RETIE',         label: 'RETIE' },
  { value: 'NTC_IEC_60364', label: 'NTC-IEC 60364' },
  { value: 'CIGRE_WG_A2',   label: 'CIGRE WG A2' },
  { value: 'NINGUNA',       label: 'Sin norma aplicable' }
];

export function categoriaLabel(v) {
  const x = CATEGORIAS_DOC.find((c) => c.value === v);
  return x ? x.label : v || '—';
}
export function normaLabel(v) {
  const x = NORMAS_DOC.find((n) => n.value === v);
  return x ? x.label : v || '—';
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
function storage() {
  const s = getStorageSafe();
  if (!s) throw new Error('Storage no inicializado.');
  return s;
}

function sanitizeFilename(name) {
  return String(name || 'archivo')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

function sanitize(input) {
  const src = input || {};
  const str = (v) => (v == null) ? '' : String(v).trim();
  return {
    codigo:               str(src.codigo).toUpperCase(),
    titulo:               str(src.titulo),
    descripcion:          str(src.descripcion),
    categoria:            str(src.categoria).toLowerCase() || 'otro',
    norma_aplicable:      str(src.norma_aplicable)         || 'NINGUNA',
    transformadorId:      str(src.transformadorId),
    transformadorCodigo:  str(src.transformadorCodigo).toUpperCase(),
    autor:                str(src.autor),
    fecha_emision:        str(src.fecha_emision)
  };
}

// ── API pública ──
export function isReady() {
  return isFirebaseConfigured && !!getDbSafe() && !!getStorageSafe();
}

export async function listar(filtros = {}) {
  const constraints = [];
  if (filtros.categoria)       constraints.push(where('categoria',       '==', filtros.categoria));
  if (filtros.norma)           constraints.push(where('norma_aplicable', '==', filtros.norma));
  if (filtros.transformadorId) constraints.push(where('transformadorId', '==', filtros.transformadorId));
  constraints.push(orderBy('codigo', 'desc'));
  if (filtros.limite)          constraints.push(limit(filtros.limite));

  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/**
 * Sube un archivo y crea el documento con su metadata.
 * Flujo:
 *   1. Pre-crea un docId en Firestore con metadata + `status: 'subiendo'`.
 *   2. Sube el binario a `documentos/{docId}/{filename}` en Storage.
 *   3. Actualiza el documento con storagePath, downloadURL, mime, size, status='listo'.
 * Si falla la subida, el documento queda marcado `status: 'error'` para
 * facilitar limpieza manual desde el panel.
 */
export async function subir(metadata, file, onProgress, uid) {
  if (!file) throw new Error('Debe seleccionar un archivo.');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Archivo demasiado grande (máx. ${MAX_FILE_MB} MB).`);
  }
  const payload = sanitize(metadata);
  if (!payload.codigo) throw new Error('El código es obligatorio.');
  if (!payload.titulo) throw new Error('El título es obligatorio.');

  const filename = sanitizeFilename(file.name);
  payload.filename   = filename;
  payload.mime       = file.type || 'application/octet-stream';
  payload.size       = file.size;
  payload.status     = 'subiendo';
  payload.createdAt  = serverTimestamp();
  payload.updatedAt  = serverTimestamp();
  payload.createdBy  = uid || null;
  payload.storagePath = '';
  payload.downloadURL = '';

  // 1. Pre-crear documento (obtener ID).
  const ref = await addDoc(collRef(), payload);
  const id  = ref.id;
  const path = `${STORAGE_PREFIX}/${id}/${filename}`;

  try {
    // 2. Subida resumible a Storage.
    const uploadTask = uploadBytesResumable(
      storageRef(storage(), path),
      file,
      { contentType: payload.mime }
    );

    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snap) => {
          if (typeof onProgress === 'function' && snap.totalBytes > 0) {
            onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        },
        (err) => reject(err),
        () => resolve()
      );
    });

    // 3. Marcar como listo con URL.
    const url = await getDownloadURL(uploadTask.snapshot.ref);
    await updateDoc(docRef(id), {
      storagePath: path,
      downloadURL: url,
      status:      'listo',
      updatedAt:   serverTimestamp()
    });
    return id;
  } catch (err) {
    // Dejar rastro del fallo para limpieza manual.
    try {
      await updateDoc(docRef(id), {
        status:    'error',
        updatedAt: serverTimestamp()
      });
    } catch (_) {}
    throw err;
  }
}

export async function actualizarMetadata(id, data) {
  const payload = sanitize(data);
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);
}

export async function eliminar(id) {
  const d = await obtener(id);
  if (d && d.storagePath) {
    try {
      await deleteObject(storageRef(storage(), d.storagePath));
    } catch (err) {
      // Si el objeto ya no existe en Storage seguimos con el borrado del doc.
      if (err && err.code !== 'storage/object-not-found') {
        console.warn('[documentos] Storage delete warning:', err);
      }
    }
  }
  await deleteDoc(docRef(id));
}

// ── Utilidades de formato ──
export function formatSize(bytes) {
  if (bytes == null || isNaN(+bytes)) return '—';
  const n = +bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function iconoPorMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('pdf'))    return '📕';
  if (m.includes('image'))  return '🖼️';
  if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) return '📊';
  if (m.includes('word') || m.includes('document'))  return '📄';
  if (m.includes('zip') || m.includes('compressed')) return '🗜️';
  if (m.includes('text'))   return '📝';
  return '📎';
}
