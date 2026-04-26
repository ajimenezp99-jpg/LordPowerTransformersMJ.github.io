# Changelog — SGM · TRANSPOWER

Evolución v1.0 → v2.0 conforme **MO.00418.DE-GAC-AX.01 Ed. 02**
(CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM).

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/).
Semver por tag. Pulido post-v2.0 incrementa el patch (v2.0.1,
v2.0.2, …) sin promesas de incompatibilidad.

## v2.4.0 — Refactor Contratos · arquitectura escalable multi-contrato (2026-04-25)

Reorganización de la navegación para soportar de forma escalable múltiples
contratos de suministro. El módulo "Suministros" (que era flat y
monocontrato) pasa a vivir jerárquicamente dentro de un contrato; cada
contrato futuro replica la misma estructura de tabs sin duplicación de
código. 5 microfases atómicas (M1–M5).

### Microfases

- **M1** — Eliminación del módulo Correcciones. Tab + tabpanel removidos
  de pages/suministros.html, archivos admin/suministros-correcciones.html
  y assets/js/admin/admin-suministros-correcciones.js eliminados, redirect
  legacy retirado de aqua-shell.js. El data layer
  data/correcciones.js y la rule firestore.rules para /correcciones
  permanecen intactos por backwards-compat (3 docs sembrados desde el JSX
  siguen accesibles, colección reusable a futuro).
- **M2** — pages/contratos.html con grid responsive de cards. Cada card
  tiene icon + número + estado-pill + nombre + fechas + footer con flecha
  animada. Suscripción realtime a /contratos con filter tipo='suministros';
  fallback a contrato semilla 4123000081 cuando la query devuelve vacío,
  con tag visible 'SEMILLA' para indicar que aún no está formalmente
  registrado.
- **M3** — pages/contrato.html?id=XXX shell dinámico. Lee el id del query,
  renderiza header con número y nombre cargados desde /contratos/{id}
  (con fallback a META_SEMILLA mientras Firestore responde). 5 tabs sin
  Correcciones: Dashboard (público) · Catálogo · Movimiento · Histórico ·
  Importar (admin). Reusa initModuleShell del refactor v2.3.
- **M4** — Sidebar refactor: 'Suministros' → 'Contratos' (icon
  file-text). LEGACY_REDIRECTS actualizado para que las 5 URLs viejas
  de Suministros lleven al contrato semilla con tab correcta. El shell
  pages/suministros.html antiguo también redirige.
- **M5** — Cache PWA sgm-v3-3-0 → sgm-v3-4-0 + CHANGELOG + tag.

### Patrón escalable para nuevos contratos

Cuando llegue un Excel de un contrato adicional:
1. Importador F42 amplía para detectar el `contrato_id` del Excel.
2. Crea/actualiza /contratos/{id} con tipo='suministros'.
3. Filtra los docs sembrados por contrato_id (suministros, marcas,
   movimientos).
4. La página pages/contratos.html lo lista automáticamente vía
   onSnapshot.
5. Click en la card → pages/contrato.html?id={N} carga sus tabs
   con datos filtrados.

Cero refactor de UI necesario para soportar el contrato N+1.

### Métricas

- 5 microfases · 5 commits aislados
- ~530 LOC nuevas (pages contratos/contrato + controllers + CSS cards)
- 341 LOC eliminadas (módulo Correcciones)
- Tests siguen 399/399 verdes (el módulo de Correcciones eliminado no
  tenía tests automatizados)
- Cero deploys nuevos
- Cache PWA bump

---

## v2.3.0 — Refactor UX · Navegación consolidada con tabs (2026-04-25)

Reorganización inteligente de TODOS los menús del portal. Sidebar pasa
de 32 entradas dispersas a **8 módulos jerárquicos** con tabs internas.
9 microfases (R0–R9) atómicas, cada una shippable independientemente.

### Bloque · Componente reutilizable

- **R0** — `assets/js/ui/tabs.js` ARIA-compliant con keyboard nav y hash
  routing. `assets/css/tabs.css` con estilo Aqua liquid-glass sticky.
  17 tests para los helpers puros (parseHash/buildHash/mergeHash).

### Bloque · Consolidación módulo a módulo

- **R1** — Suministros: 6 vistas (Catálogo, Movimiento, Histórico,
  Correcciones, Importar, Dashboard) → 1 con tabs.
