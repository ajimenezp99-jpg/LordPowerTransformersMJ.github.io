# Plan v2.2 · Integración Suministros + Repuestos (F38–F50)

> **Estado del documento:** P2 publicado · pendientes P3, P4, P5.
> **Aprobación de decisiones bloqueantes:** ✅ recibida (ver §3).
> **No iniciar ejecución hasta que el plan completo (F38–F50) esté escrito y firmado.**

Este plan integra a SGM TRANSPOWER el sistema de control de suministros descrito en
los archivos fuente `control_suministros-2.jsx` y `Gestion_Suministros_Transformadores-2.xlsm`
respetando los principios del skill `asset-tracking-system`:

- Cero datos inventados.
- Confirmación antes de transformar.
- Traceability en hoja `Correcciones`.
- Fidelidad 1:1 con el .xlsm fuente al exportar.
- Cada microfase = un commit aislado, independientemente shippable.

---

## §0 Pre-condiciones

### Estado del repo al iniciar el plan

- `main` con tag `v2.1.0-aqua` mergeado.
- Branch `claude/fix-menu-colors-AJek5` con texto graphite del menú lista para merge.
- 282 tests verdes (81 suites).
- Aqua design system activo: `body class="aqua"`, `aqua-shell.js` auto-injecta sidebar.
- Cache PWA `sgm-v3-1-0`.
- Convenciones existentes documentadas en `docs/ARQUITECTURA.md`.

### Archivos fuente (golden source)

- `/control_suministros-2.jsx` — 933 LOC, 206 trafos hardcoded, 22 ítems de catálogo, lógica React + recharts + lucide.
- `/Gestion_Suministros_Transformadores-2.xlsm` — 8 hojas, 4 tablas estructuradas, 2 gráficas, VBA project (`ConfirmarMovimiento`, `AutoCompletarManual`, `ReiniciarStock`), Office Add-in (`claude.fileId`), formato condicional con emojis 🔴🟡🟢.

**Reglas duras sobre los fuentes:**
1. Son **inmutables** durante el plan. Si el director sube nuevas versiones, se renombran
   con sufijo (`*-v3.jsx`) y se abre sub-plan de reconciliación.
2. Cada fase que lea estos fuentes vuelve a abrirlos desde disco — **prohibido caché en memoria**.
3. Si un valor no está en la fuente, la web muestra `—` o `Por definir`. **Nunca se inventa.**

### Dependencias nuevas a integrar

| Dependencia | Cómo se carga | Para qué |
|---|---|---|
| ExcelJS | CDN unpkg (browser) | Export .xlsm preservando VBA |
| `xlsx` (SheetJS) | ya cargado en `assets/js/exports/xlsx.js` | Parsing del .xlsm fuente en F42 |
| Chart.js | ya cargado | Gráficas (sin recharts) |
| Lucide | ya cargado | Iconos (los 11 del JSX están disponibles) |
| `openpyxl` (fallback) | Cloud Function Python | Si ExcelJS rompe VBA en round-trip |

**Cero dependencias React.** El JSX se reescribe en JS vanilla + módulos ESM, manteniendo
la lógica de estado y los `useMemo` derivados como funciones puras.

### Deploys requeridos durante el plan

Conforme a CLAUDE.md §0.1.1, el director ejecutará:

1. F40 — `firebase deploy --only firestore:rules,firestore:indexes`
2. F49 — si va a fallback Cloud Function: `firebase deploy --only functions:exportarSuministrosXlsm`
3. F50 — sin deploy, solo merge (Pages auto-redeploy desde main).

---

## §1 Visión y arquitectura objetivo

### Modelo conceptual

1. **La web (Firestore) es el sistema operativo en vivo:** entry form, movimientos,
   dashboards, todo en tiempo real con `onSnapshot`.
2. **El Excel exportado es un snapshot fiel** del estado actual, con macros preservadas
   para uso offline por auditores y contratistas que no tienen acceso a la web.
3. **La importación inicial (F42)** siembra Firestore desde el .xlsm fuente. Después
   de F42, todo movimiento operativo ocurre en la web; el .xlsm fuente nunca se
   re-importa salvo migración formal.

### Topología

```
┌──────────────────────────┐
│ JSX/XLSM fuentes         │  golden source · read-only
│ (en raíz del repo)       │
└─────────┬────────────────┘
          │ F42 importador idempotente
          ▼
┌──────────────────────────┐
│ Firestore                │  verdad operativa · multi-cliente realtime
│  /suministros            │
│  /marcas                 │
│  /movimientos            │
│  /correcciones           │
│  /transformadores        │  ← +sub-section repuesto (F41)
│  /auditoria              │  ← entradas bulk_import_suministros
└─────────┬────────────────┘
          │ F49 ExcelJS template-replace
          ▼
┌──────────────────────────┐
│ .xlsm exportado          │  snapshot · VBA + add-in conservados
│ 10 hojas (8+Correcciones+│
│ Portada)                 │
└──────────────────────────┘
```

### Bloques del plan

| Bloque | Microfases | Entrega |
|---|---|---|
| **A — Cimientos** | F38–F41 | Dominio puro, data layer, rules/índices, sub-section `repuesto`. Sin UI visible. |
| **B — Importador** | F42 | Seed inicial idempotente desde el .xlsm fuente. |
| **C — Admin UI** | F43–F46 | CRUD operativo: catálogo, marcas, movimientos, histórico. |
| **D — Public UI** | F47–F48 | Dashboards solo lectura: stock + ranking cruzado. |
| **E — Export & cierre** | F49–F50 | XLSM 1:1, sidebar, PWA cache bump, tag `v2.2.0`. |

### Principios de microcirugía

- **Cada fase = un commit aislado**, con mensaje siguiendo convenciones del repo
  (`feat|fix|docs|chore|refactor|style|test|ci`).
- **Cada fase es reversible** sin afectar las siguientes ya implementadas.
- **Cada fase deja el repo verde** (`npm test` pasa, `lint:html` limpio).
- **Ninguna fase rompe vistas existentes.** El campo `repuesto` en transformador
  se agrega con dual-write (F41) para que `pages/inventario.html` actual siga
  funcionando sin cambios.
- **Confirmación obligatoria antes de cualquier transformación** que altere datos
  fuente — listada por fase en §4.

---

## §2 Modelo de datos Firestore final

### `/suministros/{id}` — 22 docs después de F42

```js
{
  schema_version: 1,
  codigo: "S01",                         // PK humana, viene del .xlsm
  nombre: "Coraza para transformador",
  unidad: "Und",
  stock_inicial: 0,                      // contractual del .xlsm Sheet2!E4:E25
  marcas_disponibles: ["TRENCH","ABB"],  // mirror de tblMarcas Sheet3
  observaciones: "",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "<uid admin>"
}
```

> **Nota:** `Stock_Actual` y `Total_Ingresado/Egresado` NO se persisten — se calculan en cliente
> agregando sobre `/movimientos` con la misma fórmula que el .xlsm
> (`SUMIFS(cantidad, suministro_id, S01, tipo, INGRESO)` etc).

### `/marcas/{id}` — 22 docs

```js
{
  schema_version: 1,
  suministro_id: "S02",
  suministro_nombre: "Motoventiladores",
  marca: "ZIEHL ABEGG",
  createdAt, updatedAt, createdBy
}
```

### `/movimientos/{id}` — dinámico, append + delete con audit

```js
{
  schema_version: 1,
  codigo: "MOV-2026-0001",                // YYYY-NNNN, generado por la API
  anio: 2026,
  tipo: "EGRESO",                         // INGRESO | EGRESO
  suministro_id: "S02",
  suministro_nombre: "Motoventiladores",
  marca: "ZIEHL ABEGG",
  cantidad: 4,
  valor_unitario: 5233200,                // copiado del catálogo al momento del movimiento
  valor_total: 20932800,                  // = cantidad × valor_unitario

  transformador_id: "abc123",             // FK a /transformadores
  matricula: "T1A-A/M-BYC",
  subestacion: "BAYUNCA",
  zona: "BOLIVAR",                        // ORIENTE | BOLIVAR | OCCIDENTE
  departamento: "BOLIVAR",

  odt: "ODT-2026-115",                    // texto libre, opcional
  usuario: "Jose Pérez",                  // texto libre del formulario
  observaciones: "",
  createdAt, updatedAt, createdBy
}
```

> **Por qué se copia el `valor_unitario` y los datos del trafo en cada movimiento:**
> los movimientos quedan inmutables en términos económicos; si después se modifica el
> precio en el catálogo o cambia la zona del trafo, el histórico no se distorsiona.
> Esta es la convención del skill: snapshot al momento de la transacción.

### `/correcciones/{id}` — apéndice de fidelidad

```js
{
  schema_version: 1,
  numero: 1,
  tipo: "matricula" | "tension" | "regulacion" | "stock" | "marca" | "otro",
  ubicacion: "Equipos!B45 (.xlsm)" | "/transformadores/abc123",
  valor_original: "...",
  valor_corregido: "...",
  justificacion: "...",
  fuente: "control_suministros-2.jsx" | "Gestion_Suministros_Transformadores-2.xlsm" | "manual",
  createdAt, createdBy
}
```

### `/transformadores/{id}` — campo nuevo (F41)

