// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Contratos (F21)
// ──────────────────────────────────────────────────────────────
// Los 8 contratos macro que apalancan las actividades de
// mantenimiento. Cada orden de trabajo (F23) referencia al
// contrato que la respalda financieramente.
// ══════════════════════════════════════════════════════════════

export const ALIADOS = Object.freeze([
  { value: 'BRIGADA_TX', label: 'Brigada TX' },
  { value: 'CDM',        label: 'CDM' },
  { value: 'TYS',        label: 'TyS' },
  { value: 'TYS_G3',     label: 'TyS G3' },
  { value: 'CDM_TYS',    label: 'CDM-TyS' },
  { value: 'OTRO',       label: 'Otro' }
]);

export const ESTADOS_CONTRATO = Object.freeze([
  { value: 'vigente',     label: 'Vigente'     },
  { value: 'suspendido',  label: 'Suspendido'  },
  { value: 'finalizado',  label: 'Finalizado'  },
  { value: 'en_liquidacion', label: 'En liquidación' }
]);

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'string') v = v.replace(/,/g, '.');
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const arr = (v) => Array.isArray(v) ? v.map(str).filter(Boolean) : [];

export function sanitizarContrato(input) {
  const src = input || {};
  const enumOr = (v, cat, fallback) => {
    const s = str(v).toUpperCase();
    return cat.some((x) => x.value === s) ? s : fallback;
  };
  const enumLow = (v, cat, fallback) => {
    const s = str(v).toLowerCase();
    return cat.some((x) => x.value === s) ? s : fallback;
  };

  const monto = num(src.monto_total) ?? 0;
  const comprometido = num(src.presupuesto_comprometido) ?? 0;
  const ejecutado    = num(src.presupuesto_ejecutado)    ?? 0;
  const disponible   = Math.max(0, monto - comprometido - ejecutado);

  return {
    schema_version: 1,
    codigo:  str(src.codigo).toUpperCase(),
    alcance: str(src.alcance),
    aliado:  enumOr(src.aliado, ALIADOS, 'OTRO'),
    aliado_otro: enumOr(src.aliado, ALIADOS, 'OTRO') === 'OTRO' ? str(src.aliado_otro) : '',
    fecha_inicio:    str(src.fecha_inicio),
    fecha_fin:       str(src.fecha_fin),
    monto_total:              monto,
    presupuesto_comprometido: comprometido,
    presupuesto_ejecutado:    ejecutado,
    presupuesto_disponible:   disponible,
    moneda: str(src.moneda || 'COP').toUpperCase(),
    zonas_aplica: arr(src.zonas_aplica).map((z) => z.toUpperCase())
                    .filter((z) => ['BOLIVAR','ORIENTE','OCCIDENTE'].includes(z)),
    tipo_activo_elegible: arr(src.tipo_activo_elegible).map((t) => t.toUpperCase())
                          .filter((t) => ['POTENCIA','TPT','RESPALDO'].includes(t)),
    estado: enumLow(src.estado, ESTADOS_CONTRATO, 'vigente'),
    observaciones: str(src.observaciones)
  };
}

export function validarContrato(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (!doc.codigo)       errs.push('codigo es obligatorio.');
  if (!doc.fecha_inicio) errs.push('fecha_inicio es obligatoria.');
  if (doc.monto_total == null) errs.push('monto_total es obligatorio.');
  if (doc.presupuesto_comprometido + doc.presupuesto_ejecutado > doc.monto_total) {
    errs.push('Comprometido + ejecutado supera el monto total.');
  }
  return errs;
}
