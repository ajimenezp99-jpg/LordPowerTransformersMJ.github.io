// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: alertas & notificaciones (Fase 11)
// Motor de reglas cliente-side sobre `transformadores` + `ordenes`
// + config y reconocimientos persistidos en Firestore.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  setDoc, deleteDoc,
  getDoc, getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

import {
  listar as listarTransformadores,
  departamentoLabel, estadoLabel as estadoTransformadorLabel
} from './transformadores.js';

import {
  listar as listarOrdenes,
  estadoOrdenLabel, tipoLabel, prioridadLabel
} from './ordenes.js';

const COL_CONFIG       = 'alertas_config';
const DOC_CONFIG        = 'global';
const COL_RECONOCIDAS   = 'alertas_reconocidas';

// ── Catálogos ──
export const SEVERIDADES = [
  { value: 'critica', label: 'Crítica', rank: 3 },
  { value: 'warning', label: 'Atención', rank: 2 },
  { value: 'info',    label: 'Informativa', rank: 1 }
];

export const TIPOS_ALERTA = [
  { value: 'orden_vencida',        label: 'Orden vencida' },
  { value: 'orden_proxima',        label: 'Orden próxima a vencer' },
  { value: 'orden_prolongada',     label: 'Orden en curso prolongada' },
  { value: 'orden_critica_abierta',label: 'Orden crítica abierta' },
  { value: 'mantenimiento_largo', label: 'Mantenimiento prolongado' },
  { value: 'sin_coordenadas',      label: 'Transformador sin coordenadas' },
  { value: 'sin_fecha_instalacion',label: 'Sin fecha de instalación' }
];

export function severidadLabel(v) {
  const s = SEVERIDADES.find((x) => x.value === v);
  return s ? s.label : v || '—';
}
export function severidadRank(v) {
  const s = SEVERIDADES.find((x) => x.value === v);
  return s ? s.rank : 0;
}
export function tipoAlertaLabel(v) {
  const t = TIPOS_ALERTA.find((x) => x.value === v);
  return t ? t.label : v || '—';
}

// ── Configuración por defecto (umbrales en días) ──
export const DEFAULT_CONFIG = {
  proxima_dias:           15,   // Órdenes planificadas que vencen en <= N días
  prolongada_dias:        30,   // Órdenes en_curso abiertas por > N días
  mantenimiento_dias:     14,   // Transformadores en mantenimiento por > N días
  destinatario_email:     '',   // Reservado para F12 (Vercel Cron + Resend/Brevo)
  notificaciones_enabled: false
};

// ── Helpers Firestore ──
function db() {
  const d = getDbSafe();
  if (!d) throw new Error('Firebase no inicializado.');
  return d;
}
function configDocRef() {
  return doc(db(), COL_CONFIG, DOC_CONFIG);
}
function reconocidasCollRef() {
  return collection(db(), COL_RECONOCIDAS);
}
function reconocidaDocRef(id) {
  return doc(db(), COL_RECONOCIDAS, id);
}

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

// ── Config ──
export async function obtenerConfig() {
  try {
    const snap = await getDoc(configDocRef());
    if (!snap.exists()) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...snap.data() };
  } catch (_err) {
    return { ...DEFAULT_CONFIG };
  }
}

export async function actualizarConfig(data, uid) {
  const num = (v, fb) => (v === '' || v == null || isNaN(+v)) ? fb : Math.max(0, Math.round(+v));
  const payload = {
    proxima_dias:           num(data.proxima_dias,       DEFAULT_CONFIG.proxima_dias),
    prolongada_dias:        num(data.prolongada_dias,    DEFAULT_CONFIG.prolongada_dias),
    mantenimiento_dias:     num(data.mantenimiento_dias, DEFAULT_CONFIG.mantenimiento_dias),
    destinatario_email:     String(data.destinatario_email || '').trim(),
    notificaciones_enabled: !!data.notificaciones_enabled,
    updatedAt:              serverTimestamp(),
    updatedBy:              uid || null
  };
  await setDoc(configDocRef(), payload, { merge: true });
  return payload;
}

// ── Reconocimientos ──
export async function listarReconocidas() {
  try {
    const snap = await getDocs(reconocidasCollRef());
    const out = {};
    for (const d of snap.docs) out[d.id] = d.data();
    return out;
  } catch (_err) {
    return {};
  }
}

export async function reconocer(alertId, nota, uid) {
  await setDoc(reconocidaDocRef(alertId), {
    alertId,
    nota: String(nota || ''),
    uid:  uid || null,
    at:   serverTimestamp()
  });
}

export async function desreconocer(alertId) {
  await deleteDoc(reconocidaDocRef(alertId));
}

