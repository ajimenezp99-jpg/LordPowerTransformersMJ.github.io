// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Configuración pública del proyecto Firebase
// Fase 4 · Integración Firebase
// ──────────────────────────────────────────────────────────────
// La configuración de Web App de Firebase NO es secreta: es un
// identificador público. La seguridad real se aplica en las reglas
// de Firestore y Storage (archivos firestore.rules / storage.rules)
// y en la autenticación admin (Fase 5).
//
// Pasos manuales (a cargo del propietario del repo):
//   1. Crear proyecto en https://console.firebase.google.com
//      (sugerido: "sgm-transpower").
//   2. Agregar una Web App al proyecto.
//   3. Copiar el objeto `firebaseConfig` generado por la consola
//      y reemplazar los valores placeholder de abajo.
//   4. Habilitar Authentication (Email/Password), Firestore
//      y Storage en modo Production (las reglas ya están cerradas).
//   5. Instalar CLI:      npm i -g firebase-tools
//      Login:             firebase login
//      Vincular:          firebase use --add
//      Desplegar reglas:  firebase deploy --only firestore:rules,storage
// ══════════════════════════════════════════════════════════════

export const firebaseConfig = {
  apiKey:            'AIzaSyA4K6tPbuZ70eWIB7s9LwrrTkwU-HKDuy4',
  authDomain:        'lordpowertransformersmj.firebaseapp.com',
  projectId:         'lordpowertransformersmj',
  storageBucket:     'lordpowertransformersmj.firebasestorage.app',
  messagingSenderId: '365008989842',
  appId:             '1:365008989842:web:bbfafd26ac55af2aba804b',
  measurementId:     'G-4FGHLWJYGQ'
};

// Flag de runtime: `true` cuando la configuración aún tiene placeholders.
export const isFirebaseConfigured = !Object
  .values(firebaseConfig)
  .some((v) => typeof v === 'string' && v.startsWith('REEMPLAZAR__'));
