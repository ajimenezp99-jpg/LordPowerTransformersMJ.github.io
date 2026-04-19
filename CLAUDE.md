# CLAUDE.md — Proyecto SGM · TRANSPOWER

> Documento maestro de planeación, arquitectura y progreso del sitio web personal
> **Dirección y Gestión del Mantenimiento Especializado en Transformadores de Potencia**.
> Este archivo se actualiza al cierre de cada microfase.

---

## 1. Descripción del proyecto

Plataforma integral para el **seguimiento, planificación y control** del mantenimiento
especializado de transformadores de potencia en servicio activo en el Caribe Colombiano
(Bolívar, Córdoba, Sucre, Cesar y 11 municipios del Magdalena).

El sistema contempla:

- Trazabilidad completa de intervenciones.
- Historial de fallas y análisis de causa raíz.
- Indicadores de desempeño (KPIs) de confiabilidad, disponibilidad y mantenibilidad (RAM).
- Gestión documental alineada con **ISO 50001:2018**, IEEE C57.12, IEC 60076, RETIE, NTC-IEC 60364 y CIGRE WG A2.
- Módulos operativos dinámicos (inventario, órdenes de trabajo, georreferenciación, alertas).

> **Naturaleza:** proyecto sin ánimo de lucro. Todo el stack se diseña sobre
> **tiers gratuitos** de proveedores cloud.

---

## 2. Stack tecnológico proyectado

| Capa              | Herramienta                               | Plan gratuito              | Uso previsto |
|-------------------|-------------------------------------------|----------------------------|--------------|
| Hosting estático  | **GitHub Pages**                          | Ilimitado (repo público)   | Landing y sitio estático |
| Hosting dinámico  | **Vercel** (Hobby)                        | 100 GB banda / mes         | SSR y serverless functions |
| Runtime backend   | **Node.js** (Serverless Functions)        | Incluido en Vercel Hobby   | APIs internas |
| Autenticación     | **Firebase Authentication** (Spark)       | Ilimitado Email/Password   | Login de admin |
| Base de datos     | **Cloud Firestore** (Spark)               | 1 GB · 50k lecturas/día    | Datos operativos |
| Almacenamiento    | **Firebase Storage** (Spark)              | 5 GB · 1 GB descarga/día   | Documentos técnicos |
| Mapas             | **Leaflet + OpenStreetMap**               | Gratuito                   | Georreferenciación |
| Control de versiones | **GitHub**                             | Ilimitado                  | Código y CI/CD |

> **Nota importante:** cada servicio dinámico se enlazará **de forma progresiva** en las
> microfases dedicadas. Por el momento el sitio permanece estático (HTML/CSS/JS vanilla)
> con barrera de acceso también estática.

---

## 3. Arquitectura lógica (estado objetivo)

```
┌─────────────────────────────────────────────────────────────┐
│                  Usuario (navegador)                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
     ┌────────────────────────────┐
     │  index.html (landing      │  ← visible para todos, SIEMPRE
     │  "en construcción" +      │     se muestra al entrar
     │  panel de acceso)         │
     └────────────┬──────────────┘
                  │  código correcto
                  ▼
     ┌────────────────────────────┐
     │  home.html (sitio real)   │  ← protegido por auth-guard
     │  y páginas internas       │
     └────────────┬──────────────┘
                  │  ruta /admin (fase futura)
                  ▼
     ┌────────────────────────────┐
     │  Panel admin               │  ← protegido por Firebase Auth
     │  (CRUD sobre Firestore)    │
     └────────────┬──────────────┘
                  │
                  ▼
     ┌────────────────────────────┐
     │  Firebase (Auth · Firestore│
     │  · Storage)                │
     └────────────────────────────┘
```

### Estructura de carpetas (objetivo)

