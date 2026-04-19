// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Guard auto-ejecutable (Fase 14)
// Incluir con <script type="module" src=".../page-guard.js"></script>
// en CUALQUIER página protegida que no requiera rol admin (home,
// pages/*). Solo verifica sesión activa.
// ══════════════════════════════════════════════════════════════

import { ensureSession } from './session-guard.js';
ensureSession();
