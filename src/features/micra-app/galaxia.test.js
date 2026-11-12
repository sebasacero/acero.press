import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TONOS, estrellas, punto, rng } from './galaxia.js';

test('la misma semilla da la misma galaxia', () => {
  assert.deepEqual(estrellas(50, 3), estrellas(50, 3));
  assert.notDeepEqual(estrellas(50, 3), estrellas(50, 4));
  const r = rng(9);
  const v = r();
  assert.ok(v >= 0 && v < 1);
});

test('las estrellas caben en el orbe, giren lo que giren, y el núcleo es lo más caliente', () => {
  const es = estrellas(800);
  for (const rot of [0, 1.3, 4]) {
    for (const e of es) {
      const p = punto(e, rot);
      assert.ok(Math.hypot(p.x, p.y) <= 1.0001);
    }
  }
  assert.ok(es.every((e) => e.tono >= 0 && e.tono < TONOS.length && e.size > 0 && e.alpha > 0 && e.alpha <= 1));
  const brazo = es.filter((e) => e.tono < 5);
  const tono = (xs) => xs.reduce((a, e) => a + e.tono, 0) / xs.length;
  assert.ok(tono(brazo.filter((e) => e.r < 0.25)) < tono(brazo.filter((e) => e.r > 0.7)));
});

test('acostada: la galaxia es más ancha que alta', () => {
  const ps = estrellas(400).map((e) => punto(e, 0, 0.5, 0));
  const max = (f) => Math.max(...ps.map(f));
  assert.ok(max((p) => Math.abs(p.y)) < max((p) => Math.abs(p.x)) * 0.6);
});
