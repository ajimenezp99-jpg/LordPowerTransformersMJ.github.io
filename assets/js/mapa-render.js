// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer compartido del mapa (Fase 10)
// Consume Leaflet + Leaflet.markercluster (precargados vía CDN en
// el <head> de la página) y los datos del módulo Inventario.
// ══════════════════════════════════════════════════════════════

import {
  listar as listarTransformadores,
  estadoLabel, departamentoLabel,
  isReady
} from './data/transformadores.js';

// Centro geográfico aproximado del Caribe Colombiano.
const CENTER = [9.4, -74.8];
const INITIAL_ZOOM = 7;

// Paleta por estado (alineada con los pills).
const ESTADO_COLOR = {
  operativo:      '#00ff99',
  mantenimiento:  '#f0a500',
  fuera_servicio: '#ff5577',
  retirado:       '#4a6478'
};

let mapRef       = null;
let clusterGroup = null;

// ── Helpers ──
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function hasValidCoords(t) {
  const lat = +t.latitud;
  const lng = +t.longitud;
  return Number.isFinite(lat) && Number.isFinite(lng)
      && lat !== 0 && lng !== 0
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function coloredIcon(color) {
  return window.L.divIcon({
    className: 'sgm-marker',
    html: `<span class="sgm-dot" style="--dot-color:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });
}

function popupHtml(t, opts = {}) {
  const color = ESTADO_COLOR[t.estado] || '#89a2b0';
  const power = t.potencia_kva != null ? `${t.potencia_kva} kVA` : '—';
  const tension = (t.tension_primaria_kv != null && t.tension_secundaria_kv != null)
    ? `${t.tension_primaria_kv} / ${t.tension_secundaria_kv} kV`
    : '—';
  const editLink = opts.adminEditHref
    ? `<a class="sgm-pop-edit" href="${escHtml(opts.adminEditHref)}">Editar en inventario →</a>`
    : '';
  return `
    <div class="sgm-pop">
      <div class="sgm-pop-code">${escHtml(t.codigo || '—')}</div>
      <div class="sgm-pop-title">${escHtml(t.nombre || 'Sin nombre')}</div>
      <div class="sgm-pop-row"><span>Estado</span>
        <b style="color:${color}">${escHtml(estadoLabel(t.estado))}</b>
      </div>
      <div class="sgm-pop-row"><span>Departamento</span>
        <b>${escHtml(departamentoLabel(t.departamento))}</b>
      </div>
      <div class="sgm-pop-row"><span>Municipio</span>
        <b>${escHtml(t.municipio || '—')}</b>
      </div>
      <div class="sgm-pop-row"><span>Subestación</span>
        <b>${escHtml(t.subestacion || '—')}</b>
      </div>
      <div class="sgm-pop-row"><span>Potencia</span>
        <b>${escHtml(power)}</b>
      </div>
      <div class="sgm-pop-row"><span>Tensión</span>
        <b>${escHtml(tension)}</b>
      </div>
      <div class="sgm-pop-coords">
        ${(+t.latitud).toFixed(5)} · ${(+t.longitud).toFixed(5)}
      </div>
      ${editLink}
    </div>
  `;
}

// ── API pública ──
export function initMap(containerId) {
  if (!window.L) throw new Error('Leaflet no cargado.');
  if (mapRef) return mapRef;

  mapRef = window.L.map(containerId, {
    center: CENTER, zoom: INITIAL_ZOOM, minZoom: 5, maxZoom: 18,
    zoomControl: true
  });

  // Tile layer Aqua-aware: si el body es Aqua (tema claro perla),
  // usamos CARTO Voyager (gris claro, perfecto para fondo perla);
  // si es legacy oscuro, mantenemos OpenStreetMap original.
  const isAqua = typeof document !== 'undefined' && document.body && document.body.classList.contains('aqua');
  const tileUrl = isAqua
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttr = isAqua
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · &copy; <a href="https://carto.com/">CARTO</a> · SGM · TRANSPOWER'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · SGM · TRANSPOWER';

  window.L.tileLayer(tileUrl, {
    attribution: tileAttr,
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(mapRef);

  return mapRef;
}

export async function loadMarkers(opts = {}) {
  if (!mapRef) throw new Error('Mapa no inicializado.');
  const onReport = opts.onReport || (() => {});

  if (!isReady()) {
    onReport({ total: 0, conCoords: 0, sinCoords: 0, error: 'Firebase no configurado.' });
    return;
  }

  const items = await listarTransformadores({
    departamento: opts.departamento || undefined,
    estado:       opts.estado       || undefined
  });

  // Limpiar grupo previo.
  if (clusterGroup) {
    mapRef.removeLayer(clusterGroup);
    clusterGroup = null;
  }

  const cluster = (window.L.markerClusterGroup
    ? window.L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50
      })
    : window.L.layerGroup()
  );

  let conCoords = 0, sinCoords = 0;
  const latlngs = [];
  for (const t of items) {
    if (!hasValidCoords(t)) { sinCoords += 1; continue; }
    const color = ESTADO_COLOR[t.estado] || '#89a2b0';
    const m = window.L.marker([+t.latitud, +t.longitud], { icon: coloredIcon(color) });
    m.bindPopup(popupHtml(t, {
      adminEditHref: opts.adminEditHref ? opts.adminEditHref(t) : null
    }));
    cluster.addLayer(m);
    latlngs.push([+t.latitud, +t.longitud]);
    conCoords += 1;
  }

  mapRef.addLayer(cluster);
  clusterGroup = cluster;

  if (opts.fitBounds !== false && latlngs.length > 0) {
    mapRef.fitBounds(latlngs, { padding: [30, 30], maxZoom: 11 });
  }

  onReport({ total: items.length, conCoords, sinCoords });
}

export function resetMap() {
  if (!mapRef) return;
  mapRef.setView(CENTER, INITIAL_ZOOM);
}

export function legendHtml() {
  return `
    <div class="sgm-legend">
      <span><i style="background:${ESTADO_COLOR.operativo}"></i> Operativo</span>
      <span><i style="background:${ESTADO_COLOR.mantenimiento}"></i> En mantenimiento</span>
      <span><i style="background:${ESTADO_COLOR.fuera_servicio}"></i> Fuera de servicio</span>
      <span><i style="background:${ESTADO_COLOR.retirado}"></i> Retirado</span>
    </div>
  `;
}
