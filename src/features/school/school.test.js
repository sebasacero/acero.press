import test from 'node:test';
import assert from 'node:assert/strict';
import { BREW_STEPS, brewStepAt, untilNext, clock, parseAmount, cupMath } from './school.js';

test('el cronómetro avanza de paso en los segundos de la receta', () => {
  assert.equal(brewStepAt(0), 0);
  assert.equal(brewStepAt(9.9), 0);
  assert.equal(brewStepAt(10), 1);
  assert.equal(brewStepAt(89), 2);
  assert.equal(brewStepAt(90), 3);
  assert.equal(brewStepAt(500), BREW_STEPS.length - 1);
});

test('dice cuánto falta para el siguiente paso, y nada al terminar', () => {
  assert.equal(untilNext(0), 10);
  assert.equal(untilNext(25), 65);
  assert.equal(untilNext(120), null);
});

test('formatea el reloj en minutos y segundos', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(75.8), '1:15');
  assert.equal(clock(-3), '0:00');
});

test('lee precios como se escriben en Colombia', () => {
  assert.equal(parseAmount('18.500'), 18500);
  assert.equal(parseAmount('$ 18.500'), 18500);
  assert.equal(parseAmount('18500'), 18500);
  assert.equal(parseAmount('1.250.000'), 1250000);
  assert.equal(parseAmount('16,5'), 16.5);
  assert.equal(parseAmount('2.5'), 2.5);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('-4'), null);
});

test('la cuenta de la taza: costo, ganancia y margen', () => {
  // Libra de $20.000 y 15 g por taza: $600 de café; con $200 de vaso y filtro, $800; vendida a $3.000 deja $2.200
  const r = cupMath({ libra: 20000, grams: 15, extras: 200, price: 3000 });
  assert.equal(r.coffee, 600);
  assert.equal(r.cost, 800);
  assert.equal(r.profit, 2200);
  assert.ok(Math.abs(r.margin - 2200 / 3000) < 1e-9);
  assert.equal(r.cupsPerLibra, 33);
});

test('sin precio de venta no inventa ganancia; sin libra no inventa costo', () => {
  const a = cupMath({ libra: 20000, grams: 15, extras: 0, price: null });
  assert.equal(a.cost, 600);
  assert.equal(a.profit, null);
  const b = cupMath({ libra: null, grams: 15, price: 3000 });
  assert.equal(b.cost, null);
  assert.equal(b.margin, null);
});
