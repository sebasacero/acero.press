import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftWarnings, shiftClose } from './turno.js';

test('sin nada abierto no hay avisos', () => {
  assert.deepEqual(shiftWarnings({}), []);
});

test('avisa los apartados que esperan y las ventas sin subir', () => {
  const w = shiftWarnings({ waiting: 3, pending: 1 });
  assert.equal(w.length, 2);
  assert.match(w[0], /esperan 3 tazas apartadas/);
  assert.match(w[1], /^1 venta sin subir/);
  assert.match(shiftWarnings({ waiting: 1 })[0], /espera 1 taza/);
});

test('cierre con la meta cumplida', () => {
  const c = shiftClose({ cups: 28, goal: 25, streak: 4 });
  assert.match(c.title, /meta cumplida/);
  assert.match(c.line, /3 más que tu meta/);
  assert.equal(c.racha, 'Llevas 4 días seguidos.');
});

test('cierre justo en la meta', () => {
  assert.match(shiftClose({ cups: 25, goal: 25 }).line, /justo tu meta/);
});

test('cierre sin la meta y sin ventas', () => {
  assert.match(shiftClose({ cups: 18, goal: 25 }).line, /faltaron 7 para tu meta de 25/);
  const z = shiftClose({ cups: 0, goal: 25, streak: 1 });
  assert.equal(z.title, 'Turno cerrado');
  assert.equal(z.racha, null);
});
