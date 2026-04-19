// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Exportador PDF (F31)
// ──────────────────────────────────────────────────────────────
// Wrapper alrededor de jsPDF + jspdf-autotable (CDN) para
// reportes oficiales con encabezado MO.00418.
// ══════════════════════════════════════════════════════════════

async function loadJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.0/dist/jspdf.plugin.autotable.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.jspdf;
}

const FOOTER = 'MO.00418.DE-GAC-AX.01 Ed. 02 · CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM';

function aplicarEncabezado(doc, titulo) {
  doc.setFontSize(14);
  doc.text('SGM · TRANSPOWER', 14, 16);
  doc.setFontSize(10);
  doc.text(titulo, 14, 22);
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(new Date().toLocaleString('es-CO'), 14, 27);
  doc.setTextColor(0);
  doc.setDrawColor(200);
  doc.line(14, 30, 196, 30);
}

function aplicarPieDePagina(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text(FOOTER, 14, 290);
    doc.text(`Pág. ${i} / ${total}`, 180, 290);
    doc.setTextColor(0);
  }
}

/**
 * Ficha técnica de transformador.
 */
export async function pdfFichaTransformador(tx, filename) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF();
  aplicarEncabezado(doc, `Ficha técnica — ${tx.identificacion?.codigo || tx.codigo || ''}`);

  const rows = [
    ['Código',        tx.identificacion?.codigo || tx.codigo],
    ['Nombre',        tx.identificacion?.nombre || tx.nombre],
    ['Tipo activo',   tx.identificacion?.tipo_activo || '—'],
    ['UUCC',          tx.identificacion?.uucc || '—'],
    ['Grupo',         tx.identificacion?.grupo || '—'],
    ['Marca / Modelo', `${tx.placa?.marca || ''} / ${tx.placa?.modelo || ''}`],
    ['Serial',        tx.placa?.serial || ''],
    ['Potencia kVA',  tx.placa?.potencia_kva ?? '—'],
    ['Departamento',  tx.ubicacion?.departamento || '—'],
    ['Zona',          tx.ubicacion?.zona || '—'],
    ['Subestación',   tx.ubicacion?.subestacion_nombre || '—'],
    ['Municipio',     tx.ubicacion?.municipio || '—'],
    ['Año fab.',      tx.fabricacion?.ano_fabricacion || '—'],
    ['Estado',        tx.estado_servicio || tx.estado || '—'],
    ['HI final',      tx.salud_actual?.hi_final != null ? tx.salud_actual.hi_final.toFixed(2) : '—'],
    ['Bucket',        tx.salud_actual?.bucket || '—'],
    ['Vida remanente', tx.salud_actual?.vida_remanente_pct != null ? tx.salud_actual.vida_remanente_pct.toFixed(0) + ' %' : '—']
  ];
  doc.autoTable({
    startY: 36, head: [['Campo', 'Valor']],
    body: rows,
    theme: 'grid', headStyles: { fillColor: [60, 60, 60] },
    styles: { fontSize: 9 }
  });

  aplicarPieDePagina(doc);
  doc.save(filename || `ficha-${tx.identificacion?.codigo || 'tx'}.pdf`);
}

/**
 * Cierre de orden.
 */
export async function pdfCierreOrden(orden, historial, filename) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF();
  aplicarEncabezado(doc, `Cierre de orden — ${orden.codigo}`);

  doc.setFontSize(11);
  doc.text(`${orden.titulo}`, 14, 38);
  doc.setFontSize(9);
  doc.text(`Transformador: ${orden.transformadorCodigo}`, 14, 44);
  doc.text(`Tipo: ${orden.tipo} · Prioridad: ${orden.prioridad}`, 14, 49);
  doc.text(`Técnico: ${orden.tecnico || '—'}`, 14, 54);
  doc.text(`Duración: ${orden.duracion_horas || '—'} h`, 14, 59);

  if (orden.descripcion) {
    doc.setFontSize(8);
    doc.text('Descripción:', 14, 67);
    const split = doc.splitTextToSize(orden.descripcion, 180);
    doc.text(split, 14, 72);
  }

  const histRows = (historial || []).map((h) => [
    h.tipo_evento,
    (h.estado_previo || '—') + ' → ' + (h.estado_nuevo || '—'),
    (h.nota || '').slice(0, 60)
  ]);
  if (histRows.length) {
    doc.autoTable({
      startY: 95, head: [['Evento', 'Estado', 'Nota']],
      body: histRows, theme: 'grid',
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 8 }
    });
  }

  doc.setFontSize(9);
  doc.text('Firma del responsable:', 14, 260);
  doc.line(60, 262, 150, 262);

  aplicarPieDePagina(doc);
  doc.save(filename || `cierre-${orden.codigo}.pdf`);
}

/**
 * Reporte mensual de KPIs.
 */
export async function pdfReporteMensual(dashboard, mes, filename) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF();
  aplicarEncabezado(doc, `Reporte mensual de KPIs — ${mes}`);

  doc.setFontSize(10);
  doc.text('Resumen ejecutivo', 14, 40);

  if (dashboard.ram) {
    doc.autoTable({
      startY: 45, head: [['Indicador RAM', 'Valor']],
      body: [
        ['MTBF (días)', dashboard.ram.mtbf_dias?.toFixed(1) || '—'],
        ['MTTR (horas)', dashboard.ram.mttr_horas?.toFixed(2) || '—'],
        ['Disponibilidad %', dashboard.ram.disponibilidad_pct?.toFixed(2) || '—']
      ],
      theme: 'grid', styles: { fontSize: 9 },
      headStyles: { fillColor: [60, 60, 60] }
    });
  }

  if (dashboard.top10 && dashboard.top10.length) {
    doc.autoTable({
      startY: (doc.previousAutoTable?.finalY || 80) + 10,
      head: [['Top 10 — Transformadores críticos', 'HI', 'Órdenes']],
      body: dashboard.top10.map((t) => [t.codigo, (t.hi ?? '—').toString(), t.ordenes_count ?? '—']),
      theme: 'grid', styles: { fontSize: 8 },
      headStyles: { fillColor: [60, 60, 60] }
    });
  }

  aplicarPieDePagina(doc);
  doc.save(filename || `reporte-${mes}.pdf`);
}
