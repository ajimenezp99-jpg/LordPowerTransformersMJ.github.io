# Changelog — SGM · TRANSPOWER

Evolución v1.0 → v2.0 conforme **MO.00418.DE-GAC-AX.01 Ed. 02**
(CARIBEMAR DE LA COSTA S.A.S E.S.P · Afinia · Grupo EPM).

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/).
Semver por tag. Pulido post-v2.0 incrementa el patch (v2.0.1,
v2.0.2, …) sin promesas de incompatibilidad.

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
