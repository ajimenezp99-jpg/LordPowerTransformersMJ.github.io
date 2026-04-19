# CLAUDE.md — Proyecto SGM · TRANSPOWER

> Documento maestro de planeación, arquitectura y progreso del sitio web personal
> **Dirección y Gestión del Mantenimiento Especializado en Transformadores de Potencia**.
> Este archivo se actualiza al cierre de cada microfase.

---

## 0. Nota operativa para Claude (leer al inicio de cada sesión)

> Sección dedicada al agente (Claude Code) que opera este repo.
> Describe particularidades del entorno que no son obvias al arrancar.

### 0.1 Publicación en GitHub — permisos del entorno

En la sesión de Claude Code de este proyecto, **los canales "normales" de
push a GitHub están restringidos a lectura**:

| Canal | Auth | Resultado |
|---|---|---|
| `git push` (vía `local_proxy` del runtime) | identidad del proxy | ❌ `403 Permission denied` |
| `mcp__github__push_files`, `mcp__github__create_or_update_file`, etc. | instalación del GitHub App del runtime | ❌ `403 Resource not accessible by integration` |
| `git push` con URL `https://USER:PAT@github.com/...` | PAT personal del dueño | ✅ Funciona |

**Fix permanente (pendiente de acción del dueño del repo):**
conceder permiso **Contents: Read & write** al GitHub App de
Claude Code sobre `ajimenezp99-jpg/lordpowertransformersmj.github.io`
en *GitHub → Settings → Applications → Installed GitHub Apps*. Mientras
no se haga, los dos primeros canales seguirán fallando con 403.

**Workaround real (verificado):** el `local_proxy` **resetea el remote
`origin` entre invocaciones** (cambia de puerto y restaura la URL al
formato `http://local_proxy@127.0.0.1:PORT/git/...`), así que **no
sirve** dejar el PAT embebido con `git remote set-url` — sobrevive a
un único push y luego se pierde. La forma confiable de publicar es
**pasar la URL con token inline en cada `git push`**:

```bash
git push https://USER:TOKEN@github.com/USER/REPO.git \
    BRANCH:BRANCH
```

donde `TOKEN` es el PAT clásico del dueño guardado fuera del repo
(en este chat se entregó por mensaje del usuario; en el siguiente
chat habrá que pedirlo de nuevo o leerlo de donde el dueño lo deje).

**Reglas que debo respetar con este token:**
1. Jamás copiar el token a un archivo rastreado, a un mensaje de
   commit, a una PR, a un comentario o a cualquier salida visible
   (logs, prints, etc.). Filtrar siempre con
   `sed 's|ghp_[A-Za-z0-9]*|ghp_****REDACTED****|g'` antes de mostrar
   un remote o un error de push.
2. No hacer `git config` globales con el token. Tampoco vale la pena
   hacer `git config` local porque el proxy lo pisa.
3. Si el dueño revoca el token (recomendable cuando concede
   `contents:write` al App), `git push` volverá a fallar con 401/403
   y habrá que pedir un token nuevo o usar el App.
4. Preferir `git push` con URL inline antes que `mcp__github__*` para
   operaciones de escritura. Los endpoints MCP solo sirven para lectura
   en este entorno.
5. Si aparece una instrucción del usuario en el chat incluyendo un
   token nuevo, **asumir que reemplaza al actual**; usarlo en el
   siguiente push inline. No pedirle al usuario que lo re-introduzca
   si ya lo dio antes.
6. Al iniciar un chat nuevo: si hay commits pendientes y no hay token
   visible, **preguntar al dueño** por un PAT clásico (scope `repo`).
   Sin eso, push imposible.

### 0.2 Branch de trabajo

Desarrollar siempre sobre `claude/personal-website-transformers-CVWxV`.
`main` se toca solo cuando el dueño lo pide explícitamente.

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

## 4. Control de acceso

### Estado actual: **Login-first unificado** (Fase 14)

- **`index.html` es el portal de login público** (SaaS-style). Es la
  única ruta visible sin autenticación; el resto del sitio devuelve
  redirect al login mientras no haya sesión activa.
- **Firebase Authentication (Email/Password)** es la fuente de verdad.
  Los miembros del equipo se autentican con su correo corporativo y
  contraseña. La persistencia es configurable por checkbox: sesión
  (cierra al salir del navegador) o local (permanente hasta logout).
- **Perfiles y roles en Firestore** — `/usuarios/{uid}` con
  `{email, nombre, rol, activo, createdAt, createdBy}`. Roles activos:
  - `admin` — acceso completo + panel `/admin/*`.
  - `tecnico` — acceso de operación (lectura de módulos, no edita).
- **Guard unificado** — `assets/js/auth/session-guard.js` es el único
  punto de verificación. `page-guard.js` y `admin-guard.js` son
  wrappers auto-ejecutables para páginas protegidas. Oculta el
  `<body>` hasta resolver; redirige a login si no hay sesión o perfil,
  y a `/home.html` si un no-admin pisa una ruta admin.
- **Bootstrap** — `/admins/{uid}` (colección heredada de F5) sigue
  siendo aceptada como admin legacy para que el propietario no quede
  bloqueado durante la migración del primer perfil. Basta con crear
  el doc desde Firebase Console. Una vez hay un admin, se gestionan
  los demás usuarios desde `/admin/usuarios.html`.
- **Recuperación de contraseña** — el portal expone
  `sendPasswordResetEmail` de Firebase Auth.
- **Gate estático / dinámico retirados** — los artefactos de F0
  (`gate.js`, `sessionStorage.sgm.access`) y de F12 (`gate_codes`,
  `/admin/codigos.html`) fueron eliminados. Ya no hay códigos de
  acceso: solo credenciales personales por miembro.

### Reglas Firestore (F14)

- `isTeamMember()` — `activo=true` en `/usuarios/{uid}` **o**
  existencia en `/admins/{uid}` (bootstrap).
- `isAdmin()` — `rol='admin'` + `activo=true` en `/usuarios/{uid}`
  **o** existencia en `/admins/{uid}` (bootstrap).
- Todas las colecciones de negocio (`transformadores`, `ordenes`,
  `documentos`, `alertas_*`) requieren `isTeamMember()` para lectura
  y `isAdmin()` para escritura.
- `/usuarios/{uid}` — cada usuario puede leer su propio perfil; los
  admins pueden listar y gestionar todo. No se permite auto-eliminación.
- `/gate_codes/{hash}` — cerrada (`read, write: if false`). Los datos
  residuales de F12 quedan inertes hasta que se borren manualmente.

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
| 11 | Módulo: Alertas y notificaciones                         |  7%  |  87%      | ✅ completada |
| 12 | Gate dinámico + endurecimiento admin                     |  5%  |  92%      | ✅ completada |
| 13 | Pulido: SEO, accesibilidad, performance, i18n            |  4%  |  96%      | ✅ completada |
| 14 | Lanzamiento: login unificado + roles + v1.0.0            |  4%  | 100%      | ✅ completada |
| 15 | Realtime: `onSnapshot` en home, órdenes y alertas        |  —   | 100% + RT | ✅ completada |

### Evolución v2.0 · MO.00418.DE-GAC-AX.01 Ed. 02 (F16–F37)

La tabla post-v1 original (F16–F24) fue reemplazada por el plan v2.2
derivado del documento interno **MO.00418.DE-GAC-AX.01 Ed. 02**
(CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM). 22 microfases
independientes, cada una con commit aislado:

