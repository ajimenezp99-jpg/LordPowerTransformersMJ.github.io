# SGM · TRANSPOWER

Sistema de Gestión del Mantenimiento Especializado de Transformadores de Potencia —
Caribe Colombiano (Bolívar, Córdoba, Sucre, Cesar y 11 municipios de Magdalena).

> Proyecto **sin ánimo de lucro**. Stack íntegramente sobre tiers gratuitos
> (GitHub Pages · Vercel Hobby · Firebase Spark · Leaflet / OpenStreetMap).

## Estado

**v2.0.0 cerrada** — 22 microfases F16→F37 implementadas conforme al
procedimiento interno **MO.00418.DE-GAC-AX.01 Ed. 02** (CARIBEMAR DE
LA COSTA S.A.S E.S.P · Afinia · Grupo EPM).

- **F15** ✅ Realtime con `onSnapshot`.
- **F16** ✅ Refactor al schema v2 (secciones + `salud_actual`).
  Ver [`docs/MODELO-DATOS-v2.md`](./docs/MODELO-DATOS-v2.md).
- **F17** ✅ Importador Excel → Firestore con recálculo HI oficial.
- **F18** ✅ Motor de Salud (7 calificadores + HI ponderado Tabla 10
  + overrides §A5/§A9 + Duval/Rogers/Doernenburg + sobrecarga IEEE
  C57.91 + monitoreo intensivo C₂H₂ + juicio experto FUR).
- **F19** ✅ Muestras DGA/ADFQ/FUR time-series con contexto §A9.6.
- **F20–F22** ✅ Subestaciones · Contratos · Catálogos (subactividades
  + macroactividades + causantes, seed baseline §A7).
- **F23** ✅ Refactor Órdenes v2 con FKs a macroactividad/contrato
  y workflow de 11 estados.
- **F24–F26** ✅ TPT/Respaldo (IEEE C57.91) · Fallados + RCA (5 Porqués
  / Ishikawa / FMEA) · Contramuestras + Monitoreo intensivo + FUR.
- **F27** ✅ Dashboards ejecutivos por rol.
- **F28–F30** ✅ RBAC granular (6 roles + ámbito geográfico) ·
  Workflow aprobaciones + estados especiales (OTC §A9.3) ·
  Plan de Inversión con scoring multicriterio.
- **F31–F35** ✅ Reportes PDF/XLSX · Cloud Functions + email cron ·
  Desempeño aliados · PWA offline · Audit log global.
- **F36** ✅ Matriz Criticidad × Salud (5×5 semáforo Tabla 11).
- **F37** ✅ Motor de Estrategias por condición (catálogo §A7).

Plan completo y diccionario de cambios en [`CLAUDE.md`](./CLAUDE.md).

**Tag actual:** `v2.0.0` · **Tests:** 266/266 verdes · **Lint:** HTML limpio.

## Stack

- Frontend estático: HTML5 + CSS3 + JavaScript ES6+ (vanilla).
- Hosting estático: **GitHub Pages** (Actions workflow `pages.yml`).
- Hosting dinámico (futuro): **Vercel Hobby** (serverless Node.js).
- Backend (futuro): **Firebase** (Auth · Firestore · Storage).
- Mapas: **Leaflet 1.9.4 + Leaflet.markercluster 1.5.3 + OpenStreetMap** (CDN unpkg).

## Desarrollo local

```bash
npm install        # instala html-validate
npm run lint       # valida HTML
npm run test:unit  # tests unitarios del dominio (node --test)
npm test           # lint + tests
npm run serve      # sirve el sitio en http://localhost:8080
```

Los tests (266 al cierre de v2.0.0) cubren:

- Schema v2 (pesos oficiales Tabla 10, enums, UUCC CREG 085, buckets HI).
- Sanitizadores/validadores: transformadores · subestaciones · muestras ·
  contratos · órdenes v2 · fallados.
- Motor de Salud conforme MO.00418: 7 calificadores con bordes §A3,
  overrides §A5 (FUR/CRG/C₂H₂), Chedong, snapshot completo.