```js
{
  ...todo lo existente sin tocar,
  repuesto: {                              // sub-section nueva
    estado: "OPERATIVA" | "OBSOLETA" | "N/A",
    serial_repuesto: null,
    notas: ""
  },
  // proyección plana v1 mantiene compat con vistas legacy:
  re: "OPERATIVA"
}
```

### Índices compuestos nuevos (F40)

| Colección | Campos | Razón |
|---|---|---|
| `suministros` | `codigo ASC` | Listado ordenado por código |
| `marcas` | `suministro_id ASC, marca ASC` | Marcas por suministro |
| `movimientos` | `anio DESC, codigo DESC` | Histórico cronológico |
| `movimientos` | `suministro_id ASC, anio DESC` | Stock por ítem |
| `movimientos` | `transformador_id ASC, anio DESC` | Histórico por trafo |
| `movimientos` | `zona ASC, anio DESC` | Stock por zona |
| `movimientos` | `tipo ASC, anio DESC` | INGRESO vs EGRESO |
| `correcciones` | `tipo ASC, numero ASC` | Listado por categoría |

---

## §3 Decisiones aprobadas

| # | Decisión | Resolución |
|---|---|---|
| 1 | Estructura del Excel exportado | **C** — 10 hojas: las 8 originales + Correcciones + Portada |
| 2 | Reconciliación parque vs JSX | **A** — JSX es única verdad, sobrescribe Firestore vía F42 (sin DELETE; solo CREATE/UPDATE) |
| 3 | Items con stock_inicial=0 | **A** — Mostrar todos con estado "⚪ SIN STOCK" |
| 4 | VBA / macros | **A** — Preservar via template binario (ExcelJS); fallback Cloud Function `openpyxl` si falla |
| 5 | Office Add-in (claude.fileId) | **A** — Preservar metadato `claude.fileId` |
| 6 | RBAC para movimientos | **A** — Solo `admin` puede crear/editar/eliminar; `tecnico` y demás roles solo lectura |
| 7 | Auditoría importación inicial | **A** — Una sola entrada `bulk_import_suministros` con metadata granular (hash del .xlsm, timestamp, count, IDs de docs creados, summary por colección) |

### Implicaciones derivadas

- **(1+5)** El .xlsm exportado lleva 10 hojas: las 8 originales del fuente
  (README, Catalogo_Suministros, Marcas, ListasMarcas hidden, Equipos, Movimientos,
  Entrega, Dashboard) + **Correcciones** y **Portada** que se prependen como hoja 1 y 2
  para que el orden final de tabs sea: Portada → README → Catálogo → Marcas →
  ListasMarcas (hidden) → Equipos → Movimientos → Entrega → Dashboard → Correcciones.
  El VBA preservado opera sobre las 8 originales sin cambios.
- **(2)** F42 NO borra trafos. Solo CREATE (matrícula nueva) y UPDATE (matrícula
  existente). Si el director quiere limpiar trafos huérfanos del Firestore, se
  ejecuta un sub-paso `purgar-trafos-no-en-jsx` con confirmación explícita y dry-run obligatorio.
- **(4)** Plan F49 incluye fork explícito: si el primer test E2E del round-trip
  ExcelJS pierde el VBA o corrompe charts, se cambia inmediatamente a Cloud Function
  Python con `openpyxl` (que sí preserva VBA fielmente). La decisión se toma en F49 con
  evidencia objetiva (golden master diff binario), no por intuición.
- **(6)** `firestore.rules` para `/movimientos`:
  `allow create, update, delete: if isAdmin();`
  `allow read: if isTeamMember();`
  Para `/suministros`, `/marcas`, `/correcciones` mismo patrón.
- **(7)** El audit doc lleva forma:
  ```js
  {
    accion: "bulk_import_suministros",
    fuente_xlsm_sha256: "abc...",
    fuente_jsx_sha256: "def...",
    summary: { suministros: 22, marcas: 22, transformadores_creados: 0, transformadores_actualizados: 206 },
    ids_creados: { suministros: [...], marcas: [...] },
    ids_actualizados: { transformadores: [...] },
    duracion_ms: 1234,
    uid: "<admin>",
    at: Timestamp
  }
  ```

---

## §4 Plan de microfases

### Bloque A · Cimientos (sin UI visible para el director)

#### F38 · Dominio puro · schemas + sanitizers + validadores

**Objetivo.** Definir la forma canónica de los 4 conceptos nuevos (suministro, marca,
movimiento, corrección) como módulos puros sin Firebase, importables desde Node tests
y desde Cloud Functions. Cero I/O.

**Entregables.**
- `assets/js/domain/suministro_schema.js` — `sanitizarSuministro(input)`, `validarSuministro(doc)`.
- `assets/js/domain/marca_schema.js`
- `assets/js/domain/movimiento_schema.js` — incluye helper puro `generarCodigoMov(anio, secuencial)` que devuelve `MOV-2026-0001`.
- `assets/js/domain/correccion_schema.js`
- Extensión a `assets/js/domain/schema.js`:
  - `TIPOS_MOVIMIENTO = ['INGRESO','EGRESO']`
  - `ESTADOS_REPUESTO = ['OPERATIVA','OBSOLETA','N/A']`
  - `TIPOS_CORRECCION = ['matricula','tension','regulacion','stock','marca','otro']`
  - `UNIDADES = ['Und','Lt','Kg','Mt','Gal','Otro']`
  - `ESTADOS_STOCK = ['SIN_STOCK','NEGATIVO','AGOTADO','CRITICO','MEDIO','OK']` (semáforo del skill)
  - Helper `estadoStock(disponible, inicial)` puro que devuelve la key del semáforo.
- Tests: `tests/suministro_schema.test.js`, `tests/marca_schema.test.js`,
  `tests/movimiento_schema.test.js`, `tests/correccion_schema.test.js`,
  `tests/estado_stock.test.js`.

**Patrón de referencia.** `assets/js/domain/transformador_schema.js` para sanitizado por
secciones; `assets/js/domain/orden_schema.js` para validador que devuelve array de errores.

**Decisiones a confirmar (mini-gating).**
- ¿`UNIDADES` se restringe solo a `['Und']` (única que aparece en el .xlsm fuente) o se
  abre al set completo? **Auto-asunción mejor manera:** abrir al set completo desde F38
  para evitar romper el schema cuando el director añada un suministro líquido (silica gel ya
  podría serlo).

**Anticipación de errores.**
- Códigos `S01..S22` deben validar con regex `/^S\d{2}$/i` y normalizarse a uppercase en el sanitizer.
- `cantidad` en movimientos debe ser **entero ≥ 1** (no fracciones, no cero) — coincide con
  la data validation del .xlsm Sheet7!W (whole > 0).
- `tipo` movimiento normalizado a uppercase (`INGRESO|EGRESO`) tanto en sanitizer como en validador
  para evitar discrepancia con rules server-side.
- `valor_unitario` y `valor_total` se almacenan como `Number`; el formateo COP es responsabilidad
  del renderer (ver `fmtCOP` en F47).
- `estadoStock(0, 0)` debe devolver `SIN_STOCK` (no `AGOTADO`) — los items contractuales con
  stock_inicial=0 son legítimos (decisión 3·A) y deben distinguirse de los agotados por consumo.

**Validación / criterio de cierre.**
- `npm test` — 282 + ~25 = ~307 tests verdes.
- Sanitizer rechaza objetos sin keys obligatorias (devuelve `null` o lanza, según convención del repo).
- Validador retorna `[]` si OK, `[{campo, mensaje}]` si no.

**Tests.** 25 tests (5 por archivo).

**Commit msg.** `feat(suministros): F38 dominio puro · schemas + sanitizers + validadores + 25 tests`

**Estimación.** 1.5 h.

**Sin deploy.** No toca Firestore.

---

#### F39 · Data layer + audit hooks + transacciones de stock

**Objetivo.** API CRUD sobre Firestore para las 4 colecciones nuevas. Movimientos
en transacción atómica que valida stock antes de escribir. Cada write registrado en `/auditoria`.

**Entregables.**
- `assets/js/data/suministros.js` — `listar`, `obtener`, `crear`, `actualizar`,
  `eliminar`, `suscribir` (signature idéntica a `transformadores.js`).
- `assets/js/data/marcas.js` — mismo patrón + filtro por `suministro_id`.
- `assets/js/data/movimientos.js`:
  - `crear(payload)` envuelto en `runTransaction()`:
    1. Lee el último `MOV-{anio}-NNNN` para generar correlativo sin colisión.
    2. Calcula stock_actual recomputando agregado de movimientos previos del mismo `suministro_id`.
    3. Si quedaría negativo y `permitirNegativo=false`, lanza `StockInsuficienteError`.
    4. Crea el doc + entrada de audit en el mismo batch.
  - `eliminar(id)` con audit obligatorio (justificación requerida en payload).
  - `suscribir(filtros, onData, onError)` con realtime.
  - `computarStock(suministroId)` puro: agregación de movimientos.
  - `suscribirStockGlobal(onData, onError)` que combina `/suministros` + `/movimientos`
    con debounce 250 ms — patrón de `alertas.js` `suscribirComputo`.
- `assets/js/data/correcciones.js` — CRUD simple.
- `assets/js/data/suministros_config.js` — singleton `/suministros_config/global` con
  `permitirNegativo`, `umbral_critico_pct=0.20`, `umbral_medio_pct=0.50`.
- Tests: `tests/suministros_data.test.js`, `tests/movimientos_data.test.js` (con mock Firestore).

