// Escribe los SVG animados de figuras.js en esta carpeta.
import { writeFileSync } from 'node:fs';
import { svg } from './motor.js';
import { FIGURAS } from './figuras.js';

const dir = new URL('.', import.meta.url);
for (const [name, make] of Object.entries(FIGURAS)) {
  writeFileSync(new URL(`${name}.svg`, dir), svg(make()));
  console.log(name);
}