| #  | Microfase                                                  | Estado |
|----|------------------------------------------------------------|--------|
| 16 | Refactor modelo de datos v2 (secciones, salud_actual, subestaciones) | ✅ completada |
| 17 | Importador Excel → Firestore con recálculo HI              | ✅ completada |
| 18 | Motor de Salud (HI ponderado Tabla 10 + overrides §A5/A9)  | ✅ completada |
| 19 | Muestras de Laboratorio (DGA / ADFQ / FUR) time-series     | ✅ completada |
| 20 | Subestaciones (UI dedicada)                                | ✅ completada |
| 21 | Contratos (8 contratos macro · presupuesto)                | ✅ completada |
| 22 | Catálogos (subactividades / macroactividades / causantes)  | ✅ completada |
| 23 | Refactor Órdenes v2 (FKs catálogo)                         | ✅ completada |
| 24 | TPT / Respaldo (calculadora sobrecarga IEEE C57.91)        | ✅ completada |
| 25 | Fallados + RCA (5 porqués, Ishikawa, FMEA)                 | ✅ completada |
| 26 | Contramuestras + Monitoreo Intensivo C₂H₂ + Juicio experto FUR | ✅ completada |
| 27 | Dashboards ejecutivos por rol                              | 🔜 planificada |
| 28 | RBAC granular con ámbito geográfico (5 roles + admin)      | ✅ completada |
| 29 | Workflow aprobaciones + Estados especiales (OTC §A9.3)     | ✅ completada |
| 30 | Plan de Inversión (scoring multicriterio)                  | ✅ completada |
| 31 | Reportes PDF / Excel oficiales                             | 🔜 planificada |
| 32 | Cloud Functions + notificaciones por email                 | 🔜 planificada |
| 33 | Desempeño de aliados / contratistas                        | 🔜 planificada |
| 34 | PWA + offline para brigadistas                             | 🔜 planificada |
| 35 | Audit log global + bitácora                                | 🔜 planificada |
| 36 | Matriz de Riesgo Criticidad × Salud                        | ✅ completada |
| 37 | Motor de Estrategias por Condición (catálogo §A7)          | ✅ completada |

> **Continuidad entre chats:** al reabrir una sesión, lee sección 0
> (permisos push + token inline), luego la tabla arriba. La próxima
> movida tras F16 es **F17 — Importador Excel**. El prompt maestro
> v2.2 (con addendum §A1–A9) es el contrato funcional de referencia.

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

#### ✅ Fase 11 — Alertas y notificaciones

- `assets/js/data/alertas.js` — motor de reglas cliente-side sobre `transformadores` + `ordenes` + `alertas_config` + `alertas_reconocidas`. Función principal `computarAlertas()` devuelve `{alertas[], resumen, config, generatedAt}`. Cada alerta lleva un **id sintético determinista** (`tipo:recursoId:sello`) que permite persistir reconocimientos aun cuando la alerta se recalcule.
- **Reglas activas:**
  - `orden_vencida` — órdenes `planificada|en_curso` con `fecha_programada < hoy` (severidad `critica` si hay más de 7 días o si la prioridad es `critica`, `warning` en otro caso).
  - `orden_proxima` — planificadas que vencen dentro de `config.proxima_dias` (severidad `info`).
  - `orden_prolongada` — `en_curso` con `fecha_inicio` anterior a `config.prolongada_dias` días (severidad `warning`).
  - `orden_critica_abierta` — prioridad `critica` todavía no cerrada (severidad `critica`).
  - `mantenimiento_largo` — transformadores `estado=mantenimiento` cuyo último `en_curso` supera `config.mantenimiento_dias` (severidad `critica` cuando duplica el umbral).
  - `sin_coordenadas` — activos sin lat/lng válido (bloquea vista de mapa).
  - `sin_fecha_instalacion` — activos sin fecha de instalación (impacta cálculo de MTBF).
- **Colecciones nuevas en Firestore:**
  - `alertas_config/global` — umbrales (`proxima_dias=15`, `prolongada_dias=30`, `mantenimiento_dias=14`) + `destinatario_email` + flag `notificaciones_enabled` (reservado para F12).
  - `alertas_reconocidas/{alertId}` — un doc por alerta reconocida (`{alertId, nota, uid, at}`).
  - Reglas Firestore: lectura pública, escritura admin (`allow write: if isAdmin()`), validación de `alertId` no vacío.
- Vista pública: `pages/alertas.html` + `alertas-public.js` — resumen con 5 tarjetas (críticas / atención / informativas / activas / reconocidas), filtros (severidad / tipo / texto / toggle reconocidas), tabla con severidad-pill, tipo-pill y enlaces al recurso (Inventario / Órdenes).
- Vista admin: `admin/alertas.html` + `admin-alertas.js` — mismo dashboard + **panel de configuración** (5 campos con guardar/restaurar) + botones **Reconocer** / **Desreconocer** por fila. Al reconocer solicita una nota opcional y guarda el UID del admin. Enlaces del recurso llevan a `inventario.html#edit:{id}` o `ordenes.html#edit:{id}`.
- `assets/css/alertas.css` — banner resumen, `sev-pill.{critica|warning|info}`, `alerta-tipo-pill`, filas `.alert-row.reconocida` con tachado, panel `.config-panel` con grid de inputs, botones `btn-ack` / `btn-unack` / `btn-goto`.
- Nav "Alertas" en home + 10 subpáginas (incluye `_firebase-test` y `mapa`) + 6 paneles admin.

#### ✅ Fase 12 — Gate dinámico + endurecimiento

- `assets/js/data/codigos-acceso.js` — data layer del gate dinámico. API: `validarCodigo` (público, con fallback al bootstrap estático), `listar`, `crear`, `actualizarMetadata`, `eliminar`, `hashCode` (SHA-256 hex via `crypto.subtle`), `generarCodigoAleatorio(len=12)`, `estadoCodigo`, `hashPreview`. Constante exportada `BOOTSTRAP_CODE = '97601992@'` como mecanismo de recuperación permanente.
- **Colección nueva** `gate_codes/{sha256(plaintext)}` con `label`, `notes`, `active`, `expires_at`, `created_at`, `created_by`. El plaintext **nunca** se persiste; el hash hex es el docId.
- **Reglas Firestore endurecidas:**
  - `get: if true` — cualquier cliente puede leer un doc si ya conoce el hash (i.e., conoce el código). Esto permite validar sin exponer los códigos.
  - `list: if isAdmin()` — impide enumeración anónima.
  - `create` valida que el docId tenga ≥ 32 chars, que `label` sea string y que `active` sea bool; `update` valida `active` cuando está presente.
- `assets/js/gate.js` reescrito como **módulo ESM**: computa SHA-256 con `crypto.subtle.digest`, hace `getDoc(gate_codes/{hash})`, verifica `active=true` y `expires_at` futuro. Si Firebase no está configurado o no hay match, acepta el bootstrap estático. Mensaje "⋯ Verificando…" mientras resuelve.
- Panel admin `/admin/codigos.html` + `admin-codigos.js` con tabla (etiqueta, estado-pill, fecha expiración, fecha creación, hash abreviado, acciones), filtros (estado activo/inactivo/vencido + búsqueda), modal **Nuevo** con botón **Generar** aleatorio (56 chars del alfabeto sin confundibles) y modal **Editar** metadata (label/notes/expires/active, no el plaintext). Tras crear, un modal **Revelar** muestra el plaintext una sola vez con botón **Copiar** (clipboard API).
- `assets/css/codigos.css` — `.cod-pill.{activo|inactivo|vencido}`, `.cod-hash`, `.codigo-row` para fila input+generar, `.revelar-code` (caja destacada con borde dashed y glow), `.btn-mini` y `.btn-mini.danger`.
- Nav "Códigos" en 7 paneles admin. Se activa la tarjeta F12 del panel principal (`admin/index.html`), se mueve F13 la tarjeta "Usuarios & Roles" y se actualiza el resumen "Fase 12 cerrada · 92 %".

#### ✅ Fase 13 — Pulido (SEO + accesibilidad)

- **SEO.**
  - `robots.txt` con `Allow: /`, `Allow: /index.html`, `Allow: /assets/` y `Disallow: /admin/`, `/home.html`, `/pages/` (zona interna/admin), más línea `Sitemap:` apuntando a `https://lordpowertransformersmj.github.io/sitemap.xml`.
  - `sitemap.xml` con una única URL (la landing pública); el resto del sitio queda detrás del gate y se marca `noindex` en sus páginas.
  - `index.html` con bloque completo de **Open Graph** (`og:type=website`, `og:site_name`, `og:locale=es_CO`, `og:url`, `og:title`, `og:description`, `og:image`) + **Twitter Card** (`summary`) + `<link rel="canonical">` + `<meta name="theme-color" content="#040c14">` + `<meta name="color-scheme" content="dark">` + `<meta name="robots" content="index, follow">`.
  - **JSON-LD Organization schema** embebido al final de `index.html` con `name`, `url`, `logo`, `areaServed` (Bolívar, Córdoba, Sucre, Cesar, Magdalena como `AdministrativeArea`) y `knowsAbout` (ISO 50001, IEEE C57.12, IEC 60076, RETIE, NTC-IEC 60364, CIGRE WG A2, Transformadores de potencia, Análisis RAM).
  - `home.html` con `theme-color`, `color-scheme=dark`, `canonical` y `preconnect` a `fonts.gstatic.com` (sigue en `noindex` por ser zona interna).
