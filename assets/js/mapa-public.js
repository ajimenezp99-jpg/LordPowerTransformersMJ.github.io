// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Mapa público (Fase 10)
// Vista solo-lectura con filtros por departamento y estado.
// ══════════════════════════════════════════════════════════════

import { initMap, loadMarkers, resetMap, legendHtml } from './mapa-render.js';
import {
  DEPARTAMENTOS, ESTADOS,
  isReady
} from './data/transformadores.js';

const $ = (id) => document.getElementById(id);
const info    = $('infoBox');
const status  = $('mapStatus');
const counter = $('counter');
const fDept   = $('fDept');
const fEstado = $('fEstado');

function showInfo(msg, kind) {
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = msg ? 'block' : 'none';
}

function fillSelects() {
  for (const d of DEPARTAMENTOS) {
    fDept.insertAdjacentHTML('beforeend', `<option value="${d.value}">${d.label}</option>`);
  }
  for (const e of ESTADOS) {
    fEstado.insertAdjacentHTML('beforeend', `<option value="${e.value}">${e.label}</option>`);
  }
}

async function cargar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado. El mapa no tiene datos que mostrar hasta que se complete la configuración.', 'err');
    status.textContent = 'Sin conexión con Firestore.';
    counter.textContent = '—';
    return;
  }
  try {
    showInfo('');
    status.textContent = 'Cargando transformadores…';
    await loadMarkers({
      departamento: fDept.value || undefined,
      estado:       fEstado.value || undefined,
      onReport: ({ total, conCoords, sinCoords, error }) => {
        if (error) {
          showInfo(error, 'err');
          status.textContent = 'Error.';
          counter.textContent = '—';
          return;
        }
        counter.textContent = `${conCoords} visible${conCoords === 1 ? '' : 's'} de ${total}`;
        status.innerHTML = `<span>Total: <b>${total}</b></span>`
          + `<span>Con coordenadas: <b>${conCoords}</b></span>`
          + `<span>Sin coordenadas: <b>${sinCoords}</b></span>`;
      }
    });
  } catch (err) {
    console.error(err);
    showInfo('Error al cargar el mapa: ' + (err.message || err), 'err');
    status.textContent = 'Error.';
  }
}

// ── Init ──
fillSelects();
$('legend').innerHTML = legendHtml();
try {
  initMap('sgmMap');
} catch (err) {
  showInfo('Leaflet no se pudo inicializar: ' + (err.message || err), 'err');
}

fDept.addEventListener('change',   cargar);
fEstado.addEventListener('change', cargar);
$('btnReload').addEventListener('click', cargar);
$('btnReset').addEventListener('click', resetMap);

// Logout unificado (Fase 14)
import('./auth/session-guard.js').then((m) => {
  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', () => m.logout());
});
if($('yr'))$('yr').textContent = new Date().getFullYear();

cargar();
