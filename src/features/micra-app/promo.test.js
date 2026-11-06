import { test } from 'node:test';
import assert from 'node:assert/strict';
import { houseCans, coldBrewPrice, canText, HOUSE_CANS } from './promo.js';

const content = { slides: [
  { title1: { es: 'LATTE.' }, price: 10000 },
  { title1: { es: 'COLD BREW.' }, price: 12000 },
  { title1: { es: 'AMERICANO.' }, price: 'gratis' },
] };

test('las latas de la casa toman el precio de su receta en el sitio', () => {
  const cans = houseCans(content);
  assert.deepEqual(cans.map((c) => c.id), HOUSE_CANS.map((c) => c.id));
  assert.deepEqual(cans.map((c) => c.price), [12000, 10000, null, null]);
  assert.equal(cans[0].match, undefined);
  assert.deepEqual(houseCans(JSON.stringify(content)).map((c) => c.price), [12000, 10000, null, null]);
  assert.ok(houseCans('{roto').every((c) => c.price === null));
  assert.ok(houseCans(null).every((c) => c.price === null));
});

test('el precio del cold brew', () => {
  assert.equal(coldBrewPrice(content), 12000);
  assert.equal(coldBrewPrice({ slides: [{ title1: { es: 'LATTE.' }, price: 10000 }] }), null);
});

test('el mensaje de WhatsApp dice qué y cuántas', () => {
  assert.match(canText('Cold brew'), /una lata de cold brew\./);
  assert.match(canText('Latte', 3), /3 latas de latte/);
});
