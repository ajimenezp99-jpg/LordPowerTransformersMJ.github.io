import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  tienePermiso, filtrarPorZona, sanitizarPerfilRBAC
} from '../assets/js/domain/rbac.js';
import {
  puedeTransicionar, puedeAbrirOrden, aplicarTransicion,
  ESTADOS_ESPECIALES_ACTIVO
} from '../assets/js/domain/workflow.js';
import {
  scorePI, rankearPlanInversion, clasificarPropuestas, PESOS_PI_BASELINE
} from '../assets/js/domain/plan_inversion.js';

describe('RBAC F28', () => {
  test('admin tiene todos los permisos', () => {
    const p = { rol: 'admin', activo: true };
    assert.ok(tienePermiso(p, 'inventario.borrar'));
    assert.ok(tienePermiso(p, 'pi.aprobar'));
    assert.ok(tienePermiso(p, 'ordenes.autorizar'));
  });

  test('analista_tx NO puede autorizar órdenes', () => {
    const p = { rol: 'analista_tx', activo: true };
    assert.ok(tienePermiso(p, 'ordenes.crear'));
    assert.ok(!tienePermiso(p, 'ordenes.autorizar'));
  });

  test('brigadista solo ejecuta', () => {
    const p = { rol: 'brigadista', activo: true };
    assert.ok(tienePermiso(p, 'ordenes.ejecutar'));
    assert.ok(!tienePermiso(p, 'ordenes.crear'));
  });

  test('perfil inactivo no puede nada', () => {
    assert.ok(!tienePermiso({ rol: 'admin', activo: false }, 'inventario.ver'));
  });

  test('ámbito geográfico: zona fuera de zonas[] rechaza', () => {
    const p = { rol: 'analista_tx', activo: true, zonas: ['BOLIVAR'] };
    assert.ok(tienePermiso(p, 'inventario.editar', { zona: 'BOLIVAR' }));
    assert.ok(!tienePermiso(p, 'inventario.editar', { zona: 'ORIENTE' }));
  });

  test('zonas vacías = acceso a todas', () => {
    const p = { rol: 'analista_tx', activo: true, zonas: [] };
    assert.ok(tienePermiso(p, 'inventario.editar', { zona: 'ORIENTE' }));
  });

  test('permisos_extra añaden capacidades', () => {
    const p = { rol: 'auditor_campo', activo: true, permisos_extra: ['ordenes.autorizar'] };
    assert.ok(tienePermiso(p, 'ordenes.autorizar'));
  });

  test('filtrarPorZona respeta zonas del perfil', () => {
    const p = { rol: 'analista_tx', activo: true, zonas: ['BOLIVAR'] };
    const items = [
      { id: 'A', ubicacion: { zona: 'BOLIVAR' } },
      { id: 'B', ubicacion: { zona: 'ORIENTE' } }
    ];
    const r = filtrarPorZona(items, p);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 'A');
  });

  test('sanitizarPerfilRBAC filtra zonas inválidas', () => {
    const s = sanitizarPerfilRBAC({ zonas: ['BOLIVAR', 'MARTE', 'orIentE'] });
    assert.deepEqual(s.zonas, ['BOLIVAR', 'ORIENTE']);
  });
});

describe('Workflow F29 — transiciones con rol', () => {
  test('borrador → propuesta por analista_tx OK', () => {
    const r = puedeTransicionar('borrador', 'propuesta', 'analista_tx');
    assert.equal(r.ok, true);
  });

  test('revisada → autorizada SOLO director', () => {
    assert.equal(puedeTransicionar('revisada', 'autorizada', 'director_proyectos').ok, true);
    assert.equal(puedeTransicionar('revisada', 'autorizada', 'analista_tx').ok, false);
    assert.equal(puedeTransicionar('revisada', 'autorizada', 'brigadista').ok, false);
  });

  test('en_ejecucion → ejecutada por brigadista', () => {
    assert.ok(puedeTransicionar('en_ejecucion', 'ejecutada', 'brigadista').ok);
  });

  test('transición inválida rechazada', () => {
    const r = puedeTransicionar('borrador', 'ejecutada', 'admin');
    assert.equal(r.ok, false);
  });

  test('aplicarTransicion produce log', () => {
    const o = { estado_v2: 'borrador' };
    const n = aplicarTransicion(o, 'propuesta', {
      uid: 'u1', rol: 'analista_tx', nota: 'primera propuesta'
    });
    assert.equal(n.estado_v2, 'propuesta');
    assert.equal(n.transiciones_log.length, 1);
    assert.equal(n.transiciones_log[0].from, 'borrador');
  });

  test('aplicarTransicion lanza si rol no autorizado', () => {
    assert.throws(
      () => aplicarTransicion({ estado_v2: 'revisada' }, 'autorizada', { rol: 'brigadista' }),
      /no autorizado/
    );
  });
});

