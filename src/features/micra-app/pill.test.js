import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pillOf, wantLeft } from './pill.js';

const now = Date.parse('2026-11-10T15:00:00Z');

test('la señal dura 60 min', () => {
  assert.equal(wantLeft(now - 10 * 60000, now), 50);
  assert.equal(wantLeft(now - 61 * 60000, now), 0);
  assert.equal(wantLeft(null, now), 0);
  assert.equal(wantLeft(now + 5000, now), 0);
});

test('manda el apartado que espera; luego calificar; luego la señal', () => {
  const holds = [{ status: 'served', rating: null, cups: 1 }, { status: 'waiting', cups: 2 }];
  assert.equal(pillOf({ holds, wantAt: now - 60000, now }).kind, 'hold');
  assert.match(pillOf({ holds, now }).title, /2 tazas/);
  assert.equal(pillOf({ holds: [holds[0]], wantAt: now - 60000, now }).kind, 'rate');
  assert.equal(pillOf({ holds: [{ status: 'served', rating: 4, cups: 1 }], wantAt: now - 60000, now }).kind, 'want');
  assert.match(pillOf({ wantAt: now - 20 * 60000, now }).sub, /40 min/);
});

test('sin nada que contar no hay pastilla', () => {
  assert.equal(pillOf({ holds: [{ status: 'cancelled', cups: 1 }], now }), null);
  assert.equal(pillOf({}), null);
});
