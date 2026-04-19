import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calcularDesempenoAliado, rankingAliados } from '../assets/js/domain/desempeno_aliados.js';
import { auditar, diffSimple, ACCIONES_AUDIT } from '../assets/js/domain/audit.js';

describe('Desempeño aliados F33', () => {
  const ordenes = [
    { aliado_ejecutor: 'CDM', estado: 'cerrada', duracion_horas: 12,
      costo_estimado: 1000, costo_ejecutado: 1100,
      transformadorCodigo: 'TX-1', fecha_cierre: '2026-01-01' },
    { aliado_ejecutor: 'CDM', estado: 'cerrada', duracion_horas: 20,
      costo_estimado: 1000, costo_ejecutado: 900,
      transformadorCodigo: 'TX-1', fecha_cierre: '2026-02-10' }, // reincidencia (<90d)
    { aliado_ejecutor: 'CDM', estado: 'cancelada',
      transformadorCodigo: 'TX-2' },
    { aliado_ejecutor: 'TYS', estado: 'cerrada', duracion_horas: 60,
      costo_estimado: 500, costo_ejecutado: 800,
      transformadorCodigo: 'TX-3', fecha_cierre: '2026-01-15' }
  ];

  test('aliado sin ordenes → score null y counts 0', () => {
    const r = calcularDesempenoAliado('DESCONOCIDO', ordenes);
    assert.equal(r.ordenes_total, 0);
    assert.equal(r.score, null);
  });

  test('CDM: 2 cerradas, 1 cancelada, 1 reincidencia', () => {
    const r = calcularDesempenoAliado('CDM', ordenes);
    assert.equal(r.ordenes_total, 3);
    assert.equal(r.cerradas, 2);
    assert.equal(r.canceladas, 1);
    assert.equal(r.reincidencias, 1);
    assert.ok(r.score >= 0 && r.score <= 100);
  });

  test('TYS con sobre costo 60 % → score penalizado', () => {
    const r = calcularDesempenoAliado('TYS', ordenes);
    assert.equal(r.cerradas, 1);
    assert.ok(r.desviacion_costo_pct > 50);
    assert.ok(r.score < 80);
  });

  test('ranking ordenado desc', () => {
    const rk = rankingAliados(['CDM', 'TYS'], ordenes);
    assert.ok(rk[0].score >= rk[1].score);
  });
});

describe('Audit log F35', () => {
  test('auditar exige accion', () => {
    assert.throws(() => auditar({ coleccion: 'x' }), /accion/);
  });

  test('auditar construye payload completo', () => {
    const p = auditar({
      accion: 'actualizar', coleccion: 'transformadores',
      docId: 'TX-1', uid: 'u1', email: 'x@y.com', rol: 'admin',
      diff: { estado: { antes: 'operativo', despues: 'mantenimiento' } },
      nota: 'Cambio programado'
    });
    assert.equal(p.accion, 'actualizar');
    assert.equal(p.coleccion, 'transformadores');
    assert.ok(p.at_iso.startsWith('20'));
    assert.equal(p.diff.estado.despues, 'mantenimiento');
  });

  test('diffSimple detecta campos cambiados', () => {
    const d = diffSimple(
      { codigo: 'A', estado: 'operativo', marca: 'ABB' },
      { codigo: 'A', estado: 'mantenimiento', marca: 'ABB', serial: 'X' }
    );
    assert.ok(d.estado);
    assert.ok(d.serial);
    assert.ok(!d.codigo);
    assert.ok(!d.marca);
  });

  test('ACCIONES_AUDIT incluye las principales', () => {
    ['crear', 'actualizar', 'aprobar_fur', 'abrir_monitoreo_c2h2'].forEach((a) =>
      assert.ok(ACCIONES_AUDIT.includes(a), `falta ${a}`)
    );
  });
});