**Patrón de referencia.** `assets/js/data/transformadores.js` (CRUD + audit hooks),
`assets/js/data/ordenes.js` (suscribir con filtros), `assets/js/data/alertas.js`
(`suscribirComputo` con debounce).

**Decisiones a confirmar (mini-gating).**
- ¿`permitirNegativo` por defecto = `false` (rechazo duro) o `true` (alerta pero permite)?
  El skill cita "user approved 'alert but allow'" en sesión real. **Auto-asunción mejor manera:**
  `false` por seguridad — el director puede flipear el flag en `/suministros_config/global`
  desde la UI cuando lo necesite.
- ¿Formato del código de movimiento: `MOV-2026-0001` (correlativo anual) o
  `MOV-20260425-001` (correlativo diario)? **Auto-asunción:** anual, consistente con
  `ordenes.codigo` y más legible.

**Anticipación de errores.**
- **Race condition en correlativo:** sin tx, dos admins crean simultáneamente y colisionan.
  Mitigación: la lectura del último correlativo va dentro del mismo `runTransaction` que el create.
- **Snapshot del valor unitario:** se copia al movimiento en `crear()` (no se referencia al
  catálogo). Si después cambia el precio en `/suministros`, el histórico no se distorsiona.
- **Eliminación de movimiento:** permitida pero con audit obligatorio (`justificacion`
  required en payload). La función rechaza si no se provee.
- **Carga inicial de stock cero:** `computarStock` debe devolver `{inicial:0, ingresado:0,
  egresado:0, actual:0}` cuando no hay movimientos, no `null`.
- **Querying por `transformador_id`:** la FK en `/movimientos` se actualiza al crear; si el
  trafo se elimina (cascada raras vez deseable), el movimiento queda huérfano — política del
  proyecto: no eliminar trafos con movimientos asociados (el delete del trafo lo bloqueará F39).

**Validación / criterio de cierre.**
- Tests con mock Firestore validan: tx rechaza con stock negativo cuando flag=false; acepta
  cuando flag=true; correlativos secuenciales sin colisión bajo carga simulada (10 inserts
  paralelos generan `MOV-2026-0001..0010` sin saltos).

**Tests.** 20 tests.

**Commit msg.** `feat(suministros): F39 data layer · CRUD + tx atómica de stock + audit hooks + 20 tests`

**Estimación.** 3 h.

**Sin deploy todavía** (las rules vienen en F40).

---

#### F40 · Reglas Firestore + 8 índices compuestos

**Objetivo.** Persistir las 4 colecciones nuevas con RBAC restrictivo (lectura team,
escritura admin) y validación de enums server-side.

**Entregables.**
- `firestore.rules` con bloques nuevos:
  ```
  /suministros/{id}   — read team, write admin, valida codigo regex, unidad enum, stock_inicial >= 0
  /marcas/{id}        — read team, write admin, valida suministro_id no vacío
  /movimientos/{id}   — read team, WRITE ADMIN ONLY (decisión 6·A), valida tipo enum,
                        cantidad > 0, transformador_id no nulo, suministro_id no nulo
  /correcciones/{id}  — read team, write admin, valida tipo enum
  /suministros_config/{id} — read team, write admin
  ```
- Helpers nuevos: `isTipoMovimientoValido()`, `isUnidadValida()`, `isEstadoRepuestoValido()`.
- `firestore.indexes.json` con los 8 índices compuestos del §2.

**Patrón de referencia.** `firestore.rules` líneas 53-67 (helpers de enum), match de
`/transformadores/{id}` (validación por sección), match de `/transformadores/{id}/historial`
(append-only — patrón aplicable si en el futuro se mueven movimientos a sub-colección).

**Decisiones a confirmar.** Ninguna nueva.

**Anticipación de errores.**
- Si se despliegan rules sin desplegar índices primero, las queries con `orderBy + where`
  fallan con `FAILED_PRECONDITION`. **Orden correcto: índices → esperar build → rules.**
- Validación de enums server-side debe ser **case-sensitive uppercase** (sanitizer F38 ya
  fuerza uppercase). Si el cliente manda lowercase, el rule lo rechaza explícitamente —
  síntoma claro de bug en sanitizer.
- El campo `valor_total` debe permitir floats grandes (hasta 10^12 COP); el rule no debe
  imponer techo numérico.

**Validación / criterio de cierre.**
- Test manual con Firestore Emulator (`firebase emulators:start`):
  - Como admin: CRUD completo en las 4 colecciones funciona.
  - Como tecnico: solo `read`; cualquier `write` rechazado con `permission-denied`.
  - Como anonymous: rechazado con `permission-denied` desde el primer `get`.
- Test manual: query `where('zona','==','BOLIVAR') orderBy('anio','desc')` sobre `/movimientos`
  retorna sin error tras desplegar el índice correspondiente.

**Tests.** Sin tests automatizados (las rules se prueban con Firestore Emulator;
documentar comando en commit).

**Commit msg.** `feat(suministros): F40 firestore rules + 8 índices compuestos`

**Estimación.** 1 h.

**⚠ Requiere deploy manual del director (orden estricto):**
```bash
firebase deploy --only firestore:indexes      # paso 1: esperar build complete
firebase deploy --only firestore:rules        # paso 2: tras índices listos
```

---

#### F41 · Sub-section `repuesto` en transformador_schema (dual-write retrocompat)

**Objetivo.** Añadir el campo `repuesto` (estado: OPERATIVA/OBSOLETA/N/A) a
`/transformadores/{id}` sin romper vistas existentes. Estrategia dual-write:
sanitizer escribe **ambos** niveles (sub-section nueva `repuesto` + flat `re` en raíz),
de modo que `pages/inventario.html` y todas las vistas legacy sigan renderizando sin tocar.

**Entregables.**
- `assets/js/domain/transformador_schema.js`:
  - Sub-section nueva `repuesto: {estado, serial_repuesto, notas}`.
  - `proyeccionV1()` extendida para incluir `re` flat.
  - Coherencia bidireccional: si input trae `re` plano, sanitizer infiere `repuesto.estado`;
    si trae `repuesto`, regenera `re`.
- `assets/js/domain/schema.js` — `ESTADOS_REPUESTO` (ya añadido en F38, solo se referencia).
- `firestore.rules` — añadir validación opcional de `repuesto.estado` enum si presente
  (no requerido, el campo es opcional).
- Tests: extender `tests/transformador_schema.test.js` con casos de coherencia v1↔v2.

**Migración de datos diferida a F42.** El backfill de `repuesto.estado` para los 206
trafos existentes se hace dentro del importador F42 (que va a tocar todos los docs igualmente
al re-sembrar desde el JSX). Esto evita doble pase sobre la misma colección.

**Patrón de referencia.** F16 estableció la convención dual-write (raíz aplanada + secciones);
seguirla idéntica.

**Decisiones a confirmar.** Ninguna nueva (la decisión de diferir migración a F42 ya está tomada).

**Anticipación de errores.**
- Si `repuesto.estado` queda `undefined` al leer un doc viejo (pre-F42), las queries que
  filtren por ese campo lo excluyen del resultado. **Mitigación:** sanitizer aplica `'N/A'`
  por defecto cuando el campo falta — los reads vía data layer siempre obtienen el campo.
- La proyección plana `re` debe estar **siempre en sync** con `repuesto.estado`. Test
  explícito: editar un doc con shape v1 y verificar que `repuesto.estado` se infirió;
  editar con shape v2 y verificar que `re` se regeneró.
- El JSX original tiene algunos `re: null` (no `'N/A'`). Sanitizer trata `null` como
  ausencia → defaultea a `'N/A'`. Tests cubren este caso.

**Validación / criterio de cierre.**
- Tests cubren: shape v1 (`{re:'OPERATIVA'}`) → produce `repuesto.estado='OPERATIVA'`;
  shape v2 (`{repuesto:{estado:'OBSOLETA'}}`) → produce `re='OBSOLETA'`; doc sin ningún
  campo → ambos lados quedan en `'N/A'`; doc con `re:null` → ambos lados quedan en `'N/A'`.

**Tests.** +8 tests al archivo existente.

**Commit msg.** `feat(suministros): F41 transformador.repuesto · sub-section + dual-write retrocompat + 8 tests`

**Estimación.** 1.5 h.

**Sin deploy** (las rules ya cubren el campo opcional desde F40 si la regla acepta el
sub-objeto sin requerirlo).

---

**Resumen Bloque A:**
- 4 microfases · 4 commits aislados.
- ~73 tests nuevos (25+20+0+8 plus algunos de soporte).
- 1 deploy manual del director (F40).
- Tiempo estimado: 7 h efectivas.
- Estado del repo al cierre del bloque: backend listo para recibir datos; UI todavía sin
  cambios visibles; el director no ve nada nuevo en `home.html`.

---

### Bloque B · Importador (seed inicial idempotente)

#### F42 · Importador XLSM/JSX → Firestore

**Objetivo.** Sub-rutina reusable + UI admin que lee los archivos fuente y siembra
Firestore. **Idempotente:** re-ejecutarla no duplica datos. Hace también el backfill
del campo `repuesto` en `/transformadores` que F41 dejó pendiente.

