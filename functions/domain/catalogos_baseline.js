// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Catálogos baseline (F22 · §A7)
// ──────────────────────────────────────────────────────────────
// Seed oficial de subactividades, macroactividades y causantes
// extraídas del MO.00418 §4.3 "Estrategias de Mantenimiento
// Diferenciada según Estado de Salud".
// ══════════════════════════════════════════════════════════════

// ── Subactividades por condición objetivo ──────────────────────
export const SUBACTIVIDADES_BASELINE = Object.freeze([
  // Condición 1 — PSM
  { codigo: 'SUB-PSM-01', nombre: 'Muestreo de aceite (semestral)', condicion_objetivo: 1, especialidad: 'LAB',  tiempo_h: 2, costo_ref: 150000 },
  { codigo: 'SUB-PSM-02', nombre: 'Pruebas eléctricas (anual)',      condicion_objetivo: 1, especialidad: 'ELE',  tiempo_h: 6, costo_ref: 1500000 },
  { codigo: 'SUB-PSM-03', nombre: 'Inspección ocular detallada (mensual)', condicion_objetivo: 1, especialidad: 'MEC', tiempo_h: 1, costo_ref: 80000 },
  { codigo: 'SUB-PSM-04', nombre: 'Inspección termográfica (semestral)',   condicion_objetivo: 1, especialidad: 'TERM', tiempo_h: 2, costo_ref: 250000 },
  { codigo: 'SUB-PSM-05', nombre: 'Diagnóstico sistema puesta a tierra (anual)', condicion_objetivo: 1, especialidad: 'ELE', tiempo_h: 4, costo_ref: 600000 },

  // Condición 2 — Seguimiento Trimestral
  { codigo: 'SUB-C2-01', nombre: 'Inspección termográfica trimestral',       condicion_objetivo: 2, especialidad: 'TERM', tiempo_h: 2, costo_ref: 250000 },
  { codigo: 'SUB-C2-02', nombre: 'Verificación sistemas de enfriamiento',     condicion_objetivo: 2, especialidad: 'MEC',  tiempo_h: 3, costo_ref: 400000 },
  { codigo: 'SUB-C2-03', nombre: 'Verificación indicadores de temperatura',   condicion_objetivo: 2, especialidad: 'ELE',  tiempo_h: 2, costo_ref: 200000 },
  { codigo: 'SUB-C2-04', nombre: 'Inspección ocular detallada (quincenal)',    condicion_objetivo: 2, especialidad: 'MEC',  tiempo_h: 1, costo_ref: 80000 },
  { codigo: 'SUB-C2-05', nombre: 'Pruebas eléctricas',                         condicion_objetivo: 2, especialidad: 'ELE',  tiempo_h: 6, costo_ref: 1500000 },
  { codigo: 'SUB-C2-06', nombre: 'Evaluación de DPS',                          condicion_objetivo: 2, especialidad: 'ELE',  tiempo_h: 3, costo_ref: 450000 },

  // Condición 3 — Correctivo Menor
  { codigo: 'SUB-C3-01', nombre: 'Corrección de fugas por accesorios',         condicion_objetivo: 3, especialidad: 'MEC',  tiempo_h: 8,  costo_ref: 2000000 },
  { codigo: 'SUB-C3-02', nombre: 'Actualización de accesorios',                condicion_objetivo: 3, especialidad: 'MEC',  tiempo_h: 10, costo_ref: 3000000 },
  { codigo: 'SUB-C3-03', nombre: 'Actualización de tablero',                   condicion_objetivo: 3, especialidad: 'ELE',  tiempo_h: 12, costo_ref: 4500000 },
  { codigo: 'SUB-C3-04', nombre: 'Secado de aceite',                           condicion_objetivo: 3, especialidad: 'LAB',  tiempo_h: 24, costo_ref: 6000000 },
  { codigo: 'SUB-C3-05', nombre: 'Mantenimiento preventivo OLTC/NLTC',         condicion_objetivo: 3, especialidad: 'MEC',  tiempo_h: 16, costo_ref: 5500000 },
  { codigo: 'SUB-C3-06', nombre: 'Regeneración aceite (frío)',                 condicion_objetivo: 3, especialidad: 'LAB',  tiempo_h: 48, costo_ref: 15000000 },
  { codigo: 'SUB-C3-07', nombre: 'Recuperación aislamientos',                  condicion_objetivo: 3, especialidad: 'LAB',  tiempo_h: 36, costo_ref: 12000000 },
  // Mitigaciones C3
  { codigo: 'SUB-C3-M1', nombre: 'Aumento de caudal de refrigeración',          condicion_objetivo: 3, especialidad: 'MEC',  tiempo_h: 8,  costo_ref: 3500000, mitigacion: true },
  { codigo: 'SUB-C3-M2', nombre: 'Aumento de capacidad sistema refrigeración',  condicion_objetivo: 3, especialidad: 'MEC',  tiempo_h: 24, costo_ref: 20000000, mitigacion: true },
  { codigo: 'SUB-C3-M3', nombre: 'Instalación unidad de transformación adicional', condicion_objetivo: 3, especialidad: 'ELE', tiempo_h: 80, costo_ref: 350000000, mitigacion: true },

  // Condición 4 — Correctivo Mayor
  { codigo: 'SUB-C4-01', nombre: 'Regeneración de aceite',                     condicion_objetivo: 4, especialidad: 'LAB', tiempo_h: 72,  costo_ref: 25000000 },
  { codigo: 'SUB-C4-02', nombre: 'Secado de parte activa',                     condicion_objetivo: 4, especialidad: 'LAB', tiempo_h: 96,  costo_ref: 40000000 },
  { codigo: 'SUB-C4-03', nombre: 'Pintura parcial',                            condicion_objetivo: 4, especialidad: 'MEC', tiempo_h: 40,  costo_ref: 8000000 },
  { codigo: 'SUB-C4-04', nombre: 'Mantenimiento OLTC con despiece',            condicion_objetivo: 4, especialidad: 'MEC', tiempo_h: 60,  costo_ref: 30000000 },
  { codigo: 'SUB-C4-05', nombre: 'Inspección de parte activa',                 condicion_objetivo: 4, especialidad: 'MEC', tiempo_h: 24,  costo_ref: 10000000 },
  { codigo: 'SUB-C4-06', nombre: 'Reemplazo de bushings',                      condicion_objetivo: 4, especialidad: 'ELE', tiempo_h: 24,  costo_ref: 35000000 },
  { codigo: 'SUB-C4-07', nombre: 'Reemplazo o reparación componentes defectuosos', condicion_objetivo: 4, especialidad: 'MEC', tiempo_h: 16, costo_ref: 8000000 },
  { codigo: 'SUB-C4-08', nombre: 'Plan de mitigación sobrecarga 90-110 %',      condicion_objetivo: 4, especialidad: 'ING', tiempo_h: 8, costo_ref: 1500000, mitigacion: true },
  // Mitigaciones C4
  { codigo: 'SUB-C4-M1', nombre: 'Repotenciación de unidad de transformación',  condicion_objetivo: 4, especialidad: 'ELE',  tiempo_h: 120, costo_ref: 250000000, mitigacion: true },
  { codigo: 'SUB-C4-M2', nombre: 'Movimiento estratégico de transformadores',   condicion_objetivo: 4, especialidad: 'ELE',  tiempo_h: 60,  costo_ref: 80000000, mitigacion: true },

  // Condición 5 — Reemplazo / PI
  { codigo: 'SUB-C5-01', nombre: 'Pintura total',                              condicion_objetivo: 5, especialidad: 'MEC', tiempo_h: 80,  costo_ref: 18000000 },
  { codigo: 'SUB-C5-02', nombre: 'Retrofit de protecciones mecánicas y tableros', condicion_objetivo: 5, especialidad: 'ELE', tiempo_h: 60, costo_ref: 35000000 },
  { codigo: 'SUB-C5-03', nombre: 'Regeneración de aislamientos',               condicion_objetivo: 5, especialidad: 'LAB', tiempo_h: 120, costo_ref: 60000000 },
  { codigo: 'SUB-C5-04', nombre: 'Propuesta a Plan de Inversión (PI)',         condicion_objetivo: 5, especialidad: 'ING', tiempo_h: 16,  costo_ref: 2000000 },
  { codigo: 'SUB-C5-05', nombre: 'Aumento de capacidad de transformación',      condicion_objetivo: 5, especialidad: 'ING', tiempo_h: 160, costo_ref: 400000000 }
]);

