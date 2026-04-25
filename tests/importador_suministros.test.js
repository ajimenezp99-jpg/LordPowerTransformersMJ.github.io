// Tests del parser puro del importador de suministros (F42).
// Cero Firebase. Cero SheetJS — el data layer extrae los rows y los
// pasa ya tipados al parser puro.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsearCatalogoRows, parsearMarcasRows,
  parsearJsxTransformadores, jsxRowADocV2,
  parsearJsxCatalogo, enriquecerCatalogoConJsx,
  extraerCorreccionesEmbedded,
  reconciliarEquipos, prepararPlanImportacion
} from '../assets/js/domain/importador_suministros.js';

describe('parsearCatalogoRows (Sheet2)', () => {
  test('parsea filas válidas y normaliza unidad', () => {
    const { suministros, errores } = parsearCatalogoRows([
      { ID: 'S01', Nombre: 'Coraza',         Unidad: 'm',   Stock_Inicial: '0',  Valor_Unitario: '15120.00' },
      { ID: 'S02', Nombre: 'Motoventiladores', Unidad: 'Und', Stock_Inicial: '55', Valor_Unitario: '5,233,200.00' }
    ]);
    assert.equal(errores.length, 0);
    assert.equal(suministros.length, 2);
    assert.equal(suministros[0].codigo, 'S01');
    assert.equal(suministros[0].unidad, 'Mt');
    assert.equal(suministros[0].stock_inicial, 0);
    assert.equal(suministros[1].stock_inicial, 55);
    assert.equal(suministros[1].valor_unitario, 5233200);
  });

  test('skipea filas vacías y totalsRow', () => {
    const { suministros } = parsearCatalogoRows([
      {},
      { ID: '', Nombre: '' },
      { ID: 'TOTAL', Nombre: 'TOTAL' },
      { ID: 'S05', Nombre: 'X', Unidad: 'Und', Stock_Inicial: '1' }
    ]);
    assert.equal(suministros.length, 1);
    assert.equal(suministros[0].codigo, 'S05');
  });

  test('codigo lowercase se eleva a uppercase', () => {
    const { suministros } = parsearCatalogoRows([
      { ID: 's03', Nombre: 'Radiador', Unidad: 'Und', Stock_Inicial: '4' }
    ]);
    assert.equal(suministros[0].codigo, 'S03');
  });
});

describe('parsearMarcasRows (Sheet3)', () => {
  test('parsea marcas válidas', () => {
    const { marcas } = parsearMarcasRows([
      { ID_Suministro: 'S02', Nombre_Suministro: 'Motoventiladores', Marca: 'ZIEHL ABEGG' },
      { ID_Suministro: 'S07', Nombre_Suministro: 'Imagen térmica',   Marca: 'MESSKO' }
    ]);
    assert.equal(marcas.length, 2);
    assert.equal(marcas[0].suministro_id, 'S02');
    assert.equal(marcas[0].marca, 'ZIEHL ABEGG');
  });

  test('skipea placeholders "Por definir" y "(edite)"', () => {
    const { marcas } = parsearMarcasRows([
      { ID_Suministro: 'S01', Nombre_Suministro: 'Coraza', Marca: 'Por definir' },
      { ID_Suministro: 'S02', Nombre_Suministro: 'X',      Marca: 'ABB' },
      { ID_Suministro: 'S03', Nombre_Suministro: 'Y',      Marca: '(edite)' },
      { ID_Suministro: 'S04', Nombre_Suministro: 'Z',      Marca: '—' }
    ]);
    assert.equal(marcas.length, 1);
    assert.equal(marcas[0].marca, 'ABB');
  });

  test('skipea filas sin suministro_id', () => {
    const { marcas } = parsearMarcasRows([
      { ID_Suministro: '', Marca: 'X' },
      { ID_Suministro: 'XYZ', Marca: 'X' }  // patrón inválido
    ]);
    assert.equal(marcas.length, 0);
  });
});

