// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Exportador XLSX (F31)
// ──────────────────────────────────────────────────────────────
// Wrapper alrededor de SheetJS (CDN) para generar reportes
// multi-hoja con encabezado oficial MO.00418.
// ══════════════════════════════════════════════════════════════

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

/**
 * Descarga un libro Excel con N hojas.
 * @param {string} filename
 * @param {Array<{nombre, filas, columnas}>} hojas
 */
export async function descargarHojas(filename, hojas) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    const ws = XLSX.utils.json_to_sheet(h.filas || [], {
      header: h.columnas || (h.filas[0] ? Object.keys(h.filas[0]) : [])
    });
    XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0, 31));
  }
  const fname = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
  XLSX.writeFile(wb, fname);
}

/**
 * Descarga inventario como XLSX.
 */
export function exportarInventario(transformadores, filename = 'sgm-inventario') {
  const filas = transformadores.map((t) => ({
    Codigo: t.codigo,
    Nombre: t.nombre,
    Tipo_Activo: t.identificacion && t.identificacion.tipo_activo,
    Zona: t.ubicacion && t.ubicacion.zona,
    Departamento: t.departamento,
    Municipio: t.municipio,
    Subestacion: t.subestacion,
    Potencia_kVA: t.potencia_kva,
    Tension_pri_kV: t.tension_primaria_kv,
    Marca: t.marca,
    Modelo: t.modelo,
    Serial: t.serial,
    Ano_Fabricacion: t.fabricacion && t.fabricacion.ano_fabricacion,
    Estado: t.estado,
    HI_final: t.salud_actual && t.salud_actual.hi_final,
    Bucket: t.salud_actual && t.salud_actual.bucket
  }));
  return descargarHojas(filename, [{
    nombre: 'Inventario', filas
  }]);
}

export function exportarOrdenes(ordenes, filename = 'sgm-ordenes') {
  const filas = ordenes.map((o) => ({
    Codigo: o.codigo, Titulo: o.titulo,
    Transformador: o.transformadorCodigo,
    Tipo: o.tipo, Prioridad: o.prioridad,
    Estado_v1: o.estado, Estado_v2: o.estado_v2,
    Tecnico: o.tecnico,
    Fecha_Programada: o.fecha_programada,
    Fecha_Inicio: o.fecha_inicio,
    Fecha_Cierre: o.fecha_cierre,
    Duracion_h: o.duracion_horas,
    Condicion_Objetivo: o.condicion_objetivo,
    Macroactividad: o.macroactividad_codigo,
    Contrato: o.contrato_codigo
  }));
  return descargarHojas(filename, [{ nombre: 'Ordenes', filas }]);
}

export function exportarKPIsMultihoja(dashboard, filename = 'sgm-kpis') {
  const hojas = [];
  if (dashboard.ram) {
    hojas.push({
      nombre: 'RAM',
      filas: [{
        MTBF_dias: dashboard.ram.mtbf_dias,
        MTTR_horas: dashboard.ram.mttr_horas,
        Disponibilidad_pct: dashboard.ram.disponibilidad_pct
      }]
    });
  }
  if (dashboard.totales) {
    hojas.push({
      nombre: 'Totales', filas: [dashboard.totales]
    });
  }
  if (dashboard.top10) {
    hojas.push({ nombre: 'Top_10_TX', filas: dashboard.top10 });
  }
  if (dashboard.por_departamento) {
    hojas.push({ nombre: 'Por_Departamento', filas: dashboard.por_departamento });
  }
  return descargarHojas(filename, hojas);
}

export function exportarPlanInversion(ranking, filename = 'sgm-plan-inversion') {
  const filas = ranking.map((r, i) => ({
    Posicion: i + 1,
    Codigo: r.codigo,
    Score: r.score.toFixed(3),
    Candidato_Forzoso: r.candidato_forzoso ? 'SI' : 'NO',
    HI_Norm: r.detalle.hi.toFixed(3),
    Criticidad_Norm: r.detalle.criticidad.toFixed(3),
    Vida_Utilizada_Norm: r.detalle.vida_utilizada.toFixed(3),
    Razones: (r.razones || []).join(' | ')
  }));
  return descargarHojas(filename, [{ nombre: 'Plan_Inversion', filas }]);
}
