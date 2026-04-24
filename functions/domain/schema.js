// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain Schema v2 (Fase 16)
// ──────────────────────────────────────────────────────────────
// Fuente canónica de enumeraciones, catálogos y validadores del
// modelo de datos v2. Cualquier cambio de dominio (nuevo rol,
// nueva zona, nuevo estado especial) se hace aquí, no en las
// capas que consumen (data layer, UI, rules).
//
// Referencia normativa:
//   MO.00418.DE-GAC-AX.01 Ed. 02 (14/10/2025) — CARIBEMAR DE LA
//   COSTA S.A.S E.S.P · Afinia · Grupo EPM.
//
// Módulo ES Module. Puro (sin side effects). Importable tanto
// desde el navegador (data layer, UI) como desde Node (tests y
// scripts de migración).
// ══════════════════════════════════════════════════════════════

// ── Identidad institucional ────────────────────────────────────
// Usado en reportes PDF, correos y pies de página oficiales.
export const INSTITUCION = Object.freeze({
  operador_razon_social: 'CARIBEMAR DE LA COSTA S.A.S E.S.P',
  operador_marca:        'Afinia',
  casa_matriz:           'Grupo EPM',
  procedimiento_codigo:  'MO.00418.DE-GAC-AX.01',
  procedimiento_edicion: 'Ed. 02',
  procedimiento_fecha:   '2025-10-14'
});

// ── Tipo de activo ─────────────────────────────────────────────
// MO.00418 §1 — tres parques gestionados con la misma metodología.
export const TIPOS_ACTIVO = Object.freeze([
  { value: 'POTENCIA',  label: 'TX Potencia'        },
  { value: 'TPT',       label: 'TX Servicios Propios (TPT)' },
  { value: 'RESPALDO',  label: 'TX Respaldo'        }
]);

// ── Zonas operativas ───────────────────────────────────────────
// MO.00418 — distribución administrativa interna.
export const ZONAS = Object.freeze([
  { value: 'BOLIVAR',    label: 'Bolívar'    },
  { value: 'ORIENTE',    label: 'Oriente'    },
  { value: 'OCCIDENTE',  label: 'Occidente'  }
]);

// ── Grupos (plan de mantenimiento) ─────────────────────────────
export const GRUPOS = Object.freeze([
  { value: 'G1', label: 'Grupo 1' },
  { value: 'G2', label: 'Grupo 2' },
  { value: 'G3', label: 'Grupo 3' }
]);

// ── Departamentos cubiertos ────────────────────────────────────
export const DEPARTAMENTOS = Object.freeze([
  { value: 'bolivar',   label: 'Bolívar',   zona: 'BOLIVAR'   },
  { value: 'cordoba',   label: 'Córdoba',   zona: 'OCCIDENTE' },
  { value: 'sucre',     label: 'Sucre',     zona: 'OCCIDENTE' },
  { value: 'cesar',     label: 'Cesar',     zona: 'ORIENTE'   },
  { value: 'magdalena', label: 'Magdalena', zona: 'ORIENTE'   }
]);

// ── Municipios de Magdalena cubiertos ──────────────────────────
// MO.00418 — lista oficial (11 municipios).
export const MUNICIPIOS_MAGDALENA = Object.freeze([
  'Santa Bárbara de Pinto',
  'San Zenón',
  'Pijiño del Carmen',
  'Santa Ana',
  'San Sebastián de Buenavista',
  'Guamal',
  'El Banco',
  'Nueva Granada',
  'Algarrobo',
  'Sabanas de San Ángel',
  'Ariguaní'
]);

// ── Estado de servicio (workflow principal) ────────────────────
// Estado "físico" del activo en el sistema. Coexiste con
// `estados_especiales[]` (banderas no exclusivas, ver abajo).
export const ESTADOS_SERVICIO = Object.freeze([
  { value: 'operativo',       label: 'Operativo'          },
  { value: 'mantenimiento',   label: 'En mantenimiento'   },
  { value: 'fuera_servicio',  label: 'Fuera de servicio'  },
  { value: 'retirado',        label: 'Retirado / Baja'    },
  { value: 'fallado',         label: 'Fallado (histórico)' }
]);

