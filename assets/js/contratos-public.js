// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Contratos · selector (M2 + M7 v2.4)
// ──────────────────────────────────────────────────────────────
// Página índice del módulo Contratos. Muestra una jerarquía de
// 2 niveles:
//   1. Categoría de contrato (línea contractual / concepto del servicio)
//   2. Números de contrato individuales dentro de esa categoría
//
// Inicialmente hardcodeada con la categoría "Suministro de Elementos
// y Accesorios para Transformadores de Potencia" que agrupa los
// contratos 4123000081 y 4125000143. Cuando se registren más
// categorías o números en /contratos, la lista se hará dinámica.
// ══════════════════════════════════════════════════════════════

import {
  collection, query, where, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from './firebase-init.js';

// Estructura semilla: 1 categoría con 2 contratos.
const CATEGORIAS_SEMILLA = [
  {
    id: 'sum-tx',
    nombre: 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
    nombre_corto: 'Elementos & Accesorios TX',
    contratos: [
      {
        id: '4123000081',
        numero: '4123000081',
        nombre: 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
        estado: 'activo',
        origen: 'semilla',
        con_datos: true
      },
      {
        id: '4125000143',
        numero: '4125000143',
        nombre: 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
        estado: 'activo',
        origen: 'semilla',
        con_datos: false
      }
    ]
  }
];

const $ = (id) => document.getElementById(id);
const grid = $('contratosGrid');

let unsub = null;

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function renderCard(c) {
  const numero = c.numero || c.id;
  const nombre = c.nombre || 'Contrato sin descripción';
  const estado = (c.estado || 'activo').toUpperCase();
  const isActivo = estado === 'ACTIVO' || estado === 'VIGENTE';
  const semillaTag = c.origen === 'semilla'
    ? '<span class="contrato-semilla-tag" title="Contrato semilla — pendiente de registrar formalmente">SEMILLA</span>'
    : '';
  const sinDatosTag = c.con_datos === false
    ? '<span class="contrato-pendiente-tag" title="Pendiente de importar Excel">SIN DATOS</span>'
    : '';
  return `
    <a class="contrato-card ${isActivo ? '' : 'is-cerrado'} ${c.con_datos === false ? 'is-pendiente' : ''}" href="contrato.html?id=${encodeURIComponent(c.id)}">
      <div class="contrato-card-head">
        <div class="contrato-icon">
          <i data-lucide="file-text"></i>
        </div>
        <div class="contrato-numero">
          <code>${escHtml(numero)}</code>
          ${semillaTag}
          ${sinDatosTag}
        </div>
        <span class="contrato-estado-pill estado-${escHtml(estado.toLowerCase())}">${escHtml(estado)}</span>
      </div>
      <div class="contrato-card-body">
        <h3>${escHtml(nombre)}</h3>
      </div>
      <div class="contrato-card-foot">
        <span>${c.con_datos === false ? 'Importar Excel' : 'Abrir contrato'}</span>
        <i data-lucide="arrow-right"></i>
      </div>
    </a>
  `;
}

function renderCategoria(cat) {
  return `
    <section class="categoria-section">
      <header class="categoria-header">
        <h2>${escHtml(cat.nombre)}</h2>
        <p class="categoria-subtitle">${cat.contratos.length} contrato${cat.contratos.length === 1 ? '' : 's'} registrado${cat.contratos.length === 1 ? '' : 's'} en esta línea contractual.</p>
      </header>
      <div class="contratos-grid">
        ${cat.contratos.map(renderCard).join('')}
      </div>
    </section>
  `;
}

function render(categorias) {
  if (!categorias || categorias.length === 0) {
    grid.innerHTML = '<div class="contrato-empty">No hay categorías de contrato registradas todavía.</div>';
    return;
  }
  grid.innerHTML = categorias.map(renderCategoria).join('');
  window.sgmRefreshIcons?.();
}

function arrancar() {
  if (!isFirebaseConfigured) {
    render(CATEGORIAS_SEMILLA);
    return;
  }
  const db = getDbSafe();
  if (!db) {
    render(CATEGORIAS_SEMILLA);
    return;
  }
  // Por ahora seguimos con la semilla. Cuando el director registre
  // más contratos en /contratos, esta función se ampliará para hacer
  // merge con la lista dinámica.
  try {
    unsub = onSnapshot(
      query(collection(db, 'contratos'), where('tipo', '==', 'suministros')),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Por simplicidad, mostramos siempre la categoría semilla.
        // Si Firestore tiene contratos del tipo, los inyectamos a la lista.
        const cat = { ...CATEGORIAS_SEMILLA[0] };
        const idsSemilla = new Set(cat.contratos.map((c) => c.id));
        for (const d of docs) {
          if (!idsSemilla.has(d.id)) {
            cat.contratos.push({
              id: d.id,
              numero: d.numero || d.id,
              nombre: d.nombre || cat.nombre,
              estado: d.estado || 'activo',
              origen: 'firestore',
              con_datos: d.con_datos !== false
            });
          }
        }
        render([cat]);
      },
      (err) => {
        console.warn('[contratos] suscripción falló:', err);
        render(CATEGORIAS_SEMILLA);
      }
    );
  } catch (err) {
    console.warn('[contratos] no se pudo suscribir:', err);
    render(CATEGORIAS_SEMILLA);
  }
}

window.addEventListener('beforeunload', () => {
  if (unsub) try { unsub(); } catch (_) {}
});

arrancar();
