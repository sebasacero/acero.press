import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCart, paidOnReturn } from './cartStorage.js';

const bag = { id: 'castillo-250-g', name: 'Castillo', variant: '250 g', price: 38000, qty: 2, variantId: 'v1' };

test('el carrito guardado vuelve tal cual', () => {
  assert.deepEqual(parseCart(JSON.stringify([bag])), [bag]);
});

test('lo guardado roto o vacío da un carrito vacío', () => {
  assert.deepEqual(parseCart(null), []);
  assert.deepEqual(parseCart(''), []);
  assert.deepEqual(parseCart('{no es json'), []);
  assert.deepEqual(parseCart('{"id":"x"}'), []);
});

test('se descartan artículos con forma rara', () => {
  const raw = JSON.stringify([
    bag,
    { ...bag, id: 'a', qty: 0 },
    { ...bag, id: 'b', qty: 1.5 },
    { ...bag, id: 'c', price: 'gratis' },
    { ...bag, id: 'd', price: -1 },
    { ...bag, id: 'e', qty: 5000 },
    { name: 'sin id', price: 1, qty: 1 },
    null,
  ]);
  assert.deepEqual(parseCart(raw).map((i) => i.id), ['castillo-250-g']);
});

test('al volver de un pago aprobado o en curso, el carrito empieza vacío; cancelado no', () => {
  assert.equal(paidOnReturn('?payment=success'), true);
  assert.equal(paidOnReturn('?utm_source=ig&payment=pending'), true);
  assert.equal(paidOnReturn('?payment=cancelled'), false);
  assert.equal(paidOnReturn('?payment=successful'), false);
  assert.equal(paidOnReturn(''), false);
});