// ── Estados especiales del activo ──────────────────────────────
// MO.00418 §4.1.1, §4.1.2 Nota Técnica FUR, §4.1 Nota Técnica
// C₂H₂. Banderas NO excluyentes entre sí (un activo puede estar
// en "monitoreo_intensivo_c2h2" Y "operacion_temporal_controlada"
// al mismo tiempo). F16 sólo reserva el campo; el workflow se
// implementa en F29.
export const ESTADOS_ESPECIALES = Object.freeze([
  { value: 'monitoreo_intensivo_c2h2',     label: 'Monitoreo intensivo C₂H₂',     ref: 'MO.00418 §4.1 Nota Técnica C₂H₂' },
  { value: 'propuesta_fur_pendiente',      label: 'Propuesta FUR pendiente',      ref: 'MO.00418 §4.1.2 Nota Técnica FUR' },
  { value: 'operacion_temporal_controlada',label: 'Operación temporal controlada',ref: 'MO.00418 §4.1.2' },
  { value: 'pendiente_reemplazo',          label: 'Pendiente de reemplazo',       ref: 'MO.00418 §4.3 Condición 5' },
  { value: 'reemplazado',                  label: 'Reemplazado (histórico)',      ref: '' },
  { value: 'fin_vida_util_papel',          label: 'Fin de vida útil del papel',   ref: 'MO.00418 §4.1.2' }
]);

// ── Escala de condición 1–5 (oficial MO.00418 §4.2, Tabla 11) ──
// Nombres oficiales tomados del eje Y de la matriz. NUNCA usar
// "excelente/regular/malo" en UI — son términos descartados.
export const CONDICIONES = Object.freeze([
  { value: 1, key: 'muy_bueno',  label: 'Muy Bueno',  color: '#1B8E3F' },
  { value: 2, key: 'bueno',      label: 'Bueno',      color: '#4CB050' },
  { value: 3, key: 'medio',      label: 'Medio',      color: '#F5C518' },
  { value: 4, key: 'pobre',      label: 'Pobre',      color: '#EF7820' },
  { value: 5, key: 'muy_pobre',  label: 'Muy Pobre',  color: '#E53935' }
]);

// ── Buckets del HI continuo ────────────────────────────────────
// MO.00418 §4.2 — HI ∈ [1.0, 5.0] se clasifica en 5 buckets.
// `value` alias de `key` para compat con el helper genérico
// `enValores` y los sanitizadores que consumen buckets como enum.
export const BUCKETS_HI = Object.freeze([
  { key: 'muy_bueno', value: 'muy_bueno', min: 1.0, max: 1.5, label: 'Muy Bueno', color: '#1B8E3F' },
  { key: 'bueno',     value: 'bueno',     min: 1.5, max: 2.5, label: 'Bueno',     color: '#4CB050' },
  { key: 'medio',     value: 'medio',     min: 2.5, max: 3.5, label: 'Medio',     color: '#F5C518' },
  { key: 'pobre',     value: 'pobre',     min: 3.5, max: 4.5, label: 'Pobre',     color: '#EF7820' },
  { key: 'muy_pobre', value: 'muy_pobre', min: 4.5, max: 5.01,label: 'Muy Pobre', color: '#E53935' }
]);

// ── Niveles de criticidad (matriz 5×5) ─────────────────────────
// MO.00418 §4.2.1. Orden de menor a mayor consecuencia.
export const NIVELES_CRITICIDAD = Object.freeze([
  { value: 'minima',    label: 'Mínima',    orden: 1 },
  { value: 'menor',     label: 'Menor',     orden: 2 },
  { value: 'moderada',  label: 'Moderada',  orden: 3 },
  { value: 'mayor',     label: 'Mayor',     orden: 4 },
  { value: 'maxima',    label: 'Máxima',    orden: 5 }
]);