// ── Macroactividades por condición ─────────────────────────────
export const MACROACTIVIDADES_BASELINE = Object.freeze([
  { codigo: 'MACRO-PSM', nombre: 'Programa de Seguimiento de Mantenimiento', condicion_objetivo: 1, periodicidad_dias: 180,
    subactividades: ['SUB-PSM-01','SUB-PSM-02','SUB-PSM-03','SUB-PSM-04','SUB-PSM-05'],
    referencia: 'MO.00418 §4.3 C1' },
  { codigo: 'MACRO-ST',  nombre: 'Seguimiento Trimestral',                    condicion_objetivo: 2, periodicidad_dias: 90,
    subactividades: ['SUB-C2-01','SUB-C2-02','SUB-C2-03','SUB-C2-04','SUB-C2-05','SUB-C2-06'],
    referencia: 'MO.00418 §4.3 C2' },
  { codigo: 'MACRO-CM',  nombre: 'Correctivo Menor',                          condicion_objetivo: 3, periodicidad_dias: null,
    subactividades: ['SUB-C3-01','SUB-C3-02','SUB-C3-03','SUB-C3-04','SUB-C3-05','SUB-C3-06','SUB-C3-07'],
    referencia: 'MO.00418 §4.3 C3' },
  { codigo: 'MACRO-CMA', nombre: 'Correctivo Mayor',                          condicion_objetivo: 4, periodicidad_dias: null,
    subactividades: ['SUB-C4-01','SUB-C4-02','SUB-C4-03','SUB-C4-04','SUB-C4-05','SUB-C4-06','SUB-C4-07','SUB-C4-08'],
    referencia: 'MO.00418 §4.3 C4' },
  { codigo: 'MACRO-REP', nombre: 'Reemplazo / Plan de Inversión',             condicion_objetivo: 5, periodicidad_dias: null,
    subactividades: ['SUB-C5-01','SUB-C5-02','SUB-C5-03','SUB-C5-04','SUB-C5-05'],
    referencia: 'MO.00418 §4.3 C5' },
  { codigo: 'MACRO-MIT-C3', nombre: 'Mitigación Cond. 3',                     condicion_objetivo: 3, periodicidad_dias: null,
    subactividades: ['SUB-C3-M1','SUB-C3-M2','SUB-C3-M3'],
    referencia: 'MO.00418 §4.3 C3 mitigación' },
  { codigo: 'MACRO-MIT-C4', nombre: 'Mitigación Cond. 4',                     condicion_objetivo: 4, periodicidad_dias: null,
    subactividades: ['SUB-C4-M1','SUB-C4-M2'],
    referencia: 'MO.00418 §4.3 C4 mitigación' }
]);

