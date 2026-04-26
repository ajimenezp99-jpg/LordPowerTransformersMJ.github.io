// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Contrato individual · shell con tabs (M3 · v2.4)
// ──────────────────────────────────────────────────────────────
// Página dinámica: el id del contrato viene del query string
// (?id=4123000081). Renderiza header con número + nombre + estado
// y monta 5 tabs (Dashboard, Catálogo, Movimiento, Histórico, Importar)
// que embeben los módulos de suministros existentes vía iframe.
//
// Sin Correcciones (decisión M1 del refactor v2.4).
//
// Escalabilidad: cuando un futuro contrato N tenga su propio Excel
// importado, el id del contrato se propagará por query a los iframes
// para que cada subscreen filtre por contrato_id. Por ahora el módulo
// es monocontrato (4123000081) y los iframes operan sobre todos los
// docs sin filtro.
// ══════════════════════════════════════════════════════════════

import { initModuleShell } from './ui/module-shell.js';
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from './firebase-init.js';

// Lee el id del contrato del query.
const params = new URLSearchParams(window.location.search);
const contratoId = (params.get('id') || '').trim();

// Sin id válido → vuelve al índice de contratos.
if (!contratoId) {
  window.location.replace('contratos.html');
}

// Datos por defecto del contrato semilla (mientras no esté en Firestore).
const META_SEMILLA = {
  '4123000081': {
    numero: '4123000081',
    nombre: 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
    estado: 'activo'
  }
};

const $ = (id) => document.getElementById(id);
const elBreadcrumb = $('contratoBreadcrumb');
const elNumero     = $('contratoNumero');
const elNombre     = $('contratoNombre');

function renderMeta(meta) {
  const numero = meta.numero || meta.id || contratoId;
  const nombre = meta.nombre || meta.descripcion || 'Contrato sin descripción';
  elBreadcrumb.textContent = numero;
  elNumero.textContent = numero;
  elNombre.textContent = nombre;
  document.title = `SGM · TRANSPOWER — Contrato ${numero}`;
}

async function cargarMeta() {
  // Fallback inmediato con la semilla mientras Firestore responde.
  if (META_SEMILLA[contratoId]) {
    renderMeta(META_SEMILLA[contratoId]);
  } else {
    renderMeta({ numero: contratoId, nombre: 'Cargando…' });
  }
  // Intento de leer doc real de Firestore (sobrescribe el render).
  if (!isFirebaseConfigured) return;
  const db = getDbSafe();
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'contratos', contratoId));
    if (snap.exists()) {
      renderMeta({ id: snap.id, ...snap.data() });
    } else if (!META_SEMILLA[contratoId]) {
      // Doc inexistente Y sin semilla: mensaje claro al usuario.
      renderMeta({
        numero: contratoId,
        nombre: '(Contrato no registrado en /contratos — operando con datos sembrados)'
      });
    }
  } catch (err) {
    console.warn('[contrato-shell] no se pudo leer /contratos/' + contratoId + ':', err);
    // Conserva el render de la semilla / fallback.
  }
}

cargarMeta();

// Propaga el contrato_id a los iframes embebidos · multi-contrato (N4).
// Cada subscreen lee window.location.search para detectar el contratoId
// y filtrar sus queries Firestore. Sin filtro = comportamiento legacy.
(function propagarContratoIdALosIframes() {
  const tabsEl = document.getElementById('contratoTabs');
  if (!tabsEl) return;
  for (const iframe of tabsEl.querySelectorAll('iframe[data-src]')) {
    const src = iframe.getAttribute('data-src') || '';
    if (!src) continue;
    // Solo añadimos contratoId si la URL no la trae ya (defensivo).
    const sep = src.includes('?') ? '&' : '?';
    if (/[?&]contratoId=/.test(src)) continue;
    iframe.setAttribute('data-src', `${src}${sep}contratoId=${encodeURIComponent(contratoId)}`);
  }
})();

// Inicializa los tabs. Lazy-load de iframes + ocultar tabs admin a
// no-admins (Dashboard sigue público).
initModuleShell('contratoTabs', { defaultTab: 'dashboard' });