// ── Pesos oficiales del Health Index ───────────────────────────
// FUENTE CANÓNICA: MO.00418.DE-GAC-AX.01 Ed. 02, Tabla 10.
// §A9.8 del prompt v2.2: los títulos de §4.2.3–§4.2.9 y los
// porcentajes citados en párrafos NO coinciden entre sí; la
// Tabla 10 (suma = 100 %) es la única oficialmente correcta.
//
//   HI = 0.35·DGA + 0.30·EDAD + 0.15·ADFQ
//      + 0.05·FUR + 0.05·CRG + 0.05·PYT + 0.05·HER
export const PESOS_HI = Object.freeze({
  DGA:  0.35,
  EDAD: 0.30,
  ADFQ: 0.15,
  FUR:  0.05,
  CRG:  0.05,
  PYT:  0.05,
  HER:  0.05
});

// Verificación estructural en tiempo de carga.
(() => {
  const suma = Object.values(PESOS_HI).reduce((a, b) => a + b, 0);
  if (Math.abs(suma - 1.0) > 1e-9) {
    throw new Error(
      `[schema] PESOS_HI no suman 1.0 (actual = ${suma}). ` +
      `Corrija la Tabla 10 del MO.00418.`
    );
  }
})();

// ── Catálogo UUCC (CREG 085/2018) ──────────────────────────────
// §A8 + §A9: UUCC aplicables al reconocimiento de vida útil 30
// años son N4T1–N4T19 y N5T1–N5T25. Otros niveles (N3T…) se
// aceptan en el catálogo general pero NO gozan del beneficio
// regulatorio.
const UUCC_REGULADAS = (() => {
  const set = new Set();
  for (let i = 1; i <= 19; i++) set.add(`N4T${i}`);
  for (let i = 1; i <= 25; i++) set.add(`N5T${i}`);
  return Object.freeze(set);
})();

const UUCC_VALIDAS = (() => {
  const set = new Set(UUCC_REGULADAS);
  for (let i = 1; i <= 25; i++) set.add(`N3T${i}`);
  return Object.freeze(set);
})();

export const UUCC_PATTERN = /^N[345]T[0-9]{1,2}$/;

export function esUUCCValida(uucc) {
  if (typeof uucc !== 'string') return false;
  const u = uucc.trim().toUpperCase();
  return UUCC_PATTERN.test(u) && UUCC_VALIDAS.has(u);
}

export function esUUCCRegulada(uucc) {
  if (typeof uucc !== 'string') return false;
  return UUCC_REGULADAS.has(uucc.trim().toUpperCase());
}

export function listarUUCCValidas() {
  return Array.from(UUCC_VALIDAS).sort((a, b) => {
    const [, nA, tA] = a.match(/N([345])T(\d+)/);
    const [, nB, tB] = b.match(/N([345])T(\d+)/);
    return (+nA - +nB) || (+tA - +tB);
  });
}

// ── Ubicación de fugas (Hermeticidad, MO.00418 §4.1.6) ─────────
// La calificación de HER depende de la UBICACIÓN DOMINANTE de la
// fuga, no del scoring por componente (que era el enfoque del
// Excel original y está documentado como error en §D7).
export const UBICACIONES_FUGA = Object.freeze([
  { value: 'sin_fugas',       label: 'Sin fugas',                calif: 1 },
  { value: 'laterales',       label: 'Fugas laterales',          calif: 2 },
  { value: 'junction_block',  label: 'Fugas por Junction Block', calif: 3 },
  { value: 'accesorios',      label: 'Fugas por accesorios',     calif: 4 },
  { value: 'superiores',      label: 'Fugas superiores (tapa, aisladores, relé Buchholz, indicador de nivel, válvula de alivio)', calif: 5 }
]);

