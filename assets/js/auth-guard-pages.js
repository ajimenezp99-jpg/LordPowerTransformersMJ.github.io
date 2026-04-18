/*
 * SGM · TRANSPOWER — Auth Guard para /pages/*.html (Fase 2)
 * Redirige a la raíz si no hay sesión válida.
 */
(function () {
  'use strict';
  try {
    if (sessionStorage.getItem('sgm.access') !== '1') {
      location.replace('../index.html');
    }
  } catch (_) {
    location.replace('../index.html');
  }
})();
