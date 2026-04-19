// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Migración v1 → v2: transformadores
// ──────────────────────────────────────────────────────────────
// Fase 16.
//
// Transforma el shape plano v1 de un documento `transformadores/{id}`
// en el shape estructurado v2 (secciones + salud_actual +
// criticidad) sin perder información y dejando la proyección v1
// aplanada al nivel raíz para retro-compat con vistas legacy.
//
// Diseño:
//   1. `migrarDocV1aV2(docV1)` — función PURA, síncrona, sin
//      dependencias de Firestore. Importable desde tests (Node),
//      desde el importador F17 y desde la UI admin.
//   2. `esV1(doc)` / `esV2(doc)` — detectores para el runner
//      defensivo. Evita re-migrar docs que ya están en v2.
//   3. `ejecutarMigracion({ list, write, log, dryRun, limit })`
//      — runner DEFENSIVO. Acepta cualquier adaptador de I/O
//      (web SDK, admin SDK, mock de tests). Si la colección está
//      vacía o todos los docs ya son v2, termina sin escribir.
//      Reporta { escaneados, migrados, sinCambio, errores }.
//
// Referencia normativa: MO.00418.DE-GAC-AX.01 Ed. 02 §A9.8
// (Tabla 10 como fuente canónica de pesos del HI).
// ══════════════════════════════════════════════════════════════

import {
  sanitizarTransformador,
  validarTransformador,
  proyeccionV1
} from '../../assets/js/domain/transformador_schema.js';
import { DEPARTAMENTOS } from '../../assets/js/domain/schema.js';

// ── Detectores ─────────────────────────────────────────────────

export function esV2(doc) {
  return Boolean(
    doc
    && doc.schema_version === 2
    && doc.identificacion
    && doc.ubicacion
  );
}

export function esV1(doc) {
  if (!doc) return false;
  if (esV2(doc)) return false;
  // v1 aplanado: tiene `codigo` en raíz y `estado` ∈ enum v1.
  return typeof doc.codigo === 'string'
    && typeof doc.estado === 'string';
}

// ── Mapeo departamento v1 → zona (inferido) ────────────────────

function inferZonaDesdeDepartamento(depto) {
  const hit = DEPARTAMENTOS.find((d) => d.value === depto);
  return hit ? hit.zona : '';
}

// ── Transformación pura ────────────────────────────────────────
/**
 * Toma un documento v1 y devuelve un documento v2.
 * - Conserva todos los campos v1 mediante la proyección v1 en el
 *   nivel raíz (mediante el sanitizador de v2).
 * - Infiere `ubicacion.zona` desde `departamento` si es posible.
 * - Deja `salud_actual` vacío (el motor F18 lo poblará en el
 *   primer cálculo) pero marca un flag `_migracion_v2` en
 *   `overrides_aplicados` para trazabilidad.
 * - Deja `identificacion.tipo_activo` como POTENCIA por defecto
 *   (el importador F17 lo corregirá a TPT/RESPALDO según
 *   necesidad por hoja Excel).
 *
 * Función pura. NO llama a Firestore.
 *
 * @param {object} docV1 — documento raw leído de Firestore v1.
 * @returns {object} documento v2 sanitizado y validado.
 */
