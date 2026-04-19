// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin Guard auto-ejecutable (Fase 14)
// Incluir con <script type="module" src=".../admin-guard.js"></script>
// en toda página que requiera rol admin (admin/*). Verifica sesión
// activa + rol='admin' y redirige a /home.html si no procede.
// ══════════════════════════════════════════════════════════════

import { ensureSession } from './session-guard.js';
ensureSession({ requireAdmin: true });