```
/
├── index.html              # Landing "en construcción" + gate
├── home.html               # Home real del sitio (detrás del gate)
├── CLAUDE.md               # Este documento
├── README.md               # (futuro)
├── package.json            # (futuro — Fase 3)
├── vercel.json             # (futuro — Fase 3)
├── firebase.json           # (futuro — Fase 4)
├── .firebaserc             # (futuro — Fase 4)
├── /assets/
│   ├── /css/
│   │   ├── base.css        # (futuro — Fase 1)
│   │   └── real.css        # Estilo del sitio real (Fase 0 inicial)
│   ├── /js/
│   │   ├── gate.js         # Lógica del gate estático  ✅ Fase 0
│   │   ├── auth-guard.js   # Protector de páginas internas  ✅ Fase 0
│   │   ├── firebase-init.js # (futuro — Fase 4)
│   │   └── admin/          # (futuro — Fase 5+)
│   └── /img/               # Logos, SVGs
├── /pages/                 # (futuro) Páginas internas del sitio real
├── /api/                   # (futuro) Serverless functions Node.js
└── /.github/workflows/     # (futuro) CI/CD
```

---

## 4. Barrera de acceso (gate)

### Estado actual: **estática**

- Código de acceso: **`97601992@`** (definido en `assets/js/gate.js`).
- Se valida en el cliente contra la constante del archivo.
- En caso correcto, se guarda el flag `sgm.access = "1"` en `sessionStorage` y se redirige a `home.html`.
- Las páginas internas incluyen `assets/js/auth-guard.js`, que redirige a `index.html` si no existe el flag.
- Al cerrar la pestaña/navegador se pierde la sesión (comportamiento deseado en la etapa de construcción).

### Limitaciones conocidas

1. El código es visible en el código fuente del cliente (cualquiera que inspeccione `gate.js` lo ve).
2. `sessionStorage` es fácilmente manipulable desde la consola.
3. Aceptable **únicamente** como barrera temporal mientras el sitio está en construcción.

### Evolución prevista

En la **Fase 11** el gate estático se reemplaza por un mecanismo dinámico:

- Códigos rotativos generados desde el panel admin y almacenados en Firestore.
- Validación contra una Serverless Function (Vercel) que nunca expone el código al cliente.
- Expiración automática por tiempo o uso único.

---

## 5. Plan de microfases

> **Regla de oro:** cada microfase se cierra con un **commit aislado** y el agente se
> detiene hasta recibir la orden explícita de continuar con la siguiente. Esto evita
> agotar el presupuesto de contexto / timeouts / crasheos.

### Resumen visual

| # | Microfase                                                 | Peso | Acumulado | Estado |
|---|-----------------------------------------------------------|------|-----------|--------|
| 0 | Documentación inicial + barrera de acceso estática        |  5%  |   5%      | ✅ completada |
| 1 | Estructura base CSS/JS y refactor del landing             |  5%  |  10%      | ✅ completada |
| 2 | Home real + páginas estáticas internas                    | 10%  |  20%      | ✅ completada |
| 3 | Preparación de hosting (Vercel / GitHub Pages + CI)       |  5%  |  25%      | ✅ completada |
| 4 | Integración de Firebase (Auth, Firestore, Storage)        |  5%  |  30%      | ✅ completada |
| 5 | Autenticación admin real (login con Firebase Auth)        |  5%  |  35%      | ✅ completada |
| 6 | Módulo: Inventario de activos (CRUD)                      | 10%  |  45%      | ✅ completada |
| 7 | Módulo: Órdenes de trabajo                                | 10%  |  55%      | ✅ completada |
| 8 | Módulo: KPIs y analítica                                  | 10%  |  65%      | ✅ completada |
| 9 | Módulo: Gestión documental (+ Storage)                    |  8%  |  73%      | ✅ completada |
| 10 | Módulo: Georreferenciación (Leaflet)                     |  7%  |  80%      | ✅ completada |
| 11 | Módulo: Alertas y notificaciones                         |  7%  |  87%      | ⏳ pendiente |
| 12 | Gate dinámico + endurecimiento admin                     |  5%  |  92%      | ⏳ pendiente |
| 13 | Pulido: SEO, accesibilidad, performance, i18n            |  4%  |  96%      | ⏳ pendiente |
| 14 | Lanzamiento: reemplazo del landing y despliegue final    |  4%  | 100%      | ⏳ pendiente |

### Detalle por microfase

#### ✅ Fase 0 — Documentación inicial + barrera de acceso estática

**Entregables**

- `CLAUDE.md` con plan completo y proyección.
- `assets/js/gate.js` con código estático `97601992@`.
- `assets/js/auth-guard.js` para proteger páginas internas.
- Panel de acceso integrado en `index.html` (mantiene el diseño "en construcción").
- Stub de `home.html` como sitio real tras el gate.
- Barra de progreso del landing actualizada al **5%**.

