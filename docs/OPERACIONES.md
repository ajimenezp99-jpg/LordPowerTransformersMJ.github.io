# Runbook operativo — SGM · TRANSPOWER v2.0.8

Instrucciones de bootstrap, uso diario y emergencia de la
plataforma en producción.

Audiencia: **Ingeniero Director de Proyectos** (Afinia · CARIBEMAR)
y quien administre la plataforma.

---

## 0. Protocolo de deploys (regla permanente)

Firebase tiene **5 canales de deploy independientes** que NO se
despliegan automáticamente con cada `git push`. Cada uno requiere
un comando manual desde la máquina del director:

| Canal | Archivo fuente | Comando de deploy |
|---|---|---|
| Firestore rules | `firestore.rules` | `firebase deploy --only firestore:rules` |
| Firestore indexes | `firestore.indexes.json` | `firebase deploy --only firestore:indexes` |
| Storage rules | `storage.rules` | `firebase deploy --only storage` |
| Cloud Functions | `functions/*.js` | `firebase deploy --only functions[:nombre]` |
| Firebase Extensions | consola web | Firebase Console → Extensions |

*(GitHub Pages sí se despliega automático con cada push a `main` via
el workflow `.github/workflows/pages.yml` — eso sigue siendo
transparente.)*

### Regla estricta

**Cada vez que se modifique uno de esos archivos, el autor del cambio
(Claude o desarrollador humano) debe avisar EN EL MISMO TURNO al
director exactamente qué hay que deployar y con qué comando.**

Ejemplos de aviso correcto:

> *"Modificaste `firestore.rules` — ejecuta `firebase deploy --only firestore:rules` antes de probar."*

> *"Agregué un índice nuevo para `ordenes` por macroactividad — ejecuta `firebase deploy --only firestore:indexes`. Los índices tardan 2-5 min en propagarse."*

> *"La función `onMuestraCreate` ahora lee un campo nuevo — ejecuta `firebase deploy --only functions:onMuestraCreate` para actualizarla."*

### Por qué importa

- **Los índices no desplegados** hacen que queries fallen con
  `FAILED_PRECONDITION: The query requires an index`.
- **Las rules no desplegadas** bloquean lecturas/escrituras con
  `permission-denied` aunque el cliente tenga sesión.
- **Las functions no desplegadas** corren en producción con el
  código viejo sin que el director lo note hasta que algo se rompe.
- **Acumular varios cambios sin desplegar** hace imposible aislar
  el bug cuando algo falla; lo rápido es deployar pronto, pronto.

### Commits con cambios de deploy deben incluir en el mensaje

```
Requiere deploy:
  firebase deploy --only firestore:rules,firestore:indexes
```

Claude debe añadir ese bloque al final del commit message cuando el
PR o commit incluya cambios en `firestore.rules`, `firestore.indexes.json`,
`storage.rules` o `functions/`.

---

## 1. Bootstrap inicial (primer despliegue)

Orden recomendado (replicado como asistente visual en
`admin/index.html`):

### 1.1 Prerrequisitos

- Cuenta Firebase plan **Blaze** (solo si se activan Cloud Functions).
- Acceso al repo `ajimenezp99-jpg/LordPowerTransformersMJ.github.io`.
- Excel oficial "Salud de Activos 2026.xlsx".
- PAT clásico de GitHub con scope `repo` para push desde Claude Code.

### 1.2 Configurar Firebase