export function migrarDocV1aV2(docV1) {
  if (!docV1) throw new Error('migrarDocV1aV2: doc es null/undefined.');
  if (esV2(docV1)) {
    // Idempotente: si ya es v2, lo re-sanitiza para garantizar
    // shape correcto pero no se considera migración.
    return sanitizarTransformador(docV1);
  }

  const zonaInferida = inferZonaDesdeDepartamento(docV1.departamento || '');

  // Armamos la entrada para el sanitizador v2. El sanitizador
  // acepta tanto shape plano (fallback) como shape por secciones;
  // le damos shape por secciones explícito para que mapee limpio.
  const entradaV2 = {
    schema_version: 2,
    estado_servicio: docV1.estado || 'operativo',
    estados_especiales: [],
    identificacion: {
      codigo:      docV1.codigo || '',
      nombre:      docV1.nombre || '',
      tipo_activo: 'POTENCIA', // default; F17 corregirá por hoja Excel.
      uucc:        '',
      grupo:       ''
    },
    placa: {
      marca:        docV1.marca  || '',
      modelo:       docV1.modelo || '',
      serial:       docV1.serial || '',
      potencia_kva: docV1.potencia_kva
    },
    ubicacion: {
      departamento:       docV1.departamento || '',
      municipio:          docV1.municipio || '',
      zona:               zonaInferida,
      subestacionId:      '',
      subestacion_nombre: docV1.subestacion || '',
      latitud:            docV1.latitud,
      longitud:           docV1.longitud
    },
    electrico: {
      tension_primaria_kv:   docV1.tension_primaria_kv,
      tension_secundaria_kv: docV1.tension_secundaria_kv
    },
    mecanico:      {},
    refrigeracion: {},
    protecciones:  {},
    fabricacion: {
      fecha_fabricacion: docV1.fecha_fabricacion || '',
      ano_fabricacion:   extraerAnoISO(docV1.fecha_fabricacion)
    },
    servicio: {
      fecha_instalacion: docV1.fecha_instalacion || '',
      observaciones:     docV1.observaciones || ''
    },
    salud_actual: {
      overrides_aplicados: ['_migracion_v2']
    },
    criticidad: {},
    restricciones_operativas: null
  };

  const sane = sanitizarTransformador(entradaV2);
  const errs = validarTransformador(sane);
  if (errs.length > 0) {
    throw new Error(
      `migrarDocV1aV2: validación v2 falló para codigo="${docV1.codigo}":\n  · ` +
      errs.join('\n  · ')
    );
  }

  // Añadimos la proyección v1 al nivel raíz (para que las rules
  // la validen como consistente y las vistas legacy sigan leyendo).
  const flat = proyeccionV1(sane);
  return { ...sane, ...flat };
}

function extraerAnoISO(iso) {
  if (typeof iso !== 'string' || iso.length < 4) return null;
  const ano = parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(ano) && ano > 1900 && ano < 2200 ? ano : null;
}

// ── Runner defensivo ───────────────────────────────────────────
/**
 * Ejecuta la migración escaneando una fuente abstracta.
 *
 * El caller provee los adaptadores de I/O (web SDK, admin SDK,
 * mock de tests):
 *   - `list()`   → promesa que resuelve a [{id, ...data}]
 *   - `write(id, payloadV2)` → promesa que persiste el doc
 *   - `log(level, msg, detalle?)` → logger (opcional)
 *
 * Opciones:
 *   - `dryRun` (bool, default true) — NO llama a write.
 *   - `limit`  (int, default ∞)      — tope de docs a procesar.
 *
 * Retorna un objeto reporte con contadores y errores por código.
 *
 * @returns {Promise<{escaneados, migrados, yaV2, errores, lista}>}
 */
export async function ejecutarMigracion({
  list,
  write,
  log = () => {},
  dryRun = true,
  limite = Infinity
} = {}) {
  if (typeof list !== 'function') {
    throw new Error('ejecutarMigracion: adaptador `list` requerido.');
  }
  if (!dryRun && typeof write !== 'function') {
    throw new Error('ejecutarMigracion: adaptador `write` requerido (dryRun=false).');
  }

  const reporte = {
    dryRun,
    escaneados: 0,
    migrados: 0,
    yaV2: 0,
    errores: [],
    lista: []
  };

  const docs = await list();
  if (!Array.isArray(docs) || docs.length === 0) {
    log('info', 'Colección vacía. Nada que migrar.');
    return reporte;
  }

  let procesados = 0;
  for (const doc of docs) {
    if (procesados >= limite) break;
    reporte.escaneados += 1;

    try {
      if (esV2(doc)) {
        reporte.yaV2 += 1;
        reporte.lista.push({ id: doc.id, estado: 'ya_v2' });
        continue;
      }

      const docV2 = migrarDocV1aV2(doc);
      if (!dryRun) {
        await write(doc.id, docV2);
      }
      reporte.migrados += 1;
      reporte.lista.push({ id: doc.id, estado: dryRun ? 'simulado' : 'migrado' });
      procesados += 1;
    } catch (err) {
      const registro = {
        id: doc && doc.id,
        codigo: doc && doc.codigo,
        error: err && err.message || String(err)
      };
      reporte.errores.push(registro);
      reporte.lista.push({ id: doc && doc.id, estado: 'error' });
      log('error', `Migración fallida para id=${registro.id}`, registro);
    }
  }

  log('info', `Migración terminada. Reporte: ${JSON.stringify({
    escaneados: reporte.escaneados,
    migrados: reporte.migrados,
    yaV2: reporte.yaV2,
    errores: reporte.errores.length,
    dryRun: reporte.dryRun
  })}`);

  return reporte;
}
