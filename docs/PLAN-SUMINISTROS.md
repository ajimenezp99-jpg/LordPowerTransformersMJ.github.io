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

> **Continúa en P4:** Bloque B (F42 importador) + Bloque C (F43–F46 admin UI). Estimado
> 5 fases, sin deploy adicional (las funciones se llaman desde la UI; los datos viajan por
> las rules ya desplegadas).
