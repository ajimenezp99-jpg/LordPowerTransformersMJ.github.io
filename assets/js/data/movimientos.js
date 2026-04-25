// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: movimientos (Fase 39)
// ──────────────────────────────────────────────────────────────
// Bitácora INGRESO/EGRESO de suministros. Crear se hace en
// runTransaction para:
//   1. Generar el correlativo MOV-YYYY-NNNN sin colisión.
//   2. Validar stock antes de escribir (rechazar negativo si
//      permitirNegativo=false).
//   3. Persistir el movimiento + entrada de audit en el mismo batch.
//
// Eliminar requiere `justificacion` en opts (regla del plan).
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import {
  sanitizarMovimiento, validarMovimiento
} from '../domain/movimiento_schema.js';
import {
  computarStockDesdeMovimientos,
  siguienteSecuencial,
  validarStockMovimiento,
  DEFAULT_SUMINISTROS_CONFIG
} from '../domain/stock_calculo.js';
import { generarCodigoMov } from '../domain/schema.js';
import { auditar, persistirAuditoria } from '../domain/audit.js';
import { obtenerConfig } from './suministros_config.js';

const COL_NAME = 'movimientos';
const COL_SUMINISTROS = 'suministros';

export { sanitizarMovimiento, validarMovimiento };
export { TIPOS_MOVIMIENTO, tipoMovimientoLabel } from '../domain/schema.js';

export class StockInsuficienteError extends Error {
  constructor(suministroId, faltante, resultado) {
    super(`Stock insuficiente para ${suministroId}: faltan ${faltante} unidades (resultado quedaría en ${resultado}).`);
    this.name = 'StockInsuficienteError';
    this.suministroId = suministroId;
    this.faltante = faltante;
    this.resultado = resultado;
  }
}

function db() {
  const d = getDbSafe();
  if (!d) throw new Error('Firebase no inicializado.');
  return d;
}
function collRef() { return collection(db(), COL_NAME); }
function docRef(id) { return doc(db(), COL_NAME, id); }
function suministroRef(sid) { return doc(db(), COL_SUMINISTROS, sid); }

function auditarSeguro(entry) {
  return persistirAuditoria(
    { db: getDbSafe(), addDoc, collection, serverTimestamp },
    entry
  );
}

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

