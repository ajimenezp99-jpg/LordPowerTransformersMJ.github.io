# Plan de sincronización de servicios externos · SGM · TRANSPOWER

> Documento guía paso a paso para conectar el sitio con los servicios externos
> (Firebase, Node.js, GitHub Pages, Vercel). Pensado para quien no tiene
> experiencia con código. Cada sesión puede realizarse de forma independiente;
> entre sesiones el sitio no se rompe.

---

## Estado inicial asumido

- Proyecto Firebase creado: **`lordpowertransformersmj`** (Plan Blaze).
- Cuenta Vercel creada.
- Node.js **NO instalado** aún.
- Código del sitio en la rama `claude/personal-website-transformers-CVWxV`.

---

## Orden de prioridad (y por qué)

| # | Bloque | Por qué va aquí |
|---|--------|-----------------|
| 1 | Firebase: Web App + servicios | Es el corazón: sin él no hay login, DB ni archivos. |
| 2 | Node.js + Firebase CLI | Instrumento de una sola vez para subir reglas de seguridad. |
| 3 | Bootstrap del primer admin | Permite entrar por primera vez al sitio. |
| 4 | GitHub Pages | Publica el sitio en Internet. |
| 5 | Vercel | Postergable: solo si hace falta backend Node / correos. |

---

## SESIÓN 1 — Firebase: registrar Web App y activar servicios

**Duración estimada:** 40 min
**Objetivo:** obtener las llaves `firebaseConfig`, pegarlas en el código, y encender Auth + Firestore + Storage.