- **R2** — Salud del Activo: 5 vistas (Muestras, Motor HI, Propuestas
  FUR, Contramuestras, Fallados+RCA) + Matriz Riesgo movida desde
  Análisis → 1 con tabs.
- **R3** — Activos: 4 vistas (Inventario, Mapa, Subestaciones,
  Contratos) → 1 con tabs.
- **R4** — Análisis: 5 vistas (Dashboard, KPIs RAM, Alertas, Plan
  Inversión, Desempeño Aliados) → 1 con tabs.
- **R5** — Administración: 5 vistas (Panel, Usuarios, Catálogos,
  Importar Excel, Auditoría) → 1 con tabs.
- **R6** — Recursos: 4 vistas (Documentos, Normativa, Cobertura,
  Acerca) → 1 con tabs.
- **R7** — Reescritura del sidebar: distribuida orgánicamente en R1–R6.

### Bloque · Compatibilidad y cierre

- **R8** — `LEGACY_REDIRECTS` en aqua-shell.js: 28 URLs viejas
  redirigen automáticamente a la página padre con tab activa. Preserva
  bookmarks. Escape hatch `?legacy=keep` para acceso standalone.
- **R9** — Cache PWA `sgm-v3-2-0` → `sgm-v3-3-0` + CHANGELOG + tag.

### Patrón técnico

- **Sin refactor de subscreens**: cada vista existente sigue siendo una
  página completa que se embebe vía `<iframe lazy data-src>`. El
  `module-shell.js` genérico (initModuleShell) es un wrapper de 1
  línea por módulo sobre `tabs.js`.
- **Detección de iframe en aqua-shell.js**: si `window.self !== window.top`
  marca el body con `.is-embedded` y oculta topbar/sidebar/escena Aqua
  para no duplicar el shell del padre.
- **Hash routing**: cada tab activa actualiza `location.hash` con
  `history.replaceState` (no llena el back stack); `hashchange` listener
  permite back/forward del browser entre tabs.
- **RBAC visual**: tabs marcadas `data-admin="1"` se ocultan a
  no-admins leyendo `window.__sgmSession.profile.rol`.

### Métricas

| Métrica | Antes (v2.2.0) | Después (v2.3.0) |
|---|---|---|
| Entradas en sidebar | 32 | **8** (-75%) |
| Páginas standalone | 30+ | mantenidas (compat) |
| Tests | 382 | **399** (+17 helpers tabs) |
| LOC nuevas | — | ~900 (shells + redirects) |
| LOC eliminadas | — | 0 (zero refactor de legacy) |
| Deploys nuevos | 0 | 0 (puro client-side) |

### Estructura final del sidebar

| Grupo | Entrada | Ruta | Tabs internas |
|---|---|---|---|
| Operación | Inicio | `home.html` | — |
| Operación | **Activos** | `pages/activos.html` | Inventario · Mapa · Subestaciones · Contratos |
| Operación | Órdenes | `pages/ordenes.html` | — |
| Operación | **Suministros** | `pages/suministros.html` | Dashboard · Catálogo · Movimiento · Histórico · Correcciones · Importar |
| Análisis | **Análisis e Indicadores** | `pages/analisis.html` | Dashboard · KPIs RAM · Alertas · Plan Inversión · Desempeño |
| Salud del activo | **Salud del Activo** | `pages/salud.html` | Muestras · Motor HI · FUR · Contramuestras · Fallados+RCA · Matriz |
| Administración | **Administración** | `admin/administracion.html` | Panel · Usuarios · Catálogos · Importar Excel · Auditoría |
| Recursos | **Recursos** | `pages/recursos.html` | Documentos · Normativa · Cobertura · Acerca |

---

## v2.2.0 — Suministros + Repuestos · F38–F50 (2026-04-25)

Integración del sistema de control de suministros del .xlsm fuente
+ JSX al sitio web. 13 microfases atómicas. Plan completo en
`docs/PLAN-SUMINISTROS.md`.

### Bloque A · Cimientos (sin UI visible)

