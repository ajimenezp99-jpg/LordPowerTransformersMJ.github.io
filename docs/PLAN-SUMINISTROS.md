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

> **Continúa en P3:** Bloque A (F38–F41 cimientos) — dominio puro, data layer, rules,
> sub-section `repuesto`. Estimado 4 fases, 1 deploy manual de rules+índices.
