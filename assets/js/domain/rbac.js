// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — RBAC granular con ámbito geográfico (F28)
// ──────────────────────────────────────────────────────────────
// Extiende el perfil /usuarios/{uid} con:
//   · rol (ya existente F14): uno de 5 operativos + admin sistema.
//   · zonas[]: lista de zonas BOLIVAR/ORIENTE/OCCIDENTE donde
//     el usuario puede ejercer su rol.
//   · contratos[]: (opcional) lista de códigos de contrato que
//     el usuario gestiona (gestor_contractual).
//   · permisos_extra[]: overrides puntuales.
//
// Política: admin > director_proyectos > analista_tx / gestor / brigadista / auditor.
// Las rules Firestore hacen el gate a nivel colección; este módulo
// provee utilidades puras para el frontend (qué botones mostrar,
// qué enlaces ocultar, etc.).
// ══════════════════════════════════════════════════════════════

export const PERMISOS = Object.freeze({
  // Inventario
  'inventario.ver':    ['admin', 'director_proyectos', 'analista_tx', 'brigadista', 'auditor_campo', 'gestor_contractual', 'tecnico'],
  'inventario.editar': ['admin', 'director_proyectos', 'analista_tx'],
  'inventario.borrar': ['admin', 'director_proyectos'],

  // Órdenes
  'ordenes.ver':       ['admin', 'director_proyectos', 'analista_tx', 'brigadista', 'auditor_campo', 'gestor_contractual', 'tecnico'],
  'ordenes.crear':     ['admin', 'director_proyectos', 'analista_tx'],
  'ordenes.autorizar': ['admin', 'director_proyectos'],
  'ordenes.verificar': ['admin', 'director_proyectos', 'auditor_campo'],
  'ordenes.ejecutar':  ['admin', 'brigadista'],

  // Muestras
  'muestras.ver':    ['admin', 'director_proyectos', 'analista_tx', 'auditor_campo', 'tecnico'],
  'muestras.crear':  ['admin', 'analista_tx'],
  'muestras.editar': ['admin', 'analista_tx'],

  // Motor de salud
  'salud.sandbox':  ['admin', 'director_proyectos', 'analista_tx'],
  'salud.umbrales': ['admin', 'director_proyectos'],

  // Importación
  'importar':       ['admin', 'director_proyectos'],

  // Subestaciones / Contratos / Catálogos
  'subestaciones.editar': ['admin', 'director_proyectos'],
  'contratos.editar':     ['admin', 'director_proyectos', 'gestor_contractual'],
  'catalogos.editar':     ['admin', 'director_proyectos'],

  // Plan de Inversión
  'pi.ver':       ['admin', 'director_proyectos', 'gestor_contractual', 'auditor_campo'],
  'pi.aprobar':   ['admin', 'director_proyectos'],

  // Juicio experto FUR
  'fur.resolver': ['admin', 'analista_tx'],   // solo profesional Tx

  // Monitoreo intensivo
  'monitoreo.cerrar': ['admin', 'analista_tx'],

  // Propuestas reclasificación
  'override.manual': ['admin', 'director_proyectos'],

  // Usuarios
  'usuarios.gestionar': ['admin', 'director_proyectos'],

  // Audit log
  'audit.ver': ['admin', 'director_proyectos', 'auditor_campo'],

  // Reportes
  'reportes.generar': ['admin', 'director_proyectos', 'gestor_contractual', 'auditor_campo']
});

/**
 * Chequea si un perfil tiene un permiso dado.
 *
 * @param {{rol, activo, zonas?, contratos?, permisos_extra?}} profile
 * @param {string} permiso — e.g. 'ordenes.autorizar'
 * @param {{zona?, contrato_codigo?}} [contexto]
 */
export function tienePermiso(profile, permiso, contexto = {}) {
  if (!profile || !profile.activo) return false;
  const rol = profile.rol;
  if (!rol) return false;

  // admin: todo.
  if (rol === 'admin') return true;

  // Permisos extra explícitos.
  if (Array.isArray(profile.permisos_extra) && profile.permisos_extra.includes(permiso)) {
    return true;
  }

  const roles = PERMISOS[permiso];
  if (!Array.isArray(roles)) return false;
  if (!roles.includes(rol)) return false;

  // Ámbito geográfico: si se especifica zona, el usuario debe
  // tener esa zona en `zonas` (o zonas vacías = todas).
  if (contexto.zona) {
    const zonas = profile.zonas || [];
    if (zonas.length > 0 && !zonas.includes(contexto.zona)) return false;
  }

  // Ámbito contractual: para gestor_contractual con `contratos[]`.
  if (contexto.contrato_codigo && rol === 'gestor_contractual') {
    const contratos = profile.contratos || [];
    if (contratos.length > 0 && !contratos.includes(contexto.contrato_codigo)) return false;
  }

  return true;
}

/**
 * Filtra una lista de items por ámbito geográfico del usuario.
 * Usado por dashboards (ingeniero_zona sólo ve activos de su zona).
 */
export function filtrarPorZona(items, profile) {
  if (!profile || !Array.isArray(profile.zonas) || profile.zonas.length === 0) {
    return items;  // admin o sin restricción
  }
  const zonas = new Set(profile.zonas);
  return items.filter((x) => {
    const zona = (x.ubicacion && x.ubicacion.zona) || x.zona;
    return !zona || zonas.has(zona);
  });
}

export function sanitizarPerfilRBAC(input) {
  const src = input || {};
  const arrStr = (v) => Array.isArray(v)
    ? v.map((x) => String(x || '').trim().toUpperCase()).filter(Boolean)
    : [];
  return {
    zonas:         arrStr(src.zonas).filter((z) => ['BOLIVAR', 'ORIENTE', 'OCCIDENTE'].includes(z)),
    contratos:     Array.isArray(src.contratos)
                    ? src.contratos.map((x) => String(x || '').trim().toUpperCase()).filter(Boolean)
                    : [],
    permisos_extra: Array.isArray(src.permisos_extra)
                    ? src.permisos_extra.map((x) => String(x || '').trim()).filter(Boolean)
                    : []
  };
}
