# SGM · TRANSPOWER

Sistema de Gestión del Mantenimiento Especializado de Transformadores de Potencia —
Caribe Colombiano (Bolívar, Córdoba, Sucre, Cesar y 11 municipios de Magdalena).

> Proyecto **sin ánimo de lucro**. Stack íntegramente sobre tiers gratuitos
> (GitHub Pages · Vercel Hobby · Firebase Spark · Leaflet / OpenStreetMap).

## Estado

Fase 3 cerrada · progreso global **25 %**. Ver [`CLAUDE.md`](./CLAUDE.md) para el plan completo.

## Stack

- Frontend estático: HTML5 + CSS3 + JavaScript ES6+ (vanilla).
- Hosting estático: **GitHub Pages** (Actions workflow `pages.yml`).
- Hosting dinámico (futuro): **Vercel Hobby** (serverless Node.js).
- Backend (futuro): **Firebase** (Auth · Firestore · Storage).
- Mapas (futuro): **Leaflet + OpenStreetMap**.

## Desarrollo local

```bash
npm install        # instala html-validate
npm run lint       # valida HTML
npm run serve      # sirve el sitio en http://localhost:8080
```

## CI/CD

- `.github/workflows/ci.yml` — lint HTML en push / PR.
- `.github/workflows/pages.yml` — deploy automático a GitHub Pages desde `main`.
- `vercel.json` — configuración de headers, cleanUrls y redirects para Vercel.

## Acceso

Durante la fase de construcción el sitio queda tras un **gate estático**
(código `97601992@`, ver `assets/js/gate.js`). Se reemplazará por Firebase Auth
en la Fase 12.

## Licencia

Privado · todos los derechos reservados.