**Criterio de cierre**

- Sin acceso a `home.html` sin el código correcto (redirige a `index.html`).
- Con el código correcto, se persiste la sesión y se accede a `home.html`.

#### ⏳ Fase 1 — Estructura base CSS/JS

- Extraer CSS embebido del landing a `assets/css/base.css`.
- Sistema de tipografías y variables compartido entre landing y sitio real.
- Añadir `favicon`, `meta` OG/SEO mínimos.
- No hay cambios funcionales visibles más allá del refactor.

#### ✅ Fase 2 — Home real + páginas estáticas

- `home.html` con navegación real, hero, resumen de módulos y KPIs (aún placeholder).
- Subpáginas: `/pages/about.html`, `/pages/cobertura.html`, `/pages/normativa.html`, `/pages/contacto.html`.
- Todas protegidas por `auth-guard.js` / `auth-guard-pages.js`.
- Contenido 100% estático.

#### ✅ Fase 3 — Hosting y CI

- `package.json` base con scripts de lint y serve.
- `.htmlvalidate.json` con ajustes tolerantes para HTML estático.
- `vercel.json` con headers de seguridad, cleanUrls y redirects.
- `.nojekyll` para GitHub Pages sin procesamiento Jekyll.
- `.gitignore` de Node / Vercel / secretos.
- `.github/workflows/ci.yml` — lint HTML en push / PR (branches `main`, `master`, `claude/**`).
- `.github/workflows/pages.yml` — deploy a GitHub Pages desde `main`.
- `README.md` con estado, stack y comandos de desarrollo.

#### ✅ Fase 4 — Firebase

- `firebase.json` (hosting + rules paths + emuladores Auth/Firestore/Storage).
- `.firebaserc` con `default: "sgm-transpower"`.
- `firestore.rules` y `storage.rules` en modo **DENY-ALL** (`allow read, write: if false`).
- `firestore.indexes.json` vacío (se pobla en F6+).
- `assets/js/firebase-config.js` con config pública placeholder y flag `isFirebaseConfigured`.
- `assets/js/firebase-init.js` — SDK modular v10 vía CDN (app/auth/firestore/storage), exports `getApp`, `getAuthSafe`, `getDbSafe`, `getStorageSafe`. Expone `window.__sgmFirebaseProbe()` para diagnóstico.
- `pages/_firebase-test.html` — página oculta (no enlazada) que verifica la carga del SDK y reporta `projectId` + servicios cargados.
- Pasos manuales documentados en el header de `firebase-config.js` (crear proyecto, habilitar Auth/Firestore/Storage, desplegar reglas con `firebase deploy`).

#### ✅ Fase 5 — Autenticación admin

- `/admin/login.html` con formulario Email/Password sobre Firebase Auth, persistencia `browserSessionPersistence` y chequeo contra allowlist de UIDs. Detecta prerequisitos (Firebase configurado + UID registrado) y bloquea el botón con aviso si faltan.
- `/admin/index.html` — panel administrativo vacío con 8 módulos placeholder (F6–F12), banner con email del admin y botón de logout.
- `assets/js/admin/admin-config.js` — `ADMIN_UIDS` (allowlist) + `ADMIN_ROUTES` + helper `isAdminUid(uid)`.
- `assets/js/admin/admin-auth.js` — `loginAdmin`, `logoutAdmin`, `onAdminAuthChange`, `humanizeAuthError`, `ensureReady`.
- `assets/js/admin/admin-guard.js` — verifica gate estático + sesión Firebase + UID autorizado. Oculta el `<body>` hasta resolver. Timeout de 5 s → redirige a login.
- Link discreto a `admin/login.html` en el footer de `home.html`.

#### ✅ Fase 6 — Módulo Inventario