describe('parsearJsxTransformadores (regex + JSON.parse, NO eval)', () => {
  test('extrae array TRANSFORMADORES con keys shorthand', () => {
    const jsx = `
      import React from 'react';
      const TRANSFORMADORES = [
        {m:"T1-M/M-ABA",sub:"AGUAS BLANCAS",zona:"ORIENTE",dep:"CESAR",cod:20026566,ser:64999953,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
        {m:"T1-A/M-AGB",sub:"ALGARROBO",zona:"ORIENTE",dep:"MAGDALENA",cod:20026576,ser:"1LCB393904",pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"}
      ];
      const otraCosa = 1;
    `;
    const arr = parsearJsxTransformadores(jsx);
    assert.equal(arr.length, 2);
    assert.equal(arr[0].m, 'T1-M/M-ABA');
    assert.equal(arr[0].zona, 'ORIENTE');
    assert.equal(arr[1].re, 'OPERATIVA');
  });

  test('soporta null en valores (caso típico del JSX fuente)', () => {
    const jsx = `const TRANSFORMADORES = [
      {m:"T1-M/M-XX",sub:"X",zona:"BOLIVAR",dep:"BOLIVAR",cod:null,ser:"S01",pot:1000,gr:"G1",rt:"ONAN",re:null,reg:"NLTC",vp:"34.5",vs:"13.8",vt:null,uu:"N3T1"}
    ];`;
    const arr = parsearJsxTransformadores(jsx);
    assert.equal(arr.length, 1);
    assert.equal(arr[0].cod, null);
    assert.equal(arr[0].re, null);
  });

  test('lanza si no encuentra el array', () => {
    assert.throws(() => parsearJsxTransformadores('const X = 1;'), /no se encontró el array/);
  });

  test('lanza si el contenido no es JSON válido tras normalización', () => {
    assert.throws(() => parsearJsxTransformadores(`const TRANSFORMADORES = [
      {m:'T1',sub:'X'}
    ];`), /no es JSON válido/);  // single quotes rompen JSON.parse
  });
});

describe('jsxRowADocV2 — mapping corregido (codigo=cod, matricula=m, nombre=sub)', () => {
  test('mapping correcto: codigo del JSX → identificacion.codigo, matricula separada, nombre = subestación', () => {
    const docV2 = jsxRowADocV2({
      m: 'T1-A/M-BYC', sub: 'BAYUNCA', zona: 'BOLIVAR', dep: 'BOLIVAR',
      cod: 20016689, ser: 'P186144', pot: 60000, gr: 'G3', rt: 'ONAF',
      re: 'OPERATIVA', reg: 'OLTC', vp: 66, vs: '34.5', vt: '13.8', uu: 'N4T18'
    });
    // PK administrativa: codigo numérico del JSX, NO la matrícula.
    assert.equal(docV2.identificacion.codigo, '20016689');
    // Matrícula separada del codigo.
    assert.equal(docV2.identificacion.matricula, 'T1-A/M-BYC');
    // Nombre = subestación (legible), NO la matrícula.
    assert.equal(docV2.identificacion.nombre, 'BAYUNCA');
    // Subestación también en ubicacion.
    assert.equal(docV2.ubicacion.subestacion_nombre, 'BAYUNCA');
    // Resto del shape sin tocar.
    assert.equal(docV2.identificacion.tipo_activo, 'POTENCIA');
    assert.equal(docV2.identificacion.grupo, 'G3');
    assert.equal(docV2.identificacion.uucc, 'N4T18');
    assert.equal(docV2.ubicacion.departamento, 'bolivar');
    assert.equal(docV2.ubicacion.zona, 'BOLIVAR');
    assert.equal(docV2.placa.potencia_kva, 60000);
    assert.equal(docV2.placa.serial, 'P186144');
    assert.equal(docV2.electrico.tension_primaria_kv, 66);
    assert.equal(docV2.electrico.tension_secundaria_kv, 34.5);
    assert.equal(docV2.electrico.tipo_tap, 'OLTC');
    assert.equal(docV2.refrigeracion.tipo_refrigeracion, 'ONAF');
    assert.equal(docV2.repuesto.estado, 'OPERATIVA');
    // Proyección plana al raíz: refleja el nuevo shape.
    assert.equal(docV2.codigo, '20016689');
    assert.equal(docV2.nombre, 'BAYUNCA');
    assert.equal(docV2.subestacion, 'BAYUNCA');
    assert.equal(docV2.re, 'OPERATIVA');
  });

  test('codigo numérico se stringifica', () => {
    const docV2 = jsxRowADocV2({ m: 'M', sub: 'S', cod: 12345, dep: 'BOLIVAR', zona: 'BOLIVAR' });
    assert.equal(typeof docV2.identificacion.codigo, 'string');
    assert.equal(docV2.identificacion.codigo, '12345');
  });

  test('cod=null cae a matrícula como fallback (caso real LA SALVACION del JSX)', () => {
    const docV2 = jsxRowADocV2({
      m: 'T1-M/M-SLV', sub: 'LA SALVACION', zona: 'ORIENTE', dep: 'CESAR',
      cod: null, ser: 1072462802, pot: 12500, gr: 'G1'
    });
    // Sin cod válido, usa la matrícula para que el doc tenga PK no vacía.
    assert.equal(docV2.identificacion.codigo, 'T1-M/M-SLV');
    assert.equal(docV2.identificacion.matricula, 'T1-M/M-SLV');
    // Nombre sigue siendo la subestación.
    assert.equal(docV2.identificacion.nombre, 'LA SALVACION');
  });

  test('sub vacía cae a matrícula como nombre fallback', () => {
    const docV2 = jsxRowADocV2({ m: 'T1', sub: '', cod: 999, dep: 'BOLIVAR', zona: 'BOLIVAR' });
    assert.equal(docV2.identificacion.nombre, 'T1');
  });

  test('re=null se sanea a N/A (regla F41)', () => {
    const docV2 = jsxRowADocV2({
      m: 'T1', sub: 'X', zona: 'ORIENTE', dep: 'CESAR',
      pot: 1000, gr: 'G1', rt: 'ONAN', re: null
    });
    assert.equal(docV2.repuesto.estado, 'N/A');
    assert.equal(docV2.re, 'N/A');
  });
});

