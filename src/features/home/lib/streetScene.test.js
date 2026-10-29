import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, buildStreet, pavingLines } from './streetScene.js';

test('la misma semilla dibuja la misma calle, y otra semilla otra', () => {
  const a = buildStreet({ seed: 7 });
  const b = buildStreet({ seed: 7 });
  const c = buildStreet({ seed: 11 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.facades, c.facades);
});

test('las fachadas cubren todo el ancho, sin huecos, y se paran en el andén', () => {
  const s = buildStreet({ width: 1400, ground: 340, seed: 3 });
  assert.ok(s.facades[0].x <= 0, 'la primera empieza antes del borde');
  const last = s.facades[s.facades.length - 1];
  assert.ok(last.x + last.w >= 1400, 'la última pasa el borde');
  s.facades.forEach((f, i) => {
    if (i === 0) return;
    const prev = s.facades[i - 1];
    assert.ok(f.x - (prev.x + prev.w) <= 20, 'entre fachadas no hay más de 20 px');
    assert.ok(f.h > 0 && f.h <= 300);
    f.windows.forEach((w) => assert.ok(w.y >= 340 - f.h && w.y < 340, 'cada ventana queda dentro de su fachada'));
  });
});

test('los cerros van de lado a lado por detrás de las fachadas', () => {
  const s = buildStreet({ width: 1000, ground: 300, seed: 5 });
  assert.equal(s.hills[0].x, 0);
  assert.equal(s.hills[s.hills.length - 1].x, 1000);
  s.hills.forEach((p) => assert.ok(p.y < 300 - 150, 'cada punto queda bien arriba del andén'));
});

test('el sol sale a la izquierda y a mediodía al centro', () => {
  assert.ok(buildStreet({ width: 1000 }).sun.cx < 200);
  assert.equal(buildStreet({ width: 1000, noon: true }).sun.cx, 500);
});

test('el generador es determinista y da valores en [0, 1)', () => {
  const a = rng(42); const b = rng(42);
  for (let i = 0; i < 50; i += 1) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('las baldosas del andén pasan el borde por los dos lados', () => {
  const xs = pavingLines(500, 50);
  assert.ok(xs[0] < 0 && xs[xs.length - 1] >= 500);
});
