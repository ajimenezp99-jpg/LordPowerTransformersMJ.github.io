// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: forma del documento transformador v2
// ──────────────────────────────────────────────────────────────
// Funciones PURAS (cero side effects, cero I/O). Describen la
// estructura canónica de un documento `transformadores/{id}` en
// v2 y las transformaciones que se aplican a toda entrada
// (formulario UI, importador Excel, migración v1).
//
// Consumidores:
//   · assets/js/data/transformadores.js  — crea/actualiza en
//     Firestore tras pasar por `sanitizarTransformador`.
//   · scripts/migrate/v1-to-v2-transformadores.js — migración.
//   · tests/*.test.js                      — cobertura directa.
//
// Referencia normativa principal:
//   MO.00418.DE-GAC-AX.01 Ed. 02 — Ax. Transformadores de Potencia
// ══════════════════════════════════════════════════════════════

import {
  TIPOS_ACTIVO, ZONAS, GRUPOS, DEPARTAMENTOS,
  ESTADOS_SERVICIO, ESTADOS_ESPECIALES, BUCKETS_HI,
  UBICACIONES_FUGA, UUCC_PATTERN, esUUCCValida,
  SCHEMA_VERSION, enValores
} from './schema.js';

// ── Helpers de coerción ────────────────────────────────────────
const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const bool = (v) => {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === '' || v == null) return false;
  return Boolean(v);
};
const arrStr = (v) => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter((x) => x.length > 0);
};

function normEnum(value, cat, fallback) {
  const s = str(value);
  if (!s) return fallback;
  return enValores(cat, s) ? s : fallback;
}

function normEnumUpper(value, cat, fallback) {
  const s = str(value).toUpperCase();
  if (!s) return fallback;
  return enValores(cat, s) ? s : fallback;
}

// ── Secciones del documento ────────────────────────────────────
// Cada sección es un sub-objeto. Mantener secciones como objetos
// (en vez de aplanar campos) permite a las reglas Firestore
// validar por sección y a la UI renderizar pestañas.

function sanitizeIdentificacion(src) {
  return {
    // Clave natural (Zonas/Subestación/Matrícula). Se valida en
    // rules que `codigo` sea único via índice.
    codigo:      str(src.codigo).toUpperCase(),
    matricula:   str(src.matricula),
    nombre:      str(src.nombre),
    tipo_activo: normEnumUpper(src.tipo_activo, TIPOS_ACTIVO, 'POTENCIA'),
    // UUCC CREG. Se acepta pero se banderiza si no es regulada.
    uucc:        (() => {
      const u = str(src.uucc).toUpperCase();
      return UUCC_PATTERN.test(u) && esUUCCValida(u) ? u : '';
    })(),
    grupo:       normEnumUpper(src.grupo, GRUPOS, '')
  };
}

function sanitizePlaca(src) {
  return {
    marca:                 str(src.marca),
    modelo:                str(src.modelo),
    serial:                str(src.serial),
    norma_fabricacion:     str(src.norma_fabricacion),
    numero_fabrica:        str(src.numero_fabrica),
    potencia_kva:          num(src.potencia_kva),
    // Algunos transformadores tienen potencia con múltiples etapas
    // (ONAN/ONAF/OFAF). Campos opcionales.
    potencia_onan_kva:     num(src.potencia_onan_kva),
    potencia_onaf_kva:     num(src.potencia_onaf_kva),
    potencia_ofaf_kva:     num(src.potencia_ofaf_kva)
  };
}

function sanitizeUbicacion(src) {
  return {
    departamento: normEnum(str(src.departamento).toLowerCase(), DEPARTAMENTOS, ''),
    municipio:    str(src.municipio),
    zona:         normEnumUpper(src.zona, ZONAS, ''),
    subestacionId:     str(src.subestacionId),
    // Acepta `subestacion_nombre` (v2) o `subestacion` (alias v1).
    subestacion_nombre: str(src.subestacion_nombre || src.subestacion),
    direccion:    str(src.direccion),
    latitud:      num(src.latitud),
    longitud:     num(src.longitud)
  };
}

function sanitizeElectrico(src) {
  return {
    tension_primaria_kv:   num(src.tension_primaria_kv),
    tension_secundaria_kv: num(src.tension_secundaria_kv),
    tension_terciaria_kv:  num(src.tension_terciaria_kv),
    // Corrientes nominales (primario/secundario/terciario)
    // requeridas por el cálculo CRG (MO.00418 §4.1.4).
    corriente_nominal_primaria_a:   num(src.corriente_nominal_primaria_a),
    corriente_nominal_secundaria_a: num(src.corriente_nominal_secundaria_a),
    corriente_nominal_terciaria_a:  num(src.corriente_nominal_terciaria_a),
    grupo_conexion:         str(src.grupo_conexion),
    impedancia_cc_pct:      num(src.impedancia_cc_pct),
    tap_cambiador:          str(src.tap_cambiador),
    tap_actual:             num(src.tap_actual),
    tipo_tap:               str(src.tipo_tap)    // OLTC | NLTC | FIJO
  };
}