export async function listar(filtros = {}) {
  const constraints = [];
  if (filtros.anio)             constraints.push(where('anio',             '==', filtros.anio));
  if (filtros.tipo)             constraints.push(where('tipo',             '==', filtros.tipo));
  if (filtros.suministro_id)    constraints.push(where('suministro_id',    '==', filtros.suministro_id));
  if (filtros.transformador_id) constraints.push(where('transformador_id', '==', filtros.transformador_id));
  if (filtros.zona)             constraints.push(where('zona',             '==', filtros.zona));
  constraints.push(orderBy('anio', 'desc'));
  constraints.push(orderBy('codigo', 'desc'));
  if (filtros.limite) constraints.push(limit(filtros.limite));
  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtros = {}, onData, onError) {
  const constraints = [];
  if (filtros.anio)             constraints.push(where('anio',             '==', filtros.anio));
  if (filtros.tipo)             constraints.push(where('tipo',             '==', filtros.tipo));
  if (filtros.suministro_id)    constraints.push(where('suministro_id',    '==', filtros.suministro_id));
  if (filtros.transformador_id) constraints.push(where('transformador_id', '==', filtros.transformador_id));
  if (filtros.zona)             constraints.push(where('zona',             '==', filtros.zona));
  constraints.push(orderBy('anio', 'desc'));
  constraints.push(orderBy('codigo', 'desc'));
  if (filtros.limite) constraints.push(limit(filtros.limite));
  return onSnapshot(
    query(collRef(), ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[movimientos.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/**
 * Calcula el stock actual de un suministro agregando todos sus
 * movimientos. Útil para vistas one-shot. Para realtime use
 * `suscribirStockGlobal`.
 */
export async function computarStock(suministroId) {
  const sumDoc = await getDoc(suministroRef(suministroId));
  if (!sumDoc.exists()) return null;
  const stockInicial = +sumDoc.data().stock_inicial || 0;
  const movs = await listar({ suministro_id: suministroId });
  return computarStockDesdeMovimientos(stockInicial, movs);
}

/**
 * Crear movimiento atómicamente. Lanza StockInsuficienteError si
 * el EGRESO dejaría stock negativo y el config global no lo permite.
 */
export async function crear(payload, uid) {
  // 1. Sanitizar (sin codigo aún — lo asignamos en la tx).
  const inputSinCodigo = { ...payload, codigo: 'MOV-0000-0000' /* placeholder; se reescribe */ };
  const sane = sanitizarMovimiento(inputSinCodigo);
  // No validamos `codigo` todavía — se rellena en la tx.

  if (!sane.anio || !sane.tipo || !sane.suministro_id || !sane.cantidad) {
    throw new Error('Faltan campos obligatorios (anio, tipo, suministro_id, cantidad).');
  }

  const config = await obtenerConfig();
  const permitirNegativo = !!config.permitirNegativo;

  // 2. Tx: lee correlativo y movimientos previos, valida stock, escribe.
  const ref = doc(collRef());  // pre-genera id de documento
  const movId = await runTransaction(db(), async (tx) => {
    // Lee suministro para stock_inicial.
    const sumSnap = await tx.get(suministroRef(sane.suministro_id));
    if (!sumSnap.exists()) {
      throw new Error(`Suministro ${sane.suministro_id} no existe.`);
    }
    const stockInicial = +sumSnap.data().stock_inicial || 0;

    // Lee TODOS los movimientos del suministro (no solo del año):
    //   stock_actual = stock_inicial + Σ ingresos − Σ egresos (todo el histórico).
    const movsTodosSnap = await getDocs(
      query(collRef(), where('suministro_id', '==', sane.suministro_id))
    );
    const movs = movsTodosSnap.docs.map((d) => d.data());
    const stock = computarStockDesdeMovimientos(stockInicial, movs);

    // Valida.
    const v = validarStockMovimiento(stock.actual, sane.tipo, sane.cantidad, permitirNegativo);
    if (!v.ok && v.faltante != null) {
      throw new StockInsuficienteError(sane.suministro_id, v.faltante, v.resultado);
    }

    // Genera código (lee sólo los del año target para correlativo compacto).
    const codigosAnio = movs
      .filter((m) => +m.anio === +sane.anio)
      .map((m) => m.codigo);
    const sec = siguienteSecuencial(codigosAnio, sane.anio);
    const codigo = generarCodigoMov(sane.anio, sec);

    // Sanitiza nuevamente con el código real para validación final.
    const final = sanitizarMovimiento({ ...payload, codigo });
    const errs = validarMovimiento(final);
    if (errs.length > 0) throw new Error('Validación falló:\n  · ' + errs.join('\n  · '));

    tx.set(ref, {
      ...final,
      createdBy: uid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  });

  await auditarSeguro(auditar({
    accion: 'crear', coleccion: COL_NAME, docId: movId,
    uid, nota: `${sane.tipo} ${sane.cantidad} × ${sane.suministro_id} → ${sane.matricula}`
  }));
  return movId;
}

/**
 * Eliminar movimiento. Requiere `opts.justificacion` (no negociable
 * — política del plan: cada delete deja audit trail).
 */
export async function eliminar(id, opts = {}) {
  if (!opts.justificacion || !String(opts.justificacion).trim()) {
    throw new Error('eliminar(movimiento): justificacion es obligatoria.');
  }
  const prev = opts.prev || (await obtener(id));
  await deleteDoc(docRef(id));
  await auditarSeguro(auditar({
    accion: 'eliminar', coleccion: COL_NAME, docId: id, uid: opts.uid,
    nota: prev
      ? `Eliminado ${prev.codigo} (${prev.tipo} ${prev.cantidad} × ${prev.suministro_id}). Justificación: ${opts.justificacion}`
      : `Justificación: ${opts.justificacion}`
  }));
}

// ── Stock global realtime ──────────────────────────────────────
/**
 * Suscripción combinada que recalcula stock para todos los
 * suministros en tiempo real. Patrón equivalente a
 * `alertas.suscribirComputo` con debounce 250 ms.
 *
 * Emite { suministros: [{...sumDoc, stock: {inicial,ingresado,egresado,actual}}], generatedAt }.
 */
export function suscribirStockGlobal(onData, onError) {
  const state = { suministros: null, movimientos: null, config: null };
  let timer = null;
  let stopped = false;

  const fail = (err) => {
    if (onError) onError(err);
    else console.warn('[movimientos.suscribirStockGlobal]', err);
  };

  const emit = () => {
    if (stopped) return;
    if (!state.suministros || !state.movimientos) return;
    try {
      const movsBySum = new Map();
      for (const m of state.movimientos) {
        if (!movsBySum.has(m.suministro_id)) movsBySum.set(m.suministro_id, []);
        movsBySum.get(m.suministro_id).push(m);
      }
      const out = state.suministros.map((s) => ({
        ...s,
        stock: computarStockDesdeMovimientos(s.stock_inicial, movsBySum.get(s.codigo) || [])
      }));
      onData({ suministros: out, generatedAt: new Date(), config: state.config || { ...DEFAULT_SUMINISTROS_CONFIG } });
    } catch (err) { fail(err); }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(emit, 250);
  };

  const sumColl = collection(db(), COL_SUMINISTROS);
  const unsubS = onSnapshot(
    query(sumColl, orderBy('codigo')),
    (s) => { state.suministros = s.docs.map((d) => ({ id: d.id, ...d.data() })); schedule(); },
    fail
  );
  const unsubM = onSnapshot(
    query(collRef(), orderBy('anio', 'desc'), orderBy('codigo', 'desc')),
    (s) => { state.movimientos = s.docs.map((d) => ({ id: d.id, ...d.data() })); schedule(); },
    fail
  );
  // Config opcional — si falla (rules no autorizan, p.ej.), seguimos con defaults.
  let unsubC = () => {};
  try {
    const cfgRef = doc(db(), 'suministros_config', 'global');
    unsubC = onSnapshot(
      cfgRef,
      (s) => {
        state.config = s.exists()
          ? { ...DEFAULT_SUMINISTROS_CONFIG, ...s.data() }
          : { ...DEFAULT_SUMINISTROS_CONFIG };
        schedule();
      },
      () => { state.config = { ...DEFAULT_SUMINISTROS_CONFIG }; schedule(); }
    );
  } catch (_) { /* noop */ }

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    try { unsubS(); } catch (_) { /* noop */ }
    try { unsubM(); } catch (_) { /* noop */ }
    try { unsubC(); } catch (_) { /* noop */ }
  };
}
