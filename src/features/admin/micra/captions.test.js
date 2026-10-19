import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaption, captionFor, primaryDest, waDigits, moneyShort, money, slug, HASHTAGS } from './captions.js';

const now = new Date('2026-10-19T15:04:00-05:00');
const weather = { tempC: 14, icon: '🌧️' };
const time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

test('pie de foto de receta, invitación y anuncio (los mismos de la consola)', () => {
  const variety = { name: 'Geisha', recipe_text: 'Dosis 18 g' };
  assert.equal(buildCaption({ kind: 'recipe', variety, weather, now }), `☕ Geisha — AceroPress\n\nDosis 18 g\n\n🌧️ 14°C en Bogotá · ${time}`);
  const invite = { name: 'Te invito un café', textLabel: 'Para', note: 'Pásate por la barra.' };
  assert.equal(buildCaption({ kind: 'invite', preset: invite, text: 'Ana', weather, now }), `☕ Te invito un café — para: Ana · AceroPress\n\nPásate por la barra.\n\n📍 Chapinero, Bogotá · 🌧️ 14°C en Bogotá · ${time}`);
  const announce = { name: 'Nuevo café', usesVariety: true };
  assert.equal(buildCaption({ kind: 'announce', preset: announce, text: '', variety, weather, now }), `📣 Nuevo café: Geisha — AceroPress\n\nMás información en la barra o por WhatsApp.\n\n🌧️ 14°C en Bogotá · ${time}`);
});

test('WhatsApp va sin etiquetas y con la frase para el cliente; las redes con etiquetas si se piden', () => {
  assert.equal(captionFor('whatsapp', 'Hola', true), 'Hola\n\nTe compartimos la tarjeta de tu preparación 👇');
  assert.equal(captionFor('ig', 'Hola', true), `Hola\n\n${HASHTAGS}`);
  assert.equal(captionFor('ig', 'Hola', false), 'Hola');
});

test('botón rápido según el formato', () => {
  assert.equal(primaryDest('story', true), 'ig');
  assert.equal(primaryDest('portrait', false), 'ig');
  assert.equal(primaryDest('tiktok', true), 'share');
  assert.equal(primaryDest('landscape', false), 'download');
});

test('utilidades', () => {
  assert.equal(waDigits('300 123 4567'), '573001234567');
  assert.equal(waDigits('+57 300 123 4567'), '573001234567');
  assert.equal(moneyShort(32000), '$ 32k');
  assert.equal(money(32000), '$32.000');
  assert.equal(slug('Te invito un café'), 'te-invito-un-cafe');
  assert.equal(slug(''), 'tarjeta');
});