- Diagnóstico DGA: Duval Triangle 1, Rogers Ratios, Doernenburg.
- Sobrecarga IEEE C57.91 + Arrhenius FAA.
- Monitoreo intensivo C₂H₂ (§A9.1 R1/R2/R3) + batería ETU.
- Juicio experto FUR (§A9.2) con 3 decisiones y banderas permanentes.
- Importador Excel: hojas → tipo_activo, fechas dd/mm/yyyy, comas
  decimales, recálculo HI vs condicion_excel.
- Matriz Criticidad × Salud (Tabla 11) + rangos §A9.9.
- Motor de estrategias F37 (condición → macroactividad).
- RBAC granular + workflow con 21 transiciones permitidas por rol.
- Plan de Inversión (scoring multicriterio + candidatos forzosos).
- Desempeño aliados + audit trail.

## Documentación

Mapa completo de navegación (leer en este orden ante cualquier duda):

1. [`CLAUDE.md`](./CLAUDE.md) — **contrato funcional** · §0 permisos push · §7.1 inventario del repo · §7.2 cómo continuar · §5 plan histórico F0–F37.
2. [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — mapa de código por capa (dominio / data / UI / rules / tests). Si buscas "dónde está X", empieza aquí.
3. [`docs/MODELO-DATOS-v2.md`](./docs/MODELO-DATOS-v2.md) — diccionario completo del shape v2 (secciones, `salud_actual`, subcolecciones, §9 con todas las colecciones F17–F37).
4. [`docs/OPERACIONES.md`](./docs/OPERACIONES.md) — runbook de bootstrap, uso diario por rol, troubleshooting.
5. [`docs/DEPLOY-FUNCTIONS.md`](./docs/DEPLOY-FUNCTIONS.md) — despliegue de Cloud Functions F32 (firebase login, secret Resend, costos estimados).
6. [`CHANGELOG.md`](./CHANGELOG.md) — release notes consolidadas v1.0 → v2.0.8.

## CI/CD

- `.github/workflows/ci.yml` — lint HTML en push / PR.
- `.github/workflows/pages.yml` — deploy automático a GitHub Pages desde `main`.
- `vercel.json` — configuración de headers, cleanUrls y redirects para Vercel.

## Firebase (Fase 4 → v2.0.x)

Archivos en el repo:

- `firebase.json` — hosting, paths de reglas, emuladores (auth 9099 / firestore 8080 / storage 9199).
- `.firebaserc` — proyecto `sgm-transpower`.
- `firestore.rules` v2 — valida secciones identificacion/ubicacion + enums + `estado_v2` del workflow F29.
- `firestore.indexes.json` — 20+ índices compuestos (zona/grupo/bucket/contratos/macroactividades).
- `storage.rules` — `documentos/**` lectura pública, escritura admin (tope 20 MB).
- `assets/js/firebase-config.js` — config pública (placeholders).
- `assets/js/firebase-init.js` — bootstrap del SDK modular v10.
- `functions/` — Cloud Functions deployable (F32) con stubs `onMuestraCreate` + `cronAlertasDiarias`.
- `pages/_firebase-test.html` — sonda de diagnóstico (oculta).

Pasos manuales pendientes (consola Firebase):

1. Crear proyecto `sgm-transpower` en <https://console.firebase.google.com>.
2. Agregar Web App → copiar el `firebaseConfig` → pegar en
   `assets/js/firebase-config.js`.
3. Habilitar **Authentication** (Email/Password), **Firestore** y **Storage**.
4. Desplegar reglas:

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,storage
   ```

5. Abrir `/pages/_firebase-test.html` en el sitio (tras ingresar el gate) para
   confirmar que los tres servicios cargan.

## Acceso (Fase 14 — Login-first)

La plataforma es privada. La raíz `/` muestra un **portal de login**
SaaS-style y ninguna otra ruta es accesible sin sesión activa.

- **Autenticación:** Firebase Auth · Email/Password.
- **Portal único:** `index.html` es el login para todo el equipo. El
  antiguo `/admin/login.html` fue retirado.
- **Persistencia:** el checkbox "Mantener sesión" alterna entre
  `browserLocalPersistence` (queda abierto hasta logout) y
  `browserSessionPersistence` (cierra al salir del navegador).
- **Recuperación de contraseña:** `sendPasswordResetEmail` integrado
  en el portal.
- **Roles (`/usuarios/{uid}`):**
  - `admin` — acceso completo, incluye el panel `/admin/*`.
  - `tecnico` — acceso operativo a los módulos.
- **Guard unificado:** `assets/js/auth/session-guard.js` con dos
  wrappers auto-ejecutables:
  - `auth/page-guard.js` — cualquier página con sesión activa.
  - `auth/admin-guard.js` — requiere `rol=admin`.
- **Panel admin integrado:** ya no es un sitio aparte. La topbar de
  `home.html` muestra el chip del usuario (nombre + rol) y, cuando el
  rol es `admin`, un enlace "Admin ▾" que lleva a `/admin/index.html`.
- **Bootstrap:** la colección heredada `/admins/{uid}` (F5) sigue
  aceptada como admin legacy. Basta con crear el doc desde Firebase
  Console para que el propietario entre la primera vez; después puede
  crear los demás perfiles desde `/admin/usuarios.html`.
- **Gate de códigos retirado:** las colecciones / archivos de F12
  (`gate_codes`, `/admin/codigos.html`, `gate.js`,
  `codigos-acceso.js`) fueron eliminados.

### Gestión de usuarios (Fase 14)

- Ruta admin: `/admin/usuarios.html`.
- API cliente: `assets/js/data/usuarios.js` (`listar`, `obtener`,
  `crear`, `actualizar`, `eliminar`).
- Para dar de alta un miembro del equipo:
  1. Crear la cuenta en Firebase Console → Authentication → Users
     (email + contraseña inicial).
  2. Copiar el UID generado (28 caracteres alfanuméricos).
  3. En `/admin/usuarios.html` → **+ NUEVO USUARIO** → pegar UID +
     email + nombre + rol (`tecnico` por defecto) + activo.
- Para dar de baja: marcar `activo=false` (preserva historial) o
  eliminar el doc (la cuenta de Firebase Auth se deshabilita aparte
  desde la consola).
- El administrador no puede auto-eliminarse ni quitarse el rol.

### Inventario (Fase 6)

- Colección Firestore `transformadores` con 17 campos + timestamps.
- Vista pública: `pages/inventario.html` (KPIs + filtros + búsqueda, solo lectura).
- Vista admin:   `admin/inventario.html` (CRUD completo con modal).
- Pasos adicionales tras configurar Firebase:
  1. Desplegar reglas e índices:
     ```bash
     firebase deploy --only firestore:rules,firestore:indexes
     ```
  2. En Firebase Console → Firestore, crear un documento
     `/admins/{TU_UID_ADMIN}` con contenido libre (p.ej. `{active: true}`).
     Esto autoriza las escrituras en `transformadores` desde ese UID.

### KPIs &amp; Analítica RAM (Fase 8)

- Dashboard basado en **Chart.js 4.4.1** (vía CDN).
- Agregador cliente-side `assets/js/data/kpis.js`:
  - Totales de parque + actividad de órdenes.
  - Distribuciones por estado / tipo / prioridad / departamento.
  - Serie mensual de los últimos 12 meses (campo `fecha_programada`).
  - Top-10 transformadores con más intervenciones.
  - Indicadores **RAM**:
    - MTTR = media de `duracion_horas` en correctivos cerrados.
    - MTBF = días-equipo en servicio ÷ número de fallos.
    - A    = MTBF / (MTBF + MTTR).
- Vista pública: `pages/kpis.html`.
- Vista admin:   `admin/kpis.html` (con botón **Exportar CSV**).
- `home.html` consume el snapshot en tiempo real y llena las 4 tarjetas KPI
  superiores (Transformadores · Órdenes activas · Disponibilidad · MTBF).

### Gestión Documental (Fase 9)

- Colección Firestore `documentos` + binarios en Firebase Storage bajo
  `documentos/{docId}/{filename}` (máx. **20 MB** por archivo).
- 6 categorías (protocolo, informe, certificado, manual, reporte, otro) y
  7 normas aplicables (ISO 50001, IEEE C57.12, IEC 60076, RETIE, NTC-IEC 60364,
  CIGRE WG A2, ninguna).
- API cliente en `assets/js/data/documentos.js` con `uploadBytesResumable`
  (barra de progreso) y limpieza automática del objeto en Storage al eliminar.
- Vista pública: `pages/documentos.html` (KPIs + filtros + búsqueda + descargas).
- Vista admin:   `admin/documentos.html` (subida + CRUD de metadata).
- Índices compuestos adicionales (`categoria+codigo`, `norma_aplicable+codigo`,
  `transformadorId+codigo`). Reglas Firestore validan los enums server-side y
  reglas Storage limitan escrituras a admins registrados en `/admins/{uid}`.

### Mapa de cobertura (Fase 10)

- Renderer compartido `assets/js/mapa-render.js` sobre **Leaflet 1.9.4** +
  **Leaflet.markercluster 1.5.3** (CDN unpkg con SRI).
- Tile layer **OpenStreetMap** estándar. Centro inicial en Caribe Colombiano
  `[9.4, -74.8]` con zoom 7. `fitBounds` automático al cargar marcadores.
- Marcadores `divIcon` coloreados según `estado` (operativo / mantenimiento /
  fuera_servicio / retirado). Clusters automáticos con `maxClusterRadius: 50`.
- Filtro de coordenadas válidas: descarta `null`, `0,0` y valores fuera de
  rango para evitar marcadores espurios.
- Vista pública: `pages/mapa.html` (filtros departamento/estado, contador
  "X visible de Y", popups solo-lectura con ficha resumida).
- Vista admin:   `admin/mapa.html` (mismos filtros + popup con enlace directo
  a `inventario.html#edit:{id}` para corregir coordenadas).
- CSS con **tema oscuro** para controles y popups Leaflet en
  `assets/css/mapa.css`.

### Pulido SEO &amp; Accesibilidad (Fase 13)

- **SEO.** `robots.txt` + `sitemap.xml` en la raíz. La landing (`/`) es la única
  URL indexable; el resto del sitio está tras el gate dinámico y las páginas
  internas llevan `noindex, nofollow`.
- `index.html` trae bloque completo de **Open Graph** (`og:type`, `og:locale=es_CO`,
  `og:url`, `og:title`, `og:description`, `og:image`) + **Twitter Card** (`summary`)
  + `<link rel="canonical">` + `<meta name="theme-color" content="#040c14">` +
  `<meta name="color-scheme" content="dark">`.
- **JSON-LD Organization** al final del `<body>` de la landing con `areaServed`
  (Bolívar · Córdoba · Sucre · Cesar · Magdalena como `AdministrativeArea`) y
  `knowsAbout` (ISO 50001, IEEE C57.12, IEC 60076, RETIE, NTC-IEC 60364,
  CIGRE WG A2, Transformadores, RAM).
- **Accesibilidad WCAG AA.**
  - `.skip-link` ("Saltar al contenido principal") en landing y home apuntando al
    landmark `<main id="main">`.
  - `:focus-visible` global con `outline` azul + `box-shadow` de 2 px en
    botones/inputs/links.
  - `@media (prefers-reduced-motion: reduce)` desactiva scroll suave y colapsa
    animaciones a `.01ms`.
  - `.sr-only` utilitario para contenido solo de lector de pantalla.
  - `aria-hidden="true"` en elementos decorativos y `role="banner"` en las
    topbars.
- **Performance.** `preconnect` adicional a `fonts.gstatic.com` (además del de
  `fonts.googleapis.com`) para adelantar el TLS-handshake del CDN de fuentes.

### Alertas &amp; Notificaciones (Fase 11)

- Motor de reglas cliente-side en `assets/js/data/alertas.js` que computa
  alertas a partir de `transformadores` + `ordenes` sin requerir Cloud
  Functions (Spark plan).
- 7 tipos de alerta: `orden_vencida`, `orden_proxima`, `orden_prolongada`,
  `orden_critica_abierta`, `mantenimiento_largo`, `sin_coordenadas`,
  `sin_fecha_instalacion`.
- 3 severidades: `critica` · `warning` · `info` (ranking determinista para
  orden de listado).
- Colecciones Firestore nuevas:
  - `alertas_config/global` — umbrales configurables (`proxima_dias`,
    `prolongada_dias`, `mantenimiento_dias`), `destinatario_email` y
    `notificaciones_enabled` (preparación para F12).
  - `alertas_reconocidas/{alertId}` — registro de reconocimientos admin con
    `uid`, `nota` y `at`. IDs deterministas
    `${tipo}:${recursoId}:${sello}` → los reconocimientos persisten entre
    recálculos.
- Vista pública: `pages/alertas.html` (resumen por severidad, filtros,
  toggle mostrar reconocidas, enlaces a órdenes / inventario).
- Vista admin:   `admin/alertas.html` (mismo tablero + panel de
  configuración + acciones **Reconocer** / **Quitar reconocimiento**).
- Envío efectivo por email queda diferido a **Fase 12** (Vercel Cron +
  Resend/Brevo). Los campos ya están en la colección de config.

### Modelo de datos v2 (Fase 16)

Refactor del shape plano v1 al modelo oficial conforme MO.00418 Ed. 02.
Detalle completo en [`docs/MODELO-DATOS-v2.md`](./docs/MODELO-DATOS-v2.md).

- **Dominio puro** en `assets/js/domain/`:
  - `schema.js` — enums y pesos canónicos del HI (Tabla 10 del
    MO.00418 con verificación de suma = 1.0 en tiempo de carga).
  - `transformador_schema.js` — sanitizador por secciones
    (`identificacion`, `placa`, `ubicacion`, `electrico`, `mecanico`,
    `refrigeracion`, `protecciones`, `fabricacion`, `servicio`) +
    sub-objetos derivados `salud_actual`, `criticidad`,
    `restricciones_operativas` (reservados para F18 / F29 / F36).
  - `subestacion_schema.js` — nueva entidad FK.
- **Data layer** (`assets/js/data/`):
  - `transformadores.js` — API v2 con retrocompat v1 vía proyección
    aplanada al nivel raíz (vistas legacy siguen funcionando sin
    tocar código).
  - `subestaciones.js` — CRUD Firebase.
  - `transformadores_subcolecciones.js` — `placas_historicas` e
    `historial_hi`, ambas append-only (update/delete bloqueados
    por rules).
- **Scripts:** `scripts/migrate/v1-to-v2-transformadores.js` con
  runner defensivo (dryRun por defecto, acepta adaptadores de I/O
  para admin SDK, web SDK o mock de tests).
- **Firestore rules v2:** validación por sección, coherencia entre
  nivel raíz (v1) y secciones (v2), rechazo de `schema_version ≠ 2`.
- **Índices nuevos:** `ubicacion.zona+codigo`,
  `identificacion.grupo+codigo`,
  `identificacion.tipo_activo+salud_actual.hi_final`,
  `ubicacion.subestacionId+codigo`,
  `salud_actual.bucket+ubicacion.zona`,
  `estado_servicio+codigo`, más 2 índices para `subestaciones` y uno
  de grupo para `historial_hi`.

### Órdenes de trabajo (Fase 7)

- Colección Firestore `ordenes` con 14 campos funcionales + timestamps + `createdBy`.
- Subcolección **`ordenes/{id}/historial`** append-only (reglas prohíben `update` y
  `delete`). La API registra automáticamente eventos en los cambios de estado.
- Enumeraciones con validación server-side:
  - `estado`    → `planificada` · `en_curso` · `cerrada` · `cancelada`
  - `tipo`      → `preventivo` · `correctivo` · `predictivo` · `emergencia`
  - `prioridad` → `baja` · `media` · `alta` · `critica`
- Vista pública: `pages/ordenes.html` (KPIs + filtros + búsqueda, solo lectura).
- Vista admin:   `admin/ordenes.html` (CRUD completo con modal + historial visible).
- Índices compuestos adicionales en `firestore.indexes.json`
  (`estado`, `tipo`, `prioridad`, `transformadorId`, cada uno combinado con
  `codigo DESC`).

## Licencia

Privado · todos los derechos reservados.
