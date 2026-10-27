import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollProgress, stepAt, progressFor } from './scrolly.js';

test('scrollProgress: 0 antes de llegar, 1 al terminar, proporcional en medio', () => {
  assert.equal(scrollProgress(200, 3000, 900), 0);
  assert.equal(scrollProgress(-2100, 3000, 900), 1);
  assert.equal(scrollProgress(-1050, 3000, 900), 0.5);
  assert.equal(scrollProgress(-50, 800, 900), 0); // más baja que la pantalla: no hay recorrido
});

test('stepAt: diez tramos iguales y el final es el último paso', () => {
  assert.equal(stepAt(0, 10), 0);
  assert.equal(stepAt(0.099, 10), 0);
  assert.equal(stepAt(0.1, 10), 1);
  assert.equal(stepAt(0.55, 10), 5);
  assert.equal(stepAt(1, 10), 9);
  assert.equal(stepAt(-3, 10), 0);
  assert.equal(stepAt(NaN, 10), 0);
  assert.equal(stepAt(0.5, 0), 0);
});

test('progressFor vuelve al mismo paso con stepAt', () => {
  for (let i = 0; i < 10; i += 1) assert.equal(stepAt(progressFor(i, 10), 10), i);
  assert.equal(progressFor(42, 10), 0.95);
});
