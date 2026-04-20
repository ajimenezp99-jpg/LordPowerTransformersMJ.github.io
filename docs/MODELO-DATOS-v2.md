# Modelo de datos v2 — SGM · TRANSPOWER

**Fase:** 16 (refactor de modelo base)
**Referencia normativa:** MO.00418.DE-GAC-AX.01 Ed. 02 (14/10/2025) — CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM
**Alcance:** documento maestro de estructura de datos que adopta la metodología oficial de Salud de Activos (Health Index ponderado). Sobrescribe el shape plano v1 introducido en F6.

---

## 1. Diagrama ER (resumen)

```
                       ┌──────────────────┐
                       │  /subestaciones  │
                       │──────────────────│
                       │ codigo (PK)      │
                       │ nombre           │
                       │ departamento     │
                       │ zona             │
                       │ nivel_tension_kv │
                       │ lat / lng        │
                       └────────┬─────────┘
                                │ 1
                                │
                                │ ∞
                       ┌────────▼──────────────────────────────────┐
                       │  /transformadores                         │
                       │───────────────────────────────────────────│
                       │ schema_version = 2                        │
                       │ estado_servicio (enum)                    │
                       │ estados_especiales[] (A9.3)               │
                       │                                           │
                       │ identificacion {                          │
                       │   codigo (PK natural), matricula,         │
                       │   nombre, tipo_activo (POTENCIA│TPT│      │
                       │   RESPALDO), uucc (CREG), grupo (G1/2/3)  │
                       │ }                                         │
                       │ placa { marca, modelo, serial,            │
                       │         potencia_{kva,onan,onaf,ofaf} }   │
                       │ ubicacion { depto, municipio, zona,       │
                       │   subestacionId (FK), direccion, lat/lng }│
                       │ electrico { tensiones, corrientes,        │
                       │   grupo_conexion, impedancia_cc, tap }    │
                       │ mecanico { pesos, volumen_aceite,         │
                       │   tipo_tanque, bushings_tipo }            │
                       │ refrigeracion { tipo, #rad, #vent, #bomb }│
                       │ protecciones { relés, DPS, SCADA }        │
                       │ fabricacion { ano, fecha, pais }          │
                       │ servicio { fecha_instalacion, fecha_ener, │
                       │   horas_operacion, usuarios_aguas_abajo } │
                       │                                           │
                       │ salud_actual { … HI + calificaciones }    │
                       │ criticidad { usuarios, nivel, ts }        │
                       │ restricciones_operativas (OTC, A9.3)      │
                       └───┬─────────────────┬─────────────────────┘
                           │ 1               │ 1
                           │                 │
                           ▼ ∞               ▼ ∞
           /placas_historicas        /historial_hi
           (append-only)             (append-only)
           tipo_cambio, campo,       trigger, califs,
           valor_anterior/nuevo,     hi_bruto/final,
           razon, orden_ref          bucket, overrides,
                                     ts_calculo
```

### Entidades relacionadas (fuera de F16)

- `/muestras` — time-series DGA/ADFQ/FUR (F19).
- `/ordenes` — órdenes de trabajo (F7, se refactoriza en F23).
- `/documentos` — gestión documental (F9).
- `/alertas_*` — reglas cliente-side (F11, ampliado en F26).
- `/umbrales_salud/global` — umbrales editables del motor de salud (F18).
- `/parametros_sistema/criticidad` — rangos de criticidad (F36).
- `/contratos` — 8 contratos macro (F21).

---

## 2. Diccionario de campos — `/transformadores/{id}`

### 2.1 Campos raíz

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| `schema_version` | number (2) | ✅ | Marca de migración. Rechaza writes v1. |
| `estado_servicio` | enum | ✅ | `operativo \| mantenimiento \| fuera_servicio \| retirado \| fallado` |
| `estados_especiales` | string[] | — | Banderas de A9.3 (ver 2.2). |
| `restricciones_operativas` | object \| null | — | Sólo cuando `estados_especiales` incluye `operacion_temporal_controlada`. |
| `createdAt` / `updatedAt` | Timestamp | auto | `serverTimestamp()`. |
| `createdBy` | string (uid) | auto | Se fija solo en create. |

### 2.2 Estados especiales (MO.00418 §4.1 Notas Técnicas, §A9)

| Valor | Descripción | Referencia |
|---|---|---|
| `monitoreo_intensivo_c2h2` | Régimen semanal/quincenal de DGA. | §A9.1 |
| `propuesta_fur_pendiente` | Esperando juicio experto del Profesional de Tx. | §A9.2 |
| `operacion_temporal_controlada` | Restricciones de carga / temp / muestreo post-FUR. | §A9.3 |
| `pendiente_reemplazo` | Autorizado para PI. | §4.3 C5 |
| `reemplazado` | Histórico (no-elegible para órdenes nuevas). | — |
| `fin_vida_util_papel` | Bandera permanente tras FUR ≥ 4 aprobado. | §4.1.2 |

