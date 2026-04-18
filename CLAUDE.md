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
| 1 | Estructura base CSS/JS y refactor del landing             |  5%  |  10%      | ⏳ pendiente |
| 2 | Home real + páginas estáticas internas                    | 10%  |  20%      | ⏳ pendiente |
| 3 | Preparación de hosting (Vercel / GitHub Pages + CI)       |  5%  |  25%      | ⏳ pendiente |
| 4 | Integración de Firebase (Auth, Firestore, Storage)        |  5%  |  30%      | ⏳ pendiente |
| 5 | Autenticación admin real (login con Firebase Auth)        |  5%  |  35%      | ⏳ pendiente |
| 6 | Módulo: Inventario de activos (CRUD)                      | 10%  |  45%      | ⏳ pendiente |
| 7 | Módulo: Órdenes de trabajo                                | 10%  |  55%      | ⏳ pendiente |
| 8 | Módulo: KPIs y analítica                                  | 10%  |  65%      | ⏳ pendiente |
| 9 | Módulo: Gestión documental (+ Storage)                    |  8%  |  73%      | ⏳ pendiente |
| 10 | Módulo: Georreferenciación (Leaflet)                     |  7%  |  80%      | ⏳ pendiente |
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

#### ⏳ Fase 2 — Home real + páginas estáticas

- `home.html` con navegación real, hero, resumen de módulos y KPIs (aún placeholder).
- Subpáginas: `/pages/about.html`, `/pages/cobertura.html`, `/pages/normativa.html`, `/pages/contacto.html`.
- Todas protegidas por `auth-guard.js`.
- Contenido 100% estático.

#### ⏳ Fase 3 — Hosting y CI

- `package.json` base.
- `vercel.json` con configuración de rewrites.
- Workflow de GitHub Actions para lint + deploy preview.
- Dominio GitHub Pages y/o Vercel funcionando.

#### ⏳ Fase 4 — Firebase

- Proyecto Firebase creado.
- `firebase.json`, `.firebaserc`, reglas de Firestore y Storage en modo cerrado (`allow read, write: if false`).
- `assets/js/firebase-init.js` con SDK modular.
- Pruebas de conexión.

#### ⏳ Fase 5 — Autenticación admin

- Ruta `/admin/login.html`.
- Login con Firebase Auth (email + password).
- Protección adicional con `admin-guard.js`.
- Panel admin vacío pero accesible solo a un UID definido en variables.

#### ⏳ Fase 6 — Módulo Inventario

- Colección `transformadores` en Firestore.
- CRUD admin (crear, editar, eliminar, listar).
- Vista pública de solo lectura para usuarios con código.

#### ⏳ Fase 7 — Módulo Órdenes de trabajo

- Colección `ordenes` relacionada con `transformadores`.
- Estados: planificada → en curso → cerrada → cancelada.
- Historial inmutable.

#### ⏳ Fase 8 — KPIs y analítica

- Indicadores RAM (MTBF, MTTR, disponibilidad).
- Gráficas con Chart.js (gratuito).
- Consultas agregadas sobre `ordenes`.

#### ⏳ Fase 9 — Gestión documental

- Firebase Storage para archivos técnicos.
- Índice en Firestore con metadatos (ISO, norma aplicable, fecha, autor).

#### ⏳ Fase 10 — Georreferenciación

- Mapa Leaflet con clusters.
- Capas por departamento/municipio.
- Click en marcador → ficha del transformador.

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
| Fase en curso              | **Fase 0 cerrada · a la espera de Fase 1** |
| Porcentaje global           | **5 %** |
| Último commit              | (ver historial Git) |
| Servicios dinámicos activos | ninguno (aún sólo estático) |

---

## 8. Historial de cambios

- **Fase 0** — Creación de `CLAUDE.md`, gate estático con código `97601992@`, `home.html` stub protegido, `gate.js`, `auth-guard.js`, actualización del landing al 5 %.