function sanitizeMecanico(src) {
  return {
    peso_total_kg:     num(src.peso_total_kg),
    peso_aceite_kg:    num(src.peso_aceite_kg),
    volumen_aceite_l:  num(src.volumen_aceite_l),
    tipo_tanque:       str(src.tipo_tanque),
    bushings_tipo:     str(src.bushings_tipo)
  };
}

function sanitizeRefrigeracion(src) {
  return {
    tipo_refrigeracion: str(src.tipo_refrigeracion),  // ONAN/ONAF/OFAF
    cantidad_radiadores: num(src.cantidad_radiadores),
    cantidad_ventiladores: num(src.cantidad_ventiladores),
    cantidad_bombas:    num(src.cantidad_bombas)
  };
}

function sanitizeProtecciones(src) {
  return {
    // Campo descriptivo libre del equipamiento instalado (releés
    // diferenciales, Buchholz, DPS, etc.). La CALIFICACIÓN PYT
    // se guarda en salud_actual.calif_pyt.
    relé_diferencial:      bool(src.rele_diferencial ?? src['relé_diferencial']),
    rele_sobrecorriente:   bool(src.rele_sobrecorriente),
    rele_buchholz:         bool(src.rele_buchholz),
    dps_instalado:         bool(src.dps_instalado),
    telecontrol_scada:     bool(src.telecontrol_scada),
    scada_operativo:       bool(src.scada_operativo),
    observaciones_pyt:     str(src.observaciones_pyt)
  };
}

function sanitizeFabricacion(src) {
  return {
    // MO.00418 §4.1.5: la edad se calcula año_fab → hoy.
    ano_fabricacion:     num(src.ano_fabricacion),
    fecha_fabricacion:   str(src.fecha_fabricacion),   // ISO (YYYY-MM-DD) opcional
    pais_fabricacion:    str(src.pais_fabricacion)
  };
}

function sanitizeServicio(src) {
  return {
    fecha_instalacion:  str(src.fecha_instalacion),    // ISO
    fecha_energizacion: str(src.fecha_energizacion),   // ISO
    horas_operacion:    num(src.horas_operacion),
    observaciones:      str(src.observaciones),
    usuarios_aguas_abajo: num(src.usuarios_aguas_abajo)
  };
}

// ── Sub-objeto salud_actual ────────────────────────────────────
// MO.00418 §4.2 — snapshot del último HI calculado. Se actualiza
// por trigger `onMuestraCreate` de F19 (muestras) y por
// `onUmbralesChange` cuando el admin edita /umbrales_salud/global.
// F16 RESERVA el shape; el cálculo real vive en F18 (motor).

function sanitizeSaludActual(src) {
  if (src == null || typeof src !== 'object') {
    return emptySaludActual();
  }
  const califInt = (v) => {
    const n = num(v);
    if (n == null) return null;
    const r = Math.round(n);
    return (r >= 1 && r <= 5) ? r : null;
  };
  const califFloat = (v) => {
    const n = num(v);
    return (n == null) ? null : Math.max(1.0, Math.min(5.0, n));
  };
  return {
    ts_calculo:             str(src.ts_calculo),
    muestra_dga_ref:        str(src.muestra_dga_ref),
    muestra_adfq_ref:       str(src.muestra_adfq_ref),
    muestra_fur_ref:        str(src.muestra_fur_ref),
    // Subcalificaciones DGA (MO.00418 §4.1.1 — A3.1)
    calif_tdgc:             califInt(src.calif_tdgc),
    calif_co:               califInt(src.calif_co),
    calif_co2:              califInt(src.calif_co2),
    calif_c2h2:             califInt(src.calif_c2h2),
    eval_dga:               califFloat(src.eval_dga),
    // ADFQ (§4.1.2 — A3.2)
    calif_rd:               califInt(src.calif_rd),
    calif_ic:               califInt(src.calif_ic),
    eval_adfq:              califFloat(src.eval_adfq),
    // FUR + vida útil (§4.1.2 — A3.3, Chedong)
    calif_fur:              califInt(src.calif_fur),
    dp_estimado:            num(src.dp_estimado),
    vida_utilizada_pct:     num(src.vida_utilizada_pct),
    vida_remanente_pct:     num(src.vida_remanente_pct),
    // CRG (§4.1.3 — A3.4)
    calif_crg:              califInt(src.calif_crg),
    crg_pct_medido:         num(src.crg_pct_medido),
    // EDAD (§4.1.5 — A3.5)
    calif_edad:             califInt(src.calif_edad),
    edad_anos:              num(src.edad_anos),
    // HER (§4.1.6 — A3.6)
    calif_her:              califInt(src.calif_her),
    ubicacion_fuga_dominante: normEnum(src.ubicacion_fuga_dominante, UBICACIONES_FUGA, ''),
    // PYT (§4.1.7 — A3.7)
    calif_pyt:              califInt(src.calif_pyt),
    // HI final y trazabilidad
    hi_bruto:               califFloat(src.hi_bruto),
    hi_final:               califFloat(src.hi_final),
    bucket:                 normEnum(src.bucket, BUCKETS_HI, ''),
    overrides_aplicados:    arrStr(src.overrides_aplicados),
    // Flag permanente (MO.00418 §4.1.2 Nota Técnica FUR)
    fin_vida_util_papel:    bool(src.fin_vida_util_papel)
  };
}

