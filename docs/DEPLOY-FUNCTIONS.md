# Despliegue de Cloud Functions (F32)

Guía de activación de los triggers `onMuestraCreate` y
`cronAlertasDiarias` en producción. **Se puede hacer por etapas:**
primero el trigger de salud (sin email) y después el cron de
alertas cuando quieras activar notificaciones por correo.

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

**No requiere email ni cuentas externas.** Recalcula
`salud_actual` automáticamente cuando se crea una muestra.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:onMuestraCreate
```

Eso basta para tener el motor de Salud reactivo en producción.

## Etapa 2 — Activar email de alertas diarias (100% Google)

El cron `cronAlertasDiarias` **no envía el email directamente**.
Crea un doc en la colección `/mail` con el contenido del correo,
y la Firebase Extension **"Trigger Email from Firestore"** lo envía
vía SMTP (Gmail u otro proveedor que elijas).

Este approach evita dependencias externas (Resend, SendGrid) y
mantiene toda la infraestructura dentro de Google / Firebase.

### 2.1 Generar App Password de Gmail

1. Activa 2FA en tu cuenta Gmail si no la tienes:
   [myaccount.google.com/security](https://myaccount.google.com/security).
2. Abre [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. **Nombre de la aplicación:** `SGM Transpower - Alertas` (o lo que quieras).
4. Click **Crear** → Google muestra una contraseña de 16 caracteres
   (ejemplo `xxxx xxxx xxxx xxxx`). **Cópiala — se muestra una sola vez.**
5. Guárdala en tu gestor de contraseñas.

### 2.2 Instalar la Firebase Extension

1. Firebase Console → **Extensions** → buscar
   **"Trigger Email from Firestore"** (publicada por Firebase).
2. Click **Install**.
3. Configuración:
   - **Authentication Type:** *UsernamePassword*
   - **SMTP connection URI:** `smtps://TU_EMAIL%40gmail.com:APP_PASSWORD@smtp.gmail.com:465`
     - Reemplaza `TU_EMAIL` por tu email (sin `@gmail.com`, que va `%40`).
     - Reemplaza `APP_PASSWORD` por la contraseña de 16 caracteres sin espacios.
     - Ejemplo: `smtps://miguel%[email protected]:abcdwxyzabcdwxyz@smtp.gmail.com:465`
   - **SMTP password (opcional):** dejar en blanco (ya va en el URI).
   - **Default FROM address:** tu Gmail (ej. `[email protected]`).
   - **Default REPLY-TO address:** tu Gmail (igual que FROM).
   - **Email documents collection:** `mail` *(importante: exactamente ese nombre)*.
   - **Users collection:** deja vacío.
4. Click **Install extension**. El proceso toma ~2 minutos.

### 2.3 Deploy del cron

```bash
firebase deploy --only functions:cronAlertasDiarias
```

### 2.4 Activar desde la UI

1. Abre `admin/alertas.html` (rol admin).
2. Panel "Umbrales del motor de reglas":
   - **Destinatario correo** → email que recibirá el resumen.
   - **Cron diario** → "Habilitado".
3. Click "Guardar config".

A partir del día siguiente a las 07:00 hora Bogotá, el cron correrá.
Si no hay alertas críticas sin reconocer, no se envía email.

## 3. Verificar funcionamiento

```bash
firebase functions:log --only cronAlertasDiarias
firebase functions:log --only onMuestraCreate
```

Para probar el cron sin esperar al día siguiente, puedes:
- Crear manualmente un doc en `/mail` desde Firestore Console:
  ```json
  {
    "to": "tu@email.com",
    "message": {
      "subject": "Prueba SGM Transpower",
      "html": "<p>Funciona!</p>"
    }
  }
  ```
  Si llega el email, la Extension está OK.

## 4. Costos esperados (orden de magnitud)

| Servicio | Tier | Estimado mes |
|---|---|---|
| Firebase Cloud Functions | Blaze | < 1 USD (1 cron/día + ~10 muestras/día) |
| Firebase Firestore       | Blaze | < 1 USD (lecturas + writes operativos) |
| Gmail SMTP               | Free  | 0 USD (límite 500 emails/día) |

Total operativo estimado: **< 2 USD/mes**.

## 5. Rollback

Si necesitas deshabilitar todo:

```bash
firebase functions:delete onMuestraCreate cronAlertasDiarias
```

O desinstalar la Extension desde Firebase Console → Extensions.

## 6. Cambiar el proveedor SMTP

Si más adelante decides cambiar de Gmail a otro SMTP (SendGrid,
Mailgun, Amazon SES, servidor propio), solo reconfigura la
Extension con el nuevo SMTP URI. **El código Cloud Functions no
cambia** porque solo escribe en `/mail`; la Extension absorbe el
cambio de backend.

## Referencia normativa

Las notificaciones automáticas se alinean con MO.00418
§4.1 Nota Técnica C₂H₂ (frecuencia de muestreo intensivo) y
§A9.2 (avisar al Profesional de Tx cuando hay propuesta FUR
pendiente). El cron diario complementa al sistema de alertas
cliente-side de F11/F26.
