// Tests del importador Excel (F17).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsearFilaTransformador, procesarLibro, HOJAS_TIPO_ACTIVO
} from '../assets/js/domain/importador.js';

describe('parsearFilaTransformador', () => {
  test('fila mínima → doc v2 válido con tipo_activo inferido de la hoja', () => {
    const { docV2, diagnostico } = parsearFilaTransformador({
      codigo: 'TX-01',
      nombre: 'TX Barranquilla',
      departamento: 'BOLIVAR',
      potencia_kva: '50000'
    }, 'TX_Potencia');
    assert.equal(docV2.identificacion.codigo, 'TX-01');
    assert.equal(docV2.identificacion.tipo_activo, 'POTENCIA');
    assert.equal(docV2.ubicacion.departamento, 'bolivar');
    assert.equal(docV2.ubicacion.zona, 'BOLIVAR');
    assert.equal(docV2.placa.potencia_kva, 50000);
    assert.deepEqual(diagnostico.errores_validacion, []);
  });

  test('hoja TPT_Servicio → tipo_activo TPT', () => {
    const { docV2 } = parsearFilaTransformador({
      codigo: 'TPT-1', nombre: 'Servicio', departamento: 'cesar'
    }, 'TPT_Servicio');
    assert.equal(docV2.identificacion.tipo_activo, 'TPT');
  });

  test('hoja TX_Respaldo → tipo_activo RESPALDO', () => {
    const { docV2 } = parsearFilaTransformador({
      codigo: 'TR-1', nombre: 'Respaldo', departamento: 'Sucre'
    }, 'TX_Respaldo');
    assert.equal(docV2.identificacion.tipo_activo, 'RESPALDO');
  });

  test('recalcula HI con gases DGA (no confía en condicion_excel)', () => {
    const { docV2, diagnostico } = parsearFilaTransformador({
      codigo: 'TX-02', nombre: 'T', departamento: 'cordoba',
      h2: 50, ch4: 50, c2h4: 50, c2h6: 50, c2h2: 8, co: 200, co2: 2000,
      rd: 18, ti: 500, nn: 1,   // rigidez baja → calif 5
      ppb: 6000,                  // FUR alto
      cp: 95, ap: 100,            // 95 % cargabilidad → calif 5
      condicion: 2                // Excel dice 2
    }, 'TX_Potencia');

    assert.ok(docV2.salud_actual.hi_final > 3,
      `HI debería ser alto por CRG=5 y DGA/ADFQ degradados: ${docV2.salud_actual.hi_final}`);
    assert.ok(diagnostico.diferencia != null, 'debe calcular diferencia');
    assert.ok(diagnostico.diferencia > 0.5,
      `diferencia = ${diagnostico.diferencia}`);
  });

  test('override CRG=5 automático se aplica durante import', () => {
    const { docV2 } = parsearFilaTransformador({
      codigo: 'TX-03', nombre: 'Sobrecargado', departamento: 'bolivar',
      cp: 95, ap: 100
    }, 'TX_Potencia');
    assert.equal(docV2.salud_actual.calif_crg, 5);
    assert.ok(docV2.salud_actual.hi_final >= 4,
      `HI debe ser ≥4 por override CRG=5: ${docV2.salud_actual.hi_final}`);
  });

  test('fechas dd/mm/yyyy se convierten a ISO', () => {
    const { docV2 } = parsearFilaTransformador({
      codigo: 'TX-04', nombre: 'x', departamento: 'bolivar',
      fecha_fabricacion: '15/05/2010',
      fecha_instalacion: '01/08/2010'
    }, 'TX_Potencia');
    assert.equal(docV2.fabricacion.fecha_fabricacion, '2010-05-15');
    assert.equal(docV2.servicio.fecha_instalacion, '2010-08-01');
    assert.equal(docV2.fabricacion.ano_fabricacion, 2010);
  });

  test('comas decimales se convierten a puntos', () => {
    const { docV2 } = parsearFilaTransformador({
      codigo: 'TX-05', nombre: 'x', departamento: 'bolivar',
      potencia_kva: '34,5'
    }, 'TX_Potencia');
    assert.equal(docV2.placa.potencia_kva, 34.5);
  });

  test('departamento con tildes se normaliza', () => {
    const { docV2 } = parsearFilaTransformador({
      codigo: 'TX-06', nombre: 'x', departamento: 'Córdoba'
    }, 'TX_Potencia');
    assert.equal(docV2.ubicacion.departamento, 'cordoba');
    assert.equal(docV2.ubicacion.zona, 'OCCIDENTE');
  });

  test('fila vacía lanza error', () => {
    assert.throws(() => parsearFilaTransformador(null));
  });
});

describe('procesarLibro — reporte agregado', () => {
  test('cuenta por hoja y acumula discrepancias', () => {
    const hojas = [
      {
        hoja: 'TX_Potencia',
        filas: [
          { codigo: 'TX-A', nombre: 'A', departamento: 'bolivar', condicion: 1, cp: 95, ap: 100 },
          { codigo: 'TX-B', nombre: 'B', departamento: 'cesar',   condicion: 2, cp: 50, ap: 100 }
        ]
      },
      {
        hoja: 'TPT_Servicio',
        filas: [
          { codigo: 'TPT-1', nombre: 'P', departamento: 'sucre', condicion: 1, cp: 20, ap: 100 }
        ]
      }
    ];
    const { resultados, reporte } = procesarLibro(hojas);
    assert.equal(reporte.total_filas, 3);
    assert.equal(reporte.exitosos, 3);
    assert.equal(reporte.por_hoja['TX_Potencia'], 2);
    assert.equal(reporte.por_hoja['TPT_Servicio'], 1);
    // TX-A con CRG=5 override → HI ≥ 4, Excel dice 1 → diferencia > 0.5
    assert.ok(reporte.discrepancias_excel_mo00418.length >= 1);
    assert.equal(resultados.length, 3);
    assert.equal(resultados[2].docV2.identificacion.tipo_activo, 'TPT');
  });
});

describe('HOJAS_TIPO_ACTIVO — mapeo case-insensitive', () => {
  test('acepta variantes mayúsculas/minúsculas', () => {
    assert.equal(HOJAS_TIPO_ACTIVO['TX_Potencia'], 'POTENCIA');
    assert.equal(HOJAS_TIPO_ACTIVO['TX_POTENCIA'], 'POTENCIA');
    assert.equal(HOJAS_TIPO_ACTIVO['TPT_Servicio'], 'TPT');
    assert.equal(HOJAS_TIPO_ACTIVO['TX_Respaldo'], 'RESPALDO');
  });
});
