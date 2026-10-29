// La «llave nativa» de la app Micra: un resumen de los plugins de Capacitor que
// trae la app instalada. Una actualización sin reinstalar (solo la web) sirve
// únicamente si la llave coincide; si cambió un plugin, hay que reinstalar.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function nativeKey(pkgPath = new URL('../package.json', import.meta.url)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const native = Object.keys(deps).filter((k) => k.startsWith('@capacitor') || k.startsWith('@capgo')).sort().map((k) => `${k}@${deps[k]}`).join('|');
  return createHash('sha256').update(native).digest('hex').slice(0, 12);
}
