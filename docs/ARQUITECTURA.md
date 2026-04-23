# Arquitectura del código — SGM · TRANSPOWER v2.0.8

Mapa de navegación del repositorio. Pensado para que una sesión
nueva de Claude (o un desarrollador) encuentre rápido lo que
necesita sin explorar a ciegas.

## 1. Vista general

```
┌──────────────────────────────────────────────────────┐
│  Frontend estático (GitHub Pages)                    │
│                                                      │
│  index.html (login)  →  home.html  →  pages/*.html   │
│                      ↘                               │
│                       admin/*.html (15 módulos)      │
│                                                      │
│  Carga SDK Firebase vía CDN (assets/js/firebase-*)   │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  Firestore (southamerica-east1)                      │
│                                                      │
│  transformadores · subestaciones · muestras ·        │
│  ordenes · documentos · usuarios · contratos ·       │
│  subactividades · macroactividades · causantes ·     │
│  fallados · contramuestras · monitoreo_intensivo ·   │
│  propuestas_reclasificacion_fur · umbrales_salud ·   │
│  parametros_sistema · alertas_config · alertas_      │
│  reconocidas · importaciones · auditoria             │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  Cloud Functions v2 (southamerica-east1)             │
│                                                      │
│  onMuestraCreate   — recalcula salud_actual (F18)    │
│  cronAlertasDiarias — email Resend 07:00 Bogotá      │
└──────────────────────────────────────────────────────┘
```

## 2. Capas del código

Arquitectura en 3 capas **verticales**: dominio puro (testeable
sin Firebase) → data layer (I/O con Firestore / Storage) → UI
(HTML/JS por página).

### 2.1 Dominio puro · `assets/js/domain/`

Módulos ESM sin dependencias de Firebase. Cada uno es importable
desde Node para tests y desde el navegador para lógica en vivo.

| Módulo | Propósito |
|---|---|
| `schema.js` | Enums canónicos (TIPOS_ACTIVO · ZONAS · GRUPOS · DEPARTAMENTOS · ESTADOS · CONDICIONES · BUCKETS_HI · PESOS_HI Tabla 10 · UUCC CREG 085 · ROLES F28 · NORMATIVAS). |
| `transformador_schema.js` | Sanitizador + validador del shape v2 (secciones + salud_actual + criticidad + restricciones_operativas) + proyección v1 para retrocompat. |
| `subestacion_schema.js` | Sanitizador/validador entidad FK F20. |
| `muestra_schema.js` | Shape muestras DGA/ADFQ/FUR con validación §A9.6 (contexto obligatorio si TDGC>201 o C₂H₂≥5). |
| `contrato_schema.js` | Sanitizador F21 + enum ALIADOS + ESTADOS_CONTRATO. |
| `orden_schema.js` | Workflow de 11 estados + sanitizador v2 + `transicionValida`. |
| `fallados_schema.js` | RCA 3 métodos (5 Porqués · Ishikawa · FMEA) + `calcularRPN` + `nivelRiesgoRPN`. |
| **`salud_activos.js`** | **Motor HI oficial F18.** 7 calificadores (TDGC/C2H2/RD/IC/FUR/CRG/EDAD/HER/PYT) + `calcularHIBruto` (Tabla 10) + `aplicarOverrides` + `snapshotSaludCompleto`. |
| `dga_diagnostico.js` | Duval Triangle 1 (IEC 60599) + Rogers + Doernenburg + alerta arco D2. |
| `sobrecarga_admisible.js` | IEEE C57.91 §7 + Arrhenius FAA + `proponerPlanMitigacionSobrecarga`. |
| `monitoreo_intensivo.js` | §A9.1: velocidad C₂H₂ + `evaluarOverrideC2H2` R1/R2/R3 + batería ETU. |
| `juicio_experto_fur.js` | §A9.2: propuesta FUR ≥ 4 + 3 decisiones expertas + `puedeAbrirOrden`. |
| `umbrales_salud_baseline.js` | Baselines MO.00418 + `mergeConBaseline`. |
| `catalogos_baseline.js` | Seed §A7: 31 subactividades + 7 macroactividades + 12 causantes. |
| `tpt_respaldo.js` | F24: `evaluarActivacionRespaldo` + `seleccionarRespaldoOptimo`. |
| `matriz_riesgo.js` | F36: `calcularRangosCriticidad` + `colorCelda` + matriz 5×5. |
| `estrategias.js` | F37: `estrategiaPorCondicion` + `generarPropuestaOrden` + `detectarCausantePrincipal`. |
| `rbac.js` | F28: `PERMISOS` + `tienePermiso` con ámbito zonas/contratos + `filtrarPorZona`. |
| `workflow.js` | F29: `puedeTransicionar` con matriz de permisos por rol + `puedeAbrirOrden` integra §A9.2 y §A9.3. |
| `plan_inversion.js` | F30: `scorePI` multicriterio + `rankearPlanInversion` + `clasificarPropuestas`. |
| `desempeno_aliados.js` | F33: `calcularDesempenoAliado` (score 0-100) + `rankingAliados`. |
| `audit.js` | F35: `auditar` + `diffSimple` + **`persistirAuditoria(deps, entry)`** best-effort reutilizable. |
| `importador.js` | F17: `parsearFilaTransformador` con recálculo HI + `procesarLibro`. |