- **F38** — Dominio puro. 4 schemas + sanitizers + validadores
  (`suministro_schema.js`, `marca_schema.js`, `movimiento_schema.js`,
  `correccion_schema.js`) + extensión a `schema.js` con
  `TIPOS_MOVIMIENTO`, `ESTADOS_REPUESTO`, `TIPOS_CORRECCION`,
  `UNIDADES`, `ESTADOS_STOCK` (semáforo 6 estados del skill),
  `estadoStock(disp, ini, opts)` y `generarCodigoMov(anio, sec)`.
  41 tests.
- **F39** — Data layer. `data/suministros.js` (codigo como docId),
  `data/marcas.js` con sync arrayUnion/arrayRemove de
  `marcas_disponibles[]`, `data/movimientos.js` con `crear()` en
  `runTransaction()` que valida stock atómicamente y genera
  `MOV-YYYY-NNNN` sin race condition, `data/correcciones.js`
  (sin delete), `data/suministros_config.js` singleton, motor puro
  `domain/stock_calculo.js`. 20 tests.
- **F40** — Rules + 7 índices compuestos. Validación enums
  server-side. Movimientos con campos críticos inmutables en
  update. Correcciones DELETE bloqueado.
- **F41** — Sub-section `repuesto.estado` con dual-write retrocompat.
  +8 tests.

### Bloque B · Importador

- **F42** — Importador idempotente XLSM/JSX → Firestore. Parser puro
  con regex+JSON.parse (cero `eval`). Mapping corregido tras feedback:
  `cod` → `identificacion.codigo`, `m` → `identificacion.matricula`,
  `sub` → `identificacion.nombre` + `subestacion_nombre`.
  Enriquecimiento del catálogo con `valor_unitario` desde JSX. UI
  admin con dropzone + drag-from-repo + dryRun. Audit
  `bulk_import_suministros` con SHA-256. 20 tests.

### Bloque C · Admin UI

- **F43** — Catálogo CRUD realtime + chips marcas inline editables
  en el modal (gestión consolidada).
- **F44** — Marcas CRUD con sync arrayUnion.
- **F45** — Formulario INGRESO/EGRESO con autocomplete cascada,
  validación atómica de stock, color coding del skill,
  `StockInsuficienteError` con faltante explícito.
- **F46** — Histórico con filtros + delete con justificación
  obligatoria + export CSV. Correcciones CRUD sin delete.

### Bloque D · Public UI

- **F47** — Stock Dashboard con 8 KPIs + tabla 22 filas con
  semáforo 6 estados.
- **F48** — Dashboard ejecutivo con 8 KPIs + 4 charts Chart.js +
  vista cruzada zona/depto.

### Bloque E · Export y cierre

- **F49** — Export XLSM 1:1 con template binario via JSZip + parche
  XML quirúrgico. Preserva byte a byte: `vbaProject.bin` (3 macros),
  Office Add-in, charts, theme, styles, las otras 7 hojas. Sólo
  reescribe `sheet6.xml` y `table4.xml`. JSZip lazy-loaded vía CDN.
  8 tests.
- **F50** — Cache PWA bump `sgm-v3-1-0` → `sgm-v3-2-0` + CHANGELOG +
  tag.

### Decisiones del director registradas

1·C 10 hojas en export · 2·A JSX gana / sin DELETE huérfanos ·
3·A `stock_inicial=0` mostrado como SIN_STOCK · 4·A preservar VBA
via template binario · 5·A preservar Office Add-in · 6·A escritura
de movimientos solo admin · 7·A audit `bulk_import_suministros`
con metadata granular.

### Métricas

- 13 microfases · 23+ commits · 6.500+ LOC nuevas
- 282 → 382 tests verdes (+100 tests)
- 1 deploy manual del director (rules + índices)
- Plan completo: `docs/PLAN-SUMINISTROS.md` (1.269 líneas)

---

## v2.1.0-aqua · post-tag · PR #55 (2026-04-25)

Ajustes finos del rediseño Aqua tras feedback del director sobre el
PR #54 (que ya quedó mergeado a `main`). Estos 4 commits viven en
`claude/distracted-hoover-43da2d` esperando merge.

### `d688999` · foto real + overlay SVG con equipos (REVERTIDO)

