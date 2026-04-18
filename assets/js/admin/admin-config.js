// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Configuración del panel admin (Fase 5)
// ──────────────────────────────────────────────────────────────
// Lista blanca de UIDs de Firebase Auth autorizados para entrar
// al panel administrativo. Cualquier usuario autenticado cuyo UID
// NO esté en esta lista será expulsado inmediatamente, incluso si
// la contraseña es correcta.
//
// Pasos manuales (tras activar Firebase Auth en F4):
//   1. Ir a Firebase Console → Authentication → Users.
//   2. "Add user" con email + password (p.ej. admin@tudominio.com).
//   3. Copiar el UID generado (28 chars alfanuméricos).
//   4. Pegarlo en el array ADMIN_UIDS de abajo.
// ══════════════════════════════════════════════════════════════

export const ADMIN_UIDS = [
  // 'REEMPLAZAR__UID_ADMIN_FIREBASE'
];

export const ADMIN_ROUTES = {
  login:    '/admin/login.html',
  home:     '/admin/index.html',
  fallback: '/home.html'
};

// Normaliza UID (en caso de que alguien pegue con espacios)
export function isAdminUid(uid) {
  if (!uid) return false;
  const needle = String(uid).trim();
  return ADMIN_UIDS.some((u) => String(u).trim() === needle);
}