**Entregables.**
- `assets/js/domain/importador_suministros.js` — parser puro (sin I/O Firebase):
  - `parsearXlsmCatalogo(buffer)` → `{suministros: [...22], marcas: [...22]}` desde
    Sheet2 + Sheet3 del .xlsm.
  - `parsearXlsmEquipos(buffer)` → `[{matricula, ...}]` desde Sheet5 (206 filas).
  - `parsearJsxTransformadores(text)` → `[{m, sub, zona, dep, re, ...}]` extrae el array
    `TRANSFORMADORES` del JSX. Parsing seguro: regex extraction + `JSON.parse` con quoting fix
    (NO `eval`/`Function` — superficie de ataque innecesaria).
  - `reconciliar(equiposXlsm, equiposJsx)` — coalesce por matrícula; JSX gana en conflictos
    (decisión 2·A). Reporta diferencias.
  - `prepararPlanImportacion(parsedAll, existentesEnFirestore)` →
    `{crear: [...], actualizar: [...], skip: [...], correcciones: [...]}`.
  - `extraerCorreccionesEmbedded(jsxText)` → 3 correcciones que el JSX hardcodea (matrículas,
    tensiones, regulación) para inyectarlas como docs en `/correcciones`.
- `assets/js/data/importador_suministros.js` — runner con I/O:
  - `ejecutarImportacion({plan, dryRun, onProgress})` — batches de 450 writes (límite Firestore).
  - Registra **una sola** entrada `bulk_import_suministros` en `/auditoria` con metadata
    granular del §3 (decisión 7·A).
  - Backfill del campo `repuesto` para los 206 trafos (cumple compromiso F41).
- `admin/importar-suministros.html` + `admin-importar-suministros.js` — UI:
  - Drop-zone para subir el .xlsm y el .jsx (acepta versiones futuras).
  - Botón **"Cargar desde repo"** atajo que hace fetch a
    `/control_suministros-2.jsx` y `/Gestion_Suministros_Transformadores-2.xlsm`.
  - Botón **SIMULAR** (dryRun): muestra plan en tabla — cuántos crea, cuántos actualiza,
    conflictos por matrícula, correcciones embebidas.
  - Botón **IMPORTAR**: ejecuta. Barra de progreso. Reporte final con summary completo
    + link al doc de auditoría.
- Tests: `tests/importador_suministros.test.js` con datos sintéticos (3 sumin + 5 trafos).

**Patrón de referencia.** F17 importador Excel → Firestore en `admin/importar.html` +
`assets/js/data/importar.js` (idempotencia por código, dryRun obligatorio antes del run real,
batches de 450).

**Decisiones a confirmar (mini-gating).**
- ¿Las 3 correcciones que el JSX muestra hardcoded se importan automáticamente como docs
  con `fuente='control_suministros-2.jsx'` y `numero=1,2,3`, o se difieren a entrada
  manual en F46? **Auto-asunción mejor manera:** importar automáticamente — el director
  las ve en F46 y puede editar / agregar más sin perder la traceability del fuente.
- ¿Qué hacer con suministros / trafos huérfanos en Firestore (presentes en BD pero no en
  el .xlsm/JSX)? **Auto-asunción:** marcarlos como `skip` y reportarlos en el summary;
  NO eliminar (decisión 2·A no autoriza DELETE).

**Anticipación de errores.**
- **SheetJS:** cells vacías retornan `undefined`; coalesce a `''` antes de pasar al sanitizer
  F38 (que rechaza `undefined` pero acepta string vacío).
- **Parsing del JSX:** el array `TRANSFORMADORES` es JS literal con comillas dobles y nulls.
  Estrategia: regex captura el bloque `[...]`, se reemplaza `null` por `null` (ya válido en
  JSON), se quita comma trailing si existe, se valida con `JSON.parse`. **Cero `eval`.**
- **Race condition en re-importación concurrente:** dos admins importando a la vez generan
  dos audit entries pero los docs quedan consistentes (UPDATEs idempotentes por matrícula).
- **Memoria:** 206 trafos × ~4 KB cada uno + 22 sumin = ~900 KB en buffer — sin problema
  para client-side.
- **Backfill `repuesto`:** los trafos que el JSX trae con `re:null` se sanean a
  `repuesto.estado='N/A'` (regla del sanitizer F41). Se loguea en el summary cuántos
  pasaron de "sin campo" a "N/A" para evidencia.

**Validación / criterio de cierre.**
- Tests sintéticos: parsear, generar plan, ejecutar, verificar Firestore mock.
- Manual: dryRun en UI muestra exactamente 22 suministros + 22 marcas + 206 trafos +
  3 correcciones.
- Manual: ejecutar real, verificar entrada de audit con `sha256(.xlsm)`, `sha256(.jsx)`
  y summary completo.
- Re-ejecutar: el plan resulta `crear:0, actualizar:228, skip:0` — confirma idempotencia.

**Tests.** 18 tests.

**Commit msg.** `feat(suministros): F42 importador idempotente XLSM/JSX → Firestore + UI admin + 18 tests`

**Estimación.** 4 h.

**Sin deploy** (rules ya cubren las colecciones desde F40).

---

### Bloque C · Admin UI (CRUD operativo)

#### F43 · Admin Catálogo de Suministros (CRUD)

**Objetivo.** Tabla + modal CRUD de los 22 ítems de catálogo. Realtime con `suscribir`.
Solo admin escribe; team lee.

**Entregables.**
- `admin/suministros-catalogo.html`:
  - Topbar + sidebar via aqua-shell (body class="aqua").
  - Toolbar: filtros (unidad, búsqueda por nombre/código) + botón "Nuevo".
  - Tabla columnas: codigo · nombre · unidad · stock_inicial · marcas_disponibles (chips) ·
    valor_unitario · acciones (Editar / Eliminar).
  - Modal Nuevo/Editar con validación cliente.
  - Confirmación de borrado con conteo de movimientos asociados.
- `assets/js/admin/admin-suministros-catalogo.js` — controller usando `data/suministros.js`.
- `assets/css/suministros.css` — pills por unidad, badge para chips de marcas.

**Patrón de referencia.** `admin/inventario.html` + `admin-inventario.js` — molde idéntico
(toolbar → tabla → modal).

**Decisiones a confirmar.** Ninguna nueva.

**Anticipación de errores.**
- **PK humana inmutable:** el modal deshabilita el campo `codigo` en modo edición. Renombrar
  un código forzaría reescribir FKs en `/marcas` y `/movimientos` — fuera de alcance.
- **Eliminación con FK pendiente:** si el suministro tiene movimientos asociados, mostrar
  warning con conteo y pedir confirmación explícita. Si se confirma, los movimientos quedan
  con `suministro_nombre` snapshot pero `suministro_id` huérfano (que el dashboard maneja).
  Mejor: **bloquear delete** y obligar al admin a eliminar/reasignar movimientos primero.
- **`marcas_disponibles` read-only en este panel:** el CRUD de marcas vive en F44; aquí solo
  se renderizan como chips. Click en chip lleva a F44 con filtro pre-aplicado.

**Validación / criterio de cierre.**
- CRUD funciona end-to-end con admin login real.
- Realtime: editar en una pestaña → refleja en otra sin recargar.
- `npm run lint:html` limpio.

**Tests.** Sin tests automatizados (UI; lógica testeada en F39).

**Commit msg.** `feat(suministros): F43 admin catálogo · CRUD + realtime + Aqua shell`

**Estimación.** 2.5 h.

---

#### F44 · Admin Marcas (CRUD + sync con `marcas_disponibles`)

**Objetivo.** Panel para gestionar el mapeo Suministro → Marca(s) que en el .xlsm
vive en Sheet3 (tblMarcas). Sync automático con `/suministros[*].marcas_disponibles[]`.

**Entregables.**
- `admin/suministros-marcas.html` — tabla 4 columnas: suministro · marca · observaciones · acciones.
- `assets/js/admin/admin-suministros-marcas.js`.
- Extender `assets/js/data/marcas.js` con sync callback que tras cada `crear/actualizar/eliminar`
  releee todas las marcas del mismo suministro y actualiza el campo
  `/suministros/{id}.marcas_disponibles[]`. Hecho en cliente para no requerir Cloud Function.

**Patrón de referencia.** F43 (mismo molde con menos campos).

**Decisiones a confirmar (mini-gating).**
- ¿Una sola marca por suministro (modelo del .xlsm: 22 filas, 1 marca cada una) o
  N marcas por suministro? **Auto-asunción mejor manera:** N marcas — el .xlsm hoy tiene
  1, pero el campo plural `marcas_disponibles[]` ya está en el schema F38 anticipando
  vendor diversification. Si el director quiere cap a 1, lo enforzo en validador F38.

**Anticipación de errores.**
- **Sync de `marcas_disponibles[]`:** si dos admins crean marcas para el mismo suministro
  simultáneamente, las dos updates concurrentes al campo array producen un last-writer-wins
  que pierde una marca. **Mitigación:** usar `arrayUnion` en lugar de overwrite. Probado
  con dos pestañas → ambas marcas sobreviven.
- **Delete de la última marca:** dejar `marcas_disponibles[]` vacío, no `null`. El form
  F45 maneja array vacío mostrando "Sin marca asignada".

**Validación.**
- CRUD funciona; al crear marca para S02, panel F43 muestra el chip nuevo en realtime.

**Tests.** Sin tests automatizados (UI).

**Commit msg.** `feat(suministros): F44 admin marcas · CRUD + sync con marcas_disponibles`

**Estimación.** 2 h.

---

#### F45 · Admin Movimientos · Formulario "Entrega"