- Colección `transformadores` en Firestore con campos: `codigo`, `nombre`, `departamento`, `municipio`, `subestacion`, `potencia_kva`, `tension_primaria_kv`, `tension_secundaria_kv`, `marca`, `modelo`, `serial`, `fecha_fabricacion`, `fecha_instalacion`, `estado` (operativo / mantenimiento / fuera_servicio / retirado), `latitud`, `longitud`, `observaciones`, timestamps y `createdBy`.
- Reglas Firestore: lectura pública (filtrada por gate estático) + escritura restringida a admins vía colección `/admins/{uid}`. Validación server-side de campos obligatorios y enumeración de `estado`.
- Índices compuestos en `firestore.indexes.json` (`departamento+codigo` y `estado+codigo`).
- `assets/js/data/transformadores.js` — API: `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `contarPorEstado` + enums + helpers de formato.
- `admin/inventario.html` + `admin-inventario.js` — tabla con filtros (depto / estado), modal CRUD completo con 16 campos, confirmación de borrado, mensajes de feedback.
- `pages/inventario.html` + `inventario-public.js` — vista solo lectura con KPIs (total, operativo, mantenimiento, fuera de servicio), filtros y búsqueda local.
- `assets/css/inventario.css` — tabla, toolbar, estado-pills, modal.
- Nav ampliada con "Inventario" en `home.html` + 5 subpáginas + panel admin.

#### ✅ Fase 7 — Módulo Órdenes de trabajo

- Colección `ordenes` en Firestore con campos: `codigo`, `titulo`, `descripcion`, `transformadorId`, `transformadorCodigo`, `tipo` (preventivo / correctivo / predictivo / emergencia), `prioridad` (baja / media / alta / crítica), `estado` (planificada / en_curso / cerrada / cancelada), `tecnico`, `fecha_programada`, `fecha_inicio`, `fecha_cierre`, `duracion_horas`, `observaciones`, timestamps y `createdBy`.
- Subcolección **`ordenes/{id}/historial`** (append-only) con eventos `{tipo_evento, estado_previo, estado_nuevo, nota, uid, at}`. Reglas Firestore bloquean update/delete (historial inmutable). La API registra automáticamente un evento `creacion` al alta y `cambio_estado` cuando cambia el campo `estado`.
- Reglas Firestore: lectura pública (filtrada por gate estático) + escritura restringida a admins vía `/admins/{uid}` con validación de enums server-side (`estado`, `tipo`, `prioridad`).
- Índices compuestos en `firestore.indexes.json`: `estado+codigo`, `tipo+codigo`, `prioridad+codigo`, `transformadorId+codigo` (todos con `codigo DESC` para listar órdenes más recientes primero).
- `assets/js/data/ordenes.js` — API: `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `registrarEvento`, `listarHistorial`, `contarPorEstado` + enums `ESTADOS_ORDEN`, `TIPOS_ORDEN`, `PRIORIDADES` + helpers de etiqueta.
- `admin/ordenes.html` + `admin-ordenes.js` — tabla con filtros (estado / tipo / prioridad), modal CRUD con 14 campos + select de transformadores (cargado desde la API de inventario), confirmación de borrado y **historial inmutable visible en modo edición**.
- `pages/ordenes.html` + `ordenes-public.js` — vista solo lectura con KPIs (total, planificadas, en curso, cerradas), filtros y búsqueda local por código/título/transformador/técnico.
- `assets/css/ordenes.css` — pills de `estado-pill.planificada|en_curso|cerrada|cancelada`, `tipo-pill.*`, `prioridad-pill.*` y bloque `.historial-wrap`.
- Nav ampliada con "Órdenes" en `home.html` + 6 subpáginas + panel admin + admin/inventario.

#### ✅ Fase 8 — KPIs y analítica

- `assets/js/data/kpis.js` — agregador cliente-side sobre `transformadores` + `ordenes`. Función principal `computeDashboard()` devuelve: totales, distribuciones (por estado / tipo / prioridad / departamento), serie mensual (últimos 12 meses), top-10 transformadores con más intervenciones y bloque **RAM** (`mtbf_dias`, `mttr_horas`, `disponibilidad_pct`, `muestra_fallos`, `parque_dias_servicio`). Adicionalmente `exportarOrdenesCSV()` genera un CSV con el universo de órdenes enriquecido con nombre y departamento del transformador.
- **Fórmulas RAM:**
  - MTTR = media de `duracion_horas` en órdenes `correctivas` cerradas; fallback a `fecha_cierre − fecha_inicio`.
  - MTBF = días-equipo acumulados en servicio (Σ `hoy − fecha_instalacion` por transformador) ÷ número de fallos (correctivas cerradas).
  - A = MTBF / (MTBF + MTTR) en las mismas unidades (horas).