describe('Workflow F29 — bloqueos §A9.2 + §A9.3', () => {
  test('activo con fin_vida_util_papel solo acepta reemplazo/retiro/OTC', () => {
    const tx = { salud_actual: { fin_vida_util_papel: true } };
    const ok1 = puedeAbrirOrden(tx, { tipo: 'reemplazo' });
    assert.ok(ok1.ok);
    const no = puedeAbrirOrden(tx, { tipo: 'preventivo' });
    assert.ok(!no.ok);
  });

  test('OTC bloquea órdenes que excedan cargabilidad_max_pct', () => {
    const tx = {
      estados_especiales: ['operacion_temporal_controlada'],
      restricciones_operativas: { cargabilidad_max_pct: 75 },
      salud_actual: { crg_pct_medido: 70 }
    };
    const no = puedeAbrirOrden(tx, {
      tipo: 'preventivo', implica_cargabilidad: true, factor: 1.2
    });
    assert.ok(!no.ok);
    assert.ok(no.referencia.includes('A9.3'));
  });

  test('OTC permite órdenes sin impacto de cargabilidad', () => {
    const tx = {
      estados_especiales: ['operacion_temporal_controlada'],
      restricciones_operativas: { cargabilidad_max_pct: 75 },
      salud_actual: { crg_pct_medido: 70 }
    };
    const ok = puedeAbrirOrden(tx, { tipo: 'correctivo' });
    assert.ok(ok.ok);
  });
});

describe('Plan de Inversión F30', () => {
  test('activo con fin_vida_util_papel es candidato forzoso', () => {
    const tx = {
      salud_actual: { hi_final: 3.0, fin_vida_util_papel: true }
    };
    const s = scorePI(tx);
    assert.equal(s.candidato_forzoso, true);
    assert.ok(s.razones.some((r) => r.includes('fin_vida_util_papel')));
  });

  test('HI muy pobre 4.5+ es forzoso', () => {
    const tx = { salud_actual: { hi_final: 4.8, vida_utilizada_pct: 50 } };
    const s = scorePI(tx);
    assert.equal(s.candidato_forzoso, true);
  });

  test('HI bueno + criticidad baja → score bajo', () => {
    const tx = {
      salud_actual: { hi_final: 1.5, vida_utilizada_pct: 10 },
      criticidad: { nivel: 'minima', color: 'VRD' }
    };
    const s = scorePI(tx);
    assert.ok(s.score < 0.3, `score=${s.score}`);
  });

  test('ranking ordena forzosos primero', () => {
    const txs = [
      { id: 'A', salud_actual: { hi_final: 2.0 } },
      { id: 'B', salud_actual: { hi_final: 4.9 } },
      { id: 'C', salud_actual: { hi_final: 3.0, fin_vida_util_papel: true } }
    ];
    const r = rankearPlanInversion(txs);
    const ids = r.map((x) => x.id);
    assert.ok(ids.indexOf('C') < ids.indexOf('A'));
    assert.ok(ids.indexOf('B') < ids.indexOf('A'));
  });

  test('clasificarPropuestas agrupa por nivel', () => {
    const rk = [
      { id: 'a', score: 0.9, candidato_forzoso: true },
      { id: 'b', score: 0.8, candidato_forzoso: false },
      { id: 'c', score: 0.6, candidato_forzoso: false },
      { id: 'd', score: 0.3, candidato_forzoso: false }
    ];
    const c = clasificarPropuestas(rk);
    assert.equal(c.forzosos.length, 1);
    assert.equal(c.alta.length, 1);
    assert.equal(c.media.length, 1);
    assert.equal(c.baja.length, 1);
  });
});

describe('Estados especiales catálogo', () => {
  test('contiene los 6 estados A9.3', () => {
    assert.equal(ESTADOS_ESPECIALES_ACTIVO.length, 6);
  });
});