**Objetivo.** El núcleo operativo del módulo. Formulario INGRESO/EGRESO con autocomplete
en cascada (DESC → marca/unidad/valor; matrícula → sub/zona/depto/etc), validación de
stock, persistencia atómica via `data/movimientos.js`.

**Entregables.**
- `admin/suministros-movimiento.html`:
  - Form layout (campos del JSX + columnas del .xlsm Sheet7 "Entrega"):
    - **Cabecera:** Año (dropdown 2023-2030) · Tipo (radio INGRESO / EGRESO) · Usuario (texto).
    - **Suministro:** DESC (input + datalist sobre `/suministros`) → auto: marca · unidad ·
      valor_unitario · stock_actual.
    - **Equipo:** Matrícula (input + datalist sobre `/transformadores`) → auto: subestación ·
      zona · departamento · código · serial · potencia · grupo · UUCC · refrigeración ·
      regulación · tensiones (vp, vs, vt).
    - **Detalle movimiento:** Cantidad (numérico ≥ 1) · Valor total (calculado) · ODT
      (texto) · Observaciones (textarea).
  - Botones: GUARDAR · LIMPIAR.
  - Banner feedback (ok/err) consistente con admin existente.
- `assets/js/admin/admin-suministros-movimiento.js` — controller.
- `assets/css/suministros.css` — clases para el form con color coding del skill:
  - 🔵 azul (`--cell-manual`): inputs manuales (Año, Tipo, Cantidad, Usuario, ODT, Obs).
  - 🟡 amber (`--cell-keyfield`): la **matrícula** (segunda lookup key crítica).
  - 🟢 verde (`--cell-auto`): campos auto-completados via lookup.
  - 🟠 naranja (`--cell-calc`): valor_total calculado.
- Tests: `tests/movimiento_form_logic.test.js` (lógica pura del autocomplete + cálculo).

**Patrón de referencia.** `admin/ordenes.html` (modal con select dinámico + validación);
JSX `view==='formulario'` (estructura del form); skill (color coding + amber para 2da key).

**Decisiones a confirmar (mini-gating).**
- ¿Autocomplete con `<datalist>` HTML5 nativo (simple, cero deps) o componente custom
  fuzzy-search? **Auto-asunción:** datalist nativo en F45 inicial (eficiente con 22 + 206
  entries); si el director pide búsqueda fuzzy, se itera en F46 o F50.
- ¿Tras GUARDAR exitoso, qué se conserva en el form? **Auto-asunción:** Año + Tipo +
  Usuario (típico flow: muchos registros del mismo usuario en la misma sesión); el resto
  se limpia. Editable.

**Anticipación de errores.**
- **Validación cliente debe replicar la rule** (cantidad > 0, tipo enum, transformador_id no
  nulo) — feedback inmediato sin trip a Firestore. Discrepancia entre cliente y rule = bug
  visible.
- **Stock insuficiente:** si `permitirNegativo=false` (default F39) y el EGRESO dejaría
  stock < 0, mostrar error específico con el faltante:
  `"Stock S02: 5 disponibles, 8 solicitados — falta 3 unidades"`.
- **Datalist de matrículas con 206+ entries:** acepta input parcial; navegador autocompleta.
  Si el director escribe matrícula no listada (p.ej. typo), validar contra el array y
  bloquear submit con error claro.
- **Race condition en correlativo:** delegada a la tx F39; el form solo confía en la respuesta.

**Validación / criterio de cierre.**
- Crear 5 movimientos en el mismo año: códigos `MOV-2026-0001..0005` sin saltos.
- Editar un suministro en otra pestaña → el form refleja el nuevo `valor_unitario` en su
  datalist sin recargar.
- Intentar EGRESO de cantidad > stock → form bloquea con mensaje específico.

**Tests.** 12 tests.

**Commit msg.** `feat(suministros): F45 admin movimientos · formulario INGRESO/EGRESO + autocomplete cascada + validación stock + 12 tests`

**Estimación.** 4 h.

---

#### F46 · Admin Histórico de Movimientos + Correcciones

**Objetivo.** Tabla del histórico completo con filtros avanzados. Panel separado para
gestionar la hoja Correcciones.

**Entregables.**
- `admin/suministros-historico.html`:
  - Toolbar: filtros (año · zona · departamento · tipo · suministro · búsqueda libre).
  - Tabla 12 columnas (N° · Año · Código MOV · Tipo · DESC · Marca · Unidad · Matrícula ·
    Subestación · Zona · Cantidad · Valor · Acciones).
  - Acción **Ver:** modal con detalle completo + audit trail del movimiento.
  - Acción **Eliminar:** pide justificación obligatoria, requiere confirmación, registra
    en audit (la rule ya valida que justificación esté presente).
  - Botón **Exportar CSV** (rápido; el .xlsm 1:1 viene en F49).
- `admin/suministros-correcciones.html`:
  - Tabla 6 columnas (N° · Tipo · Ubicación · Original · Corregido · Justificación).
  - Modal Nuevo Corrección.
  - Listado de las correcciones que F42 inyectó automáticamente desde el JSX
    (matriculas, tensiones, regulación) — visibles, editables, no eliminables (append-only).
- `assets/js/admin/admin-suministros-historico.js`.
- `assets/js/admin/admin-suministros-correcciones.js`.

**Patrón de referencia.** `admin/ordenes.html` (tabla + filtros + acciones);
`admin/auditoria.html` (modal de detalle).

**Decisiones a confirmar.** Ninguna nueva (la decisión sobre las 3 correcciones
hardcoded ya está tomada en F42).

**Anticipación de errores.**
- **Filtros 3+ where simultáneos:** requieren índice compuesto. Las queries del histórico
  usan al menos 2 dimensiones (año + algo más); los 5 índices de movimientos en F40 cubren
  todas las combinaciones operativas. Si llega una combinación nueva, se añade índice.
- **Búsqueda libre:** client-side sobre el resultado de `suscribir` (no Firestore full-text,
  que requeriría Algolia/Typesense). Aceptable hasta ~5000 movimientos/año.
- **Correcciones append-only:** la rule debe rechazar `delete` en `/correcciones` (solo
  `update` permitido para corregir typos del registro, nunca borrado). Ajustar F40 si
  no quedó así.

**Validación.**
- Crear 5 movimientos en F45 → todos visibles en F46 sin recarga.
- Filtrar zona=BOLIVAR → solo BOLIVAR.
- Eliminar uno con justificación → desaparece de la tabla; aparece en `/auditoria`.
- Crear corrección → aparece en panel; intentar eliminar → bloqueado por rule.

**Tests.** Sin tests automatizados (UI; lógica de filtros pura ya testeada en F39).

**Commit msg.** `feat(suministros): F46 admin histórico + correcciones · filtros + delete con audit + export CSV`

**Estimación.** 3.5 h.

---

**Resumen Bloques B+C:**
- 5 microfases · 5 commits aislados.
- ~30 tests nuevos (18 de F42 + 12 de F45).
- 0 deploys adicionales (rules y índices ya desplegados desde F40).
- Tiempo estimado: 16 h efectivas.
- Estado del repo al cierre: el director ya puede importar el seed inicial y operar
  movimientos completos vía web. La capa pública (consulta solo lectura para tecnico) y
  el export 1:1 con macros vienen en P5.

---

### Bloque D · Public UI (consulta solo lectura)

#### F47 · Public Stock Dashboard

**Objetivo.** Vista pública (rol team) de la tabla de stock con semáforo de 6 estados
del skill. Equivalente al view `stock` del JSX pero alimentado en realtime desde Firestore.

**Entregables.**
- `pages/suministros-stock.html`:
  - 5 KPIs operativos arriba: stock_inicial · consumido · disponible · agotados · críticos.
  - 3 KPIs económicos: valor_contrato · valor_consumido · valor_disponible.
  - Tabla 22 filas × 15 columnas: codigo · nombre · marca · unidad · valor_unit ·
    stock_inicial · cons_BOL · cons_OCC · cons_ORI · cons_total · disponible ·
    valor_consumido · valor_disponible · % rest · estado_pill.
  - Filtros: zona · departamento · búsqueda por código/nombre.
  - Toolbar con botón "Exportar CSV" (rápido, no es el .xlsm 1:1; ese vive en F49 y solo
    es accesible para admin).
- `assets/js/suministros-stock-public.js` — controller usando `data/movimientos.js`
  `suscribirStockGlobal` (ya implementado en F39 con debounce 250 ms).
- `assets/css/suministros.css` — extender con clases del semáforo:
  - `.estado-pill.SIN_STOCK` — fondo `slate-200`, texto `slate-600`, prefix `⚪`.
  - `.estado-pill.NEGATIVO` — fondo `red-200`, texto `red-700`, prefix `🔴`, animación pulse.
  - `.estado-pill.AGOTADO` — fondo `red-100`, texto `red-700`, prefix `⛔`.
  - `.estado-pill.CRITICO` — fondo `orange-100`, texto `orange-700`, prefix `🟠`.
  - `.estado-pill.MEDIO` — fondo `amber-100`, texto `amber-700`, prefix `🟡`.
  - `.estado-pill.OK` — fondo `green-100`, texto `green-700`, prefix `🟢`.
- Test `tests/estado_stock_render.test.js` — 6 tests para los cutoffs (SIN_STOCK con
  stock_inicial=0, NEGATIVO con disponible<0, AGOTADO con disponible=0,
  CRITICO con %rest<0.20, MEDIO con %rest entre 0.20 y 0.50, OK con %rest≥0.50).

