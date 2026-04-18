/*
 * SGM · TRANSPOWER — Gate estático (Fase 0)
 * --------------------------------------------------------------
 * Barrera temporal de acceso. En fases posteriores este archivo
 * será reemplazado por una verificación server-side (Fase 12).
 */
(function () {
  'use strict';

  var ACCESS_CODE = '97601992@';
  var SESSION_KEY = 'sgm.access';
  var SESSION_VAL = '1';
  var TARGET_URL  = 'home.html';

  document.addEventListener('DOMContentLoaded', function () {
    var form  = document.getElementById('gateForm');
    if (!form) return;

    var input = document.getElementById('gateCode');
    var msg   = document.getElementById('gateMsg');
    var btn   = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = (input.value || '').trim();

      if (code === ACCESS_CODE) {
        try { sessionStorage.setItem(SESSION_KEY, SESSION_VAL); } catch (_) {}
        msg.textContent = '✓ Acceso autorizado · redireccionando…';
        msg.className   = 'gate-msg ok';
        input.disabled  = true;
        if (btn) btn.disabled = true;
        setTimeout(function () { location.href = TARGET_URL; }, 650);
      } else {
        msg.textContent = '✗ Código inválido';
        msg.className   = 'gate-msg err';
        input.value = '';
        input.focus();
        form.classList.remove('shake');
        void form.offsetWidth;
        form.classList.add('shake');
      }
    });
  });
})();