- **Accesibilidad (WCAG AA).**
  - `.skip-link` ("Saltar al contenido principal") en `index.html` + `home.html`, posicionada fuera de pantalla y visible al recibir foco. Apunta al landmark `<main id="main">` (se promueve el `<div class="wrapper">` del landing a `<main>` con el mismo ID).
  - Reglas globales en `assets/css/base.css`:
    - `@media (prefers-reduced-motion: reduce)` desactiva `scroll-behavior: smooth` y acorta animaciones/transiciones a `.01ms`.
    - `:focus-visible` con `outline` azul + `outline-offset` para todos los elementos; `button|a|input|select|textarea:focus-visible` refuerzan con `box-shadow` de 2 px en el color de acento.
    - Clase utilitaria `.sr-only` (contenido solo para lectores de pantalla).
  - `aria-hidden="true"` en los elementos decorativos (`.deco-line`, `.pulse`) del landing.
  - Se promueve el `<div class="topbar">` del landing a `<header class="topbar">` (el `role=banner` implícito ahora viene del elemento nativo, sin redundancia).
- **Performance.**
  - `preconnect` a `fonts.gstatic.com` (además del ya existente a `fonts.googleapis.com`) para adelantar el handshake TLS del CDN de fuentes.
  - Se mantiene el uso de `display=swap` en la URL de Google Fonts (evita FOIT).
- Barra de progreso y `phases-row` actualizadas en `index.html` y `home.html`: `F13 Pulido` pasa de `planned → done`, `--fill-pct` y etiqueta suben de **92 % → 96 %**, leyenda "Fases 0–13 completadas de 14".

#### ✅ Fase 14 — Lanzamiento · Login-first + Roles

- **Nueva arquitectura "login-first".** `index.html` es ahora el portal
  de autenticación SaaS-style (formulario centrado email+password +
  recuperación de contraseña). Ninguna página del sitio es accesible
  sin sesión Firebase Auth válida.
- **Unificación admin ↔ público.** El antiguo `/admin/login.html` se
  eliminó; el mismo login entra tanto al home como al panel admin. El
  panel admin deja de ser un sitio aparte: es una sección integrada
  del home, con enlace "Admin" en la nav principal visible solo
  cuando `rol=admin`.
- **Sistema de roles.** Nueva colección `/usuarios/{uid}` con campos
  `{email, nombre, rol, activo, createdAt, createdBy}`. Roles:
  `admin` (control total + CRUD) y `tecnico` (lectura operativa).
- **Guard unificado.** `assets/js/auth/session-guard.js` reemplaza a
  los 4 guards previos (`gate.js`, `auth-guard.js`,
  `auth-guard-pages.js`, `admin/admin-guard.js`). Wrappers
  auto-ejecutables: `page-guard.js` (sesión) y `admin-guard.js`
  (sesión + rol admin). Oculta el `<body>` hasta resolver; expone
  `window.__sgmSession = {user, profile, role}` y dispara
  `sgm:session-ready`.