function emptySaludActual() {
  return {
    ts_calculo: '', muestra_dga_ref: '', muestra_adfq_ref: '', muestra_fur_ref: '',
    calif_tdgc: null, calif_co: null, calif_co2: null, calif_c2h2: null, eval_dga: null,
    calif_rd: null, calif_ic: null, eval_adfq: null,
    calif_fur: null, dp_estimado: null, vida_utilizada_pct: null, vida_remanente_pct: null,
    calif_crg: null, crg_pct_medido: null,
    calif_edad: null, edad_anos: null,
    calif_her: null, ubicacion_fuga_dominante: '',
    calif_pyt: null,
    hi_bruto: null, hi_final: null, bucket: '',
    overrides_aplicados: [], fin_vida_util_papel: false
  };
}

function sanitizeCriticidad(src) {
  if (src == null || typeof src !== 'object') {
    return { usuarios_aguas_abajo: null, nivel: '', ts_calculo: '' };
  }
  return {
    usuarios_aguas_abajo: num(src.usuarios_aguas_abajo),
    nivel:                str(src.nivel).toLowerCase(),
    ts_calculo:           str(src.ts_calculo)
  };
}

function sanitizeRestriccionesOperativas(src) {
  // Reservado para A9.3 / F29. En F16 se acepta un objeto plano
  // con campos numéricos y texto libre; F29 endurecerá el shape.
  if (src == null || typeof src !== 'object') return null;
  return {
    cargabilidad_max_pct:           num(src.cargabilidad_max_pct),
    temperatura_aceite_max_c:       num(src.temperatura_aceite_max_c),
    frecuencia_muestreo_dga_dias:   num(src.frecuencia_muestreo_dga_dias),
    frecuencia_muestreo_fur_dias:   num(src.frecuencia_muestreo_fur_dias),
    requiere_inspeccion_ocular_dias:num(src.requiere_inspeccion_ocular_dias),
    autorizado_por:                 str(src.autorizado_por),
    fecha_inicio:                   str(src.fecha_inicio),
    fecha_fin_prevista:             str(src.fecha_fin_prevista),
    motivo:                         str(src.motivo),
    notas:                          str(src.notas)
  };
}

// ── Sanitizador raíz (API pública) ─────────────────────────────
/**
 * Toma una entrada cualquiera (formulario, fila Excel, doc v1) y
 * devuelve el documento canónico v2, listo para persistir.
 *
 * No llama a Firestore. No toca serverTimestamp. Los timestamps
 * los añade la data layer (v2 transformadores.js).
 *
 * @param {object} input — datos crudos.
 * @returns {object} documento v2 normalizado.
 */