Primer intento tras feedback "no tuviste en cuenta la imagen": añadí
foto de subestación + overlay SVG con DPS/89/52/CT interconectados
por las 3 fases. El director rechazó el overlay ("manten la imagen
tal cual"). El SVG `assets/img/aqua/substation-scene.svg` queda en
repo pero inactivo.

### `0025a8b` · foto sin overlay + más transparencia

- `.aqua-power-scene` apunta directo a `substation-photo.png` (no al
  SVG). `position: inset 0` cubre toda la viewport. `opacity: 1`
  (era .72). Solo un velo perla muy ligero (12-22%) sobre el cielo
  para asegurar contraste de texto.
- Glass más transparente: thin .42→.22 / .22→.10, regular .52→.30 /
  .32→.16, thick .66→.42 / .44→.24, ultra .82→.62 / .62→.42.
- Topbar idle .55→.30 / .40→.18 (scrolled .78→.50 / .62→.36).
- Sidebar .62→.36 / .48→.22, brand-head .42→.22.
- Blur compensa: 32/48/64px (era 28/44/60).

### `e6e04fe` · texto Steel Corporate Navy + text-shadow

- `--ink-1: #0a1628 → #0d1f38` (títulos · steel navy deep).
- `--ink-2: #2a3a52 → #1f3656` (cuerpo · corporate steel).
- `--ink-3: #5a6c87 → #4d6485` (meta · muted blue-gray).
- `--ink-4: #8896ad → #8093ad` (placeholder · light blue-gray).
- Misma familia cromática que `--brand: #007aff` pero saturada y
  oscura. Estilo corporativo del sector energía (GE, Siemens, ISA).
- `text-shadow: 0 1px 0 rgba(255,255,255,.55), 0 2px 8px rgba(244,
  249,255,.42)` en `.page-title`/`.section-title`/`.page-sub`/
  `.section-sub` para legibilidad sobre la foto (zonas claras del
  cielo y zonas oscuras del transformador).

### `4e24111` · `.gitignore` excluye `.claude/`

- Una línea: `.claude/` añadida al `.gitignore`.
- Resuelve el "commit fantasma" que GitHub Desktop mostraba en
  `main` al ver la carpeta del worktree de Claude Code como
  cambio nuevo.

### Pendientes en PR #55

- Foto en alta resolución (la actual 755×752 pixela en viewports
  >1200px). Pendiente que el director exporte el original desde
  Photos (Export Unmodified Original) o provea URL de origen.
- Merge del PR desde GitHub.com web.
- Revocar el PAT clásico que dio inline durante la sesión.

---

## v2.1.0-aqua · 2026-04-25 · Liquid Glass redesign (iOS 26 / macOS Tahoe)

Rediseño visual integral a **Apple Aqua light perla** (iOS 26 /
macOS Tahoe Liquid Glass). Cero impacto en lógica de Firestore,
motor de salud, importador, RBAC, alertas, reportes o Cloud
Functions. Capa puramente visual sobre la arquitectura v2.0.x.

### Sistema de diseño Aqua (10 microfases)

#### A1 · Fundación
- `assets/css/aqua-tokens.css` (light perla, sin azul de fondo,
  sin rosa). iOS palette (blue/cyan/teal/amber). SF Pro + Instrument
  Serif italic en hero + JetBrains Mono. Radii iOS, motion ease-ios,
  shadows light. **Solo activo con `body.aqua`.** Bloque de aliases
  legacy (`--space-*`, `--surface-*`, `--edge-*`, `--radius-*`,
  `--brand-500`, `--text-*`, `--gradient-*`, etc.) para que el CSS
  legacy de páginas v2 siga funcionando sobre la paleta perla.
- `assets/css/aqua-components.css` (1090 líneas) — librería completa:
  4 materiales de glass con specular + ring 3D, topbar, sidebar,
  botones 3D, chips, inputs, stat cards, panels, alerts, hero,
  feed, qc cards, modals, tabs, breadcrumb, page-head, form-grid,
  hring, reveal + overrides para componentes legacy.
- `assets/js/aqua.js` — partículas eléctricas, glint cursor, topbar
  scroll state, IntersectionObserver reveal, Lucide auto-init.
- `assets/js/aqua-shell.js` — auto-inyecta topbar + sidebar + escena
  en cualquier página con `body.aqua`. Detecta base relativa, marca
  sidebar item activo según URL, lee `window.__sgmSession` para
  mostrar role-chip + iniciales + ocultar links admin a no-admins.
  Bind `⌘K` para enfocar búsqueda global.
- `assets/img/aqua/{transformer,tower,logo-aqua}.svg` — 3 SVG
  técnicos del bundle de Claude Design.

#### A2 · Login Aqua (`index.html`)
Portal de acceso reescrito con auth-card glass-ultra + escena
completa (mesh + grid + 4 orbes blue/cyan/teal/amber + transformer
SVG + partículas). Hero con `<em>` Instrument Serif italic
gradient. Inputs con icon, check Aqua, btn-primary 3D. Mensajes
de estado info/ok/err con paleta light. **100% lógica Firebase
Auth preservada** (mismos IDs de form, mismo módulo ESM con
`signInWithEmailAndPassword`, `sendPasswordResetEmail`,
`setPersistence`, `onAuthStateChanged`, verificación
`/usuarios/{uid}` con fallback `/admins/{uid}`).

#### A3 · Home dashboard (`home.html`)
Topbar `.tb` pegajoso, sidebar `.sb` permanente 240px, app-main
responsive. Hero glass-thick con título serif italic + parque card
(totales por tipo POTENCIA/TPT/RESPALDO). KPIs grid-4 con stat-cards
+ sparklines. Banda de alertas críticas con alert-card glass.
Panel grid-2: distribución HI bucket (1-5 con paleta iOS) + Top
Plan de Inversión. Feed reciente. Quick cards. **Toda la lógica
realtime de Firestore intacta** (mismas suscripciones a
transformadores + ordenes + suscribirComputo de alertas).

#### A4 · Páginas públicas (13)
Migración mecánica con script Python: about, cobertura, contacto,
normativa, alertas, dashboard, documentos, inventario, kpis, mapa,
matriz-riesgo, ordenes, _firebase-test. Cada una: `theme-color
#f4f6fb`, `color-scheme light`, favicon → `logo-aqua.svg`, imports
CSS legacy (theme/base/app/nav/compat) → un solo
`aqua-components.css`, `body class="aqua"`, `<main class="app-main
page-container">`. `nav.js` (legacy) removido — `aqua-shell.js`
auto-inyecta navegación.

#### A5 · Paneles admin (22)
Mismo patrón A4 sobre `admin/*.html`: alertas, auditoria, catalogos,
contramuestras, contratos, demo-seed, desempeno-aliados, documentos,
fallados, importar, index, inventario, kpis, mapa, motor-salud,
muestras, ordenes, plan-inversion, propuestas-fur, subestaciones,
umbrales-salud, usuarios. `admin-guard.js` intacto.

#### A6 · Modales y formularios legacy
Bloque de overrides `body.aqua` para `.modal-overlay`, `.modal-bg`,
`.modal-card`, `.modal-head`, `.modal-x`, `.modal-actions` con
glass-ultra + specular + animación spring. Inputs/textarea/select
dentro de modales legacy con focus iOS. Form grids `.cols-2`/`.cols-3`
responsive. `.btn-primary`/`.btn-primary-v3` → `grad-brand`.

#### A7 · Pills, tablas, alertas legacy
Overrides para `.estado-pill` (operativo/mantenimiento/fuera_servicio
/retirado/fallado · planificada/en_curso/cerrada/cancelada),
`.tipo-pill` (preventivo/correctivo/predictivo/emergencia con
border-left semántico), `.prioridad-pill` (baja/media/alta/critica),
`.sev-pill` (critica/warning/info), `.bucket-pill[data-b="1..5"]`
para HI 1..5 (paleta verde-teal-azul-naranja-rojo). Tablas legacy
con thead translúcido sticky-style. `.alert-row` con glass-thin +
border-left semántico. `.toolbar`, `.filtros`, `.card`, `.panel-v3`,
`.stat-v3`, page-header con tipografía Aqua.

#### A8 · Charts Chart.js
`assets/js/kpis-render.js` detecta `body.aqua` y aplica paleta iOS
(brand `#007aff`, cyan `#00b8d4`, teal `#30d1b0`, success `#1cc870`,
warn `#ff9500`, danger `#ff3b30`, purple `#7e57ff`). Texto SF Pro
en lugar de Share Tech Mono. Tooltips translúcidos perla con border
iOS blue. Líneas con borderWidth 2.5 y point radius 3. Fallback a
paleta dark legacy si la página no es Aqua.

#### A9 · Mapa Leaflet
`mapa-render.js` detecta `body.aqua` y cambia tile a CARTO Voyager
(gris claro, neutro, sin azul dominante). `aqua-components.css` con
override completo: `.map-wrap` glass-thin + border-left brand,
`#sgmMap` perla `#e6edf7`, controles zoom translúcidos, popups con
glass-ultra, marker clusters con `rgba(0,122,255,.20)` y borde
blanco, divIcon con drop-shadow azul, leyenda translúcida.

#### A10 · Polish + QA
- 282/282 tests verdes (`node --test`).
- Lint HTML 100% limpio en index, home, 13 públicas y 22 admin.
- `CHANGELOG.md` actualizado con el bloque Aqua.
- Tag `v2.1.0-aqua`.

### Garantías

- **Cero impacto en lógica.** Solo CSS, HTML estructural mínimo y
  configuración Chart.js/Leaflet. Firebase Auth, Firestore rules,
  Storage rules, motor de salud F18, importador F17, alertas, RBAC,
  audit log, PWA: **intactos**.
- **Reversibilidad por fase.** 10 commits atómicos
  (`6ee0ae3 → e886612`).
- **Performance.** `backdrop-filter` activo solo en superficies
  visibles; `will-change` en hover/scroll. Fallback `@supports not
  (backdrop-filter)` con bg `rgba(255,255,255,.92)` plano.
- **Accesibilidad.** Contraste WCAG AA, skip-link, `:focus-visible`
  con outline brand, sr-only conservados, `prefers-reduced-motion`
  respeta animaciones.
- **Sin emojis** en UI ni copy (regla del AQUA_GUIDE).

### Adiciones nuevas
- Sidebar lateral fijo 240px en todas las páginas internas.
- Búsqueda global ⌘K en topbar (placeholder, lógica futura).
- Partículas eléctricas animadas (sutiles, 8–18 puntos).
- SVG técnico de transformador como fondo a la derecha.
- Avatar con iniciales del usuario en topbar + role-chip dinámico.

### Lo que NO cambió
- Functions, rules, indexes, schema, motor de salud, importador,
  RBAC, audit log: idénticos a v2.0.8.
- 282 tests Node siguen pasando sin modificar.
- Estructura de archivos /assets/js/data, /assets/js/domain, /tests
  no se tocó.

### Comandos de despliegue
- **GitHub Pages:** auto-deploy via `pages.yml` al hacer merge a `main`.
- **Sin deploy de Firebase requerido** (no tocan rules/indexes/
  storage/functions).

---

## v3.0.0 · 2026-04 · UX v3 + Cloud Functions activas

Evolución mayor con reestructuración de UX y activación de la primera
Cloud Function en producción.

### Nuevo sistema de diseño (UX v3)
- Tokens CSS corporativos en `assets/css/theme.css` (Space Grotesk +
  Inter + JetBrains Mono, paleta azul eléctrico + teal, glass morphism,
  aurora gradient sutil).
- Navegación unificada con 2 desplegables (`Más ▾` y `Admin ▾`) en lugar
  de 3 universos inconsistentes. Componente ESM en `assets/js/ui/nav.js`.
- `home.html` redibujado como dashboard operativo (hero + KPIs con
  sparklines + alertas críticas + Top 5 PI + feed + accesos rápidos).
- Páginas estáticas (about, cobertura, normativa, contacto) reescritas
  con tono corporativo, sin referencias a "fases" / "v1.0.0".
- `compat.css` para que las 15 páginas admin secundarias hereden el look
  v3 sin reescribir su HTML.
- `admin/index.html` reducido a redirect → `home.html`. Se retira el
  panel admin separado.
- Dashboard ejecutivo, Matriz de Riesgo y KPIs rediseñados con cards v3.

### Fixes críticos
- Splash de verificación de sesión + failsafe 7.5 s + escape valve
  "Volver al login" tras 2 s.
- Eliminado el bucle infinito MutationObserver + Lucide que congelaba
  el browser (`window.sgmRefreshIcons()` debounced).
- Firebase SDK `10.13.0 → 10.14.1`: silencia warnings "heartbeats
  undefined" (bug conocido del SDK).
- Consolida 4 suscripciones Firestore duplicadas en home a 2.
- Service Worker bump `sgm-v2-0-8 → sgm-v3-1-0` para invalidar cache.

### Cloud Functions
- `firebase.json` declara sección `functions` con runtime `nodejs22`.
- `functions/prepare-deploy.mjs` sincroniza `assets/js/domain/` →
  `functions/domain/` antes del deploy (predeploy hook).
- Refactor `functions/index.js` a Firebase Extension "Trigger Email"
  vía colección `/mail` (100% Google, sin Resend/Secret Manager).
- Dependencias actualizadas: `firebase-admin ^13`, `firebase-functions ^6`.
- ✅ **`onMuestraCreate` deployado en producción** (southamerica-east1).
- Cleanup policy Artifact Registry: 7 días de retención.

### Documentación nueva
- `docs/OPERACIONES.md §0` — **Protocolo de deploys**: regla
  permanente de avisar al director qué hay que deployar manualmente
  cada vez que se modifican rules/indexes/storage/functions.
- `docs/DEPLOY-FUNCTIONS.md` reescrito con flujo Gmail + Extension
  (etapa 1 sin email, etapa 2 opcional con email).
- `CLAUDE.md §0.1.1` — regla obligatoria para Claude de avisar
  en el mismo turno cuando haga cambios que requieran deploy Firebase.

### Pendiente
- `cronAlertasDiarias` — requiere instalar Firebase Extension
  "Trigger Email from Firestore" con Gmail App Password (documentado
  en `docs/DEPLOY-FUNCTIONS.md §2`).

## v2.0.8 · 2026-04
- Audit log wired en `documentos.js` (subir/actualizar/eliminar) — cierre del trail en los 7 data layers de mutación.
- `assets/js/ui-helpers.js` compartido (bucketColor · escHtml · fmtTs). Elimina duplicados en inventario admin/público.
- `admin/demo-seed.html` — pobla 6 TX ficticios cubriendo los 5 buckets + fin_vida_util_papel, 3 muestras DGA y 2 órdenes. Idempotente. Cada TX con `salud_actual` calculado en vivo por el motor F18.

## v2.0.7 · 2026-04
- Audit wired en `ordenes.js` (crear/actualizar/eliminar + `cambiar_estado_orden`), `importar.js` (`importar_excel`), `umbrales_salud.js` (`cambiar_umbrales`).
- `pages/ordenes.html` upgrade v2: añade columnas macroactividad_codigo, contrato_codigo, aliado_ejecutor; estado muestra `estado_v2` del workflow F29.

## v2.0.6 · 2026-04
- `docs/DEPLOY-FUNCTIONS.md` — guía completa de despliegue F32 (firebase login, secret RESEND_API_KEY, npm install + deploy, costos <2 USD/mes, rollback).
- `admin/index.html` añade asistente "PUESTA EN MARCHA v2" con 7 pasos enlazados al final del panel.
- Labels de notificaciones alineados: "cron F32 · Cloud Functions + Resend" (antes "preparación F12").

## v2.0.5 · 2026-04
- KPIs saludV2 visibles en `pages/kpis.html` y `admin/kpis.html` (HI promedio · vida remanente · régimen especial · distribución por bucket con chart §A9.7).
- `kpis-render.js` añade `renderSaludV2()` y registro de canvas `chBucket`.

## v2.0.4 · 2026-04
- `pages/inventario.html` vista pública con columnas Tipo / Zona / HI · Bucket.
- `firestore.rules` valida `estado_v2` en create/update de órdenes (11 valores del workflow F29).
- 3 nuevos índices: `ordenes(estado_v2+codigo)`, `ordenes(contratoId+codigo)`, `ordenes(macroactividadId+codigo)`.
- 3 tests nuevos del handler puro `onMuestraCreate`.

## v2.0.3 · 2026-04
- `admin/inventario.html` + `admin-inventario.js` upgrade v2: tabla con 9 columnas incluye HI/bucket/vida remanente; modal con sección "Identificación v2" (tipo_activo / UUCC / grupo / zona).
- `admin/ordenes.html` + `admin-ordenes.js` upgrade v2: selects de macroactividad, contrato, causantes multi, aliado ejecutor, estado_v2 (11 estados).
- `data/transformadores.js` wired con `auditar()` en crear/actualizar/eliminar con diff de campos clave.
- `functions/package.json` + `functions/index.js` refactor para ser deployable real (firebase-admin v12, firebase-functions v5, resend v3, secret RESEND_API_KEY).
- `tests/integracion_e2e.test.js` — 3 escenarios E2E del dominio (TX crítico → propuesta · FUR aprobado → bloqueo · TX joven sano).

## v2.0.2 · 2026-04
- `admin/fallados.html` — UI RCA post-mortem (5 Porqués · Ishikawa 6M · FMEA con RPN dinámico).
- `admin/auditoria.html` + `data/auditoria.js` — visor de bitácora F35.
- Wiring de `auditar()` en `data/usuarios.js` y `data/monitoreo_fur.js`.
- RBAC F28: `data/usuarios.js` acepta los 6 roles oficiales + `permisos_extra[]`, `zonas[]`, `contratos[]`.
- `admin/contramuestras.html` — UI de seguimiento reforzado (muestras tomadas / pendientes / vencidas).

## v2.0.1 · 2026-04
- `admin/propuestas-fur.html` — cola de juicio experto §A9.2 con 3 decisiones (aprobar reemplazo / aprobar OTC / rechazar).
- `admin/plan-inversion.html` — ranking PI con scoring multicriterio + export XLSX.
- `admin/desempeno-aliados.html` — score 0–100 por aliado con desviación de costo, reincidencias, tiempo medio.
- README.md reflejando cierre v2.0.0.

## v2.0.0 · 2026-04 · **Cierre del plan MO.00418**

22 microfases F16→F37 derivadas del prompt maestro v2.2.

- **F16** · Schema v2 con secciones (identificacion, ubicacion, placa, electrico, mecanico, refrigeracion, protecciones, fabricacion, servicio) + `salud_actual` + `estados_especiales[]`. Sanitizador puro + proyección v1 retrocompat. Rules v2 con helpers + 3 subcolecciones append-only.
- **F17** · Importador Excel → Firestore con recálculo HI oficial (descarta columna CONDICION del Excel por §D1-D17). Log en `/importaciones` con reporte de discrepancias.
- **F18** · Motor de Salud (7 calificadores + HI ponderado Tabla 10 + overrides §A5/§A9 + Duval/Rogers/Doernenburg + IEEE C57.91 + monitoreo intensivo C₂H₂ + juicio experto FUR).
- **F19** · Muestras DGA/ADFQ/FUR time-series con contexto §A9.6 obligatorio.
- **F20** · Subestaciones UI dedicada.
- **F21** · 8 contratos macro con control presupuestario (vigente/suspendido/finalizado/en_liquidacion).
- **F22** · Catálogos §A7 (31 subactividades · 7 macroactividades · 12 causantes).
- **F23** · Refactor Órdenes v2 con FKs catálogo + workflow de 11 estados.
- **F24** · TPT/Respaldo (IEEE C57.91 + selección óptima por zona/HI).
- **F25** · Fallados + RCA (5 Porqués · Ishikawa · FMEA con RPN).
- **F26** · Contramuestras + Monitoreo Intensivo + Propuestas FUR (A9.1 + A9.2).
- **F27** · Dashboard ejecutivo por rol con 6 KPIs + matriz 5×5 + Top-10 PI.
- **F28** · RBAC granular (6 roles + ámbito geográfico zonas[]).
- **F29** · Workflow aprobaciones + estados especiales de activo (OTC §A9.3).
- **F30** · Plan de Inversión con scoring multicriterio (HI 40% + criticidad 25% + vida 15% + costo_inv 10% + fallas 10%).
- **F31** · Reportes PDF/XLSX (ficha técnica · cierre orden · reporte mensual RAM).
- **F32** · Cloud Functions stubs (onMuestraCreate + cronAlertasDiarias).
- **F33** · Desempeño aliados con score 0-100.
- **F34** · PWA + service worker + manifest.
- **F35** · Audit log global.
- **F36** · Matriz Criticidad × Salud (Tabla 11 con §A9.9).
- **F37** · Motor de Estrategias por Condición (catálogo §A7).

- **Tests:** 234 unitarios al cierre del plan (escalan a 275 con pulido).
- **Stack operativo:** 14 UIs admin + 4 páginas públicas + 6 módulos de dominio puro + 9 data layers + rules + índices.
- **Fuente canónica:** MO.00418.DE-GAC-AX.01 Ed. 02 (Tabla 10 fuente única de pesos HI).

## v1.0.0 · 2026-04
Plataforma base F0-F15 (pre-evolución MO.00418). Ver `CLAUDE.md` §5 para detalle.