**Patrón de referencia.** `pages/inventario.html` (vista pública con KPIs + tabla);
JSX `view==='stock'` (estructura de columnas).

**Decisiones a confirmar.** Ninguna nueva.

**Anticipación de errores.**
- **Cálculo client-side de agregación zona×suministro:** la query a `/movimientos` puede
  retornar miles de docs en parques activos. Mitigación: `suscribirStockGlobal` ya filtra
  en cliente con índices construidos en memoria; tope práctico 5000 movimientos antes de
  notar lag. Si se supera, mover agregación a Cloud Function con cache (post-v2.2).
- **% rest cuando stock_inicial=0:** división por cero. El helper `estadoStock` del F38
  ya devuelve `SIN_STOCK` directamente sin calcular el ratio.
- **Pill negativo con animación pulse:** respetar `prefers-reduced-motion` (clase ya
  manejada en `base.css` desde F13).

**Validación / criterio de cierre.**
- Crear 3 movimientos en F45 → tabla refleja en realtime.
- Filtrar zona=BOLIVAR → columna `cons_BOL` permanece, las otras se atenúan visualmente
  (sin ocultar para no romper la lectura).
- Item con stock_inicial=0 muestra `⚪ SIN STOCK`, no `⛔ AGOTADO`.

**Tests.** 6 tests puros + manual E2E.

**Commit msg.** `feat(suministros): F47 public stock dashboard · tabla 22×N + KPIs + semáforo 6 estados + 6 tests`

**Estimación.** 3 h.

---

#### F48 · Public Suministros Dashboard + Vista Cruzada

**Objetivo.** Dashboard ejecutivo con KPIs operativos y económicos + ranking por descripción +
distribución geográfica + vista cruzada (filtro zona/depto sobre ranking de descripciones).
Equivalente a los views `dashboard` y `cruzado` del JSX.

**Entregables.**
- `pages/suministros-dashboard.html` (single page, dos secciones):
  - **Sección 1 — Dashboard ejecutivo:**
    - 5 KPIs operativos: registros · unidades · descripciones únicas · TX atendidos · valor consumido.
    - 4 KPIs económicos: valor_contrato · valor_consumido · valor_disponible · %ejecución.
    - 4 gráficas Chart.js:
      - Bar horizontal: ranking suministros por unidades consumidas.
      - Bar horizontal: ranking suministros por valor consumido.
      - Doughnut: distribución por zona (BOLIVAR / OCCIDENTE / ORIENTE).
      - Bar: distribución por departamento (5 deptos).
  - **Sección 2 — Vista cruzada:**
    - Selector zona (3 opciones + "Todas").
    - Selector departamento (5 opciones + "Todos").
    - Bar horizontal: ranking suministros filtrado por la combinación seleccionada.
    - Banner contador "Mostrando X de Y movimientos según filtros activos".
- `assets/js/suministros-dashboard-public.js` — controller; reusa `kpis-render.js`
  como helper para destruir charts en recargas.
- Sin extensión de CSS (los estilos del dashboard ya viven en `kpis.css` desde F8).

**Patrón de referencia.** `pages/kpis.html` (5 gráficas + 3 tarjetas RAM + grids);
`assets/js/kpis-render.js` (renderer compartido). JSX `view==='dashboard'` y
`view==='cruzado'`.

**Decisiones a confirmar (mini-gating).**
- ¿Las 4 gráficas viven en una sola página o se splitean en pestañas (Dashboard / Cruzado)?
  **Auto-asunción:** una sola página con 2 secciones — más rápido para el director
  scrolear que cambiar de tab. Si reporta fatiga visual, se splittea.
- ¿La gráfica de zona es Doughnut (3 sectores) o Pie? **Auto-asunción:** Doughnut
  consistente con F8 KPIs (que ya usa doughnut para distribución por estado).

**Anticipación de errores.**
- **Decisión #1·C** dejó las hojas Detalle Zona y Detalle Depto fuera del .xlsm exportado.
  En la web NO se construye matriz heatmap descripción×zona ni descripción×departamento.
  Solo el ranking cruzado del JSX. Confirmar con el director si alguna vez quiere el heatmap.
- **Chart.js destroy:** olvidar `chart.destroy()` antes de re-render produce charts huérfanos
  que consumen RAM. El renderer compartido `kpis-render.js` ya lo maneja.
- **Filtros sin resultados:** si zona=BOLIVAR + depto=CESAR (combinación imposible — CESAR
  está en ORIENTE), mostrar mensaje "Sin movimientos para los filtros seleccionados" en
  lugar de gráficas vacías.

**Validación / criterio de cierre.**
- Cargar la página con datos sembrados (F42) y 0 movimientos → KPIs muestran 0, gráficas
  muestran "Sin datos" (placeholder, no se rompe).
- Crear 5 movimientos diversos en F45 → KPIs y gráficas refrescan en realtime.
- Cambiar selector de zona → ranking cruzado se refiltra.

**Tests.** Sin tests automatizados (UI; lógica de agregación testeada en F39).

**Commit msg.** `feat(suministros): F48 public dashboard suministros + vista cruzada · 9 KPIs + 5 gráficas Chart.js`

**Estimación.** 3.5 h.

---

**Resumen Bloque D:**
- 2 microfases · 2 commits aislados.
- 6 tests nuevos.
- 0 deploys.
- Tiempo estimado: 6.5 h efectivas.
- Estado del repo al cierre: tecnico ya tiene visibilidad completa del stock y consumo;
  admin sigue siendo el único que puede mover. Falta solo el export 1:1 (F49) y el
  cierre (F50).

---

### Bloque E · Export & Cierre

#### F49 · Export XLSM 1:1 con template binario (JSZip + parche XML)

**Objetivo crítico.** Generar un .xlsm idéntico al fuente con: 10 hojas (las 8 del fuente
+ Correcciones + Portada), VBA preservado byte-a-byte, Office Add-in preservado, charts
intactos, formato condicional intacto, themes intactos. **Cero regeneración de XML
que no sea estrictamente necesaria.**

**Estrategia (decidida tras evaluar 3 paths).**

| Path | Pros | Contras | Veredicto |
|---|---|---|---|
| ExcelJS browser-side | API moderna, tipada | Reserializa todo el zip → **destruye `vbaProject.bin`** y `webextensions/` | ❌ Descartado |
| `xlsx-populate` | Preserva VBA según docs | Requiere npm install, +500 KB browser | 🟡 Backup |
| **JSZip + parche XML directo** | Cero regeneración del zip; tocamos solo los XMLs de hojas; `vbaProject.bin` y `webextensions/` jamás se reescriben | DOM XML manual, más código bajo nivel | ✅ **Elegido** |

Bajo el approach **JSZip + parche XML**: leemos el .xlsm como zip, modificamos sólo
`xl/worksheets/sheet2.xml` (Catalogo_Suministros · stock_inicial), `xl/worksheets/sheet5.xml`
(Equipos), `xl/worksheets/sheet6.xml` (Movimientos · datos vivos), añadimos
`xl/worksheets/sheet9.xml` (Correcciones nueva), `xl/worksheets/sheet10.xml` (Portada nueva),
ajustamos `xl/workbook.xml` para registrar las nuevas hojas en el orden tab requerido por
decisión 1·C, y actualizamos `[Content_Types].xml` y `xl/_rels/workbook.xml.rels`.
Recomprimimos. Listo. **Las fórmulas SUMIFS de Sheet2 (F y G) y de Dashboard se mantienen
sin tocarse — recalculan solas al abrir Excel.**

**Entregables.**
- `/assets/templates/Gestion_Suministros_Transformadores-2.xlsm` — template inmutable
  (~80 KB, copia exacta del fuente).
- `assets/js/exports/xlsm_suministros.js`:
  - `cargarTemplate()` → fetch del template como `ArrayBuffer`.
  - `descomprimirZip(buffer)` → JSZip instance.
  - `parchearSheet2(zip, suministros)` — reescribe celdas H4:H25 (stock_inicial) en
    `xl/worksheets/sheet2.xml` preservando estilos, fórmulas existentes y formato condicional.
  - `parchearSheet5(zip, transformadores)` — reescribe rango B4:J209 con los 206 trafos.
  - `parchearSheet6(zip, movimientos)` — reescribe `tblMovimientos` con datos vivos +
    actualiza `xl/tables/table4.xml` con el nuevo `ref` para que la tabla se expanda
    correctamente.
  - `inyectarHojaCorrecciones(zip, correcciones)` — agrega `xl/worksheets/sheet9.xml` +
    actualiza `xl/workbook.xml` (sheets, sheetId, rId) + `xl/_rels/workbook.xml.rels`
    (rId nuevo apuntando a sheet9.xml) + `[Content_Types].xml`.
  - `inyectarHojaPortada(zip, metadata)` — agrega `xl/worksheets/sheet10.xml` con título,
    fecha de exportación, contrato, autor, hash del template; lo prependea como hoja 1
    en `xl/workbook.xml` (sheetId más bajo, primer item del array).
  - `recomprimirZip(zip)` → `Uint8Array`.
  - `generarXlsm(snapshot)` orquesta los 6 pasos y retorna el `Uint8Array` listo para descarga.