### 1.1 Registrar la Web App
1. En https://console.firebase.google.com abra el proyecto `lordpowertransformersmj`.
2. En la pantalla principal pulse **"+ Agregar app"**.
3. Elija el ícono **`</>`** (Web).
4. Apodo: `SGM Web`.
5. **NO** marque la casilla "También configura Firebase Hosting para esta app".
6. Pulse **Registrar app**.
7. Firebase mostrará un bloque de código así:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "lordpowertransformersmj.firebaseapp.com",
     projectId: "lordpowertransformersmj",
     storageBucket: "lordpowertransformersmj.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef..."
   };
   ```
8. **Copie el bloque completo** y guárdelo en un Bloc de notas.

### 1.2 Pegar las llaves en el código
Entregue el bloque `firebaseConfig` al asistente (Claude) para que lo pegue en
`assets/js/firebase-config.js` y active `isFirebaseConfigured = true`.

### 1.3 Habilitar Authentication
1. Menú izquierdo → **Build** → **Authentication**.
2. Clic en **Comenzar**.
3. Pestaña **Sign-in method** → **Correo electrónico/contraseña**.
4. Active el primer toggle (NO el de enlace mágico) → **Guardar**.

### 1.4 Habilitar Firestore
1. Menú izquierdo → **Build** → **Firestore Database**.
2. Clic en **Crear base de datos**.
3. Modo **Producción** (las reglas que desplegaremos luego son estrictas).
4. Región: `southamerica-east1` (São Paulo, la más cercana a Colombia).
5. Pulse **Habilitar**.

### 1.5 Habilitar Storage
1. Menú izquierdo → **Build** → **Storage**.
2. Clic en **Comenzar**.
3. Acepte reglas iniciales en modo producción.
4. Misma región: `southamerica-east1`.

### Criterio de cierre de la Sesión 1
- `firebaseConfig` pegado en `assets/js/firebase-config.js`.
- Los tres servicios (Auth, Firestore, Storage) marcan **Habilitado** en la
  consola de Firebase.

---

## SESIÓN 2 — Node.js y Firebase CLI (herramienta única)

**Duración estimada:** 30 min
**Objetivo:** instalar el CLI de Firebase y desplegar las reglas de seguridad.

### 2.1 Instalar Node.js
1. Entre a https://nodejs.org
2. Descargue la versión **LTS** (botón verde izquierdo).
3. Ejecute el instalador con los valores por defecto.
4. Abra PowerShell (Windows) o Terminal (Mac/Linux) y verifique:
   ```
   node --version
   npm --version
   ```
   Ambos deben imprimir versiones válidas (ej. `v20.x.x`, `10.x.x`).

### 2.2 Instalar Firebase CLI
En la misma terminal:
```
npm install -g firebase-tools
```
Luego autentíquese:
```
firebase login
```
Se abrirá su navegador → inicie sesión con la misma cuenta Google del proyecto.

### 2.3 Enlazar el proyecto local
Ubíquese en la carpeta del repo:
```
cd ruta\a\LordPowerTransformersMJ.github.io
```
(En Windows puede arrastrar la carpeta a la terminal después de `cd `.)
Verifique el alias ya configurado:
```
firebase projects:list
firebase use default
```
Debe responder `Now using alias default (lordpowertransformersmj)`.

### 2.4 Desplegar reglas e índices
```
firebase deploy --only firestore:rules,firestore:indexes,storage
```
Debe terminar con `Deploy complete!`. Si falla por "API not enabled", siga el
enlace que imprime el error, pulse **Enable** y reintente.

### Criterio de cierre de la Sesión 2
- Reglas de Firestore visibles en Console → Firestore → Rules.
- Índices visibles en Console → Firestore → Indexes.
- Reglas de Storage visibles en Console → Storage → Rules.

---

## SESIÓN 3 — Primer admin y entrada al sistema

**Duración estimada:** 20 min
**Objetivo:** crear su cuenta de Firebase Auth, bootstrap del doc `/admins/{uid}`,
entrar por primera vez, y mover su perfil a `/usuarios/{uid}`.

### 3.1 Crear su cuenta de Authentication
1. Console → Authentication → pestaña **Users** → **Add user**.
2. Correo: el suyo. Contraseña: fuerte (mínimo 8 caracteres, mezcla).
3. Copie el **UID** que aparece en la tabla (cadena larga tipo `xK7p2Qm...`).

### 3.2 Bootstrap admin (doc /admins/{uid})
1. Console → Firestore Database → **Iniciar colección**.
2. ID de colección: `admins`.
3. ID de documento: **pegue su UID exacto**.
4. Primer campo: `active` (Boolean) = `true`.
5. **Guardar**.

### 3.3 Primer login
1. Abra el sitio (local con `npm run serve` desde la carpeta del repo,
   o la URL de GitHub Pages si ya la publicó).
2. Ingrese correo + contraseña.
3. Debería entrar al home y ver la pill "Admin ▾" en la barra superior.

### 3.4 Crear su perfil formal en /usuarios
1. Clic en **Admin ▾** → **Usuarios**.
2. Botón **+ Nuevo**.
3. Pegue el mismo UID, su correo, nombre, rol `administrador`, activo ✓.
4. **Guardar**.
5. Ahora su acceso depende del perfil `/usuarios` real (el bootstrap
   `/admins` queda como respaldo).

### 3.5 Invitar al equipo
Para cada miembro:
1. Console → Auth → Add user (correo + contraseña temporal).
2. Copie el UID.
3. En `/admin/usuarios.html` → **+ Nuevo** → registre UID + correo + nombre +
   rol (`tecnico` o `admin`) + activo.
4. Comparta credenciales con el miembro. Desde el login podrá pulsar
   "¿Olvidó su contraseña?" para establecer la suya definitiva.

### Criterio de cierre de la Sesión 3
- Usted entra al sitio con su correo/contraseña.
- Ve la nav "Admin ▾" y el chip con su nombre y rol.
- Su perfil aparece en `/admin/usuarios.html`.

---

## SESIÓN 4 — Publicación en GitHub Pages

**Duración estimada:** 15 min
**Objetivo:** que el sitio esté en Internet.

### 4.1 Habilitar GitHub Pages
1. En GitHub → repo `LordPowerTransformersMJ.github.io` → **Settings** → **Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `main` · Folder: `/ (root)` · **Save**.

### 4.2 Merge de la rama de desarrollo
El workflow `.github/workflows/pages.yml` publica en cada push a `main`.
Solicite al asistente crear el Pull Request desde `claude/personal-website-transformers-CVWxV`
hacia `main`, revisarlo y hacer merge.

### 4.3 Autorizar el dominio público en Firebase
1. Console → Authentication → **Settings** → **Authorized domains**.
2. Pulse **Add domain** y agregue `lordpowertransformersmj.github.io` (o el
   dominio final que GitHub le dé).

### Criterio de cierre de la Sesión 4
- La URL pública abre el portal de login.
- El login funciona (Firebase no rechaza por dominio no autorizado).

---

## SESIÓN 5 — Vercel (POSTERGABLE)

**Duración estimada:** 60 min — cuando haga falta.
**Objetivo:** habilitar backend Node para funciones que Firebase Spark/Pages no cubren.

**No es bloqueante para v1.0.0.** Se activa cuando la plataforma necesite:

- Envío de correos automáticos en alertas críticas (F11+).
- Importación masiva de inventario desde CSV/Excel.
- Creación de usuarios en lote.
- Generación de reportes PDF mensuales.
- Webhooks o integraciones con terceros.

### Pasos (resumen, se detallan cuando lleguemos)
1. Instalar `vercel` CLI (`npm install -g vercel`).
2. Ejecutar `vercel` en la raíz del repo → enlazar con el proyecto Vercel.
3. Crear funciones bajo `/api/*.js`.
4. Configurar variables de entorno con la cuenta de servicio Firebase
   Admin SDK (clave privada JSON — NO subir a Git).
5. Actualizar `vercel.json` con rutas y headers.

---

## Bitácora de estado

Anote aquí el avance de cada sesión (fecha + nota breve):

- [ ] Sesión 1 — Firebase Web App + servicios · _fecha_ · _nota_
- [ ] Sesión 2 — Node.js + Firebase CLI · _fecha_ · _nota_
- [ ] Sesión 3 — Primer admin + entrada · _fecha_ · _nota_
- [ ] Sesión 4 — GitHub Pages · _fecha_ · _nota_
- [ ] Sesión 5 — Vercel · _fecha_ · _nota_ (postergable)
