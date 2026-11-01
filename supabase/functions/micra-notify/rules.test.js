import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, waPhone, itemsText, firstName, templatePayload, SEEN_MS, THROTTLE_MS } from './rules.js';

const NOW = Date.parse('2026-10-31T19:12:00Z');
const hold = { status: 'waiting', created_at: new Date(NOW - 5000).toISOString(), name: 'Sebas · oficina 302', items: [{ product: 'tinto', qty: 2 }, { product: 'perico', qty: 1 }] };
const barista = { wa_alerts: true, phone: '573001234567', app_seen_at: null };

test('se escribe solo si el barista lo pidió, tiene celular y no tiene Micra abierta', () => {
  assert.deepEqual(decide({ hold, barista, now: NOW }), { send: true, reason: 'send' });
  assert.equal(decide({ hold: { ...hold, status: 'cancelled' }, barista, now: NOW }).reason, 'not_waiting');
  assert.equal(decide({ hold: { ...hold, created_at: new Date(NOW - 11 * 60000).toISOString() }, barista, now: NOW }).reason, 'stale');
  assert.equal(decide({ hold, barista: { ...barista, wa_alerts: false }, now: NOW }).reason, 'no_optin');
  assert.equal(decide({ hold, barista: { ...barista, phone: '12345' }, now: NOW }).reason, 'no_phone');
  assert.equal(decide({ hold, barista: { ...barista, app_seen_at: new Date(NOW - SEEN_MS / 2).toISOString() }, now: NOW }).reason, 'app_open');
  assert.equal(decide({ hold, barista: { ...barista, app_seen_at: new Date(NOW - SEEN_MS * 3).toISOString() }, now: NOW }).reason, 'send');
  assert.equal(decide({ hold, barista, lastSentAt: new Date(NOW - THROTTLE_MS / 2).toISOString(), now: NOW }).reason, 'throttled');
  assert.equal(decide({ hold, barista, lastSentAt: new Date(NOW - THROTTLE_MS - 1000).toISOString(), now: NOW }).reason, 'send');
  assert.equal(decide({ hold, barista, now: NOW, configured: false }).reason, 'unconfigured');
  assert.equal(decide({ hold: null, barista, now: NOW }).reason, 'not_waiting');
});

test('el celular va con el 57 y diez números que empiezan por 3', () => {
  assert.equal(waPhone('300 123 4567'), '573001234567');
  assert.equal(waPhone('+57 300-123-4567'), '573001234567');
  assert.equal(waPhone('573001234567'), '573001234567');
  assert.equal(waPhone('6011234567'), null);
  assert.equal(waPhone(null), null);
});

test('el mensaje: la plantilla con el nombre de pila y lo que apartó', () => {
  assert.equal(itemsText(hold.items), '2 tintos y 1 perico');
  assert.equal(itemsText([{ product: 'aromatica', qty: 1 }]), '1 aromática');
  assert.equal(itemsText([]), 'café');
  assert.equal(firstName('Sebas · oficina 302'), 'Sebas');
  assert.equal(firstName(''), 'Un cliente');
  assert.deepEqual(templatePayload({ to: '573001234567', hold }), {
    messaging_product: 'whatsapp', to: '573001234567', type: 'template',
    template: {
      name: 'micra_nuevo_apartado', language: { code: 'es' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Sebas' }, { type: 'text', text: '2 tintos y 1 perico' }] }],
    },
  });
});