- `/assets/vendor/jszip.min.js` o CDN unpkg con SRI.
- Test E2E `tests/export_xlsm_e2e.test.js`:
  1. Carga template fixture.
  2. Genera con datos sintéticos (3 sumin, 5 trafos, 2 movs, 1 corrección).
  3. Re-parsea el output con `jszip` → verifica que `xl/vbaProject.bin` está presente y
     tiene **mismo SHA-256** que el del fuente (preservación byte-a-byte).
  4. Verifica `xl/webextensions/webextension1.xml` presente con string `claude.fileId`.
  5. Verifica que `xl/workbook.xml` lista 10 hojas con orden correcto.
  6. Verifica que `xl/charts/chart1.xml` y `chart2.xml` no se modificaron (SHA-256 igual al fuente).
  7. Re-parsea sheet2.xml con `xmldom` → verifica celdas H4:H25 contienen los stock_inicial
     esperados.
- Botón **"Exportar XLSM"** en `admin/suministros-historico.html` (F46) y opcionalmente
  en `admin/suministros-catalogo.html` (F43) — solo admin lo ve. Spinner durante generación
  (~3-5 s para 1000 movimientos).

**Patrón de referencia.** No hay precedente en el repo (es un mecanismo nuevo). Sí está
`assets/js/exports/xlsx.js` (SheetJS wrapper) que sirve para CSV pero no para preservar VBA.
La técnica JSZip+XML es el approach canónico documentado en la comunidad para este caso.

**Decisiones a confirmar (mini-gating).**
- ¿Si el test E2E #3 falla (VBA SHA-256 diverge) en alguna iteración del approach JSZip,
  saltamos a fallback Cloud Function Python con `openpyxl`? **Auto-asunción mejor manera:**
  sí. El fallback tiene presupuesto de +4 h en F49 (presupuesto total 8+4=12 h). El plan
  reserva la decisión de saltar al primer indicio binario divergente, no después de
  intentar parches superficiales.
- ¿La hoja Portada incluye el logo de la empresa? **Auto-asunción:** placeholder de texto
  con metadata; embed de imagen en XML excede el alcance de F49. Si el director quiere
  logo embebido, se itera post-tag.

**Anticipación de errores (lista detallada).**
1. **Reserialización destruye VBA:** confirmado en ExcelJS y SheetJS. El approach JSZip
   evita esto al no tocar nunca `xl/vbaProject.bin`.
2. **Parche del XML rompe `calcChain.xml`:** si añadimos celdas con fórmulas que no estaban
   antes, Excel se queja al abrir. Mitigación: las celdas de datos no tienen fórmulas
   (las fórmulas viven en columnas F y G de Sheet2 y son invariantes). `calcChain.xml`
   se deja sin tocar; Excel lo regenera al primer recálculo.
3. **`tblMovimientos` ref desactualizado:** si añadimos 50 filas pero el `ref` de la
   tabla en `xl/tables/table4.xml` sigue siendo `B4:Q5`, Excel muestra "tabla corrupta".
   Mitigación: actualizar `<table ref="B4:Q{N+4}">` en cada generación.
4. **Hojas nuevas (Correcciones, Portada) sin estilos:** si los XMLs nuevos no referencian
   `xl/styles.xml`, las celdas se ven sin formato. Mitigación: aplicar `s="0"` (style 0,
   default) o referenciar estilos existentes vía índice.
5. **`sharedStrings.xml`:** si añadimos textos nuevos (encabezados de Correcciones,
   "Portada · SGM TRANSPOWER", etc.), hay dos opciones: (a) usar `inline strings` en cada
   celda (`<is><t>...</t></is>` con `t="inlineStr"`), o (b) extender `sharedStrings.xml`.
   **Decisión:** (a) inline strings en hojas nuevas; cero modificación del shared strings.
6. **Office Add-in (`claude.fileId`):** vive en `xl/webextensions/webextension1.xml` y
   `xl/webextensions/_rels/taskpanes.xml.rels`. **Nunca tocarlos.**
7. **Encoding UTF-8:** los XMLs deben empezar con `<?xml version="1.0" encoding="UTF-8"
   standalone="yes"?>`. Cualquier acento (Cesar, Bolívar, Magdalena, Córdoba) requiere
   UTF-8 estricto en el writer JSZip (`compression: DEFLATE`).
8. **Archivos > 25 MB:** si el cliente exporta con 50000 movimientos, el zip supera el
   límite de cookies/headers de algunos browsers. Mitigación: streaming-friendly write
   con FileSaver.js o Blob URL — JSZip soporta `generateAsync({type: "blob"})`.
9. **Race condition en suscripciones:** generar mientras `suscribirStockGlobal` está activa
   puede leer un snapshot a medio camino. Mitigación: la función `generarXlsm` recibe
   un snapshot frozen como argumento (no se suscribe ella misma).
10. **Test E2E binario diff:** dos exports consecutivos con el mismo dataset deben producir
    `Uint8Array` idénticos byte-a-byte (determinismo). Mitigación: ordenar entries del zip
    alfabéticamente, usar timestamps fijos en compression, sin random IDs.

**Validación / criterio de cierre.**
- El test E2E `tests/export_xlsm_e2e.test.js` verde con todos los 7 sub-checks.
- Manual: exportar con datos reales, abrir en Excel desktop:
  - Las 3 macros del VBA (`ConfirmarMovimiento`, `AutoCompletarManual`, `ReiniciarStock`)
    se ven en ALT+F11 y ejecutan sin errores.
  - El add-in claude se carga (panel derecho).
  - Las gráficas Chart1 y Chart2 muestran datos actualizados.
  - Las fórmulas SUMIFS de Sheet2 recalculan stock_actual.
  - Las hojas Correcciones y Portada se ven con datos.

**Tests.** 1 test E2E con 7 sub-checks + manual.

**Commit msg.** `feat(suministros): F49 export XLSM 1:1 con template binario · JSZip + parche XML + tests E2E + botón UI`

**Estimación.** 8 h (path JSZip) + 4 h reserva si va a fallback Python = 8–12 h.

**Deploy condicional.** Solo si va a fallback: `firebase deploy --only functions:exportarSuministrosXlsm`.

---

#### F50 · Sidebar + nav + cache PWA + tag v2.2.0

**Objetivo.** Cierre del plan. Integrar los entry points nuevos al sidebar y home,
bumpear cache PWA, validación E2E final, tag `v2.2.0`.

**Entregables.**
- `assets/js/aqua-shell.js` — nuevo grupo **"Suministros"** entre "Salud del activo" y
  "Administración" con los items:
  - Stock (`pages/suministros-stock.html`) · icon `package`
  - Dashboard (`pages/suministros-dashboard.html`) · icon `bar-chart-3`
  - Catálogo admin (`admin/suministros-catalogo.html`) · icon `clipboard-list` · clase `sb-admin`
  - Marcas admin (`admin/suministros-marcas.html`) · icon `tag` · `sb-admin`
  - Movimientos admin (`admin/suministros-movimiento.html`) · icon `arrow-right-left` · `sb-admin`
  - Histórico admin (`admin/suministros-historico.html`) · icon `history` · `sb-admin`
  - Correcciones admin (`admin/suministros-correcciones.html`) · icon `file-edit` · `sb-admin`
  - Importar admin (`admin/importar-suministros.html`) · icon `file-up` · `sb-admin`
- `home.html` — KPI card adicional **"Stock crítico"** que cuenta items con estado
  `CRITICO` o `AGOTADO`. Realtime via `suscribirStockGlobal`.
- `sw.js` — bump `CACHE_VERSION` de `sgm-v3-1-0` a `sgm-v3-2-0`. Añadir las 8 rutas
  nuevas + `/assets/templates/Gestion_Suministros_Transformadores-2.xlsm` al array `SHELL`.
- `CHANGELOG.md` — entrada `v2.2.0` con summary de F38–F50.
- `CLAUDE.md` §5 — añadir bloque "Evolución v2.2 · Suministros (F38–F50)" con la tabla
  de microfases. §7 — actualizar tabla de progreso, último tag, sistema activo.
- `docs/PLAN-SUMINISTROS.md` — marcar como **completado** con fecha de cierre.

**Validación E2E manual.**
1. Login admin → ver grupo "Suministros" en sidebar.
2. Importar (F42) datos desde el repo → verificar 22 sumin + 22 marcas + 206 trafos +
   3 correcciones + 1 entrada de audit `bulk_import_suministros`.
3. Crear movimiento INGRESO (F45) → ver en histórico (F46) en realtime.
4. Public dashboard (F47) muestra stock recalculado en otra pestaña.
5. Export XLSM (F49) → abrir en Excel → 3 macros VBA ejecutan + add-in carga + 2 charts
   + 10 hojas + Correcciones poblada + Portada con metadata correcta.
6. Logout y login como `tecnico` → ve "Suministros · Stock" y "Dashboard"; NO ve los 6 items
   admin.

**Patrón de referencia.** F37 cierre del plan v2.0 (tag + CHANGELOG + actualización CLAUDE.md).

**Anticipación de errores.**
- **Cache PWA stale:** si no se bumpea `CACHE_VERSION`, los clientes con sw.js antiguo
  no ven los HTML nuevos hasta hard reload. **Crítico no olvidar.**
- **Orden del grupo en sidebar:** "Suministros" debe ir entre "Salud del activo" y
  "Administración" (decisión visual). Verificar con captura antes del tag.
- **Visibilidad por rol:** `aqua-shell.js` lee `window.__sgmSession.role` y oculta los
  `sb-admin` a no-admins. Validar con dos sesiones.
