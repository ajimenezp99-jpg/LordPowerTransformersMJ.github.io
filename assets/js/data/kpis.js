// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: KPIs y analítica RAM (Fase 8)
// Agregaciones cliente-side sobre `transformadores` + `ordenes`.
// No persiste nada: recalcula bajo demanda desde Firestore.
// ══════════════════════════════════════════════════════════════

import { listar as listarTransformadores, departamentoLabel, DEPARTAMENTOS }
  from './transformadores.js';
import { listar as listarOrdenes, TIPOS_ORDEN, ESTADOS_ORDEN, PRIORIDADES }
  from './ordenes.js';
import { isFirebaseConfigured } from '../firebase-init.js';

export function isReady() { return isFirebaseConfigured; }

// ── Helpers ──
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
function lastNMonths(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

// ── Agregación principal ──
// Devuelve un snapshot listo para renderizar en el dashboard.
export async function computeDashboard() {
  const [trafos, ords] = await Promise.all([
    listarTransformadores({}),
    listarOrdenes({})
  ]);

  const trafoById = new Map(trafos.map((t) => [t.id, t]));

  // ── Totales simples ──
  const totales = {
    transformadores: trafos.length,
    operativos:      trafos.filter((t) => t.estado === 'operativo').length,
    mantenimiento:   trafos.filter((t) => t.estado === 'mantenimiento').length,
    fuera_servicio:  trafos.filter((t) => t.estado === 'fuera_servicio').length,
    ordenes:         ords.length,
    ordenes_cerradas:    ords.filter((o) => o.estado === 'cerrada').length,
    ordenes_planificadas: ords.filter((o) => o.estado === 'planificada').length,
    ordenes_en_curso:    ords.filter((o) => o.estado === 'en_curso').length
  };

  // ── Distribuciones ──
  const porEstado = distribuir(ords, 'estado', ESTADOS_ORDEN);
  const porTipo   = distribuir(ords, 'tipo',   TIPOS_ORDEN);
  const porPrioridad = distribuir(ords, 'prioridad', PRIORIDADES);

  // Por departamento (join con transformador)
  const porDepartamento = {};
  for (const d of DEPARTAMENTOS) porDepartamento[d.value] = 0;
  for (const o of ords) {
    const t = trafoById.get(o.transformadorId);
    if (t && porDepartamento[t.departamento] != null) porDepartamento[t.departamento] += 1;
  }

  // ── Serie mensual (últimos 12 meses, usa fecha_programada) ──
  const meses = lastNMonths(12);
  const porMes = Object.fromEntries(meses.map((m) => [m, 0]));
  for (const o of ords) {
    const d = parseDate(o.fecha_programada);
    if (!d) continue;
    const k = monthKey(d);
    if (porMes[k] != null) porMes[k] += 1;
  }

  // ── Top transformadores con más órdenes ──
  const countByTrafo = new Map();
  for (const o of ords) {
    if (!o.transformadorId) continue;
    countByTrafo.set(o.transformadorId, (countByTrafo.get(o.transformadorId) || 0) + 1);
  }
  const topTransformadores = [...countByTrafo.entries()]
    .map(([id, count]) => {
      const t = trafoById.get(id);
      return {
        id,
        codigo: t ? t.codigo : '—',
        nombre: t ? t.nombre : '(transformador eliminado)',
        departamento: t ? departamentoLabel(t.departamento) : '—',
        count
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── RAM: MTBF / MTTR / Disponibilidad ──
  const correctivasCerradas = ords.filter(
    (o) => o.tipo === 'correctivo' && o.estado === 'cerrada'
  );

  // MTTR: media de duracion_horas declarada; si no, fecha_cierre − fecha_inicio.
  const duraciones = correctivasCerradas
    .map((o) => {
      if (o.duracion_horas != null && !isNaN(+o.duracion_horas)) return +o.duracion_horas;
      const ini = parseDate(o.fecha_inicio);
      const fin = parseDate(o.fecha_cierre);
      if (ini && fin && fin >= ini) return (fin - ini) / 36e5;
      return null;
    })
    .filter((x) => x != null && x >= 0);
  const mttr_horas = duraciones.length
    ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length
    : 0;

  // MTBF: tiempo de servicio del parque / número de fallos (correctivo cerrado).
  // Servicio = suma (fecha_actual − fecha_instalacion) por transformador, en días.
  const hoy = new Date();
  let totalDiasServicio = 0;
  for (const t of trafos) {
    const fi = parseDate(t.fecha_instalacion);
    if (!fi) continue;
    const d = (hoy - fi) / (36e5 * 24);
    if (d > 0) totalDiasServicio += d;
  }
  const mtbf_dias = correctivasCerradas.length
    ? totalDiasServicio / correctivasCerradas.length
    : 0;

  // Disponibilidad = MTBF / (MTBF + MTTR)  (ambos a las mismas unidades).
  const mtbf_horas = mtbf_dias * 24;
  const denom = mtbf_horas + mttr_horas;
  const disponibilidad_pct = denom > 0 ? (mtbf_horas / denom) * 100 : null;

  return {
    totales,
    porEstado, porTipo, porPrioridad, porDepartamento,
    porMes, topTransformadores,
    ram: {
      mtbf_dias,
      mttr_horas,
      disponibilidad_pct,
      muestra_fallos: correctivasCerradas.length,
      parque_dias_servicio: Math.round(totalDiasServicio)
    },
    ts: Date.now()
  };
}

// ── Utilidad ──
function distribuir(items, campo, enumDef) {
  const out = Object.fromEntries(enumDef.map((e) => [e.value, 0]));
  for (const it of items) {
    const v = it[campo];
    if (v != null && out[v] != null) out[v] += 1;
  }
  return out;
}

// ── Export CSV (plano de órdenes con nombre legible de transformador) ──
export async function exportarOrdenesCSV() {
  const [trafos, ords] = await Promise.all([
    listarTransformadores({}),
    listarOrdenes({})
  ]);
  const trafoById = new Map(trafos.map((t) => [t.id, t]));
  const headers = [
    'codigo','titulo','transformador_codigo','transformador_nombre','departamento',
    'tipo','prioridad','estado','tecnico',
    'fecha_programada','fecha_inicio','fecha_cierre','duracion_horas'
  ];
  const rows = ords.map((o) => {
    const t = trafoById.get(o.transformadorId) || {};
    return [
      o.codigo, o.titulo,
      t.codigo || o.transformadorCodigo || '',
      t.nombre || '',
      departamentoLabel(t.departamento || ''),
      o.tipo, o.prioridad, o.estado, o.tecnico || '',
      o.fecha_programada || '', o.fecha_inicio || '', o.fecha_cierre || '',
      o.duracion_horas ?? ''
    ];
  });
  const esc = (v) => {
    const s = String(v ?? '');
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}
