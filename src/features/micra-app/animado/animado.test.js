import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Los SVG los genera scripts/animar-personajes: aquí se cuida que cada bucle
// cierre sin salto y que sigan siendo livianos para un celular con mala red.
const dir = new URL('./', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.svg'));

test('están los cinco personajes', () => {
  assert.deepEqual(files.sort(), ['aeropress.svg', 'caminando.svg', 'carrito.svg', 'ruana.svg', 'servir.svg']);
});

for (const f of files) {
  const svg = readFileSync(new URL(f, dir), 'utf8');
  test(`${f}: cada animación cierra el bucle sin salto`, () => {
    const lists = [...svg.matchAll(/values="([^"]+)"/g)].map((m) => m[1].split(';'));
    assert.ok(lists.length >= 1, 'tiene animaciones');
    for (const v of lists) {
      const a = v[0].split(' ').map(Number); const b = v.at(-1).split(' ').map(Number);
      a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < 0.05, `${v[0]} → ${v.at(-1)}`));
    }
  });
  test(`${f}: pesa menos de 130 KB y dice cuánto dura`, () => {
    assert.ok(svg.length < 130 * 1024, `${Math.round(svg.length / 1024)} KB`);
    assert.match(svg, /data-dur="[\d.]+"/);
    assert.doesNotMatch(svg, /<script/);
  });
}