// ── Utilidades de fecha ──
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(a, b) {
  // Días calendario entre dos fechas (a - b), positivo si a es posterior.
  const MS = 24 * 60 * 60 * 1000;
  const at = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bt = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((at - bt) / MS);
}

function fmtFecha(s) {
  const d = parseDate(s);
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

// ── Motor de reglas ──
function buildAlertId(tipo, recursoId, sello) {
  // ID determinista: el mismo recurso + misma fecha de referencia → mismo ID.
  // Esto permite que un reconocimiento persista mientras la condición no cambie.
  return `${tipo}:${recursoId}:${sello || 'na'}`;
}

function pushAlert(out, alert) { out.push(alert); }

/**
 * Computa alertas sobre el parque.
 * @param {{ hoy?: Date, config?: object }} [opts]
 * @returns {Promise<{alertas: Array, resumen: object, config: object, generatedAt: Date}>}
 */
export async function computarAlertas(opts = {}) {
  const hoy    = opts.hoy instanceof Date ? opts.hoy : new Date();
  const config = opts.config || await obtenerConfig();
  const recs   = await listarReconocidas();

  const [transformadores, ordenes] = await Promise.all([
    listarTransformadores({}),
    listarOrdenes({})
  ]);

  const mapT = new Map();
  for (const t of transformadores) mapT.set(t.id, t);

  const alertas = [];

  // ── Órdenes: vencidas / próximas / prolongadas / críticas abiertas ──
  for (const o of ordenes) {
    const tRef = mapT.get(o.transformadorId);
    const tLabel = tRef ? `${tRef.codigo} · ${tRef.nombre}` : (o.transformadorCodigo || '—');

    const fProg = parseDate(o.fecha_programada);
    const fIni  = parseDate(o.fecha_inicio);

    // Sólo consideramos órdenes no cerradas/canceladas.
    const activa = o.estado === 'planificada' || o.estado === 'en_curso';

    if (activa && fProg) {
      const diff = daysBetween(hoy, fProg); // >0: vencida hace diff días, <0: faltan -diff días
      if (diff > 0) {
        const sev = o.prioridad === 'critica' ? 'critica' : (diff >= 7 ? 'critica' : 'warning');
        pushAlert(alertas, {
          id:        buildAlertId('orden_vencida', o.id, o.fecha_programada),
          tipo:      'orden_vencida',
          severidad: sev,
          titulo:    `Orden ${o.codigo} vencida hace ${diff} día${diff === 1 ? '' : 's'}`,
          detalle:   `${o.titulo || '—'} · ${tLabel} · ${tipoLabel(o.tipo)} · ${prioridadLabel(o.prioridad)}`,
          fecha_ref: o.fecha_programada,
          recurso:   { clase: 'orden', id: o.id, codigo: o.codigo }
        });
      } else if (diff >= -Math.abs(config.proxima_dias)) {
        pushAlert(alertas, {
          id:        buildAlertId('orden_proxima', o.id, o.fecha_programada),
          tipo:      'orden_proxima',
          severidad: 'info',
          titulo:    `Orden ${o.codigo} vence en ${Math.abs(diff)} día${Math.abs(diff) === 1 ? '' : 's'}`,
          detalle:   `${o.titulo || '—'} · ${tLabel} · ${tipoLabel(o.tipo)} · ${prioridadLabel(o.prioridad)}`,
          fecha_ref: o.fecha_programada,
          recurso:   { clase: 'orden', id: o.id, codigo: o.codigo }
        });
      }
    }

    if (o.estado === 'en_curso' && fIni) {
      const dias = daysBetween(hoy, fIni);
      if (dias > config.prolongada_dias) {
        pushAlert(alertas, {
          id:        buildAlertId('orden_prolongada', o.id, o.fecha_inicio),
          tipo:      'orden_prolongada',
          severidad: 'warning',
          titulo:    `Orden ${o.codigo} en curso hace ${dias} días`,
          detalle:   `${o.titulo || '—'} · ${tLabel} · técnico: ${o.tecnico || '—'}`,
          fecha_ref: o.fecha_inicio,
          recurso:   { clase: 'orden', id: o.id, codigo: o.codigo }
        });
      }
    }

    if (activa && o.prioridad === 'critica') {
      pushAlert(alertas, {
        id:        buildAlertId('orden_critica_abierta', o.id, o.estado),
        tipo:      'orden_critica_abierta',
        severidad: 'critica',
        titulo:    `Orden crítica ${o.codigo} abierta (${estadoOrdenLabel(o.estado)})`,
        detalle:   `${o.titulo || '—'} · ${tLabel} · ${tipoLabel(o.tipo)}`,
        fecha_ref: o.fecha_programada || o.fecha_inicio || '',
        recurso:   { clase: 'orden', id: o.id, codigo: o.codigo }
      });
    }
  }

  // ── Transformadores: mantenimiento prolongado / sin coords / sin fecha instalación ──
  // Para "mantenimiento prolongado" usamos la fecha de inicio de la orden más reciente
  // no-cerrada sobre ese transformador; fallback a updatedAt.
  const ordenesPorTrafo = new Map();
  for (const o of ordenes) {
    if (!o.transformadorId) continue;
    const arr = ordenesPorTrafo.get(o.transformadorId) || [];
    arr.push(o);
    ordenesPorTrafo.set(o.transformadorId, arr);
  }

  for (const t of transformadores) {
    if (t.estado === 'mantenimiento') {
      const arr = (ordenesPorTrafo.get(t.id) || [])
        .filter((o) => o.estado === 'en_curso' && o.fecha_inicio)
        .map((o) => parseDate(o.fecha_inicio))
        .filter(Boolean)
        .sort((a, b) => b - a);
      const inicio = arr[0];
      if (inicio) {
        const dias = daysBetween(hoy, inicio);
        if (dias > config.mantenimiento_dias) {
          pushAlert(alertas, {
            id:        buildAlertId('mantenimiento_largo', t.id, inicio.toISOString().slice(0, 10)),
            tipo:      'mantenimiento_largo',
            severidad: dias > config.mantenimiento_dias * 2 ? 'critica' : 'warning',
            titulo:    `${t.codigo} en mantenimiento hace ${dias} días`,
            detalle:   `${t.nombre || '—'} · ${departamentoLabel(t.departamento)} · ${t.municipio || '—'}`,
            fecha_ref: inicio.toISOString().slice(0, 10),
            recurso:   { clase: 'transformador', id: t.id, codigo: t.codigo }
          });
        }
      }
    }

    const activo = t.estado === 'operativo' || t.estado === 'mantenimiento';

    if (activo) {
      const latOk = typeof t.latitud === 'number' && !isNaN(t.latitud)
                  && t.latitud !== 0 && Math.abs(t.latitud) <= 90;
      const lngOk = typeof t.longitud === 'number' && !isNaN(t.longitud)
                  && t.longitud !== 0 && Math.abs(t.longitud) <= 180;
      if (!latOk || !lngOk) {
        pushAlert(alertas, {
          id:        buildAlertId('sin_coordenadas', t.id, 'na'),
          tipo:      'sin_coordenadas',
          severidad: 'info',
          titulo:    `${t.codigo} sin coordenadas GPS`,
          detalle:   `${t.nombre || '—'} · ${departamentoLabel(t.departamento)} · ${estadoTransformadorLabel(t.estado)}`,
          fecha_ref: '',
          recurso:   { clase: 'transformador', id: t.id, codigo: t.codigo }
        });
      }

      if (!t.fecha_instalacion) {
        pushAlert(alertas, {
          id:        buildAlertId('sin_fecha_instalacion', t.id, 'na'),
          tipo:      'sin_fecha_instalacion',
          severidad: 'info',
          titulo:    `${t.codigo} sin fecha de instalación`,
          detalle:   `${t.nombre || '—'} · ${departamentoLabel(t.departamento)} · impacta cálculo de MTBF`,
          fecha_ref: '',
          recurso:   { clase: 'transformador', id: t.id, codigo: t.codigo }
        });
      }
    }
  }

  // ── Marcar reconocidas ──
  for (const a of alertas) {
    const r = recs[a.id];
    if (r) {
      a.reconocida    = true;
      a.reconocida_uid = r.uid || null;
      a.reconocida_nota = r.nota || '';
    } else {
      a.reconocida = false;
    }
    a.fecha_ref_fmt = fmtFecha(a.fecha_ref);
  }

  // Ordenar por severidad (crítica primero) y luego por fecha_ref descendente.
  alertas.sort((a, b) => {
    const sa = severidadRank(a.severidad);
    const sb = severidadRank(b.severidad);
    if (sa !== sb) return sb - sa;
    return String(b.fecha_ref || '').localeCompare(String(a.fecha_ref || ''));
  });

  const activas = alertas.filter((a) => !a.reconocida);
  const resumen = {
    total:             alertas.length,
    activas:           activas.length,
    reconocidas:       alertas.length - activas.length,
    criticas:          activas.filter((a) => a.severidad === 'critica').length,
    warnings:          activas.filter((a) => a.severidad === 'warning').length,
    info:              activas.filter((a) => a.severidad === 'info').length
  };

  return { alertas, resumen, config, generatedAt: hoy };
}
