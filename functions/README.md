# SGM · TRANSPOWER — Cloud Functions (F32)

Backend serverless mínimo sobre **Firebase Cloud Functions v2**
(recomendado) o **Vercel Functions** alternativamente.

## Triggers previstos

### `onMuestraCreate` — recálculo `salud_actual`
Cuando se escribe un nuevo doc en `/muestras/{id}`:
1. Lee el transformador referenciado.
2. Busca últimas muestras (DGA/ADFQ/FUR) del mismo TX.
3. Llama a `snapshotSaludCompleto` del motor F18.
4. Actualiza `/transformadores/{id}.salud_actual`.
5. Registra entrada en `/transformadores/{id}/historial_hi`.
6. Si hay cambio de bucket, genera propuesta de orden (F37).

### `onParametrosSaludChange` — recálculo masivo
Cuando se edita `/umbrales_salud/global`: recalcula HI de todos
los transformadores y registra cada entrada con
`trigger: 'parametros_actualizados'`.

### `cronAlertasDiarias` — resumen de alertas por email
Cron diario (Vercel Cron / Cloud Scheduler) que:
1. Lee `/alertas_config/global` (si `notificaciones_enabled`).
2. Computa alertas del motor F11.
3. Filtra severidad crítica no reconocidas.
4. Envía email via Resend API al `destinatario_email`.

## Variables de entorno requeridas

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (con saltos de línea escapados)
- `RESEND_API_KEY`

## Deploy

```bash
# Opción 1 — Firebase Cloud Functions
npm install -g firebase-tools
firebase deploy --only functions

# Opción 2 — Vercel Functions
npx vercel deploy --prod
```

## Endpoint de salud pública (Vercel)

`GET /api/health` → `{ ok: true, ts: <ISO>, version: 'v2.0.0' }`.

Sirve como sonda de availability del backend.