// ── Causantes (catálogo cerrado) ───────────────────────────────
export const CAUSANTES_BASELINE = Object.freeze([
  { codigo: 'CAU-01', nombre: 'Análisis físico-químico deficiente',    origen: 'ADFQ' },
  { codigo: 'CAU-02', nombre: 'Cargabilidad — sobrecarga 110-115 %',    origen: 'CRG' },
  { codigo: 'CAU-03', nombre: 'Cargabilidad — sobrecarga 115-120 %',    origen: 'CRG' },
  { codigo: 'CAU-04', nombre: 'Cargabilidad — sobrecarga 120-130 %',    origen: 'CRG' },
  { codigo: 'CAU-05', nombre: 'Alta generación de gases (DGA)',         origen: 'DGA' },
  { codigo: 'CAU-06', nombre: 'Envejecimiento avanzado del papel (FUR)', origen: 'FUR' },
  { codigo: 'CAU-07', nombre: 'Fin de vida útil (EDAD)',                origen: 'EDAD' },
  { codigo: 'CAU-08', nombre: 'Hermeticidad y temperatura',             origen: 'HER' },
  { codigo: 'CAU-09', nombre: 'Múltiples defectos internos',             origen: 'MULTI' },
  { codigo: 'CAU-10', nombre: 'Falla de protecciones o telecontrol',    origen: 'PYT' },
  { codigo: 'CAU-11', nombre: 'Descarga atmosférica',                   origen: 'EXT' },
  { codigo: 'CAU-12', nombre: 'Falla de red externa',                   origen: 'EXT' }
]);
