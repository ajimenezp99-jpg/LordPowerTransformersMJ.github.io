# Despliegue de Cloud Functions (F32)

Guía de activación de los triggers `onMuestraCreate` y
`cronAlertasDiarias` en producción. **Se puede hacer por etapas:**
primero el trigger de salud (sin secretos) y después el cron de
email cuando quieras activar notificaciones.

## Prerrequisitos

- Proyecto Firebase con plan **Blaze** (requerido por Cloud
  Functions; tier gratis generoso: 2M invocaciones + 400K GB-s/mes).
- `firebase-tools` instalado globalmente:
  ```bash
  npm install -g firebase-tools
  firebase login
  firebase use lordpowertransformersmj
  ```

## Etapa 1 — Deploy del trigger de salud (recomendado primero)

**No requiere Resend, ni Secret Manager, ni cuenta de email.**
Recalcula `salud_actual` automáticamente cuando se crea una muestra.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:onMuestraCreate
```

Eso basta para tener el motor de Salud reactivo en producción.

## Etapa 2 — Activar el cron diario de email (opcional)

Ejecuta esto solo cuando quieras recibir el resumen diario por correo.

### 2.1 Habilitar Secret Manager API

Una sola vez en el proyecto. Abre en el navegador:

```
https://console.developers.google.com/apis/api/secretmanager.googleapis.com/overview?project=lordpowertransformersmj
```

y click **Enable**. Toma ~30 segundos en propagar.

### 2.2 Cuenta en Resend + API key

1. Crear cuenta en [resend.com](https://resend.com) (free 3 000 emails/mes).
2. Dashboard → **API Keys → Create API Key** → copia el valor `re_xxx...`.
3. *(Opcional pero recomendado)*: verifica un dominio tuyo para que los
   emails salgan con tu marca. Sin dominio verificado, Resend solo
   permite enviar al email de la cuenta Resend.

### 2.3 Guardar el secret en Firebase

```bash
firebase functions:secrets:set RESEND_API_KEY
# Pega la API key cuando lo solicite (formato re_xxx...)
```

### 2.4 Deploy del cron

```bash
firebase deploy --only functions:cronAlertasDiarias
```

El primer despliegue tarda ~2–3 minutos. Crea:

- `onMuestraCreate` (Firestore trigger v2 · region `southamerica-east1`).
- `cronAlertasDiarias` (Pub/Sub schedule · `0 7 * * * America/Bogota`).

## 3. Activar el cron desde la UI

1. Abre `admin/alertas.html` (rol admin).
2. En el panel "Umbrales del motor de reglas":
   - **Destinatario correo** → email del director / responsable.
   - **Cron diario** → "Habilitado".
3. Click en "Guardar config".

A partir del día siguiente a las 07:00 (hora Bogotá) el cron
correrá. Si no hay alertas críticas no reconocidas, no envía email.

## 4. Verificar

```bash
firebase functions:log --only cronAlertasDiarias
firebase functions:log --only onMuestraCreate
```

## 5. Endpoint health (Vercel)

Si despliegas el repo en Vercel además de GitHub Pages:

```
GET https://<proyecto>.vercel.app/api/health
→ { "ok": true, "service": "SGM · TRANSPOWER", "version": "v2.0.x", ... }
```

Sirve como sonda externa de availability.

## 6. Costos esperados (orden de magnitud)

| Servicio | Tier | Estimado mes |
|---|---|---|
| Firebase Cloud Functions | Blaze | < 1 USD (1 cron/día + ~10 muestras/día) |
| Firebase Firestore       | Blaze | < 1 USD (lecturas + writes operativos) |
| Resend                   | Free  | 0 USD (≤ 3 000 emails/mes) |

Total operativo estimado: **< 2 USD/mes** con uso normal del
parque de 296 transformadores.

## 7. Rollback

Si necesitas deshabilitar todo sin perder configuración:

```bash
firebase functions:delete onMuestraCreate cronAlertasDiarias
```

O sólo desactivar el cron desde la UI (toggle en
`admin/alertas.html`). El trigger `onMuestraCreate` seguiría
activo (no envía emails, solo recalcula salud_actual).

## Referencia normativa

Las notificaciones automáticas se alinean con MO.00418
§4.1 Nota Técnica C₂H₂ (frecuencia de muestreo intensivo) y
§A9.2 (avisar al Profesional de Tx cuando hay propuesta FUR
pendiente). El cron diario es un complemento al sistema de
alertas cliente-side de F11/F26.