### 2.3 `identificacion`

| Campo | Tipo | Notas |
|---|---|---|
| `codigo` | string | Clave natural uppercased. Único (índice). |
| `matricula` | string | Alias operativo. |
| `nombre` | string | Display humano. |
| `tipo_activo` | enum | `POTENCIA \| TPT \| RESPALDO`. |
| `uucc` | string | CREG 085/2018. Patrón `^N[345]T[0-9]{1,2}$`. N4T1–N4T19 y N5T1–N5T25 son reguladas (vida útil 30 años); el resto se acepta en el catálogo pero no goza del beneficio regulatorio. |
| `grupo` | enum | `G1 \| G2 \| G3` (plan de mantenimiento). |

### 2.4 `placa`

| Campo | Tipo | Notas |
|---|---|---|
| `marca`, `modelo`, `serial`, `norma_fabricacion`, `numero_fabrica` | string | Placa física. |
| `potencia_kva` | number | Nominal. |
| `potencia_onan_kva` / `potencia_onaf_kva` / `potencia_ofaf_kva` | number | Etapas de enfriamiento. Opcionales. |

### 2.5 `ubicacion`

| Campo | Tipo | Notas |
|---|---|---|
| `departamento` | enum | `bolivar \| cordoba \| sucre \| cesar \| magdalena`. |
| `municipio` | string | Libre. |
| `zona` | enum | `BOLIVAR \| ORIENTE \| OCCIDENTE`. Se infiere desde `departamento` en la migración. |
| `subestacionId` | string (FK) | Apunta a `/subestaciones/{id}`. |
| `subestacion_nombre` | string | Denormalizado para vistas v1. Alias del v1: `subestacion`. |
| `direccion` | string | Libre. |
| `latitud` / `longitud` | number | Validado en rango. |

### 2.6 `electrico`

| Campo | Tipo | Notas |
|---|---|---|
| `tension_{primaria,secundaria,terciaria}_kv` | number | kV nominales. |
| `corriente_nominal_{primaria,secundaria,terciaria}_a` | number | A nominales. Requeridos por CRG (§4.1.4). |
| `grupo_conexion` | string | Ej. `Dyn11`. |
| `impedancia_cc_pct` | number | Impedancia de cortocircuito. |
| `tap_cambiador`, `tap_actual`, `tipo_tap` | mix | `tipo_tap ∈ {OLTC, NLTC, FIJO}`. |

### 2.7 `mecanico`, `refrigeracion`, `protecciones`, `fabricacion`, `servicio`

Secciones descriptivas. Ver sanitizador `transformador_schema.js` para los campos exactos. Todos los campos son opcionales; el validador sólo exige `identificacion.codigo`, `identificacion.nombre`, `ubicacion.departamento` y `estado_servicio`.

`servicio.usuarios_aguas_abajo` alimenta el cálculo de criticidad (F36).

### 2.8 `salud_actual` (snapshot derivado, escrito por F18)

Bloque maestro del Health Index. Reservado en F16; poblado por el motor en F18. Se actualiza vía Cloud Function `onMuestraCreate` (F19) y vía recálculo masivo al cambiar `/umbrales_salud/global`.