// ── Tipos de diagnóstico DGA ───────────────────────────────────
// IEC 60599 + IEEE C57.104. Usados por F18 (motor de
// diagnóstico Duval/Rogers/Doernenburg).
export const DIAGNOSTICOS_DGA = Object.freeze([
  { value: 'NORMAL',       label: 'Normal',                               severidad: 1 },
  { value: 'PD',           label: 'Descargas parciales (PD)',             severidad: 3 },
  { value: 'T1',           label: 'Falla térmica < 300 °C (T1)',          severidad: 2 },
  { value: 'T2',           label: 'Falla térmica 300–700 °C (T2)',        severidad: 3 },
  { value: 'T3',           label: 'Falla térmica > 700 °C (T3)',          severidad: 4 },
  { value: 'D1',           label: 'Descarga baja energía (D1)',           severidad: 3 },
  { value: 'D2',           label: 'Descarga alta energía / arco (D2)',    severidad: 5 },
  { value: 'DT',           label: 'Descarga y térmica combinadas',        severidad: 4 },
  { value: 'INDETERMINADO',label: 'Indeterminado',                        severidad: 0 }
]);

// ── Roles RBAC (F28) ───────────────────────────────────────────
// Lista cerrada confirmada por el director (dedup de lista
// provista en el chat al autorizar F16). Se incluye `admin` como
// rol de sistema heredado de F14 para retrocompatibilidad con
// /usuarios/{uid} existente.
export const ROLES = Object.freeze([
  { value: 'admin',              label: 'Admin (sistema)',                               sistema: true  },
  { value: 'director_proyectos', label: 'Ingeniero Director de proyectos',               sistema: false },
  { value: 'analista_tx',        label: 'Ingeniero Analista de transformadores de potencia', sistema: false },
  { value: 'gestor_contractual', label: 'Encargado de gestión y seguimiento administrativo/contractual', sistema: false },
  { value: 'brigadista',         label: 'Encargado de la brigada de transformadores',    sistema: false },
  { value: 'auditor_campo',      label: 'Auditor en campo de aliados estratégicos y gestión técnica-operativa', sistema: false }
]);

// Rol legacy F14 (`tecnico`) se acepta durante la migración hasta
// que F28 cierre el mapeo. Una vez F28 en prod, los perfiles con
// rol='tecnico' deben reasignarse a `analista_tx` o `brigadista`.
export const ROLES_LEGACY = Object.freeze(['tecnico']);

export function esRolValido(rol) {
  if (typeof rol !== 'string') return false;
  return ROLES.some((r) => r.value === rol) || ROLES_LEGACY.includes(rol);
}

