// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Orden v2 (F23)
// ──────────────────────────────────────────────────────────────
// Refactor del shape v1 de F7. La orden v2:
//   · Referencia a macroactividad (FK) en vez de descripcion libre.
//   · Hereda condicion_objetivo del macro.
//   · Enlaza al contrato que la respalda financieramente.
//   · Lleva causante[] del catálogo (no texto libre).
//   · Extiende workflow de estado a 10 estados (F29).
//
// Compat con v1: `actualizar`/`crear` legacy de F7 siguen
// aceptando el shape viejo (titulo/descripcion/tipo/prioridad)
// y el sanitizador produce el doc v2 mapeando 1:1.
// ══════════════════════════════════════════════════════════════

import { enValores } from './schema.js';

export const ESTADOS_ORDEN_V2 = Object.freeze([
  { value: 'borrador',      label: 'Borrador' },
  { value: 'propuesta',     label: 'Propuesta' },
  { value: 'revisada',      label: 'Revisada' },
  { value: 'autorizada',    label: 'Autorizada' },
  { value: 'programada',    label: 'Programada' },
  { value: 'en_ejecucion',  label: 'En ejecución' },
  { value: 'ejecutada',     label: 'Ejecutada' },
  { value: 'verificada',    label: 'Verificada' },
  { value: 'cerrada',       label: 'Cerrada' },
  { value: 'rechazada',     label: 'Rechazada' },
  { value: 'cancelada',     label: 'Cancelada' }
]);

// Mapeo legacy v1 → v2 (el v1 usaba 4 estados).
const MAP_V1_V2 = Object.freeze({
  planificada: 'programada',
  en_curso:    'en_ejecucion',
  cerrada:     'cerrada',
  cancelada:   'cancelada'
});

export const TIPOS_ORDEN = Object.freeze([
  { value: 'preventivo',   label: 'Preventivo' },
  { value: 'correctivo',   label: 'Correctivo' },
  { value: 'predictivo',   label: 'Predictivo' },
  { value: 'emergencia',   label: 'Emergencia' },
  { value: 'etu',          label: 'ETU — Evaluación Técnica Urgente (§A9.1)' },
  { value: 'reemplazo',    label: 'Reemplazo' },
  { value: 'retiro',       label: 'Retiro' }
]);

export const PRIORIDADES = Object.freeze([
  { value: 'baja',    label: 'Baja'    },
  { value: 'media',   label: 'Media'   },
  { value: 'alta',    label: 'Alta'    },
  { value: 'critica', label: 'Crítica' }
]);

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const arr = (v) => Array.isArray(v) ? v.map(str).filter(Boolean) : [];

function normEstado(v) {
  const s = str(v).toLowerCase();
  if (MAP_V1_V2[s]) return MAP_V1_V2[s];
  return enValores(ESTADOS_ORDEN_V2, s) ? s : 'borrador';
}

function normEnum(v, cat, fallback) {
  const s = str(v).toLowerCase();
  return enValores(cat, s) ? s : fallback;
}

export function sanitizarOrden(input) {
  const src = input || {};
  return {
    schema_version: 2,
    codigo:         str(src.codigo).toUpperCase(),
    titulo:         str(src.titulo),
    descripcion:    str(src.descripcion),
    // FKs v2
    macroactividadId:      str(src.macroactividadId),
    macroactividad_codigo: str(src.macroactividad_codigo),
    contratoId:            str(src.contratoId),
    contrato_codigo:       str(src.contrato_codigo),
    transformadorId:       str(src.transformadorId),
    transformadorCodigo:   str(src.transformadorCodigo),
    // Catálogos v2
    causantes:             arr(src.causantes),      // array de códigos CAU-xx
    subactividades_ejecutadas: arr(src.subactividades_ejecutadas),
    // Enum
    tipo:       normEnum(src.tipo, TIPOS_ORDEN, 'preventivo'),
    prioridad:  normEnum(src.prioridad, PRIORIDADES, 'media'),
    estado:     normEstado(src.estado),
    // Condición objetivo heredada de la macroactividad
    condicion_objetivo: num(src.condicion_objetivo),
    // Operativos
    tecnico:         str(src.tecnico),
    aliado_ejecutor: str(src.aliado_ejecutor).toUpperCase(),
    fecha_programada: str(src.fecha_programada),
    fecha_inicio:    str(src.fecha_inicio),
    fecha_cierre:    str(src.fecha_cierre),
    duracion_horas:  num(src.duracion_horas),
    costo_estimado:  num(src.costo_estimado),
    costo_ejecutado: num(src.costo_ejecutado),
    observaciones:   str(src.observaciones),
    // Workflow (F29) — info de quién aprobó cada etapa
    propuesta_por:   str(src.propuesta_por),
    revisada_por:    str(src.revisada_por),
    autorizada_por:  str(src.autorizada_por),
    verificada_por:  str(src.verificada_por)
  };
}

export function validarOrden(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (!doc.codigo)          errs.push('codigo es obligatorio.');
  if (!doc.titulo)          errs.push('titulo es obligatorio.');
  if (!doc.transformadorId) errs.push('transformadorId es obligatorio.');
  if (!doc.estado)          errs.push('estado es obligatorio.');
  if (doc.condicion_objetivo != null) {
    if (doc.condicion_objetivo < 1 || doc.condicion_objetivo > 5) {
      errs.push('condicion_objetivo debe estar en [1,5].');
    }
  }
  return errs;
}

// ── Workflow (§F29 extensión) ──────────────────────────────────
export const TRANSICIONES_VALIDAS = Object.freeze({
  borrador:      ['propuesta', 'cancelada'],
  propuesta:     ['revisada', 'rechazada', 'cancelada'],
  revisada:      ['autorizada', 'rechazada', 'cancelada'],
  autorizada:    ['programada', 'cancelada'],
  programada:    ['en_ejecucion', 'cancelada'],
  en_ejecucion:  ['ejecutada', 'cancelada'],
  ejecutada:     ['verificada'],
  verificada:    ['cerrada'],
  cerrada:       [],
  rechazada:     [],
  cancelada:     []
});

export function transicionValida(from, to) {
  const ok = TRANSICIONES_VALIDAS[from] || [];
  return ok.includes(to);
}
