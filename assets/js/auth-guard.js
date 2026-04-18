/*
 * SGM · TRANSPOWER — Auth Guard (Fase 0)
 * --------------------------------------------------------------
 * Protege las páginas internas. Si no hay sesión válida de gate,
 * redirige al landing "en construcción".
 *
 * Debe cargarse lo antes posible dentro de <head> para evitar
 * el flash de contenido protegido.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'sgm.access';
  var SESSION_VAL = '1';
  var LANDING_URL = 'index.html';

  try {
    if (sessionStorage.getItem(SESSION_KEY) !== SESSION_VAL) {
      location.replace(LANDING_URL);
    }
  } catch (_) {
    location.replace(LANDING_URL);
  }
})();