// ── Normativas referenciadas (lista oficial §A8) ───────────────
// Usada como FK validable en `documentos.norma_aplicable` y como
// label en UI de umbrales/reportes.
export const NORMATIVAS = Object.freeze([
  { value: 'IEEE_C57_91',  label: 'IEEE C57.91 — Loading guide'            },
  { value: 'IEEE_C57_104', label: 'IEEE C57.104 — DGA'                     },
  { value: 'IEEE_C57_109', label: 'IEEE C57.109 — Cortocircuito'           },
  { value: 'IEEE_C57_125', label: 'IEEE C57.125 — Análisis de fallas'      },
  { value: 'IEEE_C57_12',  label: 'IEEE C57.12 — General requirements'     },
  { value: 'IEC_60076_1',  label: 'IEC 60076-1 — TX de potencia'           },
  { value: 'IEC_60076_7',  label: 'IEC 60076-7 — Carga en aceite'          },
  { value: 'IEC_60567',    label: 'IEC 60567 — Muestreo gases'             },
  { value: 'IEC_60599',    label: 'IEC 60599 — Interpretación DGA'         },
  { value: 'IEC_61198',    label: 'IEC 61198 — Ensayo furanos'             },
  { value: 'CIGRE_445',    label: 'CIGRÉ 445 — Mantenimiento TX'           },
  { value: 'CIGRE_WG_A2',  label: 'CIGRÉ WG A2'                            },
  { value: 'ISO_55001',    label: 'ISO 55001 — Gestión de activos'         },
  { value: 'ISO_50001',    label: 'ISO 50001:2018 — Gestión de la energía' },
  { value: 'ASTM_D877',    label: 'ASTM D877 — Rigidez (electrodos disco)' },
  { value: 'ASTM_D1816',   label: 'ASTM D1816 — Rigidez (electrodos VDE)'  },
  { value: 'ASTM_D1533',   label: 'ASTM D1533 — Humedad Karl Fischer'      },
  { value: 'ASTM_D974',    label: 'ASTM D974 — Acidez'                     },
  { value: 'ASTM_D664',    label: 'ASTM D664 — Acidez potenciométrica'     },
  { value: 'ASTM_D924_23', label: 'ASTM D924-23 — Factor potencia aceite'  },
  { value: 'ASTM_D1500_24',label: 'ASTM D1500-24 — Color'                  },
  { value: 'ASTM_D445',    label: 'ASTM D445 — Viscosidad cinemática'      },
  { value: 'ASTM_D5837_15',label: 'ASTM D5837-15 — Furanos'                },
  { value: 'ASTM_D1275',   label: 'ASTM D1275 — Azufre corrosivo'          },
  { value: 'NTC_3284',     label: 'NTC 3284 — Rigidez dieléctrica'         },
  { value: 'NTC_IEC_60364',label: 'NTC-IEC 60364'                          },
  { value: 'RETIE',        label: 'RETIE'                                  },
  { value: 'CREG_085_2018',label: 'Resolución CREG 085/2018 — Vida útil'   },
  { value: 'PEGA',         label: 'Plan de Expansión Generación/Transmisión' },
  { value: 'NINGUNA',      label: 'Ninguna'                                }
]);

// ── Helpers de lookup por enum ─────────────────────────────────

export function tipoActivoLabel(v)     { return lookupLabel(TIPOS_ACTIVO, v); }
export function zonaLabel(v)           { return lookupLabel(ZONAS, v); }
export function grupoLabel(v)          { return lookupLabel(GRUPOS, v); }
export function departamentoLabel(v)   { return lookupLabel(DEPARTAMENTOS, v); }
export function estadoServicioLabel(v) { return lookupLabel(ESTADOS_SERVICIO, v); }
export function condicionLabel(v)      { return lookupLabel(CONDICIONES, v); }
export function criticidadLabel(v)     { return lookupLabel(NIVELES_CRITICIDAD, v); }
export function ubicacionFugaLabel(v)  { return lookupLabel(UBICACIONES_FUGA, v); }
export function rolLabel(v)            { return lookupLabel(ROLES, v); }
export function normativaLabel(v)      { return lookupLabel(NORMATIVAS, v); }

function lookupLabel(cat, v) {
  if (v == null || v === '') return '—';
  const hit = cat.find((x) => x.value === v || x.value === String(v));
  return hit ? hit.label : String(v);
}

// ── Enum guards (usados por data layer y tests) ────────────────

export function enValores(catalogo, valor) {
  if (!Array.isArray(catalogo)) return false;
  return catalogo.some((x) => x.value === valor);
}

// ── Bucket del HI a partir del valor continuo ──────────────────

export function bucketDesdeHI(hi) {
  if (typeof hi !== 'number' || Number.isNaN(hi)) return null;
  // Dominio esperado [1, 5]. Clampear para evitar NaN por muestras corruptas.
  const v = Math.min(5, Math.max(1, hi));
  const b = BUCKETS_HI.find((x) => v >= x.min && v < x.max);
  return b ? b.key : 'muy_pobre';
}

// ── Versionado del schema (usado por migraciones) ──────────────

export const SCHEMA_VERSION = 2;
