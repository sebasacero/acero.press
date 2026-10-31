import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoDue, promoSeen, coldBrewPrice, coldBrewText, PROMO_KEY } from './promo.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('el banner sale una vez al día; sin memoria no sale', () => {
  const s = mem();
  assert.equal(promoDue(s, '2026-10-31'), true);
  promoSeen(s, '2026-10-31');
  assert.equal(s.getItem(PROMO_KEY), '2026-10-31');
  assert.equal(promoDue(s, '2026-10-31'), false);
  assert.equal(promoDue(s, '2026-11-01'), true);
  assert.equal(promoDue(null, '2026-10-31'), false);
  assert.equal(promoDue({ getItem: () => { throw new Error('bloqueado'); } }, '2026-10-31'), false);
});

test('el precio de la lata sale de la diapositiva de cold brew del sitio', () => {
  const content = { slides: [
    { title1: { es: 'LATTE.' }, price: 10000 },
    { title1: { es: 'COLD BREW.' }, figLabel: { es: 'FIG. 02 — RECETA COLD BREW (LATA 355 ML)' }, price: 12000 },
  ] };
  assert.equal(coldBrewPrice(content), 12000);
  assert.equal(coldBrewPrice(JSON.stringify(content)), 12000);
  assert.equal(coldBrewPrice({ slides: [{ title1: { es: 'COLD BREW.' }, price: 'gratis' }] }), null);
  assert.equal(coldBrewPrice({ slides: [{ title1: { es: 'LATTE.' }, price: 10000 }] }), null);
  assert.equal(coldBrewPrice('{roto'), null);
  assert.equal(coldBrewPrice(null), null);
});

test('el mensaje de WhatsApp dice qué y cuántas', () => {
  assert.match(coldBrewText(), /una lata de cold brew \(355 ml\)/);
  assert.match(coldBrewText(3), /3 latas/);
});
