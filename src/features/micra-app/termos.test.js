import { test } from 'node:test';
import assert from 'node:assert/strict';
import { termosOf, termosLine, readSetting, stampTermo, clampTermos, clampPer, TERMOS_DEFAULT, PER_TERMO_DEFAULT } from './termos.js';

test('sin ventas: todos llenos y sirve el primero', () => {
  const t = termosOf(0, 5, 11);
  assert.deepEqual(t.levels, [1, 1, 1, 1, 1]);
  assert.equal(t.current, 0);
  assert.equal(t.leftInCurrent, 11);
  assert.equal(t.leftTotal, 55);
});

test('se vacían en orden', () => {
  const t = termosOf(26, 5, 11);
  assert.deepEqual(t.levels.map((l) => Math.round(l * 11)), [0, 0, 7, 11, 11]);
  assert.equal(t.current, 2);
  assert.equal(t.emptied, 2);
  assert.equal(t.leftInCurrent, 7);
  assert.equal(termosLine(t), 'Termo 3 de 5 · le quedan ~7 tintos');
});

test('justo al vaciar uno pasa al siguiente, lleno', () => {
  const t = termosOf(11, 5, 11);
  assert.equal(t.current, 1);
  assert.equal(t.leftInCurrent, 11);
  assert.equal(t.levels[0], 0);
});

test('un tinto en singular', () => {
  assert.equal(termosLine(termosOf(10, 2, 11)), 'Termo 1 de 2 · le queda 1 tinto');
});

test('sin café y con ventas de más', () => {
  const lleno = termosOf(22, 2, 11);
  assert.equal(lleno.current, null);
  assert.equal(termosLine(lleno), 'Se acabó el café de hoy.');
  const mas = termosOf(25, 2, 11);
  assert.equal(mas.over, 3);
  assert.match(termosLine(mas), /3 más de lo que cabía/);
});

test('valores raros se ajustan', () => {
  assert.equal(clampTermos(0), 1);
  assert.equal(clampTermos(99), 12);
  assert.equal(clampTermos('x'), TERMOS_DEFAULT);
  assert.equal(clampPer(1), 4);
  assert.equal(termosOf(-3).leftTotal, TERMOS_DEFAULT * PER_TERMO_DEFAULT);
});

test('lo guardado en el celular', () => {
  assert.deepEqual(readSetting('{"termos":3,"per":15}'), { termos: 3, per: 15 });
  assert.deepEqual(readSetting(null), { termos: 5, per: 11 });
  assert.deepEqual(readSetting('{roto'), { termos: 5, per: 11 });
  assert.deepEqual(readSetting({ termos: 40 }), { termos: 12, per: 11 });
});

test('termo de sellos', () => {
  assert.deepEqual(stampTermo(7, 10), { level: 0.7, marks: 10, left: 3, full: false });
  assert.equal(stampTermo(12, 10).full, true);
  assert.equal(stampTermo(-1, 10).level, 0);
});