| Campo | Tipo | Origen | Referencia |
|---|---|---|---|
| `ts_calculo` | string ISO | Motor F18 | — |
| `muestra_{dga,adfq,fur}_ref` | string | FK muestra | F19 |
| `calif_tdgc` | int 1–5 | TDGC = H₂+CH₄+C₂H₄+C₂H₆ | §A3.1 (a) |
| `calif_co` / `calif_co2` | int 1–5 | Gases de papel | §A3.1 (b) |
| `calif_c2h2` | int 1–5 | Acetileno | §A3.1 (c) |
| `eval_dga` | float 1–5 | MAX(TDGC, C2H2) | §A3.1 (d) |
| `calif_rd` | int 1–5 | Rigidez dieléctrica | §A3.2 (a) |
| `calif_ic` | int 1–5 | IC = TI/NN | §A3.2 (b) |
| `eval_adfq` | float 1–5 | Media(RD, IC) | §A3.2 (c) |
| `calif_fur` | int 1–5 | 2FAL ppb | §A3.3 |
| `dp_estimado` | number | Curva de Chedong | §A3.3 |
| `vida_utilizada_pct` | number | Chedong | §A3.3 |
| `vida_remanente_pct` | number | 100 − vida_utilizada | §A3.3 |
| `calif_crg` | int 1–5 | MAX(CP/AP, CS/AS, CT/AT) | §A3.4 |
| `crg_pct_medido` | number | % cargabilidad | §A3.4 |
| `calif_edad` | int 1–5 | año_fab → hoy | §A3.5 (CREG 085/2018) |
| `edad_anos` | number | Calculada | §A3.5 |
| `calif_her` | int 1–5 | Por ubicación dominante | §A3.6 |
| `ubicacion_fuga_dominante` | enum | `sin_fugas \| laterales \| junction_block \| accesorios \| superiores` | §A3.6 |
| `calif_pyt` | int 1–5 | Evaluación PyT | §A3.7 |
| `hi_bruto` | float 1–5 | 0.35·DGA+0.30·EDAD+0.15·ADFQ+0.05·(FUR+CRG+PYT+HER) | §A4 |
| `hi_final` | float 1–5 | hi_bruto tras overrides | §A5 |
| `bucket` | enum | `muy_bueno \| bueno \| medio \| pobre \| muy_pobre` | §A4 / §A9.7 |
| `overrides_aplicados` | string[] | Audit trail de §A5/A9.1 | — |
| `fin_vida_util_papel` | bool | Bandera permanente FUR ≥ 4 aprobado | §A9.2 |

### 2.9 `criticidad` (snapshot derivado, escrito por F36)

| Campo | Tipo | Notas |
|---|---|---|
| `usuarios_aguas_abajo` | number | Copia denormalizada de `servicio.usuarios_aguas_abajo`. |
| `nivel` | enum | `minima \| menor \| moderada \| mayor \| maxima`. §A9.9. |
| `ts_calculo` | string | Recalculado al editar `/parametros_sistema/criticidad`. |

### 2.10 `restricciones_operativas` (OTC, §A9.3)

Objeto NULL salvo que el activo esté en `operacion_temporal_controlada`. Campos: `cargabilidad_max_pct`, `temperatura_aceite_max_c`, `frecuencia_muestreo_{dga,fur}_dias`, `requiere_inspeccion_ocular_dias`, `autorizado_por`, `fecha_inicio`, `fecha_fin_prevista`, `motivo`, `notas`.

F16 reserva el shape; F29 implementa validación y workflow.

---

## 3. Subcolecciones

### 3.1 `/transformadores/{id}/placas_historicas/{evt}` (append-only)

Trazabilidad regulatoria de retrofits (potencia, tensión, refrigeración, tap, otro). Campos: `tipo_cambio`, `campo`, `valor_anterior`, `valor_nuevo`, `razon`, `autorizado_por`, `orden_ref`, `nota`, `ts_cambio`, `createdBy`. Rules: `update: false`, `delete: false`.

### 3.2 `/transformadores/{id}/historial_hi/{calc}` (append-only)

Snapshots históricos del HI. Cada entrada registra el resultado de una re-evaluación y su trigger: `muestra_nueva`, `parametros_actualizados`, `migracion_v2`, `manual`, `override_experto`, `recalculo_masivo`. Campos: calificaciones por variable, `hi_bruto`, `hi_final`, `bucket`, `overrides_aplicados[]`, `muestra_origen_ref`, `ts_calculo`, `createdBy`.

---

## 4. Retrocompatibilidad v1 ↔ v2

Los documentos v2 llevan **proyección v1 aplanada** al nivel raíz (`codigo`, `nombre`, `departamento`, `municipio`, `subestacion`, `potencia_kva`, `tension_primaria_kv`, `tension_secundaria_kv`, `marca`, `modelo`, `serial`, `fecha_fabricacion`, `fecha_instalacion`, `estado`, `latitud`, `longitud`, `observaciones`).

La proyección:

- Se genera automáticamente por `proyeccionV1(docV2)` en cada `crear`/`actualizar`.
- Permite a las vistas legacy (Inventario UI, KPIs, Mapa, Alertas) seguir funcionando sin cambios de código durante F16.
- Las rules de Firestore validan que `root.codigo == identificacion.codigo` y `root.estado` concuerda con `estado_servicio` (con excepción `fallado → retirado` para el nivel raíz v1).
- Las vistas se migran progresivamente en F19–F27 y entonces la proyección pasará a estado deprecated.

---

## 5. Reglas Firestore v2 — resumen