- `pages/kpis.html` + `kpis-public.js` — dashboard público con 4 KPIs de parque, 3 tarjetas RAM, 5 gráficas (doughnut, 3 barras, línea) y tabla top-10. Botón "Recalcular" que vuelve a pedir a Firestore.
- `admin/kpis.html` + `admin-kpis.js` — mismo dashboard + botón **Exportar CSV** que descarga `sgm-ordenes-YYYY-MM-DD.csv`.
- `assets/js/kpis-render.js` — renderer compartido entre admin y público (destrucción correcta de charts en recargas, paleta alineada con variables CSS).
- `assets/css/kpis.css` — `.ram-grid`, `.ram-card` (con variantes good/warn según disponibilidad), `.charts-grid`, `.chart-card`, `.top-wrap`.
- Chart.js 4.4.1 por CDN (jsDelivr, umd.min).
- `home.html` alimenta ahora las 4 tarjetas placeholder (`TRANSFORMADORES / ÓRDENES ACTIVAS / DISPONIBILIDAD / MTBF`) con valores reales del snapshot.
- Nav "KPIs" en home + 7 subpáginas (incluye `_firebase-test`) + 3 paneles admin.
- Consultas agregadas sobre `ordenes`.

#### ✅ Fase 9 — Gestión documental

- Colección Firestore `documentos` (metadatos) + binarios en Firebase Storage bajo `documentos/{docId}/{filename}`.
- Campos: `codigo`, `titulo`, `descripcion`, `categoria` (protocolo / informe / certificado / manual / reporte / otro), `norma_aplicable` (ISO_50001 / IEEE_C57_12 / IEC_60076 / RETIE / NTC_IEC_60364 / CIGRE_WG_A2 / NINGUNA), `transformadorId`, `transformadorCodigo`, `autor`, `fecha_emision`, `filename`, `mime`, `size`, `storagePath`, `downloadURL`, `status` (subiendo / listo / error), timestamps y `createdBy`.
- **Storage**: `storage.rules` permite lectura pública (filtrada por gate estático), escritura restringida a admins vía `firestore.exists(/admins/{uid})` con límite de **20 MB** por archivo.
- **Firestore**: `firestore.rules` valida enums server-side en `create` y `update`; escritura restringida a admins.
- Índices compuestos en `firestore.indexes.json`: `categoria+codigo`, `norma_aplicable+codigo`, `transformadorId+codigo`.
- `assets/js/data/documentos.js` — API: `listar`, `obtener`, `subir` (pre-crea doc → `uploadBytesResumable` con callback de progreso → marca `status=listo` con `downloadURL`), `actualizarMetadata`, `eliminar` (borra objeto en Storage + doc), `formatSize`, `iconoPorMime` + enums + `MAX_FILE_MB`.
- Vista admin: `admin/documentos.html` + `admin-documentos.js` — tabla con filtros (categoría / norma), modal con 9 campos de metadata + drop-zone de archivo con barra de progreso en tiempo real. En edición se oculta el campo archivo (los binarios no se reemplazan en esta fase).
- Vista pública: `pages/documentos.html` + `documentos-public.js` — 4 KPIs (total, protocolos, informes, volumen total), filtros + búsqueda local, enlaces de descarga directos a Storage.
- `assets/css/documentos.css` — pills por categoría (6 variantes) y por estado de subida, drop-zone, barra de progreso.
- Nav ampliada con "Documentos" en home + 8 subpáginas (incluye `_firebase-test`) + 4 paneles admin.

#### ✅ Fase 10 — Georreferenciación