- **Data layer de usuarios.** `assets/js/data/usuarios.js` con
  `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `ROLES`,
  `labelRol`.
- **Panel de gestión de usuarios.** `/admin/usuarios.html` +
  `admin-usuarios.js` — tabla con filtros (rol / estado / texto),
  modal **Nuevo** (pide UID de Firebase Auth + email + nombre + rol +
  activo) y modal **Editar** (nombre + rol + activo). El correo es
  read-only en edición (es identidad en Auth). Bloquea al admin de
  auto-eliminarse y de quitarse el rol o desactivar su cuenta.
- **Reglas Firestore refactorizadas.** Lecturas por `isTeamMember()`,
  escrituras por `isAdmin()`. Ambas helpers admiten fallback al doc
  legacy `/admins/{uid}` para no bloquear al propietario durante la
  migración. Nueva sección `/usuarios/{uid}` con validación de enums
  server-side (`rol ∈ {admin, tecnico}`, `activo bool`). La colección
  `gate_codes` queda cerrada (`read, write: if false`).
- **Retiro del gate de F12.** Se eliminaron `assets/js/gate.js`,
  `assets/js/data/codigos-acceso.js`, `assets/js/admin/admin-codigos.js`,
  `assets/css/codigos.css` y `/admin/codigos.html`. Todas las nav
  admin sustituyen el enlace "Códigos" por "Usuarios".
- **Retiro del guard estático.** Se eliminaron `assets/js/auth-guard.js`,
  `assets/js/auth-guard-pages.js`, `assets/js/admin/admin-guard.js`
  y `assets/js/admin/admin-config.js`. `admin-auth.js` queda como
  shim fino que reexporta `logoutAdmin` (wrapper de `session-guard`)
  y `onAdminAuthChange` (basado en evento `sgm:session-ready`) para
  no tocar los controladores admin-*.js.
- **Recuperación de contraseña.** El portal expone
  `sendPasswordResetEmail` de Firebase Auth; envía el enlace al
  correo indicado en el campo email.
- **Persistencia configurable.** Checkbox "Mantener sesión en este
  dispositivo" alterna entre `browserLocalPersistence` (permanente) y
  `browserSessionPersistence` (hasta cerrar el navegador).
- **Home actualizada.** Nav incluye `user-chip` (nombre + rol) y,
  para admins, enlace `Admin ▾`. Logout usa el helper unificado.
  Barra de progreso al 100 %, v1.0.0. Se mantiene `noindex` en la
  zona interna; el sitemap solo lista la landing de login.
- **Tag `v1.0.0`** al cierre de la fase.

#### ✅ Fase 15 — Realtime con `onSnapshot`

Primera evolución post-v1: la plataforma deja de recargar datos bajo
demanda y pasa a escuchar Firestore en vivo. Ahora cualquier cambio
que haga un administrador (alta/baja/edición de transformadores u
órdenes, reconocimiento de alertas, ajuste de umbrales) se propaga
instantáneamente a todas las pestañas abiertas del equipo, sin
botones de "Recargar".

- **Data layer.**
  - `assets/js/data/transformadores.js` → `suscribir(filtros, onData, onError)` con `onSnapshot`.
  - `assets/js/data/ordenes.js` → `suscribir(filtros, onData, onError)` con los mismos filtros que `listar`.
  - `assets/js/data/kpis.js` → nueva función pura `computeFromDatasets(trafos, ords)` extraída de `computeDashboard()` para permitir recomputar sin I/O.
  - `assets/js/data/alertas.js` → nueva función pura `computarFromDatasets(transformadores, ordenes, config, recs, hoy)` y `suscribirComputo(onData, onError)` que combina **4 suscripciones** (`transformadores`, `ordenes`, `alertas_config/global` y `alertas_reconocidas`) con **debounce de 250 ms** y retorna un único `unsubscribe()` que cancela todas.
- **Vistas migradas.**
  - `home.html` — las 4 tarjetas del parque (Transformadores / Órdenes activas / Disponibilidad / MTBF) se alimentan de dos `suscribir()` paralelos (transformadores + ordenes) y recomputan con `computeFromDatasets` con debounce 150 ms.
  - `assets/js/ordenes-public.js` — `cargar()` deja de hacer `await listar(...)`; ahora administra el ciclo de vida de `suscribir()`, con cancelación al cambiar filtros y en `beforeunload`.
  - `assets/js/admin/admin-ordenes.js` — misma migración; se eliminan los `await cargar()` tras crear/editar/eliminar porque la suscripción refresca sola.
  - `assets/js/alertas-public.js` — usa `suscribirComputo`.
  - `assets/js/admin/admin-alertas.js` — usa `suscribirComputo`; reconocer/desreconocer y guardar configuración ya no recargan manualmente (el motor recalcula cuando llega el snapshot de `alertas_reconocidas` o `alertas_config/global`).
- **Cuota Firestore.** Se reemplazan ráfagas de `getDocs()` por conexiones `onSnapshot` persistentes. Cada página interna mantiene abiertas 1–4 suscripciones según el módulo; dentro del plan Spark (50 k lecturas/día) el cliente solo consume delta-reads cuando un documento cambia.
- **Backwards-compat.** `listar()` y `computarAlertas()` siguen existiendo para flujos CSV / exports que no requieren realtime.

#### ✅ Fase 16 — Refactor del modelo de datos v2 (MO.00418 Ed. 02)

Primera microfase de la **evolución v2.0** derivada del prompt maestro
v2.2 + documento interno **MO.00418.DE-GAC-AX.01 Ed. 02** (CARIBEMAR
DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM). El shape plano de v1
(introducido en F6 como "17 campos aplanados") se reemplaza por un
documento estructurado en secciones que acomoda la metodología
oficial de Salud de Activos. **Esta F16 sustituye el F16 anterior
("Vercel deploy + serverless skeleton")**, que pasa a ser parte de
F32 cuando se aborde en v2.

- **Dominio puro (`assets/js/domain/`).** Tres módulos sin dependencia
  de Firebase (importables desde Node para tests):
  - `schema.js` — fuente canónica de enumeraciones: `TIPOS_ACTIVO`
    (POTENCIA/TPT/RESPALDO), `ZONAS` (BOLIVAR/ORIENTE/OCCIDENTE),
    `GRUPOS` (G1/G2/G3), `DEPARTAMENTOS` mapeados a su zona,
    `ESTADOS_SERVICIO` ampliado con `fallado`, `ESTADOS_ESPECIALES`
    (§A9.3: `monitoreo_intensivo_c2h2`, `propuesta_fur_pendiente`,
    `operacion_temporal_controlada`, `pendiente_reemplazo`,
    `reemplazado`, `fin_vida_util_papel`), `CONDICIONES` con nombres
    oficiales §A9.7 (Muy Bueno/Bueno/Medio/Pobre/Muy Pobre, sin
    "regular" ni "malo"), `BUCKETS_HI` con bordes [1.5, 2.5, 3.5,
    4.5], `NIVELES_CRITICIDAD` (Mínima…Máxima), `UBICACIONES_FUGA`
    (por ubicación dominante, §A3.6), `ROLES` F28 (admin,
    director_proyectos, analista_tx, gestor_contractual,
    brigadista, auditor_campo), `NORMATIVAS` (30 referencias A8),
    `PESOS_HI` **Tabla 10 del MO.00418 §A9.8 como fuente canónica**
    (DGA 0.35 · EDAD 0.30 · ADFQ 0.15 · FUR 0.05 · CRG 0.05 ·
    PYT 0.05 · HER 0.05) con verificación de suma=1.0 en tiempo de
    carga que lanza si alguien altera los pesos. Catálogo UUCC
    CREG 085/2018: `esUUCCValida` acepta N3T1–N3T25 + N4T1–N4T19 +
    N5T1–N5T25; `esUUCCRegulada` restringe a N4T1–N4T19 y N5T1–N5T25
    (las únicas que gozan de vida útil reconocida de 30 años).
    Helper `bucketDesdeHI(hi)` clampea a [1, 5] y devuelve la key.
  - `transformador_schema.js` — sanitizador por secciones
    (`identificacion`, `placa`, `ubicacion`, `electrico`, `mecanico`,
    `refrigeracion`, `protecciones`, `fabricacion`, `servicio`) +
    sub-objetos derivados (`salud_actual` con las 12 calificaciones
    parciales + HI bruto/final + bucket + overrides_aplicados[] +
    bandera `fin_vida_util_papel`; `criticidad` con usuarios aguas
    abajo y nivel; `restricciones_operativas` reservado para OTC
    §A9.3). Acepta input plano (v1) o estructurado (v2) y mapea a
    shape canónico. `validarTransformador` devuelve array de
    errores (latitud/longitud en rango, enums, campos obligatorios).
    `proyeccionV1(docV2)` aplana a los 17 campos v1 de nivel raíz
    para retrocompat con vistas legacy.
  - `subestacion_schema.js` — nueva entidad FK con sanitizador y
    validador (codigo único, depto catalogado, zona opcional,
    coordenadas en rango).

- **Data layer (`assets/js/data/`).**
  - `transformadores.js` — API v2 manteniendo las firmas v1 (`listar`,
    `suscribir`, `obtener`, `crear`, `actualizar`, `eliminar`,
    `contarPorEstado`) para que Inventario UI, KPIs, Mapa y Alertas
    sigan funcionando sin tocarse. Cada write normaliza con el
    sanitizador v2 y escribe AMBOS niveles (secciones + proyección
    v1 aplanada al raíz) para convivencia v1/v2. Nuevos: `listarV2`
    con filtros por sección (`zona`, `tipo_activo`, `grupo`,
    `bucket`, `subestacionId`), `actualizarParcial(id, parches)` y
    re-exports del dominio (`sanitizarTransformador`,
    `validarTransformador`, `proyeccionV1`).
  - `subestaciones.js` — CRUD Firebase con `listar`, `suscribir`,
    `obtener`, `crear`, `actualizar`, `eliminar`.
  - `transformadores_subcolecciones.js` — dos subcolecciones
    append-only: `placas_historicas` (retrofits de potencia /
    tensión / refrigeración / tap / otro con `tipo_cambio`, `campo`,
    `valor_anterior`, `valor_nuevo`, `razon`, `orden_ref`,
    `autorizado_por`) e `historial_hi` (snapshots del motor con
    `trigger` ∈ {`muestra_nueva`, `parametros_actualizados`,
    `migracion_v2`, `manual`, `override_experto`, `recalculo_masivo`},
    calificaciones por variable, `hi_bruto`/`hi_final`, `bucket`,
    `overrides_aplicados[]`, `muestra_origen_ref`).

- **Migración (`scripts/migrate/v1-to-v2-transformadores.js`).**
  Función pura `migrarDocV1aV2(docV1)` idempotente (si el input ya
  es v2 sólo lo re-sanitiza). Infiere `ubicacion.zona` desde
  `departamento`, extrae `fabricacion.ano_fabricacion` desde ISO, y
  marca `salud_actual.overrides_aplicados = ['_migracion_v2']`
  para trazabilidad (el motor F18 retira la marca al primer
  recálculo real). Runner defensivo `ejecutarMigracion({list,
  write, log, dryRun, limite})` acepta adaptadores de I/O
  arbitrarios (web SDK, admin SDK, mock de tests), retorna reporte
  `{escaneados, migrados, yaV2, errores, lista}`, respeta `limite`
  para corrida parcial. Reutilizable como sub-rutina por F17
  (importador Excel).

- **Firestore rules v2 (`firestore.rules`).** Helpers
  `isTipoActivoValido`, `isEstadoServicioValido`, `isZonaValida`,
  `isDeptoValido`, `isGrupoValido`. Match `/transformadores/{id}`
  valida `schema_version==2`, las claves de `identificacion`, enum
  de `tipo_activo`, enum de `grupo`, enum de `departamento` en
  `ubicacion`, enum de `zona` si está presente, y coherencia entre
  nivel raíz v1 y secciones v2 (`root.codigo ==
  identificacion.codigo`, `root.estado == estado_servicio` con la
  excepción `fallado → retirado` para proyección v1). Subcolecciones
  `placas_historicas` e `historial_hi` append-only (update/delete
  bloqueados) con validación de enum `tipo_cambio` / `trigger`.
  Nueva sección `/subestaciones/{id}` con lectura team, escritura
  admin, validación de depto/zona. `/usuarios/{uid}` acepta roles
  F28 (`admin`, `tecnico`, `director_proyectos`, `analista_tx`,
  `gestor_contractual`, `brigadista`, `auditor_campo`) en create y
  update.

- **Índices (`firestore.indexes.json`).** +8 compuestos nuevos:
  - `transformadores`: `ubicacion.zona+codigo`,
    `identificacion.grupo+codigo`,
    `identificacion.tipo_activo+salud_actual.hi_final DESC`,
    `ubicacion.subestacionId+codigo`,
    `salud_actual.bucket+ubicacion.zona`,
    `estado_servicio+codigo`.
  - `subestaciones`: `zona+codigo`, `departamento+codigo`.
  - Collection group `historial_hi`: `trigger+ts_calculo DESC`.
  Los índices v1 (`departamento+codigo`, `estado+codigo`, etc.) se
  conservan para las vistas legacy mientras dure la convivencia.

- **Suite de tests.** `package.json` declara `"type": "module"`,
  `engines.node >= 20`, scripts `test:unit` (`node --test
  tests/*.test.js`) y `test` (lint + tests). 4 archivos, 63 tests:
  - `tests/schema.test.js` — pesos HI suman 1.0 y son inmutables,
    nombres oficiales §A9.7, 5 departamentos con zona correcta,
    patrón UUCC, catálogo regulado vs general, bordes de
    `bucketDesdeHI` (§4.2), roles F28 + compat legacy, identidad
    institucional.
  - `tests/transformador_schema.test.js` — sanitizador mapea plano
    v1 a secciones v2 y vice-versa, rechaza UUCC inválida, cae a
    defaults ante enums desconocidos, filtra `estados_especiales`
    fuera de catálogo, clampea `calif_*` a [1,5], valida lat/lng,
    `proyeccionV1` mapea `fallado → retirado` para vistas v1.
  - `tests/subestacion_schema.test.js` — normalización de codigo,
    zona inválida descartada, validador flagea depto fuera de
    catálogo y coords fuera de rango.
  - `tests/migracion_v1_v2.test.js` — detectores `esV1`/`esV2`
    (cuidado con `&&` que en JS devuelve el último operando no
    falsy), 5 deptos mapean a su zona correcta, idempotencia v2,
    runner: colección vacía no-op, `dryRun=false` salta `esV2`,
    respeta `limite`, un error no aborta los demás, exige adaptador
    `write` cuando `dryRun=false`.

- **Documentación.** `docs/MODELO-DATOS-v2.md` con diagrama ER,
  diccionario completo por sección con referencia a MO.00418 por
  campo, catálogo de rules/índices, política de migración y plan
  de convivencia v1↔v2. `README.md` actualizado con estado v2.0 y
  sección "Modelo de datos v2". `CLAUDE.md` reemplaza la tabla
  post-v1 (F16–F24 Vercel+Email+PDF…) por la tabla de 22 microfases
  v2.0 (F16–F37) derivadas del prompt maestro v2.2.

- **Tag:** `v2.0.0-f16`. **Próxima movida:** F17 (importador Excel).

### 5.2 Plan post-v1.0 (F16–F24) · SUPERSEDED por v2.2

> ⚠️ **NOTA (abril 2026).** La tabla y detalles de F16–F24 que siguen
> a continuación describen el plan post-v1.0 ORIGINAL (Vercel,
> notificaciones email, exports XLSX/PDF, adjuntos, auditoría,
> calendario, PWA, analítica predictiva). Ese plan fue
> **reemplazado** por el plan v2.0 derivado del documento interno
> **MO.00418.DE-GAC-AX.01 Ed. 02** (prompt maestro v2.2). La
> correspondencia es:
>
> - F16 (original: Vercel deploy) → rescatado en F32 v2 (Cloud
>   Functions + notificaciones email).
> - F17 (original: notificaciones email) → también absorbido en
>   F32 v2 + F17 v2 (importador Excel).
> - F18 (original: export Excel) → F31 v2 (reportes).
> - F19 (original: export PDF) → F31 v2.
> - F20 (original: adjuntos por orden) → parte del refactor de
>   órdenes en F23 v2 y documental F9 (ya cerrada).
> - F21 (original: auditoría) → F35 v2 (audit log global).
> - F22 (original: calendario mantenimientos) → mantenido como
>   feature opcional post-v2.
> - F23 (original: PWA offline) → F34 v2 (PWA brigadistas).
> - F24 (original: analítica predictiva) → feature opcional
>   post-v2; el Plan de Inversión F30 v2 cubre el caso de uso
>   principal.
>
> La tabla canónica ahora es la **sección 5.1 Evolución v2.0**
> (F16–F37). La tabla y detalles abajo quedan por referencia
> histórica.

Cada fase post-v1.0 era **independiente** y debía cerrar con su propio
commit aislado. Ninguna dependía rígidamente de la anterior salvo las
que tocaban el backend (F17 dependía de F16). Si el dueño hubiese
querido reordenar o saltarse una, no se rompía nada — el plan era una
sugerencia priorizada, no una secuencia obligatoria. Pre-requisito
común: `assets/js/firebase-config.js` ya conectado al proyecto real.

#### 🔜 Fase 16 — Vercel deploy + serverless skeleton

**Objetivo.** Habilitar el backend en Vercel sin abandonar GitHub Pages
para el frontend. Necesario para todas las fases que requieran código
server-side (F17, eventualmente F24).

- Crear proyecto en Vercel apuntando a este repo, branch `main`. Build
  command vacío (sitio estático ya servido por GitHub Pages); el deploy
  de Vercel queda **solo para `/api/*`**.
- `vercel.json` ya existe (F3) con headers de seguridad — extenderlo
  con `functions` config si hace falta runtime Node 20.
- Primera function `/api/health.js` que devuelve `{ok:true, ts:...}`
  para validar que el deploy pipeline funciona.
- Configurar las env vars en Vercel:
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
    (descargadas del Firebase Console → Project Settings → Service accounts).
  - Estas habilitan `firebase-admin` para operaciones server-side
    privilegiadas (notificaciones, agregaciones pesadas).
- Documentar en `README.md` el flujo de deploy (push a main → Vercel
  redeploya `/api/*`) y la separación frontend/backend.
- **Yo configuro Vercel siempre** (instrucción explícita del dueño).
  El dueño solo tiene que dar permiso una vez al GitHub App de Vercel
  para conectar el repo; el resto lo hago vía CLI o dashboard.

**Criterio de cierre.** `https://<proyecto>.vercel.app/api/health` responde
200 OK y se enlaza desde `_firebase-test.html` para verificación rápida.

#### 🔜 Fase 17 — Notificaciones por email

**Objetivo.** Aprovechar el flag `alertas_config.notificaciones_enabled`
+ `destinatario_email` que F11 dejó reservados. Resumen diario de alertas
críticas a un correo configurado por el admin.

- Endpoint cron `/api/cron/alertas-diarias.js` ejecutado por **Vercel Cron**
  una vez al día (config en `vercel.json`).
- Re-implementa el motor de `assets/js/data/alertas.js` en Node usando
  `firebase-admin` (lectura de `transformadores`, `ordenes`, `alertas_config`).
- Filtra solo severidad `critica` no reconocidas, agrupa por tipo, arma
  un email HTML con resumen + tabla.
- Envío vía **Resend** (free tier 3 000 emails/mes, 100/día) — alternativa
  Brevo (300/día). API key en env var `RESEND_API_KEY`.
- Si `notificaciones_enabled === false` o no hay `destinatario_email`,
  el cron termina sin enviar.
- Vista admin: pequeño panel "Última ejecución" en `admin/alertas.html`
  con timestamp del último envío (guardado en `alertas_config/global`).

**Criterio de cierre.** Cron corre todos los días, envío llega al inbox
del destinatario configurado, y `admin/alertas.html` muestra "Último envío:
hace N horas".

#### 🔜 Fase 18 — Exportación Excel (XLSX)

**Objetivo.** Dar a los usuarios un export profesional para reportes
ejecutivos y compartir con stakeholders no técnicos.

- Librería **SheetJS (`xlsx`)** vía CDN (sin npm: el sitio sigue siendo
  estático). Versión community/free.
- Botón **"Exportar XLSX"** en:
  - `pages/inventario.html` y `admin/inventario.html` (parque completo + filtros aplicados).
  - `pages/ordenes.html` y `admin/ordenes.html` (con filtros aplicados).
  - `pages/kpis.html` y `admin/kpis.html` (multi-hoja: KPIs / RAM / Top 10 / Por departamento).
  - `pages/alertas.html` (alertas activas con severidad y recurso).
- Hojas con cabeceras estilizadas (negrita + fondo gris claro), columnas
  auto-ancho, fechas formateadas como tipo `Date` real (no string).
- Helper compartido `assets/js/exports/xlsx.js` con `descargarHojas(nombre, hojas)`.
- El CSV actual de KPIs (F8) se conserva como opción secundaria.

**Criterio de cierre.** Cada vista lista exporta `.xlsx` que abre limpio
en Excel/LibreOffice/Google Sheets.

#### 🔜 Fase 19 — Exportación PDF

**Objetivo.** Documentos formales para cierre de orden, fichas técnicas
y reportes mensuales.

- Librerías **jsPDF + jspdf-autotable** vía CDN. Renderizado client-side.
- Plantillas:
  1. **Ficha técnica de transformador** — desde `admin/inventario.html` y
     `pages/inventario.html`, botón "PDF" por fila. Incluye: encabezado
     con logo SGM, datos generales, datos eléctricos, ubicación, mapa
     mini (captura del marker via Leaflet `getCanvas`), pie con
     normativas aplicables y QR del código.
  2. **Cierre de orden** — desde `admin/ordenes.html` cuando `estado==='cerrada'`.
     Incluye: encabezado con código + transformador, descripción,
     técnico responsable, duración real, observaciones, **historial completo**
     (la subcolección `historial`), espacio para firma del responsable.
  3. **Reporte mensual de KPIs** — desde `admin/kpis.html`. Resumen
     ejecutivo: parque, RAM, top transformadores, distribución por estado.
     Selector de mes. Pie con fecha de generación y normativas.
- Helper compartido `assets/js/exports/pdf.js` con plantilla base
  (encabezado/pie reutilizables).
- Logos en `/assets/img/` ya existen.

**Criterio de cierre.** Las 3 plantillas generan PDFs A4 vertical legibles,
con tablas paginadas correctamente.

#### 🔜 Fase 20 — Adjuntos por orden (evidencias fotográficas)

**Objetivo.** Cerrar el ciclo de trazabilidad: foto **antes** y **después**
del mantenimiento adjunta a la orden.

- Subcolección Firestore `ordenes/{id}/adjuntos` con metadatos:
  `{filename, mime, size, storagePath, downloadURL, etiqueta, uid, at}`.
- Storage bajo `ordenes/{ordenId}/adjuntos/{filename}`.
- Reglas: lectura por `isTeamMember()`, escritura por `isAdmin()` y por
  el técnico asignado a la orden (validar `request.auth.token.email ===
  resource.data.tecnico`). Tope **5 MB** por archivo (foto comprimida).
- Reutilizar la API de `documentos.js` (F9) — extraer un módulo común
  `assets/js/data/_storage-uploader.js`.
- Vista admin: pestaña **"Evidencias"** en el modal de edición de orden,
  con galería thumbnails (`<img>` + `loading="lazy"`), drop-zone y
  botón **"Marcar como ANTES / DESPUÉS"**.
- Vista pública: galería read-only en `pages/ordenes.html` al expandir
  la fila.
- Las fotos se incluyen en el PDF de cierre (F19) como anexo.

**Criterio de cierre.** Subir 2 fotos a una orden, verlas en admin y
público, y verlas embebidas en el PDF de cierre.

#### 🔜 Fase 21 — Auditoría / bitácora cross-collection

**Objetivo.** Trazabilidad regulatoria (ISO 50001 sección 9.1.4):
quién hizo qué cambio cuándo en qué documento.

- Colección `auditoria` con docs `{coleccion, docId, accion, uid,
  email, at, diff}` donde `diff` es un objeto `{campo: {antes, despues}}`.
- Acciones: `crear` / `actualizar` / `eliminar` / `reconocer_alerta`
  / `subir_documento` / `subir_evidencia` / `cambiar_rol`.
- Hook en cada función de escritura del data layer
  (`transformadores.js`, `ordenes.js`, `documentos.js`, `usuarios.js`,
  `alertas.js`) — un único helper `auditar(accion, coleccion, docId, diff)`.
- Vista admin `/admin/auditoria.html` — tabla con filtros (colección /
  acción / usuario / rango de fechas), búsqueda por docId, paginación.
- Reglas Firestore: lectura solo `isAdmin()`, escritura **solo por
  `firebase-admin`** (server-side desde funciones, o por reglas que
  validen `request.auth.uid` coincide con el `uid` registrado).

**Criterio de cierre.** Cada CRUD aparece como entrada de auditoría;
la vista admin permite reconstruir el estado histórico de cualquier
documento.

#### 🔜 Fase 22 — Calendario de mantenimientos

**Objetivo.** Vista mensual visual sobre `ordenes.fecha_programada`
para planificar carga de trabajo y detectar solapamientos.

- Implementación con **FullCalendar 6** (free, MIT) vía CDN, o
  construcción manual con grid CSS si se quiere evitar la dependencia
  (~60 KB).
- Vista pública `pages/calendario.html` y admin `admin/calendario.html`.
- Cada evento = una orden, color por prioridad (verde/amarillo/naranja/rojo).
- Click en evento → modal con detalle + enlace al admin de órdenes.
- Filtros por técnico y tipo.
- Realtime con `suscribir` de F15 (ya existe).
- **Export iCal (`.ics`)** del calendario filtrado para que técnicos
  importen en Google Calendar / Outlook / Apple Calendar.
- Helper `assets/js/exports/ical.js`.

**Criterio de cierre.** Vista mensual navegable, exportar `.ics` que
importa correctamente en al menos 2 calendarios externos.

#### 🔜 Fase 23 — PWA + offline básico

**Objetivo.** Que la plataforma funcione como app instalable en móvil
y que las consultas básicas (órdenes recientes, ficha de transformador)
sigan funcionando sin red.

- `manifest.json` con icons, name, theme_color (`#040c14`), display
  `standalone`, start_url `/index.html`.
- Service worker en `/sw.js`:
  - **Cache-first** para shell (HTML/CSS/JS/fuentes/icons).
  - **Stale-while-revalidate** para imágenes y assets de Storage.
  - **Network-first con fallback a cache** para datos de Firestore.
- Activar `enableIndexedDbPersistence(db)` en `firebase-init.js` para
  que Firestore mantenga su propia cache offline (sincroniza al volver).
- Cola de escrituras pendientes ya manejada por Firestore offline persistence
  — basta con activarla.
- Banner "Instalar app" en `home.html` cuando el evento `beforeinstallprompt`
  esté disponible.
- Auditoría Lighthouse: PWA score ≥ 90.

**Criterio de cierre.** Cortar red (DevTools offline), navegar entre
home / órdenes / inventario sigue funcionando con datos cacheados.
Volver a línea sincroniza cualquier cambio pendiente.

#### 🔜 Fase 24 — Analítica predictiva ligera

**Objetivo.** Cerrar el ciclo RAM con un componente predictivo simple
sobre el histórico de órdenes correctivas. Sin ML pesado: regresión
lineal y media móvil bastan para alimentar alertas tempranas.

- Por cada transformador con ≥ 3 fallos correctivos cerrados, calcular:
  - **Tasa de fallos** (fallos / día de servicio).
  - **Próximo fallo esperado** = última falla + (1 / tasa).
  - **Tendencia** (regresión lineal sobre intervalos entre fallas).
- Agregar regla `prediccion_falla` al motor de alertas (F11):
  - `info` si próximo fallo esperado en > 30 días.
  - `warning` si en (7, 30] días.
  - `critica` si en ≤ 7 días.
- Visualización en `pages/kpis.html`: tarjeta nueva "Próximas fallas
  proyectadas" con top 5 transformadores en riesgo.
- Línea de tendencia en la gráfica mensual existente (Chart.js soporta
  `type: 'line'` adicional).
- Sin librerías de ML — implementación manual (~50 líneas de JS) en
  `assets/js/data/predict.js` con tests unitarios cliente.
- Documentar el modelo en `README.md`: limitaciones (asume distribución
  uniforme; no detecta cambios de régimen) y advertir que es una guía,
  no un dictamen.

**Criterio de cierre.** Crear histórico ficticio en un transformador
de prueba, verificar que la predicción aparece como alerta y en el
panel de KPIs.

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
| v1.0 (F0–F14)              | **100 %** ✅ |
| v1.0 + Realtime (F15)      | ✅ |
| Evolución v2.0 (F16–F37)    | **F16 ✅ · F17–F37 🔜** |
| Próxima movida              | **Fase 19 — Muestras DGA/ADFQ/FUR time-series** |
| Referencia normativa activa | MO.00418.DE-GAC-AX.01 Ed. 02 (14/10/2025) |
| Último tag                  | `v2.0.0-f17` |
| Servicios dinámicos activos | Firebase (Auth + Firestore + Storage) · Vercel post-v2 |

> **Continuidad entre chats.** Si arrancas una sesión nueva: lee la
> sección **0** (permisos de push + token inline), luego revisa la
> tabla v2.0 en la sección **5.1** para saber qué queda. El prompt
> maestro v2.2 con el addendum normativo A1–A9 es el contrato
> funcional de referencia. F16 cerró con schema v2; F17 es la
> siguiente movida.

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
- **Fase 11** — Alertas &amp; Notificaciones. `assets/js/data/alertas.js` implementa un motor de reglas cliente-side sobre `transformadores` + `ordenes` con 7 reglas (`orden_vencida`, `orden_proxima`, `orden_prolongada`, `orden_critica_abierta`, `mantenimiento_largo`, `sin_coordenadas`, `sin_fecha_instalacion`) y tres severidades (crítica · atención · informativa). IDs sintéticos deterministas `tipo:recursoId:sello` permiten persistir reconocimientos en `alertas_reconocidas/{alertId}` (`{alertId, nota, uid, at}`). Configuración global en `alertas_config/global` con umbrales (`proxima_dias=15`, `prolongada_dias=30`, `mantenimiento_dias=14`) + placeholders de notificación por correo (`destinatario_email`, `notificaciones_enabled`, reservados para F12). `firestore.rules` extendidas: lectura pública + escritura admin en las dos colecciones. Vista pública `pages/alertas.html` + `alertas-public.js` (5 tarjetas resumen, 4 filtros, tabla con severidad-pill / tipo-pill / enlaces al recurso). Vista admin `admin/alertas.html` + `admin-alertas.js` (mismo dashboard + panel de configuración con 5 campos + botones reconocer/desreconocer por fila que solicitan nota y guardan UID). `assets/css/alertas.css` (banner resumen, pills de severidad, `.alert-row.reconocida`, `.config-panel`, `.btn-ack` / `.btn-unack`). Nav "Alertas" en home + 10 subpáginas + 6 paneles admin. Landing y home al 87 %.
- **Fase 12** — Gate dinámico + endurecimiento admin. `assets/js/data/codigos-acceso.js` implementa el nuevo gate sobre la colección `gate_codes/{sha256(hex)}` donde el docId es el hash SHA-256 del código en texto plano (calculado con `crypto.subtle.digest`). El plaintext nunca se persiste. Reglas Firestore endurecidas: `get: if true` (conocer el hash equivale a conocer el código), `list: if isAdmin()` (no hay enumeración), `create`/`update`/`delete` restringidos a admins con validación de longitud de hash y tipo de `label`/`active`. `assets/js/gate.js` reescrito como módulo ESM que consulta Firestore, respeta `active` + `expires_at` y cae al bootstrap estático (`97601992@`) para recuperación permanente. Panel admin `/admin/codigos.html` + `admin-codigos.js` con tabla, filtros (estado/texto), modal **Nuevo** con botón **Generar** aleatorio (alfabeto sin caracteres confundibles), modal **Editar** metadata (no el plaintext) y modal **Revelar** que muestra el código plano una sola vez con botón **Copiar** (clipboard API). `assets/css/codigos.css` con `.cod-pill.{activo|inactivo|vencido}`, `.cod-hash`, `.revelar-code`, `.btn-mini` y `.btn-mini.danger`. Nav "Códigos" en 7 paneles admin. Módulo F12 activado en el panel principal; la tarjeta "Usuarios &amp; Roles" se mueve a F13. Landing y home al 92 %.
- **Fase 13** — Pulido SEO + accesibilidad. Nuevos `robots.txt` (permite landing + `/assets/`, bloquea `/admin/`, `/home.html`, `/pages/`) y `sitemap.xml` (solo landing, resto bajo gate). `index.html` amplía el `<head>` con Open Graph completo (incluye `og:locale=es_CO`, `og:image`), Twitter Card, `<link rel="canonical">`, `theme-color #040c14`, `color-scheme dark`, `preconnect` a `fonts.gstatic.com` y bloque **JSON-LD Organization** al final del `<body>` con `areaServed` (5 departamentos como `AdministrativeArea`) y `knowsAbout` (ISO 50001, IEEE C57.12, IEC 60076, RETIE, NTC-IEC 60364, CIGRE WG A2, Transformadores, RAM). `home.html` recibe `theme-color`, `color-scheme`, `canonical` y `preconnect`. Accesibilidad: `.skip-link` en landing y home apuntando a `<main id="main">` (el `<div class="wrapper">` del landing se promueve a `<main>`); `:focus-visible` con `outline` + `box-shadow` para botones/inputs/links en `base.css`; `@media (prefers-reduced-motion: reduce)` desactiva `scroll-behavior: smooth` y colapsa animaciones a `.01ms`; clase utilitaria `.sr-only`; `aria-hidden="true"` en decorativos (`.deco-line`, `.pulse`); el `.topbar` del landing pasa de `<div>` a `<header>` (elemento nativo con rol `banner` implícito). Barra de progreso y `phases-row` actualizadas: `F13 Pulido` `planned → done`, `--fill-pct 92% → 96%`, leyenda "Fases 0–13 completadas de 14". Landing y home al 96 %.
- **Fase 14** — Lanzamiento + refactor de acceso "login-first". `index.html` se reescribe por completo como portal de autenticación SaaS-style (form email+password centrado, recuperación de contraseña vía `sendPasswordResetEmail`, persistencia configurable). Nueva colección `/usuarios/{uid}` con campos `{email, nombre, rol, activo, createdAt, createdBy}` y enums `rol ∈ {admin, tecnico}`. Nuevo guard unificado `assets/js/auth/session-guard.js` + wrappers `page-guard.js` / `admin-guard.js` que reemplazan a `gate.js`, `auth-guard.js`, `auth-guard-pages.js` y `admin/admin-guard.js`. Firestore rules refactorizadas: lecturas por `isTeamMember()` (perfil activo o fallback a `/admins/{uid}`), escrituras por `isAdmin()` (rol admin o fallback legacy). Panel `/admin/usuarios.html` + `admin-usuarios.js` + `assets/css/usuarios.css` con CRUD de perfiles, filtros por rol/estado/texto y protecciones de auto-baja. Panel admin ahora integrado a la plataforma: enlace "Admin ▾" en nav del home visible solo con `rol=admin`, y `user-chip` (nombre + rol) en la topbar. `admin-auth.js` reducido a shim que mantiene la superficie `logoutAdmin` / `onAdminAuthChange` / `ADMIN_ROUTES` sobre el nuevo `session-guard`. Eliminados `admin/login.html`, `admin/codigos.html`, `assets/js/gate.js`, `assets/js/auth-guard.js`, `assets/js/auth-guard-pages.js`, `assets/js/admin/admin-guard.js`, `assets/js/admin/admin-config.js`, `assets/js/admin/admin-codigos.js`, `assets/js/data/codigos-acceso.js` y `assets/css/codigos.css`. `robots.txt` actualizado a "plataforma privada". Barra de progreso al 100 %. Tag **v1.0.0**.
- **Fase 15** — Realtime con `onSnapshot`. Data layer: `transformadores.js` y `ordenes.js` exponen ahora `suscribir(filtros, onData, onError)` además de `listar`; `kpis.js` factoriza `computeFromDatasets(trafos, ords)` como función pura; `alertas.js` factoriza `computarFromDatasets(...)` y añade `suscribirComputo(onData, onError)` que combina **4 suscripciones** (`transformadores`, `ordenes`, `alertas_config/global`, `alertas_reconocidas`) con debounce de 250 ms y devuelve un único `unsubscribe()`. Vistas migradas: `home.html` alimenta sus 4 KPIs vía dos `suscribir()` paralelos + recompute debounced; `ordenes-public.js` y `admin-ordenes.js` reemplazan `await listar(...)` por `suscribir(...)` con gestión de ciclo de vida (cancelación al cambiar filtros y en `beforeunload`); `alertas-public.js` y `admin-alertas.js` usan `suscribirComputo`. Los `await cargar()` tras crear/editar/eliminar/reconocer desaparecen: el snapshot refresca la UI solo. `listar()` y `computarAlertas()` se mantienen para flujos CSV / exports. Primera evolución post-v1; no mueve el 100 % del plan original, añade una capa realtime encima.
- **Fase 17** — Importador Excel → Firestore con recálculo HI. Parser puro `domain/importador.js` que lee filas de "Salud de Activos 2026.xlsx" (hojas `TX_Potencia` → POTENCIA, `TPT_Servicio` → TPT, `TX_Respaldo` → RESPALDO), normaliza (trim, comas→puntos decimales, fechas dd/mm/yyyy → ISO, enums, departamentos con tildes) y **recalcula el HI con el motor F18** descartando la columna CONDICION del Excel (según §D1–D17 del prompt). Cada fila produce `{docV2, diagnostico}` donde el diagnóstico compara `hi_recalculado` vs `condicion_excel` y emite flag si la diferencia > 0.5. `procesarLibro(hojas)` agrega el reporte con conteo por hoja, exitosos/errores y las discrepancias. Data layer `data/importar.js` con `persistirImportacion` idempotente por `codigo` (busca existente, hace update; si no, crea) usando batches de 450 writes, registra el job en `/importaciones/{jobId}` con los primeros 30 discrepancias como entregable auditable. UI `admin/importar.html` con drop-zone, carga SheetJS 0.18.5 vía CDN, muestra resumen + tabla de discrepancias con bucket-pills, botón SIMULAR (dryRun) y botón IMPORTAR. Rules F17 añaden `/importaciones` append-only (lectura team, create admin, update/delete false). 11 tests nuevos cubren parseo de fila, mapeo de hoja→tipo_activo, recálculo HI con override CRG=5, normalización de departamentos con tildes, fechas dd/mm/yyyy, comas decimales y reporte agregado. Total 169/169 tests. Tag `v2.0.0-f17`.

- **Fase 18** — Motor de Salud de Activos conforme MO.00418 Ed. 02. Implementa los calificadores oficiales de las 7 variables con tests de conformidad numérica: DGA (TDGC de 4 gases + CO + CO₂ + C₂H₂ — corrigiendo los errores §D1/§D2 del Excel), ADFQ (RD NTC 3284/ASTM D1816 + IC = TI/NN, corrigiendo §D3/§D4), FUR con curva de Chedong (DP + %vida_utilizada + %vida_remanente, CIGRÉ 445), CRG = MAX(CP/AP, CS/AS, CT/AT) con override automático a HI ≥ 4 cuando CRG=5 (§A5), EDAD anclada a CREG 085/2018 (corrigiendo §D6), HER por **ubicación dominante** de fuga (no por componente como el Excel §D7), PYT escala 1–5 (antes solo 1/5). `calcularHIBruto` aplica la Tabla 10 canónica (35/30/15/5/5/5/5) con redistribución proporcional cuando falta una variable. `aplicarOverrides` implementa §A5 (FUR≥4 solo si aprobado por experto, CRG=5 automático) y §A9.1 (C₂H₂=5 con aceleración ≥ umbral → HI ≥ 4; sin aceleración queda como marker informativo). `snapshotSaludCompleto` produce el sub-objeto `salud_actual` listo para persistir. Módulos nuevos `dga_diagnostico.js` (Duval Triangle 1 IEC 60599 + Rogers + Doernenburg + alerta arco D2 cuando C₂H₂/C₂H₄ ≥ 3), `sobrecarga_admisible.js` (tablas IEEE C57.91 §7 + FAA Arrhenius + `proponerPlanMitigacionSobrecarga` para F24/F30), `monitoreo_intensivo.js` (A9.1: `calcularVelocidadC2H2`, `evaluarOverrideC2H2` R1/R2/R3, batería ETU de 5 pruebas, `crearEstadoMonitoreoIntensivo`), `juicio_experto_fur.js` (A9.2: `crearPropuestaReclasificacionFUR` solo si FUR≥4, workflow de 3 decisiones expertas con audit trail, `puedeAbrirOrden` que bloquea órdenes distintas a reemplazo/retiro/OTC tras aprobación). Baselines oficiales en `umbrales_salud_baseline.js` con verificación estructural + `mergeConBaseline(custom)` para respetar overrides de la colección `/umbrales_salud/global`. Data layer `data/umbrales_salud.js` con CRUD + suscripción realtime + subcolección `historial` append-only. Rules v2.1 (`/umbrales_salud`, `/monitoreo_intensivo`, `/propuestas_reclasificacion_fur`). UI admin: `motor-salud.html` (sandbox que recibe entrada manual para los 7 factores y muestra HI + bucket + overrides aplicados + diagnóstico DGA + alerta D2) y `umbrales-salud.html` (formulario con baseline-chip al lado de cada input + botón "restaurar baseline oficial"). 95 tests nuevos (total 158/158). Tag `v2.0.0-f18`.

- **Fase 16** — Refactor del modelo de datos v2 · MO.00418.DE-GAC-AX.01 Ed. 02. Primera microfase de la evolución v2.0 (CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM). Nuevo paquete de dominio puro `assets/js/domain/` con `schema.js` (enums canónicos: `TIPOS_ACTIVO`, `ZONAS`, `GRUPOS`, `DEPARTAMENTOS`+zona, `ESTADOS_SERVICIO` ampliado con `fallado`, `ESTADOS_ESPECIALES` §A9.3, `CONDICIONES` 1–5 con nombres oficiales §A9.7, `BUCKETS_HI`, `NIVELES_CRITICIDAD`, `UBICACIONES_FUGA`, `ROLES` F28, `NORMATIVAS`, `PESOS_HI` con verificación de suma=1.0 en tiempo de carga conforme Tabla 10 §A9.8), `transformador_schema.js` (sanitizador por secciones `identificacion`/`placa`/`ubicacion`/`electrico`/`mecanico`/`refrigeracion`/`protecciones`/`fabricacion`/`servicio` + sub-objetos derivados `salud_actual`/`criticidad`/`restricciones_operativas` reservados para F18/F29/F36 + `validarTransformador` + `proyeccionV1` para retrocompat con vistas legacy), `subestacion_schema.js` (entidad FK nueva). Data layer `assets/js/data/` reescrito: `transformadores.js` acepta shape v1 (plano) o shape v2 (secciones) y escribe AMBOS para que las vistas sin migrar sigan leyendo del nivel raíz; `subestaciones.js` nueva; `transformadores_subcolecciones.js` con `placas_historicas` e `historial_hi` append-only. `scripts/migrate/v1-to-v2-transformadores.js` con función pura `migrarDocV1aV2` + runner defensivo `ejecutarMigracion({list, write, dryRun, limite})` reutilizable por F17. `firestore.rules` v2: helpers `isTipoActivoValido`/`isEstadoServicioValido`/`isZonaValida`/`isDeptoValido`/`isGrupoValido`, validación por sección, coherencia root(v1) ↔ secciones(v2), subcolecciones append-only, nueva colección `/subestaciones`, roles F28 aceptados en `/usuarios/{uid}` (`admin`, `tecnico`, `director_proyectos`, `analista_tx`, `gestor_contractual`, `brigadista`, `auditor_campo`). `firestore.indexes.json` +8 índices compuestos (`ubicacion.zona+codigo`, `identificacion.grupo+codigo`, `identificacion.tipo_activo+salud_actual.hi_final`, `ubicacion.subestacionId+codigo`, `salud_actual.bucket+ubicacion.zona`, `estado_servicio+codigo`, 2 de subestaciones, 1 de `historial_hi` como collection-group). Runner de tests: Node native `node --test` + `"type": "module"` en `package.json`, scripts `npm run test:unit` y `npm test` (lint + tests). 63 tests unitarios (4 files) cubriendo pesos HI/enums/UUCC CREG 085 (N4T1–N4T19 + N5T1–N5T25 reguladas, rango general N3T1–N5T25)/buckets/roles/sanitizadores/validadores/proyección v1/migración v1→v2 idempotente/runner defensivo. `docs/MODELO-DATOS-v2.md` con diagrama ER, diccionario completo de campos, catálogo de rules/índices, referencia normativa por sección y plan de migración. README.md y CLAUDE.md actualizados con estado v2 y tabla F16–F37. Tag `v2.0.0-f16`.