| Colección | read | create | update | delete |
|---|---|---|---|---|
| `/transformadores/{id}` | `isTeamMember()` | `isAdmin()` + validar `schema_version=2`, secciones, enums | `isAdmin()` + validar enums presentes | `isAdmin()` |
| `/transformadores/{id}/placas_historicas` | team | admin + tipo_cambio ∈ enum | ❌ | ❌ |
| `/transformadores/{id}/historial_hi` | team | admin + trigger ∈ enum | ❌ | ❌ |
| `/subestaciones/{id}` | team | admin + codigo/nombre/depto válidos | admin + enums | admin |
| `/usuarios/{uid}` | propio o admin | admin + rol ∈ enum ampliado (F28) | admin | admin (no sí mismo) |

Helpers definidos en `firestore.rules`:

- `isSignedIn()`, `hasProfile()`, `profile()`
- `isTeamMember()` — perfil activo o bootstrap `/admins/{uid}`
- `isAdmin()` — `rol=admin` o bootstrap
- `isTipoActivoValido(v)`, `isEstadoServicioValido(v)`, `isZonaValida(v)`, `isDeptoValido(v)`, `isGrupoValido(v)`

---

## 6. Índices compuestos activos

```
transformadores
  · departamento ASC, codigo ASC                     (v1 compat)
  · estado ASC, codigo ASC                           (v1 compat)
  · estado_servicio ASC, codigo ASC                  (v2)
  · ubicacion.zona ASC, codigo ASC                   (v2)
  · identificacion.grupo ASC, codigo ASC             (v2)
  · identificacion.tipo_activo ASC, salud_actual.hi_final DESC
  · ubicacion.subestacionId ASC, codigo ASC
  · salud_actual.bucket ASC, ubicacion.zona ASC
subestaciones
  · zona ASC, codigo ASC
  · departamento ASC, codigo ASC
historial_hi  (collection group)
  · trigger ASC, ts_calculo DESC
```

---

## 7. Migración v1 → v2

`scripts/migrate/v1-to-v2-transformadores.js` expone:

- `migrarDocV1aV2(docV1)` — función **pura**, idempotente. Dada una fila v1 (o una ya v2) devuelve el shape v2 canónico.
- `esV1(doc)` / `esV2(doc)` — detectores.
- `ejecutarMigracion({ list, write, log, dryRun, limite })` — runner **defensivo** que acepta cualquier adaptador de I/O (web SDK, admin SDK, mock de tests). En `dryRun` no escribe. Reporta `{ escaneados, migrados, yaV2, errores }`.

Política:

- `tipo_activo` default `POTENCIA`. F17 (importador Excel) lo corrige por hoja (`TX_Potencia` → POTENCIA, `TPT_Servicio` → TPT, `TX_Respaldo` → RESPALDO).
- `zona` se infiere por `departamento`.
- `ano_fabricacion` se extrae de `fecha_fabricacion` ISO si es válido.
- `salud_actual.overrides_aplicados` incluye la marca `_migracion_v2` para trazabilidad; el motor F18 la borrará al primer recálculo real.

---

## 8. Tests de conformidad

```
tests/schema.test.js              · 29 tests — enums, pesos HI Tabla 10, UUCC,
                                    buckets, roles RBAC, normativas.
tests/transformador_schema.test.js · 15 tests — sanitizador, validador,
                                    proyección v1, overrides de enums.
tests/subestacion_schema.test.js  ·  7 tests — sanitizador y validador.
tests/migracion_v1_v2.test.js     · 12 tests — transformación pura +
                                    runner defensivo + error handling.
                                    Total: 63 tests. Runner: node --test (nativo).
```

Ejecutar:

```bash
npm test          # lint HTML + tests unit
npm run test:unit # solo tests (node --test)
```

---

## 9. Colecciones añadidas F17→F37 (v2.0 completa)

El modelo nuclear descrito en §2–§3 se extiende con las siguientes
colecciones/subcolecciones que entregaron las microfases posteriores:

### 9.1 Time-series y monitoreo

| Colección | Fase | Propósito | Reglas |
|---|---|---|---|
| `/muestras/{id}` | F19 | Time-series DGA/ADFQ/FUR con contexto §A9.6 (eventos externos, intervención previa, observación del analista). | read team; create/update admin valida enum `tipo ∈ {DGA, ADFQ, FURANOS, COMBO}` |
| `/contramuestras/{id}` | F26 | Seguimiento reforzado generado por reglas automáticas (CRG≥4, humedad+RD…). | admin CRUD |
| `/monitoreo_intensivo/{id}` | F26/§A9.1 | Régimen semanal/quincenal cuando CalifC₂H₂ = 5. Guarda velocidad_ppm_dia y evaluación de override R1/R2/R3. | read team; create admin valida `tipo=='C2H2'`; update admin; delete false |
| `/propuestas_reclasificacion_fur/{id}` | F26/§A9.2 | Cola de juicio experto cuando CalifFUR ≥ 4. Shape: `{transformadorId, muestra_id, ppb_2fal, dp_estimado, vida_remanente_pct, hi_propuesto, estado, resolucion}`. | read team; create admin con `estado=='pendiente_revision_experto'`; update admin; delete false |