### 2.2 Data layer · `assets/js/data/`

Wrappers CRUD/realtime sobre Firestore. Cada módulo importa el
SDK Firebase via CDN y delega la sanitización/validación al
dominio puro.

| Módulo | Colección(es) |
|---|---|
| `transformadores.js` | `/transformadores` (+ subcolecciones en `transformadores_subcolecciones.js`). Audit cableado. |
| `subestaciones.js` | `/subestaciones` (F20). |
| `transformadores_subcolecciones.js` | `/transformadores/{id}/placas_historicas` + `historial_hi` (append-only). |
| `ordenes.js` | `/ordenes` + subcolección `historial`. Audit + workflow `transicionValida`. |
| `documentos.js` | `/documentos` + Storage `documentos/{id}/{filename}`. Audit cableado. |
| `usuarios.js` | `/usuarios/{uid}`. 7 roles F28. Audit cableado. |
| `alertas.js` | `/alertas_config/global` + `/alertas_reconocidas`. Motor de 12 tipos (7 v1 + 5 v2). |
| `kpis.js` | Agregador puro sobre transformadores + ordenes. `computeFromDatasets` incluye bloque `saludV2`. |
| `muestras.js` | `/muestras` + pre-cálculo de calificaciones al escribir. |
| `contratos.js` | `/contratos` (F21). |
| `catalogos.js` | `/subactividades` + `/macroactividades` + `/causantes` + `seedCatalogos`. |
| `fallados.js` | `/fallados` (F25) con validación FMEA. |
| `monitoreo_fur.js` | `/contramuestras` + `/monitoreo_intensivo` + `/propuestas_reclasificacion_fur`. Audit cableado en `resolverPropuestaFUR`. |
| `umbrales_salud.js` | `/umbrales_salud/global` + subcolección `historial`. Audit cableado. |
| `parametros_criticidad.js` | `/parametros_sistema/criticidad` (F36 tope dinámico). |
| `auditoria.js` | `/auditoria` — read-only con filtros. |
| `importar.js` | `persistirImportacion` idempotente por código + log en `/importaciones`. Audit cableado. |

### 2.3 UIs

#### Admin (`admin/*.html` + `assets/js/admin/*.js`)

15 páginas. Estructura común: topbar + main-nav + página
con modal CRUD. Todas usan `auth-guard.js` para gate por rol.

| Página | Data layer | Fase |
|---|---|---|
| `index.html` | — (landing panel) | — |
| `inventario.html` + `admin-inventario.js` | transformadores | F6 + v2.0.3 |
| `ordenes.html` + `admin-ordenes.js` | ordenes | F7 + v2.0.3 |
| `kpis.html` + `admin-kpis.js` | kpis | F8 + v2.0.5 |
| `documentos.html` + `admin-documentos.js` | documentos | F9 |
| `mapa.html` + `admin-mapa.js` | transformadores (Leaflet) | F10 |
| `alertas.html` + `admin-alertas.js` | alertas | F11 + v2 extension |
| `usuarios.html` + `admin-usuarios.js` | usuarios | F14 + F28 |
| `muestras.html` | muestras | F19 |
| `subestaciones.html` | subestaciones | F20 |
| `contratos.html` | contratos | F21 |
| `catalogos.html` | catalogos | F22 |
| `motor-salud.html` | domain/salud_activos (sandbox sin I/O) | F18 |
| `umbrales-salud.html` | umbrales_salud | F18 |
| `importar.html` | importar (SheetJS CDN) | F17 |
| `propuestas-fur.html` | monitoreo_fur | F26 + v2.0.1 |
| `plan-inversion.html` | transformadores + plan_inversion | F30 + v2.0.1 |
| `desempeno-aliados.html` | ordenes + desempeno_aliados | F33 + v2.0.1 |
| `fallados.html` | fallados | F25 + v2.0.2 |
| `contramuestras.html` | monitoreo_fur (contramuestras) | F26 + v2.0.2 |
| `auditoria.html` | auditoria | F35 + v2.0.2 |
| `demo-seed.html` | pobla TX-DEMO-* | v2.0.8 |

