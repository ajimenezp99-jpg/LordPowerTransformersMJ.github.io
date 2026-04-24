// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Service Worker (F34)
// ──────────────────────────────────────────────────────────────
// Estrategia mixta:
//   · Cache-first   para shell HTML/CSS/JS y fuentes.
//   · Stale-while-revalidate para imágenes y assets de Storage.
//   · Network-first con fallback a cache para Firestore REST.
//
// Firebase Firestore offline persistence se habilita aparte en
// firebase-init.js con enableIndexedDbPersistence.
// ══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'sgm-v3-1-0';
const SHELL = [
  '/',
  '/index.html',
  '/home.html',
  '/manifest.json',
  '/assets/css/theme.css',
  '/assets/css/base.css',
  '/assets/css/app.css',
  '/assets/css/nav.css',
  '/assets/css/compat.css',
  '/assets/css/home-v3.css',
  '/assets/js/ui/nav.js',
  '/assets/img/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Firestore / Firebase Auth → network first, fallback cache
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Shell + assets locales: cache first
  if (event.request.method === 'GET' &&
      (url.origin === self.location.origin ||
       url.hostname === 'fonts.gstatic.com' ||
       url.hostname === 'fonts.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
          }
          return resp;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});
