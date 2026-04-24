// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: parametros_sistema/criticidad (F36)
// ══════════════════════════════════════════════════════════════
import {
  doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { calcularRangosCriticidad } from '../domain/matriz_riesgo.js';

const PATH = ['parametros_sistema', 'criticidad'];
const BASELINE_MAX = 48312;

function ref() { return doc(getDbSafe(), ...PATH); }

export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }

export async function obtenerCriticidad() {
  if (!isReady()) {
    return { max_usuarios: BASELINE_MAX, min_usuarios: 1, rangos: calcularRangosCriticidad(BASELINE_MAX), _source: 'baseline' };
  }
  const s = await getDoc(ref());
  if (!s.exists()) {
    return { max_usuarios: BASELINE_MAX, min_usuarios: 1, rangos: calcularRangosCriticidad(BASELINE_MAX), _source: 'baseline' };
  }
  const data = s.data();
  return {
    max_usuarios: data.max_usuarios || BASELINE_MAX,
    min_usuarios: data.min_usuarios || 1,
    rangos: calcularRangosCriticidad(data.max_usuarios || BASELINE_MAX, data.min_usuarios || 1),
    fecha_actualizacion: data.fecha_actualizacion || '',
    _source: 'firestore'
  };
}

export function suscribirCriticidad(onData, onError) {
  if (!isReady()) {
    onData({ max_usuarios: BASELINE_MAX, min_usuarios: 1, rangos: calcularRangosCriticidad(BASELINE_MAX), _source: 'baseline' });
    return () => {};
  }
  return onSnapshot(ref(),
    (s) => {
      if (!s.exists()) {
        onData({ max_usuarios: BASELINE_MAX, min_usuarios: 1, rangos: calcularRangosCriticidad(BASELINE_MAX), _source: 'baseline' });
        return;
      }
      const d = s.data();
      onData({
        max_usuarios: d.max_usuarios || BASELINE_MAX,
        min_usuarios: d.min_usuarios || 1,
        rangos: calcularRangosCriticidad(d.max_usuarios || BASELINE_MAX, d.min_usuarios || 1),
        _source: 'firestore'
      });
    },
    onError || ((err) => console.warn('[criticidad.suscribir]', err))
  );
}

export async function actualizarMaxUsuarios(maxUsuarios, { uid, nota } = {}) {
  const n = Number(maxUsuarios);
  if (!Number.isFinite(n) || n <= 1) throw new Error('max_usuarios debe ser > 1.');
  await setDoc(ref(), {
    max_usuarios: n,
    min_usuarios: 1,
    fecha_actualizacion: new Date().toISOString(),
    actualizado_por: uid || null,
    nota: String(nota || ''),
    updatedAt: serverTimestamp()
  }, { merge: true });
}
