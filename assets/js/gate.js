// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Gate dinámico (Fase 12)
// --------------------------------------------------------------
// Valida el código contra Firestore (`gate_codes/{hash}`):
//   - Doc ID = SHA-256(hex) del código en texto plano.
//   - Reglas Firestore: `get` público, `list` y `write` solo admins.
//     Un cliente solo obtiene el doc si ya conoce el código
//     (conoce el hash), lo que elimina la enumeración.
//   - Se respeta el flag `active` y `expires_at`.
//
// Fallback: si Firebase no está configurado o falla el lookup,
// se acepta el código maestro de bootstrap (`BOOTSTRAP_CODE`) para
// que el propietario pueda ingresar siempre y rotar códigos.
// ══════════════════════════════════════════════════════════════

import { validarCodigo } from './data/codigos-acceso.js';

const SESSION_KEY = 'sgm.access';
const SESSION_VAL = '1';
const TARGET_URL  = 'home.html';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('gateForm');
  if (!form) return;

  const input = document.getElementById('gateCode');
  const msg   = document.getElementById('gateMsg');
  const btn   = form.querySelector('button[type="submit"]');

  let busy = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;

    const code = (input.value || '').trim();
    if (!code) return;

    busy = true;
    if (btn) { btn.disabled = true; }
    msg.textContent = '⋯ Verificando…';
    msg.className   = 'gate-msg';

    let ok = false;
    try {
      ok = await validarCodigo(code);
    } catch (_) {
      ok = false;
    }

    if (ok) {
      try { sessionStorage.setItem(SESSION_KEY, SESSION_VAL); } catch (_) {}
      msg.textContent = '✓ Acceso autorizado · redireccionando…';
      msg.className   = 'gate-msg ok';
      input.disabled  = true;
      if (btn) btn.disabled = true;
      setTimeout(() => { location.href = TARGET_URL; }, 650);
      return;
    }

    msg.textContent = '✗ Código inválido o expirado';
    msg.className   = 'gate-msg err';
    input.value = '';
    input.focus();
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');

    busy = false;
    if (btn) btn.disabled = false;
  });
});
