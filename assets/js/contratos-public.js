// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Contratos · selector (M2 · v2.4)
// ──────────────────────────────────────────────────────────────
// Página índice del nuevo módulo "Contratos". Lista los contratos
// del módulo de suministros disponibles. Cada card lleva al usuario
// a pages/contrato.html?id={contratoId}.
//
// Estrategia escalable:
//   1. Lee colección /contratos (ya existe en F21 v2). Si tiene docs
//      con tipo='suministros' o sin tipo (compat), los muestra.
//   2. Si la colección está vacía o no tiene contratos del módulo
//      suministros, hardcodea el contrato semilla 4123000081 (que
//      corresponde al .xlsm que el director ya importó).
//   3. Cuando el director suba el Excel de un nuevo contrato, el
//      importador F42 puede ampliarse para registrar el doc en
//      /contratos automáticamente — cero cambio en esta vista.
// ══════════════════════════════════════════════════════════════

import {
  collection, query, where, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from './firebase-init.js';

// Contrato semilla: el .xlsm que ya está importado en Firestore.
// Hasta que el director lo registre formalmente en /contratos, este
// item asegura que la página no quede vacía.
const CONTRATO_SEMILLA = {
  id: '4123000081',
  numero: '4123000081',
  nombre: 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
  estado: 'activo',
  origen: 'semilla',
  fecha_inicio: null,
  fecha_fin: null
};

const $ = (id) => document.getElementById(id);
const grid = $('contratosGrid');
const info = $('infoBox');

let unsub = null;

function showInfo(msg, kind) {
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = msg ? 'block' : 'none';
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmtFecha(v) {
  if (!v) return '—';
  const d = v.toDate ? v.toDate() : (v.seconds ? new Date(v.seconds * 1000) : new Date(v));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderCard(c) {
  const numero = c.numero || c.id;
  const nombre = c.nombre || c.descripcion || 'Contrato sin descripción';
  const estado = (c.estado || 'activo').toUpperCase();
  const isActivo = estado === 'ACTIVO' || estado === 'VIGENTE';
  const semillaTag = c.origen === 'semilla'
    ? '<span class="contrato-semilla-tag" title="Contrato semilla — pendiente de registrar formalmente">SEMILLA</span>'
    : '';
  const fechaIni = fmtFecha(c.fecha_inicio || c.inicio);
  const fechaFin = fmtFecha(c.fecha_fin || c.fin);
  return `
    <a class="contrato-card ${isActivo ? '' : 'is-cerrado'}" href="contrato.html?id=${encodeURIComponent(c.id)}">
      <div class="contrato-card-head">
        <div class="contrato-icon">
          <i data-lucide="file-text"></i>
        </div>
        <div class="contrato-numero">
          <code>${escHtml(numero)}</code>
          ${semillaTag}
        </div>
        <span class="contrato-estado-pill estado-${escHtml(estado.toLowerCase())}">${escHtml(estado)}</span>
      </div>
      <div class="contrato-card-body">
        <h3>${escHtml(nombre)}</h3>
        <dl class="contrato-meta">
          <div><dt>Inicio</dt><dd>${fechaIni}</dd></div>
          <div><dt>Fin</dt><dd>${fechaFin}</dd></div>
        </dl>
      </div>
      <div class="contrato-card-foot">
        <span>Abrir contrato</span>
        <i data-lucide="arrow-right"></i>
      </div>
    </a>
  `;
}

function render(contratos) {
  if (!contratos || contratos.length === 0) {
    grid.innerHTML = '<div class="contrato-empty">No hay contratos registrados todavía. El primer contrato aparecerá automáticamente al importar su Excel.</div>';
    return;
  }
  grid.innerHTML = contratos.map(renderCard).join('');
  window.sgmRefreshIcons?.();
}

function arrancar() {
  if (!isFirebaseConfigured) {
    // Sin Firebase: muestra solo la semilla.
    render([CONTRATO_SEMILLA]);
    return;
  }
  const db = getDbSafe();
  if (!db) {
    render([CONTRATO_SEMILLA]);
    return;
  }
  // Suscripción a /contratos. Filtramos por tipo='suministros' si está
  // presente; si no hay docs así, fallback al semilla.
  try {
    unsub = onSnapshot(
      query(collection(db, 'contratos'), where('tipo', '==', 'suministros')),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Si la query típica no devuelve nada, buscar al menos el semilla.
        if (docs.length === 0) {
          render([CONTRATO_SEMILLA]);
        } else {
          // Si la semilla no está incluida en los docs y nadie la registró
          // todavía, la prependemos como ítem garantizado.
          const tieneSemilla = docs.some((d) => d.id === CONTRATO_SEMILLA.id);
          render(tieneSemilla ? docs : [CONTRATO_SEMILLA, ...docs]);
        }
      },
      (err) => {
        // Si la query falla (índice faltante, permisos), caemos a la
        // semilla — no bloquea la UI.
        console.warn('[contratos] suscripción falló:', err);
        render([CONTRATO_SEMILLA]);
      }
    );
  } catch (err) {
    console.warn('[contratos] no se pudo suscribir:', err);
    render([CONTRATO_SEMILLA]);
  }
}

window.addEventListener('beforeunload', () => {
  if (unsub) try { unsub(); } catch (_) {}
});

arrancar();
