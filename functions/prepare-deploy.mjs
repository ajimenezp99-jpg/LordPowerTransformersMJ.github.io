// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Prepare deploy for Cloud Functions
// ──────────────────────────────────────────────────────────────
// Copia los módulos de dominio puro (assets/js/domain/*) a
// functions/domain/ antes del deploy. Cloud Functions empaqueta
// solo el contenido de la carpeta `source`, por lo que imports
// relativos con `../` no pueden salir fuera de functions/.
//
// Este script se ejecuta automáticamente vía el hook `predeploy`
// declarado en firebase.json.
//
// Uso manual:  node functions/prepare-deploy.mjs
// ══════════════════════════════════════════════════════════════

import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDomain = resolve(__dirname, '..', 'assets', 'js', 'domain');
const dstDomain = resolve(__dirname, 'domain');

if (!existsSync(srcDomain)) {
  console.error('✗ No existe la carpeta de dominio:', srcDomain);
  process.exit(1);
}

if (existsSync(dstDomain)) {
  rmSync(dstDomain, { recursive: true, force: true });
}
mkdirSync(dstDomain, { recursive: true });
cpSync(srcDomain, dstDomain, { recursive: true });

// Marca la carpeta como auto-generada.
writeFileSync(
  resolve(dstDomain, 'README.md'),
  '# ⚠ Carpeta auto-generada\n\n' +
  'Esta carpeta es una COPIA sincronizada de `assets/js/domain/` generada por\n' +
  '`functions/prepare-deploy.mjs` antes de cada `firebase deploy --only functions`.\n\n' +
  '**No la edites directamente** — cualquier cambio aquí se sobrescribe en el\n' +
  'próximo deploy. Edita los módulos originales en `assets/js/domain/`.\n'
);

const n = readdirSync(dstDomain).filter((f) => f.endsWith('.js')).length;
console.log('✓ Domain sync:', srcDomain, '→', dstDomain);
console.log('  Módulos .js copiados:', n);