- **Migración doble:** F50 NO ejecuta `v1-to-v2-transformadores-add-repuesto`; ese
  backfill ya lo hizo F42. Confirmar que `npm test` pasa sin necesitar nuevo run.

**Tests.** Sin tests automatizados nuevos (manual E2E). Total acumulado del plan:
~109 tests nuevos sobre los 282 actuales = ~391 tests verdes.

**Commit msg.** `chore(suministros): F50 sidebar + nav + PWA cache bump + tag v2.2.0`

**Tag.** `git tag -a v2.2.0 -m "Integración Suministros + Repuestos · 13 microfases F38-F50"`

**Estimación.** 2 h.

**Sin deploy** (merge a main → Pages auto-redeploy).

---

**Resumen Bloque E:**
- 2 microfases · 2 commits aislados.
- Tests E2E del export + manual de cierre.
- 0–1 deploys (solo si F49 va a fallback Python).
- Tiempo estimado: 10–14 h efectivas.

---

## §5 Riesgos consolidados

| # | Riesgo | Probabilidad | Impacto | Fase | Mitigación |
|---|---|---|---|---|---|
| R1 | ExcelJS/SheetJS destruyen el VBA al guardar | **Alta** (confirmado por docs) | Crítico (decisión 4·A no se cumple) | F49 | Approach JSZip + parche XML; jamás se reescribe `vbaProject.bin`. Test E2E #3 verifica SHA-256 byte-a-byte. Fallback Python con presupuesto reservado. |
| R2 | Race condition en correlativo de movimientos | Media | Alto (códigos colisionan) | F39 | `runTransaction` lee y escribe correlativo en el mismo batch. Test simula 10 inserts paralelos. |
| R3 | Stock negativo no detectado | Baja | Alto (datos inconsistentes) | F39 | Tx valida `stock_actual >= 0` antes de escribir. Flag `permitirNegativo=false` por defecto. |
| R4 | Importador F42 duplica docs en re-ejecución | Baja | Medio | F42 | Idempotencia por `codigo` (suministro) y `matricula` (trafo). Test re-ejecuta 2 veces y verifica `crear:0`. |
| R5 | `marcas_disponibles[]` desincronizada por updates concurrentes | Media | Medio (chips faltantes en UI) | F44 | Usar `arrayUnion` en lugar de overwrite. Probar con dos pestañas. |
| R6 | Datalist con 200+ trafos lento en mobile | Baja | Bajo (lag de input) | F45 | Datalist nativo es eficiente; si reporta lag, iterar a virtual scroll en F50. |
| R7 | Cache PWA stale en F50 oculta cambios al usuario | Media | Alto (director no ve nada nuevo) | F50 | Bump explícito `CACHE_VERSION`. Documentar en commit que es obligatorio. |
| R8 | Reglas Firestore desplegadas antes de índices fallan queries | Media | Alto (página rota en prod) | F40 | Orden estricto en aviso de deploy: índices → esperar build → rules. |
| R9 | Backfill `repuesto.estado` reescribe trafos con datos divergentes | Baja | Medio | F42 | Sanitizer F41 normaliza `null` → `'N/A'` antes de escribir; preserva resto del doc intacto. |
| R10 | `parsearJsxTransformadores` con `eval` introduce XSS | Eliminado | Crítico | F42 | Estrategia documentada: regex extraction + `JSON.parse`. Cero `eval`/`Function`. |
| R11 | Concurrent imports duplican audit entries | Baja | Bajo (audit log con dos rows) | F42 | Aceptable; los docs operativos quedan consistentes. |
| R12 | Director sube nueva versión del .xlsm/.jsx mid-plan | Media | Alto (plan obsoleto) | Todo | Sufijo de versión obligatorio (`-v3`); abrir sub-plan. Documentado en §0. |
| R13 | Test E2E del export determinista falla por timestamps en zip | Alta sin mitigación | Bajo (CI rojo intermitente) | F49 | Forzar timestamps fijos al generar zip; ordenar entries alfabéticamente. |
| R14 | Cloud Function fallback agrega dependencia Python | Si se activa | Medio (deploy nuevo) | F49 | Decisión documentada con golden master diff. Path A (JSZip) tiene 90% probabilidad de éxito. |
| R15 | Decisión 1·C (10 hojas) confunde al auditor que esperaba 8 | Baja | Bajo | F49 | Hoja Portada explica el origen de las 2 hojas extra; hoja Correcciones es estándar del skill. |

**Bloqueantes técnicos sin mitigación:** ninguno. Cada riesgo tiene mitigación documentada
o fallback aceptable.

---

## §6 Estimación total

| Bloque | Microfases | Tests nuevos | Tiempo efectivo | Deploys |
|---|---|---|---|---|
| **A — Cimientos** | F38 · F39 · F40 · F41 | ~73 | 7 h | 1 (rules + índices) |
| **B — Importador** | F42 | 18 | 4 h | 0 |
| **C — Admin UI** | F43 · F44 · F45 · F46 | 12 | 12 h | 0 |
| **D — Public UI** | F47 · F48 | 6 | 6.5 h | 0 |
| **E — Export & cierre** | F49 · F50 | E2E + manual | 10–14 h | 0–1 (fallback) |
| **TOTAL** | **13** | **~109** | **39.5–43.5 h** | **1–2** |

**Tests verdes esperados al cierre:** 282 + 109 = **~391**.

**Tag final:** `v2.2.0`.

**Cadencia recomendada:** una microfase por sesión chat para evitar timeouts y permitir
revisión por el director antes de avanzar. Cada cierre de fase = commit aislado + push
inline + screenshot opcional para evidencia visual.

---

## §7 Anti-patrones (cosas que NO se harán durante la ejecución)

Lista derivada del skill `asset-tracking-system` y de las convenciones del repo. Cada
anti-patrón está documentado para que el director pueda llamarme la atención si lo viola.

1. **Cero datos inventados.** Si una matrícula del JSX trae `re:null`, va como `'N/A'`,
   no como `'OPERATIVA'` por defecto. Si una fecha no está en el .xlsm, se muestra `—`,
   no se interpola. Si una marca está vacía, se muestra `Por definir`, no se adivina vendor.

2. **Cero `eval` en parser del JSX.** El array `TRANSFORMADORES` se extrae con regex y se
   parsea con `JSON.parse` tras quoting fix. Nunca `Function('return ' + str)()`.

3. **Cero re-importación silenciosa.** Cada ejecución de F42 con `dryRun=false` deja
   evidencia en `/auditoria` con metadata granular. Si el director re-importa, ve dos
   entries y puede comparar.

4. **Cero modificación de `vbaProject.bin`.** El binario VBA del template solo se mueve
   dentro del zip; nunca se reescribe ni se intenta regenerar.

5. **Cero modificación del Office Add-in.** `webextensions/webextension1.xml` y su
   `_rels/taskpanes.xml.rels` se mueven con el zip; el `claude.fileId` queda intacto.

6. **Cero cambios de schema sin dual-write.** F41 introduce `repuesto` como sub-section
   y como flat `re` simultáneamente. Las vistas legacy siguen funcionando.

7. **Cero deploy automático de rules antes de índices.** El aviso de deploy en F40 lista
   el orden estricto. Romper el orden = páginas vivas con `FAILED_PRECONDITION`.

8. **Cero delete masivo en F42.** Trafos huérfanos en Firestore se reportan en summary,
   no se eliminan. La limpieza requiere sub-paso explícito con confirmación.

9. **Cero confirmación implícita.** Antes de transformar datos fuente (renombrar columnas,
   ocultar items con stock=0, consolidar duplicados), preguntar al director con 2–4
   opciones concretas. Las decisiones de §3 ya cubren las 7 transformaciones macro;
   cualquier transformación nueva detectada durante la ejecución abre mini-gating.

10. **Cero comentarios decorativos.** Convención del repo (CLAUDE.md): código sin
    comentarios salvo cuando el WHY no sea obvio. No "// método que crea suministro" sobre
    `crear()`. Sí "// stock_actual snapshot al momento del movimiento, no se actualiza
    aunque cambie el catálogo después" sobre la línea relevante en F39.

11. **Cero scope creep.** El plan tiene 13 microfases; una feature nueva (ej. notificaciones
    email cuando stock crítico) abre un sub-plan post-v2.2.0, no se mete dentro de las
    fases existentes.

12. **Cero override de `localStorage` heredado del JSX.** El JSX persistía en
    `ctrl_suministros_trafos_v6`. La integración a Firestore deja ese localStorage huérfano
    (los datos viven en Firestore desde F42). No se lee ni se escribe el localStorage; el
    director puede limpiarlo manualmente si quiere.

---

## Cierre del plan

Plan v2.2 completo desde §0 hasta §7. Listo para tu aprobación final.

**Aprobación esperada:**
- Plan completo: ✅/❌
- Auto-asunciones de §3: ✅/❌ (15 auto-asunciones distribuidas entre las fases)
- Decisión sobre fallback Python en F49 si VBA SHA-256 diverge: ✅/❌
- Cadencia "una microfase por sesión chat": ✅/❌

Una vez aprobado, F38 arranca con un mensaje del director explícito: `"ejecuta F38"`.
El plan no se ejecuta solo.

---

> **Versión del plan:** P5c · 2026-04-25 · `claude/fix-menu-colors-AJek5`
> **Tags previstos durante ejecución:** ninguno hasta `v2.2.0` al cierre de F50.