- Renderer compartido `assets/js/mapa-render.js` sobre **Leaflet 1.9.4** + **Leaflet.markercluster 1.5.3** (ambos por CDN unpkg con SRI). Funciones públicas: `initMap(id)`, `loadMarkers({departamento, estado, adminEditHref, onReport})`, `resetMap()`, `legendHtml()`. Usa `L.markerClusterGroup({ maxClusterRadius: 50, spiderfyOnMaxZoom: true })` y `divIcon` coloreado por estado via CSS var `--dot-color`.
- **Centro inicial:** `[9.4, -74.8]` · Caribe Colombiano · zoom 7. Tile layer **OpenStreetMap** estándar. `fitBounds` automático con `padding [30,30]` y `maxZoom: 11` al cargar marcadores.
- Filtro de coordenadas válidas: se descartan `null`, `0,0` y valores fuera de `[-90,90] / [-180,180]` (evita marcadores espurios en el origen).
- Paleta por `estado`: `operativo → --accent3 (#00ff99)`, `mantenimiento → --accent2 (#f0a500)`, `fuera_servicio → #ff5577`, `retirado → #4a6478`.
- Vista pública: `pages/mapa.html` + `assets/js/mapa-public.js` — filtros departamento/estado, botones **Recargar** y **Vista general**, contador `X visible de Y`, status-bar con total / con-coordenadas / sin-coordenadas, popup con ficha resumida del transformador (código, nombre, estado-pill, ubicación, potencia, tensión, coordenadas).
- Vista admin: `admin/mapa.html` + `assets/js/admin/admin-mapa.js` — mismos filtros + popup extendido con **enlace directo a `inventario.html#edit:{id}`** para corregir coordenadas o editar ficha.
- `assets/css/mapa.css` — contenedor `#sgmMap { height: 560px; }` (460px ≤ 768px), **tema oscuro** aplicado a controles y popups Leaflet (`.leaflet-container`, `.leaflet-control-attribution`, `.leaflet-control-zoom a`, `.leaflet-popup-content-wrapper`, `.marker-cluster` + `.marker-cluster div`), estilos de toolbar, contador, leyenda, barra de estado y pill `.sgm-pop-edit`.
- Nav ampliada con "Mapa" en home + 9 subpáginas (incluye `_firebase-test`) + 5 paneles admin.

#### ⏳ Fase 11 — Alertas y notificaciones

- Jobs programados (Vercel Cron) que revisan vencimientos.
- Notificaciones por email vía servicio gratuito (Resend / Brevo tier free).

#### ⏳ Fase 12 — Gate dinámico + endurecimiento

- Gate estático reemplazado por códigos rotativos en Firestore.
- Serverless function `/api/verify-code` valida sin exponer el secreto.
- Revisión de reglas de seguridad Firestore/Storage.

#### ⏳ Fase 13 — Pulido

- Lighthouse ≥ 90 en Performance, Accessibility, Best Practices, SEO.
- Meta tags OG, Twitter Cards, sitemap, robots.txt.
- Revisión WCAG AA.

#### ⏳ Fase 14 — Lanzamiento

- Reemplazo del landing "en construcción" por el home real.
- La barrera de acceso se mantiene sólo para la zona admin.
- Tag `v1.0.0`.

---

## 6. Convenciones de trabajo

- **Branch de desarrollo:** `claude/personal-website-transformers-CVWxV`.
- **Commits:** un commit por microfase, mensaje descriptivo en español iniciando con `feat|fix|docs|chore|refactor|style|ci`.
- **Idioma del sitio:** español (primario); inglés como fase futura.
- **Estilo de código:** HTML5 semántico, CSS con variables, JavaScript ES6+ modular.
- **No se sube código** con claves, tokens o `.env` a Git (se usarán secretos de GitHub / Vercel).

---

## 7. Progreso actual

| Métrica                    | Valor |
|----------------------------|-------|
| Fase en curso              | **Fase 10 cerrada · a la espera de Fase 11** |
| Porcentaje global           | **80 %** |
| Último commit              | (ver historial Git) |
| Servicios dinámicos activos | ninguno (aún sólo estático) |

---

## 8. Historial de cambios

