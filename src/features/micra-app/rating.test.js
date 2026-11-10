import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsRating, paidChoices, ratePayload, ratingLabel } from './rating.js';

test('solo un apartado entregado y sin nota pide calificación', () => {
  assert.equal(needsRating({ status: 'served', rating: null }), true);
  assert.equal(needsRating({ status: 'served' }), true);
  assert.equal(needsRating({ status: 'served', rating: 4 }), false);
  assert.equal(needsRating({ status: 'waiting' }), false);
  assert.equal(needsRating(null), false);
});

test('los precios sugeridos empiezan por lo apartado', () => {
  assert.deepEqual(paidChoices(1500, 1), [1500, 1000, 2000]);
  assert.deepEqual(paidChoices(3000, 2), [3000, 2000, 4000]);
  assert.deepEqual(paidChoices(500, 1), [500, 1000]);
  assert.deepEqual(paidChoices(0, 1), []);
});

test('la nota va de 1 a 5 y lo pagado es opcional', () => {
  assert.deepEqual(ratePayload(5, 2500), { rating: 5, paid: 2500 });
  assert.deepEqual(ratePayload(3, ''), { rating: 3, paid: null });
  assert.equal(ratePayload(0, null), null);
  assert.equal(ratePayload(6, null), null);
  assert.equal(ratePayload(4, 90000), null);
});

test('la etiqueta del barista', () => {
  assert.equal(ratingLabel(null), null);
  assert.equal(ratingLabel({ n: 0, avg: null }), null);
  assert.equal(ratingLabel({ n: 1, avg: 5 }), '5,0 · 1 opinión');
  assert.equal(ratingLabel({ n: 12, avg: 4.6 }), '4,6 · 12 opiniones');
});