```bash
firebase login
firebase use sgm-transpower
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Esto sube las rules v2, los 20+ índices compuestos y el
control de Storage. Los índices pueden tardar 2-5 minutos en
propagarse.

### 1.3 Crear primer admin

1. Firebase Console → Authentication → añadir usuario con email
   del director.
2. Firestore Console → `/admins/{uid_del_director}` con `{}`
   (bootstrap F5 legacy — sigue vigente).
3. Primer login desde `index.html` con ese email.

### 1.4 Poblar catálogos oficiales §A7

`admin/catalogos.html` → botón **"CARGAR BASELINE OFICIAL"**.
Crea idempotente:

- 31 subactividades
- 7 macroactividades
- 12 causantes

### 1.5 Registrar equipo (F28 RBAC)

`admin/usuarios.html` → alta de cada miembro con:

- `uid` de Firebase Auth (previo en consola o self-signup).
- `email`, `nombre`.
- `rol` de los 6 oficiales:
  - `director_proyectos`
  - `analista_tx` (= Profesional de Transformadores)
  - `gestor_contractual`
  - `brigadista`
  - `auditor_campo`
  - `admin` (sistema)
- `zonas[]` con `BOLIVAR` / `ORIENTE` / `OCCIDENTE` (vacío = sin
  restricción).
- `contratos[]` (para `gestor_contractual` con alcance por contrato).

### 1.6 Contratos macro (F21)

`admin/contratos.html` → registrar los 8 contratos vigentes.
Campos clave: código, aliado (BRIGADA_TX / CDM / TyS / TyS_G3 /
CDM_TYS / OTRO), monto_total, presupuesto_comprometido,
presupuesto_ejecutado, fecha_inicio, fecha_fin, alcance.

### 1.7 Subestaciones (F20)

`admin/subestaciones.html` → registrar las subestaciones que
referencian los transformadores. Previo a la importación del
Excel, los TX pueden no tener subestacionId aún; se asocian
después.

### 1.8 Importar los 296 TX del Excel (F17)

`admin/importar.html`:

1. Arrastrar `Salud de Activos 2026.xlsx`.
2. Revisar resumen: 230 TX Potencia + 39 TPT + 27 Respaldo.
3. Click **"SIMULAR (DRY-RUN)"** → produce reporte de
   discrepancias HI Excel ↔ MO.00418 (las 17 documentadas en
   §D1-D17 del prompt v2.2).
4. Si el reporte es aceptable, click **"IMPORTAR EN FIRESTORE"**.
5. Un job queda en `/importaciones/{jobId}` con primeras 30
   discrepancias como entregable auditable para el director.

### 1.9 Activar Cloud Functions (opcional, F32)

Seguir `docs/DEPLOY-FUNCTIONS.md`. Requiere plan Blaze y cuenta
Resend (free tier 3 000 emails/mes). Después, configurar
`admin/alertas.html`:

- `destinatario_email` del director.
- Toggle `Habilitado` del cron diario.

### 1.10 Ajustes finales

- `admin/umbrales-salud.html` → verificar/ajustar baselines si
  el Profesional de Tx solicita calibración local. Cada cambio
  queda en `/umbrales_salud/global/historial`.
- `admin/parametros_sistema/criticidad` (actualmente por UI
  indirecta) → si los usuarios aguas abajo totales crecen,
  editar `max_usuarios` y los 5 rangos F36 se recalculan solo.

## 2. Uso diario

### 2.1 Analista de transformadores

1. `admin/muestras.html` → capturar nueva muestra DGA/ADFQ/FUR.
   Si TDGC>201 o C₂H₂≥5, el campo "Contexto operativo" es
   obligatorio (validación §A9.6).
2. Al guardar, el trigger F32 `onMuestraCreate` (si desplegado)
   recalcula `salud_actual` automáticamente. Si no hay
   Cloud Functions, el snapshot se refresca la próxima vez que
   abras la ficha del TX.
3. Si CalifFUR ≥ 4 → se crea propuesta en
   `/propuestas_reclasificacion_fur`. Revisarla en
   `admin/propuestas-fur.html` y decidir reemplazo / OTC / rechazo.

### 2.2 Brigadista

1. `admin/ordenes.html` → ver órdenes asignadas (filtrar por
   tu email o aliado).
2. Cambiar estado `programada → en_ejecucion` al empezar.
3. Al terminar, cambiar a `ejecutada` y llenar duración_horas +
   observaciones.

### 2.3 Director de proyectos

1. `pages/dashboard.html` → visión ejecutiva con KPIs del parque
   filtrados por sus zonas (RBAC F28).
2. `pages/matriz-riesgo.html` → celdas rojas/naranjas (§A6).
3. `admin/plan-inversion.html` → ranking PI con candidatos
   forzosos al tope. Click **"EXPORTAR XLSX"** para presentar
   a junta.
4. `admin/propuestas-fur.html` → aprobar decisiones expertas
   (reemplazo o OTC) o rechazar con nota.
5. `admin/desempeno-aliados.html` → revisar score 0-100 por
   aliado para renegociación contractual.

### 2.4 Auditor de campo

1. `admin/auditoria.html` → bitácora con filtros por acción /
   colección / uid. ISO 55001 §9.1 compliance.
2. Verificación en terreno: revisar que los datos del TX
   coinciden con la ficha de `admin/inventario.html`.

## 3. Emergencias y troubleshooting

### 3.1 El HI de un TX no se actualiza tras una muestra

- **Causa probable:** Cloud Functions no están desplegadas o
  el trigger falló.
- **Fix:** abrir `admin/motor-salud.html`, introducir los datos
  manualmente y verificar el cálculo. Si coincide, ejecutar
  el recálculo batch manualmente (no hay UI aún — pedir al
  siguiente Claude que añada un botón en umbrales-salud).

### 3.2 Alertas no llegan por email

- **Causa probable:** `RESEND_API_KEY` mal configurado o el
  toggle `notificaciones_enabled` desactivado.
- **Fix:**
  ```bash
  firebase functions:secrets:access RESEND_API_KEY
  firebase functions:log --only cronAlertasDiarias
  ```
  Revisar logs. Confirmar `admin/alertas.html` con el toggle en
  "Habilitado".

### 3.3 Una muestra crítica C₂H₂ = 5 no reclasifica HI

- **Comportamiento esperado:** §A9.1 dice que C₂H₂=5 dispara
  monitoreo intensivo (frecuencia 7 días), pero NO reclasifica
  HI ≥ 4 hasta que haya aceleración demostrada (≥ 0.5 ppm/día
  entre muestras consecutivas).
- Si el usuario espera que baje inmediatamente a "pobre",
  explicarle: se necesita ≥ 2 muestras en el régimen intensivo
  para activar R1.

### 3.4 FUR ≥ 4 no bloquea la operación

- **Comportamiento esperado:** §A9.2 exige juicio experto.
  La primera muestra con FUR ≥ 4 crea propuesta pendiente; el
  activo sigue operando. Tras aprobación en
  `admin/propuestas-fur.html`, el motor pone
  `fin_vida_util_papel=true` y bloquea órdenes que no sean
  reemplazo / retiro / OTC.

### 3.5 Push a GitHub falla con 403

- **Causa (según CLAUDE.md §0):** el GitHub App de Claude Code
  no tiene permiso `Contents: Read & write`.
- **Workaround temporal:** push con URL inline usando PAT
  clásico:
  ```bash
  git push https://USER:TOKEN@github.com/USER/REPO.git BRANCH:BRANCH
  ```
- **Fix permanente:** conceder el permiso en
  `github.com/settings/installations`.

### 3.6 Tests fallan después de un cambio

```bash
npm run test:unit 2>&1 | grep "not ok" | head
```
Identifica el test que rompió. Los fixtures están en cada
archivo; no hay dependencia cruzada entre suites.

## 4. Mantenimiento periódico

### 4.1 Mensual

- Revisar `admin/auditoria.html` con filtro mes a mes.
- Exportar desde `admin/plan-inversion.html` para junta
  directiva.
- Revisar score de aliados en `admin/desempeno-aliados.html`.

### 4.2 Anual

- Actualizar `max_usuarios` en parámetros del sistema si la
  demanda del operador crece. Los 5 rangos de criticidad se
  recalculan solo (§A9.9).
- Revisar baselines de umbrales tras actualización del
  procedimiento interno (nueva edición del MO.00418).
- Rotar PAT clásico si el token actual fue expuesto.

### 4.3 Ante cambio del procedimiento MO.00418

1. Editar `assets/js/domain/umbrales_salud_baseline.js` con los
   nuevos valores.
2. Actualizar `BASELINES_C2H2` en `assets/js/domain/monitoreo_intensivo.js`
   si cambia la frecuencia.
3. Actualizar tests en `tests/umbrales_baseline.test.js` y
   `tests/salud_activos.test.js` con los nuevos bordes.
4. Tag con edición del procedimiento: `v2.1.0-mo00418-ed03`.
5. Desplegar y enviar comunicado al equipo.

## 5. Contactos y referencias

- **Procedimiento vigente:** MO.00418.DE-GAC-AX.01 Ed. 02 (14/10/2025)
- **Operador:** CARIBEMAR DE LA COSTA S.A.S E.S.P (Afinia · Grupo EPM)
- **Repo:** `github.com/ajimenezp99-jpg/LordPowerTransformersMJ.github.io`
- **Rama activa:** `claude/review-phase-16-plan-mhPgg`
- **Issues / mejoras:** crear issue en el repo o pedir al
  siguiente Claude que lo aborde.
