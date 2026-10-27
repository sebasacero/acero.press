import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DURATION, CLIP_STEPS, passProgress, timeAt, clipStepAt } from './videoScroll.js';

test('passProgress: 0 al entrar, 1 al salir, y nunca fuera de 0–1', () => {
  // banner de 400 px en una pantalla de 1000: centro en 800 → 0; centro en 200 → 1
  assert.equal(passProgress(600, 400, 1000), 0);
  assert.equal(passProgress(0, 400, 1000), 1);
  assert.equal(passProgress(300, 400, 1000), 0.5);
  assert.equal(passProgress(2000, 400, 1000), 0);
  assert.equal(passProgress(-3000, 400, 1000), 1);
  assert.equal(passProgress(0, 400, 0), 0);
});

test('timeAt: recorre el clip entero', () => {
  assert.equal(timeAt(0), 0);
  assert.equal(timeAt(1), DURATION);
  assert.equal(timeAt(2), DURATION);
  assert.equal(timeAt('x'), 0);
});

test('clipStepAt: el momento que corresponde a cada segundo', () => {
  assert.equal(clipStepAt(0), 0);
  assert.equal(clipStepAt(4.69), 0);
  assert.equal(clipStepAt(4.7), 1);
  assert.equal(clipStepAt(12), 3);
  assert.equal(clipStepAt(DURATION), CLIP_STEPS.length - 1);
});