describe('parsearJsxCatalogo + enriquecerCatalogoConJsx', () => {
  test('extrae array CATALOGO con keys shorthand', () => {
    const jsx = `
      const CATALOGO = [
        { cod: "CAT-01", n: 1, desc: "Coraza",         unid: "m",   valU: 15120.00,  stock: 0,  marca: "Por definir" },
        { cod: "CAT-02", n: 2, desc: "Motoventiladores", unid: "Und", valU: 5233200.00, stock: 55, marca: "ZIEHL ABEGG" }
      ];
    `;
    const arr = parsearJsxCatalogo(jsx);
    assert.equal(arr.length, 2);
    assert.equal(arr[0].cod, 'CAT-01');
    assert.equal(arr[1].valU, 5233200);
  });

  test('enriquece catálogo del .xlsm con valor_unitario del JSX por posición', () => {
    const xlsm = [
      { codigo: 'S01', nombre: 'A', unidad: 'Mt', stock_inicial: 0, valor_unitario: 0, marcas_disponibles: [], observaciones: '' },
      { codigo: 'S02', nombre: 'B', unidad: 'Und', stock_inicial: 55, valor_unitario: 0, marcas_disponibles: [], observaciones: '' }
    ];
    const jsxCat = [
      { cod: 'CAT-01', valU: 15120 },
      { cod: 'CAT-02', valU: 5233200 }
    ];
    const merged = enriquecerCatalogoConJsx(xlsm, jsxCat);
    assert.equal(merged[0].valor_unitario, 15120);
    assert.equal(merged[1].valor_unitario, 5233200);
    assert.equal(merged[0].codigo, 'S01');  // resto del shape sin tocar
  });

  test('si JSX es más corto, completa lo que pueda', () => {
    const xlsm = [{ codigo: 'S01', valor_unitario: 0 }, { codigo: 'S02', valor_unitario: 0 }];
    const merged = enriquecerCatalogoConJsx(xlsm, [{ valU: 100 }]);
    assert.equal(merged[0].valor_unitario, 100);
    assert.equal(merged[1].valor_unitario, 0);
  });
});