### 9.2 Gobernanza operativa

| Colección | Fase | Propósito | Reglas |
|---|---|---|---|
| `/contratos/{id}` | F21 | 8 contratos macro con control presupuestario (`monto_total`, `comprometido`, `ejecutado`, `disponible`). Enum `estado ∈ {vigente, suspendido, finalizado, en_liquidacion}`. | read team; create/update admin valida enum `estado` |
| `/subactividades/{codigo}` | F22/§A7 | 31 subactividades oficiales por condición objetivo (PSM/ST/CM/CMA/REP + mitigaciones). docId = `codigo`. | read team; write admin |
| `/macroactividades/{codigo}` | F22 | 7 macroactividades que agrupan subactividades por condición. | read team; write admin |
| `/causantes/{codigo}` | F22 | 12 causantes con origen (DGA/ADFQ/FUR/EDAD/CRG/PYT/HER/EXT/MULTI). | read team; write admin |
| `/fallados/{id}` | F25 | Histórico post-mortem con RCA (5 Porqués, Ishikawa, FMEA). Calcula RPN = Severidad × Ocurrencia × Detección. | read team; create/update admin valida enum `tipo_falla` y `metodo_rca`; delete admin |

### 9.3 Parámetros del sistema

| Colección | Fase | Propósito |
|---|---|---|
| `/umbrales_salud/global` | F18 | Umbrales activos del motor con subcolección `historial/{evt}` append-only. Fallback al `BASELINE_UMBRALES_SALUD` si no existe. |
| `/parametros_sistema/criticidad` | F36 | Tope `max_usuarios` dinámico que recalcula los 5 rangos con `calcularRangosCriticidad(max, min=1)`. Baseline 48 312. |

### 9.4 Auditoría e importación

| Colección | Fase | Propósito |
|---|---|---|
| `/importaciones/{jobId}` | F17 | Log append-only de cada carga Excel con reporte reducido: filas por hoja, exitosos/errores, primeras 30 discrepancias Excel ↔ MO.00418. |
| `/auditoria/{id}` | F35 | Append-only global (ISO 55001 §9.1). 18 acciones catalogadas. Lectura restringida a admin + auditor_campo. |

### 9.5 Triggers y funciones (F32)

- `onMuestraCreateHandler(event, deps)` — recalcula `salud_actual` usando `snapshotSaludCompleto` + añade entrada en `historial_hi` del transformador.
- `cronAlertasDiariasHandler(event, deps)` — lee `/alertas_config/global`; si `notificaciones_enabled`, computa alertas críticas y envía email vía Resend.
- `/api/health` (Vercel) — sonda de availability pública con `version: 'v2.0.0'`.

### 9.6 Roles F28 aceptados en `/usuarios/{uid}`

| rol | Uso |
|---|---|
| `admin` | Administrador del sistema (control total). |
| `director_proyectos` | Ingeniero Director de Proyectos. |
| `analista_tx` | Ingeniero Analista de Transformadores de Potencia (= Profesional de Tx para §A9.2). |
| `gestor_contractual` | Gestión administrativa y contractual (ámbito filtrable por `contratos[]`). |
| `brigadista` | Ejecución en campo. |
| `auditor_campo` | Auditor en campo de aliados estratégicos. |
| `tecnico` (legacy F14) | Se acepta durante la migración; debe reasignarse a `analista_tx` o `brigadista`. |

Ámbito geográfico: campo `zonas[]` filtra `[BOLIVAR, ORIENTE, OCCIDENTE]`. Zonas vacías = sin restricción.

### 9.7 Reglas de alerta v2 (motor F11+)

| tipo | Severidad | Disparador |
|---|---|---|
| `hi_degradado` | crítica ≥4.5, warning ≥4.0 | `salud_actual.hi_final` |
| `propuesta_fur_pendiente` | crítica | bandera en `estados_especiales` |
| `monitoreo_c2h2_activo` | warning | bandera en `estados_especiales` |
| `otc_vencimiento_proximo` | crítica ≤7d, warning ≤30d | `restricciones_operativas.fecha_fin_prevista` |
| `vida_util_remanente_baja` | crítica | `salud_actual.vida_remanente_pct < 10 %` |

Todas reutilizan `/alertas_reconocidas/{alertId}` existente con id determinista.
