# SGM · TRANSPOWER

Sistema de Gestión del Mantenimiento Especializado de Transformadores de Potencia —
Caribe Colombiano (Bolívar, Córdoba, Sucre, Cesar y 11 municipios de Magdalena).

> Proyecto **sin ánimo de lucro**. Stack íntegramente sobre tiers gratuitos
> (GitHub Pages · Vercel Hobby · Firebase Spark · Leaflet / OpenStreetMap).

## Estado

Fase 9 cerrada · progreso global **73 %**. Ver [`CLAUDE.md`](./CLAUDE.md) para el plan completo.

## Stack

- Frontend estático: HTML5 + CSS3 + JavaScript ES6+ (vanilla).
- Hosting estático: **GitHub Pages** (Actions workflow `pages.yml`).
- Hosting dinámico (futuro): **Vercel Hobby** (serverless Node.js).
- Backend (futuro): **Firebase** (Auth · Firestore · Storage).
- Mapas (futuro): **Leaflet + OpenStreetMap**.

## Desarrollo local

```bash
npm install        # instala html-validate
npm run lint       # valida HTML
npm run serve      # sirve el sitio en http://localhost:8080
```

## CI/CD

- `.github/workflows/ci.yml` — lint HTML en push / PR.
- `.github/workflows/pages.yml` — deploy automático a GitHub Pages desde `main`.
- `vercel.json` — configuración de headers, cleanUrls y redirects para Vercel.

## Firebase (Fase 4)

Archivos en el repo:

- `firebase.json` — hosting, paths de reglas y puertos de emuladores.
- `.firebaserc` — proyecto por defecto.
- `firestore.rules` / `storage.rules` — en modo **DENY-ALL**.
- `firestore.indexes.json` — vacío (se llenará en F6+).
- `assets/js/firebase-config.js` — config pública (placeholders).
- `assets/js/firebase-init.js` — bootstrap del SDK modular v10.
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

## Acceso

Durante la fase de construcción el sitio queda tras un **gate estático**
(código `97601992@`, ver `assets/js/gate.js`). Se reemplazará por un gate
dinámico en la Fase 12.

### Panel administrativo (Fase 5)

- Ruta: `/admin/login.html` (link discreto en el footer de `home.html`).
- Autenticación: **Firebase Auth · Email/Password** + allowlist de UIDs.
- Sesión: se cierra al salir del navegador (`browserSessionPersistence`).
- Para habilitar:
  1. Crear usuario en Firebase Console → Authentication → Users.
  2. Copiar el UID al array `ADMIN_UIDS` en
     `assets/js/admin/admin-config.js`.
  3. Ingresar desde `/admin/login.html`.

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