describe('extraerCorreccionesEmbedded', () => {
  test('devuelve las 3 correcciones canónicas', () => {
    const corr = extraerCorreccionesEmbedded();
    assert.equal(corr.length, 3);
    assert.deepEqual(corr.map((c) => c.numero), [1, 2, 3]);
    assert.deepEqual(corr.map((c) => c.tipo), ['matricula', 'tension', 'regulacion']);
    for (const c of corr) {
      assert.equal(c.fuente, 'control_suministros-2.jsx');
      assert.ok(c.justificacion.length > 0);
    }
  });
});

describe('reconciliarEquipos', () => {
  test('JSX gana sobre XLSM cuando hay matrícula duplicada', () => {
    const { equipos, conflictos } = reconciliarEquipos(
      [{ matricula: 'T1', identificacion: { codigo: 'T1' }, _src: 'xlsm' }],
      [{ matricula: 'T1', identificacion: { codigo: 'T1' }, _src: 'jsx' }]
    );
    assert.equal(equipos.length, 1);
    assert.equal(equipos[0]._src, 'jsx');
    assert.deepEqual(conflictos, ['T1']);
  });

  test('matriculas únicas en cada lado se preservan', () => {
    const { equipos, conflictos } = reconciliarEquipos(
      [{ matricula: 'A' }],
      [{ matricula: 'B' }]
    );
    assert.equal(equipos.length, 2);
    assert.equal(conflictos.length, 0);
  });
});

describe('prepararPlanImportacion', () => {
  test('genera plan con crear/actualizar/huérfanos correctos', () => {
    const parsed = {
      suministros: [
        { codigo: 'S01', nombre: 'A', unidad: 'Und', stock_inicial: 1, valor_unitario: 100, marcas_disponibles: [], observaciones: '' },
        { codigo: 'S02', nombre: 'B', unidad: 'Und', stock_inicial: 2, valor_unitario: 200, marcas_disponibles: [], observaciones: '' }
      ],
      marcas: [
        { suministro_id: 'S02', suministro_nombre: 'B', marca: 'ABB', observaciones: '' }
      ],
      transformadores: [
        jsxRowADocV2({ m: 'T1', dep: 'BOLIVAR', zona: 'BOLIVAR', pot: 1 }),
        jsxRowADocV2({ m: 'T2', dep: 'CESAR',   zona: 'ORIENTE', pot: 2 })
      ],
      correcciones: extraerCorreccionesEmbedded()
    };
    const existentes = {
      suministrosIds: new Set(['S01', 'S99']),  // S01 existe, S99 huérfano, S02 nuevo
      marcasKeys:     new Set(),
      transformadoresPorMatricula: new Map([
        ['T1', 'doc-id-T1'],   // existe
        ['T-OLD', 'doc-id-old']  // huérfano
      ])
    };
    const plan = prepararPlanImportacion(parsed, existentes);

    // Suministros
    assert.deepEqual(plan.suministros.actualizar.map((s) => s.codigo), ['S01']);
    assert.deepEqual(plan.suministros.crear.map((s) => s.codigo), ['S02']);
    assert.deepEqual(plan.suministros.huerfanos, ['S99']);

    // Marcas
    assert.equal(plan.marcas.crear.length, 1);

    // Transformadores
    assert.equal(plan.transformadores.actualizar.length, 1);
    assert.equal(plan.transformadores.actualizar[0]._existingId, 'doc-id-T1');
    assert.equal(plan.transformadores.crear.length, 1);
    assert.deepEqual(plan.transformadores.huerfanos, ['T-OLD']);

    // Correcciones
    assert.equal(plan.correcciones.crear.length, 3);
  });

  test('plan vacío con inputs vacíos', () => {
    const plan = prepararPlanImportacion({}, {});
    assert.equal(plan.suministros.crear.length, 0);
    assert.equal(plan.suministros.actualizar.length, 0);
    assert.equal(plan.transformadores.crear.length, 0);
    assert.equal(plan.correcciones.crear.length, 0);
  });
});
