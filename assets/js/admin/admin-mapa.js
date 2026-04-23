// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Mapa (Fase 10)
// Vista geográfica del inventario con enlaces de edición.
// ══════════════════════════════════════════════════════════════

import { initMap, loadMarkers, resetMap, legendHtml } from '../mapa-render.js';
import {
  DEPARTAMENTOS, ESTADOS,
  isReady
} from '../data/transformadores.js';

import { logoutAdmin, ADMIN_ROUTES } from './admin-auth.js';

const $ = (id) => document.getElementById(id);
const info    = $('infoBox');
const status  = $('mapStatus');
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
    return;
  }
  try {
    showInfo('');
    status.textContent = 'Cargando transformadores…';
    await loadMarkers({
      departamento: fDept.value || undefined,
      estado:       fEstado.value || undefined,
      adminEditHref: (t) => `inventario.html#edit:${t.id}`,
      onReport: ({ total, conCoords, sinCoords, error }) => {
        if (error) {
          showInfo(error, 'err');
          status.textContent = 'Error.';
          return;
        }
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

$('btnLogout')?.addEventListener('click', async () => {
  try { await logoutAdmin(); } catch (_) {}
  location.replace(ADMIN_ROUTES.login);
});
if($('yr'))$('yr').textContent = new Date().getFullYear();

cargar();