export function sanitizarTransformador(input) {
  const src = input || {};

  // Estados especiales: array de strings validado contra el
  // catálogo. F16 permite array vacío; F29 poblará banderas.
  const estadosEsp = arrStr(src.estados_especiales || [])
    .filter((v) => enValores(ESTADOS_ESPECIALES, v));

  return {
    // Versión de esquema — escritas por esta función.
    schema_version: SCHEMA_VERSION,

    // Estado de servicio (enum).
    estado_servicio: normEnum(src.estado_servicio || src.estado, ESTADOS_SERVICIO, 'operativo'),
    estados_especiales: estadosEsp,

    // Secciones del activo.
    identificacion:  sanitizeIdentificacion(src.identificacion || src),
    placa:           sanitizePlaca(src.placa || src),
    ubicacion:       sanitizeUbicacion(src.ubicacion || src),
    electrico:       sanitizeElectrico(src.electrico || src),
    mecanico:        sanitizeMecanico(src.mecanico || src),
    refrigeracion:   sanitizeRefrigeracion(src.refrigeracion || src),
    protecciones:    sanitizeProtecciones(src.protecciones || src),
    fabricacion:     sanitizeFabricacion(src.fabricacion || src),
    servicio:        sanitizeServicio(src.servicio || src),

    // Snapshots derivados (se recalculan por trigger F18/F36).
    salud_actual:    sanitizeSaludActual(src.salud_actual),
    criticidad:      sanitizeCriticidad(src.criticidad),

    // Restricciones operativas (OTC — A9.3). `null` si no aplica.
    restricciones_operativas: src.restricciones_operativas
      ? sanitizeRestriccionesOperativas(src.restricciones_operativas)
      : null
  };
}

// ── Validaciones duras (usadas por create/update en data layer) ─
// Retornan array de errores ([] = OK). La data layer puede lanzar
// o mostrar inline según contexto.

export function validarTransformador(doc) {
  const errs = [];
  if (!doc || typeof doc !== 'object') { errs.push('Documento vacío.'); return errs; }

  const id = doc.identificacion || {};
  if (!id.codigo)    errs.push('identificacion.codigo es obligatorio.');
  if (!id.nombre)    errs.push('identificacion.nombre es obligatorio.');
  if (!enValores(TIPOS_ACTIVO, id.tipo_activo)) {
    errs.push(`identificacion.tipo_activo inválido: "${id.tipo_activo}".`);
  }
  if (id.uucc && !esUUCCValida(id.uucc)) {
    errs.push(`identificacion.uucc inválida: "${id.uucc}". Debe matchear ${UUCC_PATTERN}.`);
  }
  if (id.grupo && !enValores(GRUPOS, id.grupo)) {
    errs.push(`identificacion.grupo inválido: "${id.grupo}".`);
  }

  const ub = doc.ubicacion || {};
  if (!ub.departamento) errs.push('ubicacion.departamento es obligatorio.');
  if (ub.zona && !enValores(ZONAS, ub.zona)) {
    errs.push(`ubicacion.zona inválida: "${ub.zona}".`);
  }
  if (ub.latitud != null && (ub.latitud < -90 || ub.latitud > 90)) {
    errs.push(`ubicacion.latitud fuera de rango: ${ub.latitud}.`);
  }
  if (ub.longitud != null && (ub.longitud < -180 || ub.longitud > 180)) {
    errs.push(`ubicacion.longitud fuera de rango: ${ub.longitud}.`);
  }

  if (!enValores(ESTADOS_SERVICIO, doc.estado_servicio)) {
    errs.push(`estado_servicio inválido: "${doc.estado_servicio}".`);
  }

  // salud_actual.calif_* ∈ [1,5] ya está clampeado por el
  // sanitizador; no se valida aquí.

  return errs;
}

// ── Proyección "v1 compatible" ─────────────────────────────────
// Para que vistas y módulos aún no migrados (Inventario UI, KPIs,
// Mapa, Alertas) sigan funcionando sin cambios durante la
// convivencia v1/v2. Exporta los campos v1 al nivel raíz.
//
// Se elimina cuando F19–F27 migren todas las vistas.

export function proyeccionV1(docV2) {
  const d = docV2 || {};
  const id = d.identificacion || {};
  const pl = d.placa || {};
  const ub = d.ubicacion || {};
  const el = d.electrico || {};
  const fa = d.fabricacion || {};
  const se = d.servicio || {};

  // Mapeo de estado_servicio → estado v1 (que no tenía "fallado").
  const estadoV1 = d.estado_servicio === 'fallado' ? 'retirado' : d.estado_servicio;

  return {
    codigo:                id.codigo || '',
    nombre:                id.nombre || '',
    departamento:          ub.departamento || '',
    municipio:             ub.municipio || '',
    subestacion:           ub.subestacion_nombre || '',
    potencia_kva:          pl.potencia_kva,
    tension_primaria_kv:   el.tension_primaria_kv,
    tension_secundaria_kv: el.tension_secundaria_kv,
    marca:                 pl.marca || '',
    modelo:                pl.modelo || '',
    serial:                pl.serial || '',
    fecha_fabricacion:     fa.fecha_fabricacion || '',
    fecha_instalacion:     se.fecha_instalacion || '',
    estado:                estadoV1 || 'operativo',
    latitud:               ub.latitud,
    longitud:              ub.longitud,
    observaciones:         se.observaciones || ''
  };
}
