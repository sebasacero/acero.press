import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ik, P, svg, walk } from './motor.js';
import { FIGURAS } from './figuras.js';

test('ik llega al objetivo si alcanza y se estira si no', () => {
  const S = P(0, 0);
  const { E, T } = ik(S, P(60, 20), 44, 44, 1);
  assert.ok(Math.abs(Math.hypot(E.x, E.y) - 44) < 1e-6);
  assert.ok(Math.abs(Math.hypot(T.x - E.x, T.y - E.y) - 44) < 1e-6);
  assert.deepEqual([Math.round(T.x), Math.round(T.y)], [60, 20]);
  const far = ik(S, P(300, 0), 44, 44, 1).T;
  assert.ok(far.x < 88.01 && far.x > 87.9);
});

test('la marcha vuelve al mismo paso al cerrar la vuelta', () => {
  assert.ok(Math.abs(walk(0).thigh - walk(1).thigh) < 1e-9);
  assert.ok(Math.abs(walk(0).bend - walk(1).bend) < 1e-9);
});

for (const [name, make] of Object.entries(FIGURAS)) {
  test(`${name}: cada animación cierra el bucle sin salto`, () => {
    const out = svg(make());
    const lists = [...out.matchAll(/values="([^"]+)"/g)].map((m) => m[1].split(';'));
    assert.ok(lists.length > 5, 'tiene animaciones');
    for (const v of lists) {
      // la rueda gira vueltas enteras de 60° (seis rayos): mismo dibujo
      if (/^-?[\d.]+ [\d.]+ [\d.]+$/.test(v[0])) {
        const a = Number(v[0].split(' ')[0]); const b = Number(v.at(-1).split(' ')[0]);
        assert.equal(Math.round((b - a) * 10) % 600, 0, `${name}: ${v[0]} → ${v.at(-1)}`);
        continue;
      }
      if (/^M0 0$|^M[\d.]+ \d+ l-9 14$/.test(v[0])) continue; // juntas del piso: corren y vuelven a su sitio
      assert.equal(v[0], v.at(-1), `${name}: ${v[0]} → ${v.at(-1)}`);
    }
  });

  test(`${name}: el SVG guardado es el que sale del código`, () => {
    const saved = readFileSync(new URL(`./${name}.svg`, import.meta.url), 'utf8');
    assert.equal(saved, svg(make()), 'corre node src/features/micra-app/animado/generar.js');
  });
}
