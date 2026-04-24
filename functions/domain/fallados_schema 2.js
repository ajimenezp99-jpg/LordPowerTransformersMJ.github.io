// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fallados + RCA (F25)
// ──────────────────────────────────────────────────────────────
// Histórico post-mortem. Un transformador puede fallar y dejar
// de operar; se registra en /fallados con análisis causa-raíz
// conforme a 3 metodologías: 5 Porqués, Ishikawa, FMEA.
// ══════════════════════════════════════════════════════════════

export const TIPOS_FALLA = Object.freeze([
  { value: 'termica',    label: 'Térmica'             },
  { value: 'electrica',  label: 'Eléctrica / Dieléctrica' },
  { value: 'mecanica',   label: 'Mecánica'            },
  { value: 'quimica',    label: 'Química (aceite/papel)' },
  { value: 'externa',    label: 'Externa (descarga, red)' },
  { value: 'desconocida', label: 'Desconocida'         }
]);

export const METODOS_RCA = Object.freeze([
  { value: '5_porques',  label: '5 Porqués'    },
  { value: 'ishikawa',   label: 'Ishikawa (6M)' },
  { value: 'fmea',       label: 'FMEA'          }
]);

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const arr = (v) => Array.isArray(v) ? v.map(str).filter(Boolean) : [];

export function sanitizarFallado(input) {
  const src = input || {};
  const tipo = str(src.tipo_falla).toLowerCase();
  const metodoRCA = str(src.metodo_rca).toLowerCase();
  return {
    schema_version: 1,
    transformadorId:     str(src.transformadorId),
    transformadorCodigo: str(src.transformadorCodigo),
    fecha_falla:         str(src.fecha_falla),
    fecha_retiro:        str(src.fecha_retiro),
    tipo_falla:          TIPOS_FALLA.some((t) => t.value === tipo) ? tipo : 'desconocida',
    descripcion_falla:   str(src.descripcion_falla),
    consecuencias:       str(src.consecuencias),
    causantes:           arr(src.causantes),
    // RCA
    metodo_rca:          METODOS_RCA.some((m) => m.value === metodoRCA) ? metodoRCA : '5_porques',
    rca_porques:         arr(src.rca_porques).slice(0, 10),  // 5 porqués extendido
    rca_ishikawa: {
      metodo:       str(src.rca_ishikawa && src.rca_ishikawa.metodo),
      mano_obra:    str(src.rca_ishikawa && src.rca_ishikawa.mano_obra),
      maquinaria:   str(src.rca_ishikawa && src.rca_ishikawa.maquinaria),
      materiales:   str(src.rca_ishikawa && src.rca_ishikawa.materiales),
      medio_ambiente: str(src.rca_ishikawa && src.rca_ishikawa.medio_ambiente),
      medicion:     str(src.rca_ishikawa && src.rca_ishikawa.medicion)
    },
    rca_fmea: Array.isArray(src.rca_fmea) ? src.rca_fmea.map((f) => ({
      modo_falla:       str(f.modo_falla),
      efecto:           str(f.efecto),
      causa:            str(f.causa),
      severidad:        num(f.severidad),      // 1–10
      ocurrencia:       num(f.ocurrencia),
      deteccion:        num(f.deteccion),
      rpn:              num(f.severidad) && num(f.ocurrencia) && num(f.deteccion)
                          ? num(f.severidad) * num(f.ocurrencia) * num(f.deteccion)
                          : null,
      accion_recomendada: str(f.accion_recomendada)
    })) : [],
    // Causa raíz final (texto o código causante)
    causa_raiz:          str(src.causa_raiz),
    lecciones_aprendidas: str(src.lecciones_aprendidas),
    // Evidencias
    evidencias_refs:     arr(src.evidencias_refs),
    costo_reposicion:    num(src.costo_reposicion),
    horas_fuera_servicio: num(src.horas_fuera_servicio)
  };
}

export function validarFallado(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (!doc.transformadorId) errs.push('transformadorId es obligatorio.');
  if (!doc.fecha_falla)     errs.push('fecha_falla es obligatoria.');
  if (!doc.tipo_falla)      errs.push('tipo_falla es obligatorio.');
  if (doc.metodo_rca === 'fmea' && (!doc.rca_fmea || doc.rca_fmea.length === 0)) {
    errs.push('FMEA requiere al menos una línea.');
  }
  return errs;
}

/**
 * Calcula RPN (Risk Priority Number) para una fila FMEA.
 * RPN = Severidad × Ocurrencia × Detección (cada uno 1–10).
 */
export function calcularRPN({ severidad, ocurrencia, deteccion }) {
  const s = +severidad, o = +ocurrencia, d = +deteccion;
  if (![s, o, d].every((x) => Number.isFinite(x) && x >= 1 && x <= 10)) return null;
  return s * o * d;
}

/**
 * Clasifica un RPN en nivel de riesgo (convención FMEA).
 */
export function nivelRiesgoRPN(rpn) {
  if (rpn == null) return 'desconocido';
  if (rpn >= 200)  return 'critico';
  if (rpn >= 125)  return 'alto';
  if (rpn >= 50)   return 'medio';
  return 'bajo';
}