#### Públicas (`pages/*.html`)

13 páginas protegidas por login. `dashboard.html` y
`matriz-riesgo.html` son las vistas operativas v2 principales.

## 3. Rules y validación

- **`firestore.rules`** — helpers por rol (`isSignedIn`, `hasProfile`,
  `isTeamMember`, `isAdmin`) + helpers de enum v2
  (`isTipoActivoValido`, `isZonaValida`, etc.). Cada colección
  tiene `allow create/update` con validación server-side de
  campos obligatorios y enums.
- **`storage.rules`** — `documentos/**` lectura pública filtrada
  por gate, escritura admin con límite 20 MB.
- **`firestore.indexes.json`** — 20+ índices compuestos incluyendo
  `ubicacion.zona+codigo`, `identificacion.tipo_activo+hi_final`,
  `estado_v2+codigo`, `contratoId+codigo`, `trigger+ts_calculo` (collection group `historial_hi`).

## 4. Tests

Ubicación: `tests/*.test.js`. Runner: `node --test` (sin deps).

```bash
npm run test:unit   # solo unit tests
npm test            # lint HTML + tests
```

**Clasificación de los 282 tests (81 suites):**

- Schema v2 + UUCC CREG: `schema.test.js`
- Sanitizadores: `transformador_schema.test.js` · `subestacion_schema.test.js`
- Migración v1→v2: `migracion_v1_v2.test.js`
- Motor de Salud: `salud_activos.test.js` (bordes oficiales + overrides)
- Diagnóstico DGA: `dga_diagnostico.test.js`
- Sobrecarga IEEE C57.91: `sobrecarga_admisible.test.js`
- A9.1 + A9.2: `monitoreo_intensivo.test.js`
- Umbrales: `umbrales_baseline.test.js`
- Importador: `importador.test.js`
- Muestras: `muestra_schema.test.js`
- Contratos + Catálogos: `catalogos_contratos.test.js`
- Órdenes v2: `orden_schema.test.js`
- Fallados + TPT/Respaldo: `fallados_tpt.test.js`
- Matriz + Estrategias: `matriz_estrategias.test.js`
- RBAC + Workflow + PI: `rbac_workflow_pi.test.js`
- Exports + Desempeño + Audit: `exports_desempeno_audit.test.js`
- KPIs v2: `kpis_v2.test.js`
- Handler onMuestraCreate: `onmuestra_handler.test.js`
- E2E chain: `integracion_e2e.test.js`
- Audit persistir: `audit_persistir.test.js`

## 5. Convenciones

- **ESM nativo** — `"type": "module"` en `package.json`. No hay build.
- **CDN para dependencias** — Firebase SDK, Chart.js, Leaflet, SheetJS,
  jsPDF se cargan por `<script>` o `import` dinámico.
- **Node ≥ 20** — requerido por tests (`node --test` con describe).
- **Sin backend** — todo corre en el navegador excepto Cloud Functions
  (F32) que son opcionales.
- **Proyección v1** — cada doc v2 (transformadores, ordenes) guarda
  campos v1 aplanados en el nivel raíz para que consultas legacy
  sigan funcionando. Retirar cuando todas las vistas migren.

## 6. Cómo buscar algo

- **Un cálculo o fórmula** → `assets/js/domain/` (siempre puro).
- **Un CRUD a Firestore** → `assets/js/data/`.
- **Una pantalla admin** → `admin/*.html`.
- **Un enum o constante** → `domain/schema.js`.
- **El workflow de estados** → `domain/orden_schema.js` + `domain/workflow.js`.
- **La matriz 5×5** → `domain/matriz_riesgo.js` + `pages/matriz-riesgo.html`.
- **El HI y sus overrides** → `domain/salud_activos.js` (→ `aplicarOverrides`).
- **Las rules o índices** → raíz del repo.
- **El historial oficial** → `CHANGELOG.md` + `CLAUDE.md` §5.