- **Fase 0** — Creación de `CLAUDE.md`, gate estático con código `97601992@`, `home.html` stub protegido, `gate.js`, `auth-guard.js`, actualización del landing al 5 %.
- **Fase 1** — `assets/css/base.css` con variables, reset, bg, animaciones y utilidades compartidas. Refactor de `index.html` y `home.html` para usar variables CSS (`--font-*`). `assets/img/favicon.svg` con ícono del transformador. Meta tags OG/SEO en ambas páginas. Progreso actualizado al 10 %.
- **Fase 2** — `assets/css/app.css` con shell compartido (topbar, nav, page-container, stats/modules/norm/geo cards, forms, progress, highlight-box, responsive). Reescritura de `home.html` como dashboard operativo (KPIs placeholder, 6 módulos, barra de progreso 20 %, 15 status-badges de fases). Nuevas subpáginas estáticas: `pages/about.html` (perfil + descripción), `pages/cobertura.html` (5 departamentos + 11 municipios Magdalena + placeholder de mapa), `pages/normativa.html` (ISO 50001, IEEE C57.12, IEC 60076, NTC-IEC 60364, RETIE, CIGRE WG A2), `pages/contacto.html` (formulario visual + info de canales). `assets/js/auth-guard-pages.js` para proteger rutas en `/pages/`. Landing actualizado a 20 %.
- **Fase 3** — `package.json` (scripts `lint:html`, `serve`, `test`) + `html-validate` como dev dep. `.htmlvalidate.json` con reglas tolerantes para el shell estático. `vercel.json` con headers de seguridad (`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), `cleanUrls` y `redirects`. `.nojekyll` y `.gitignore` (node_modules, .env, secretos). Workflows: `.github/workflows/ci.yml` (lint en push / PR) y `.github/workflows/pages.yml` (deploy automático a GitHub Pages desde `main`). `README.md` con estado, stack y comandos. Landing y home actualizados a 25 %.
- **Fase 4** — Integración base de Firebase (sin servicios activos todavía). `firebase.json` con hosting, rules y emuladores (auth 9099, firestore 8080, storage 9199, hosting 5000). `.firebaserc` (`default: sgm-transpower`). `firestore.rules` y `storage.rules` en modo **DENY-ALL**. `firestore.indexes.json` vacío. `assets/js/firebase-config.js` con config pública placeholder + flag `isFirebaseConfigured`. `assets/js/firebase-init.js` — SDK modular v10 por CDN con `getApp` / `getAuthSafe` / `getDbSafe` / `getStorageSafe` y sonda `window.__sgmFirebaseProbe()`. `pages/_firebase-test.html` (oculta) para verificar carga del SDK. Landing y home al 30 %.
- **Fase 5** — Autenticación admin real sobre Firebase Auth. `/admin/login.html` (Email/Password, `browserSessionPersistence`, aviso cuando faltan prerequisitos, errores humanizados). `/admin/index.html` — panel vacío con 8 módulos placeholder (F6–F12), banner con email del admin, botón logout. Módulo `assets/js/admin/` con: `admin-config.js` (allowlist `ADMIN_UIDS` + helper `isAdminUid`), `admin-auth.js` (`loginAdmin`, `logoutAdmin`, `onAdminAuthChange`, `humanizeAuthError`, `ensureReady`), `admin-guard.js` (gate estático + verificación de sesión + UID autorizado, body oculto hasta resolver, timeout 5 s → login). Link discreto a admin en el footer de `home.html`. Landing y home al 35 %.
- **Fase 6** — Módulo Inventario CRUD. Colección `transformadores` con 17 campos (incl. timestamps y `createdBy`). `firestore.rules` con validación de campos obligatorios, enum de `estado` y control de admins vía colección `/admins/{uid}`. Índices compuestos `departamento+codigo` y `estado+codigo`. `assets/js/data/transformadores.js` (API: `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `contarPorEstado` + enums + labels). `admin/inventario.html` + `admin-inventario.js` (tabla con filtros depto/estado, modal con 16 campos, alta/edición/baja con confirmación). `pages/inventario.html` + `inventario-public.js` (KPIs por estado, filtros depto/estado, búsqueda local por texto, solo lectura). `assets/css/inventario.css` (tabla, toolbar, estado-pills, modal). Nav actualizada con "Inventario" en home + 5 subpáginas + panel admin. Landing y home al 45 %.
- **Fase 7** — Módulo Órdenes de trabajo. Colección `ordenes` con 14 campos funcionales (codigo, titulo, descripcion, transformadorId, transformadorCodigo, tipo, prioridad, estado, tecnico, fechas programada/inicio/cierre, duracion_horas, observaciones) + timestamps y `createdBy`. Subcolección **`ordenes/{id}/historial`** append-only (append-only reforzado en reglas: update/delete bloqueados) con eventos `creacion` y `cambio_estado` registrados automáticamente por la API. `firestore.rules` extendidas con enums de `estado` (planificada/en_curso/cerrada/cancelada), `tipo` (preventivo/correctivo/predictivo/emergencia) y `prioridad` (baja/media/alta/critica). Índices compuestos `estado+codigo`, `tipo+codigo`, `prioridad+codigo`, `transformadorId+codigo`. `assets/js/data/ordenes.js` (API completa con `registrarEvento` y `listarHistorial`). `admin/ordenes.html` + `admin-ordenes.js` (tabla con 3 filtros, modal con 14 campos + select dinámico de transformadores + bloque de historial visible en edición). `pages/ordenes.html` + `ordenes-public.js` (KPIs por estado, 3 filtros, búsqueda local). `assets/css/ordenes.css` (pills de estado-orden / tipo / prioridad + bloque historial). Nav con "Órdenes" en home + 6 subpáginas + 2 paneles admin. Landing y home al 55 %.
- **Fase 8** — Módulo KPIs &amp; Analítica RAM. `assets/js/data/kpis.js` agrega en cliente sobre `transformadores` + `ordenes` y entrega un snapshot con totales, distribuciones (estado/tipo/prioridad/departamento), serie mensual de últimos 12 meses, top-10 transformadores y bloque RAM (MTBF en días, MTTR en horas, Disponibilidad = MTBF/(MTBF+MTTR)). Además `exportarOrdenesCSV()` genera CSV enriquecido. Chart.js 4.4.1 por CDN. `pages/kpis.html` + `kpis-public.js` = dashboard público con 4 KPIs + 3 tarjetas RAM + 5 gráficas (doughnut + 3 barras + línea) + tabla top-10. `admin/kpis.html` + `admin-kpis.js` = mismo dashboard con botón "Exportar CSV". Renderer compartido en `assets/js/kpis-render.js`. `assets/css/kpis.css` para grids RAM / charts / tabla top. `home.html` alimenta en tiempo real sus 4 tarjetas placeholder (Transformadores / Órdenes activas / Disponibilidad / MTBF). Nav "KPIs" en home + 7 subpáginas + 3 paneles admin. Landing y home al 65 %.
- **Fase 9** — Gestión Documental con Firebase Storage. Colección `documentos` con metadatos (codigo, titulo, descripcion, categoria, norma_aplicable, transformadorId/Codigo, autor, fecha_emision, filename, mime, size, storagePath, downloadURL, status) + timestamps y `createdBy`. Binarios en `documentos/{docId}/{filename}` con tope de **20 MB**. `firestore.rules` valida enums (6 categorías × 7 normas) y limita escritura a admins. `storage.rules` abre `documentos/**` con lectura pública y escritura admin vía `firestore.exists(/admins/{uid})`. Índices `categoria+codigo`, `norma_aplicable+codigo`, `transformadorId+codigo`. `assets/js/data/documentos.js` (API `listar`/`obtener`/`subir`/`actualizarMetadata`/`eliminar` + `uploadBytesResumable` con progreso + limpieza de Storage al borrar). `admin/documentos.html` + `admin-documentos.js` (tabla + modal con drop-zone + barra de progreso). `pages/documentos.html` + `documentos-public.js` (4 KPIs, filtros cat/norma, búsqueda local, enlaces de descarga). `assets/css/documentos.css` (pills por categoría y estado, drop-zone). Nav "Documentos" en home + 8 subpáginas + 4 paneles admin. Landing y home al 73 %.
- **Fase 10** — Georreferenciación con **Leaflet 1.9.4** + **Leaflet.markercluster 1.5.3** (CDN unpkg con SRI). Renderer compartido `assets/js/mapa-render.js` expone `initMap`, `loadMarkers`, `resetMap` y `legendHtml`. Tile layer OpenStreetMap, centro Caribe Colombiano `[9.4,-74.8]` zoom 7, `fitBounds` automático con padding al cargar. Paleta por estado (operativo/mantenimiento/fuera_servicio/retirado) aplicada a `divIcon` vía CSS var `--dot-color`. Filtro de coordenadas válidas (descarta `null`, `0,0` y valores fuera de rango). `pages/mapa.html` + `mapa-public.js` (filtros depto/estado, contador `X visible de Y`, status-bar, popups solo-lectura). `admin/mapa.html` + `admin-mapa.js` (mismos filtros + popup con enlace `inventario.html#edit:{id}` para corregir coordenadas). `assets/css/mapa.css` (contenedor `#sgmMap` 560px/460px, tema oscuro para controles Leaflet y popups, leyenda con dots coloreados). Nav "Mapa" en home + 9 subpáginas + 5 paneles admin. Landing y home al 80 %.
