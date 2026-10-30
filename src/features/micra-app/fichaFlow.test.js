import test from 'node:test';
import assert from 'node:assert/strict';
import { autoName, quickBody, gpsBadge, savedSummary, readQueue, enqueue, dequeue, isOffline, EMPTY_FICHA, EXTRAS, STEPS } from './fichaFlow.js';

const at = Date.UTC(2026, 9, 29, 15, 5); // 29 oct 10:05 en Bogotá
const gps = { lat: 4.6655, lng: -74.0545, gps_accuracy_m: 12, located_at: new Date(at).toISOString() };

test('autoName: con referencia, con localidad o solo con la hora', () => {
  assert.equal(autoName({ referencia: 'Frente a la panadería', at }), 'Puesto · Frente a la panadería');
  assert.match(autoName({ localidad: 'Kennedy', at }), /^Puesto · Kennedy · 29 de oct/);
  assert.match(autoName({ at }), /^Puesto · 29 de oct,? 10:05$/);
  assert.ok(autoName({ referencia: 'x'.repeat(120), at }).length <= 80);
});

test('quickBody: con nada escrito, la ficha existe igual (nombre inventado) y lleva el GPS', () => {
  const { body, error } = quickBody(EMPTY_FICHA, gps, { now: at });
  assert.equal(error, undefined);
  assert.match(body.name, /^Puesto · 29 de oct/);
  assert.equal(body.photo_consent, false);
  assert.equal(body.ad_consent, false);
  assert.equal(body.lat, 4.6655);
  assert.equal(body.gps_accuracy_m, 12);
  assert.equal(body.localidad, undefined);
  assert.equal(body.products, undefined);
});

test('quickBody: con datos, van limpios; un nombre de una letra se reemplaza', () => {
  const { body } = quickBody({ ...EMPTY_FICHA, name: 'J', referencia: ' Puerta de Plaza de las Américas ', phone: '300 123 4567', localidad: 'Kennedy', formato: 'carrito', products: ['tinto', 'perico', 'nada'], tinto_price: '1.500', termos: '3', hora_inicio: 6, notes: 'Llega a las 6' }, null, { now: at });
  assert.equal(body.name, 'Puesto · Puerta de Plaza de las Américas');
  assert.equal(body.referencia, 'Puerta de Plaza de las Américas');
  assert.equal(body.phone, '573001234567'); // con el 57: igual que el número con el que entra por SMS
  assert.equal(quickBody({ ...EMPTY_FICHA, phone: '+57 300 123 4567' }).body.phone, '573001234567');
  assert.equal(body.localidad, 'Kennedy');
  assert.equal(body.formato, 'carrito');
  assert.deepEqual(body.products, ['tinto', 'perico']);
  assert.equal(body.tinto_price, 1500);
  assert.equal(body.termos, 3);
  assert.equal(body.hora_inicio, 6);
  assert.equal(body.notes, 'Llega a las 6');
  assert.equal(body.lat, undefined);
});

test('quickBody: un GPS con error no viaja; un precio o un teléfono raros avisan', () => {
  assert.equal(quickBody(EMPTY_FICHA, { error: 'fuera' }).body.lat, undefined);
  assert.match(quickBody({ ...EMPTY_FICHA, tinto_price: '99999999' }).error, /tinto/);
  assert.match(quickBody({ ...EMPTY_FICHA, phone: '12' }).error, /WhatsApp/);
  assert.match(quickBody({ ...EMPTY_FICHA, localidad: 'Narnia' }).error, /localidad/);
});

test('gpsBadge: listo, buscando o sin señal', () => {
  assert.deepEqual(gpsBadge(gps, false), { text: 'GPS ±12 m', tone: 'ok' });
  assert.equal(gpsBadge({ ...gps, gps_accuracy_m: 120 }, false).tone, 'warn');
  assert.deepEqual(gpsBadge(null, true), { text: 'Buscando el GPS…', tone: 'wait' });
  assert.deepEqual(gpsBadge({ error: 'x' }, false), { text: 'Sin GPS', tone: 'warn' });
});

test('savedSummary cuenta lo que quedó y lo que falta', () => {
  assert.deepEqual(savedSummary({ ...gps, localidad: 'Bosa' }, { photo: true, uploaded: true }), ['Foto guardada', 'GPS ±12 m', 'Bosa']);
  assert.deepEqual(savedSummary({}, { photo: true, uploaded: false }), ['Foto sin permiso: no se subió', 'Sin GPS: márcalo después en Estudio']);
  assert.equal(savedSummary({}, {})[0], 'Sin foto');
});

test('la cola sin señal: entra, no se repite por ref, sale', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(readQueue(storage), []);
  enqueue(storage, { ref: 'a', body: { name: 'x' }, at: 1 });
  enqueue(storage, { ref: 'a', body: { name: 'y' }, at: 2 });
  enqueue(storage, { ref: 'b', body: { name: 'z' }, at: 3 });
  assert.deepEqual(readQueue(storage).map((x) => [x.ref, x.body.name]), [['a', 'y'], ['b', 'z']]);
  dequeue(storage, 'a');
  assert.deepEqual(readQueue(storage).map((x) => x.ref), ['b']);
  storage.setItem('micra_ficha_queue_v1', 'basura');
  assert.deepEqual(readQueue(storage), []);
  assert.deepEqual(readQueue(null), []);
});

test('isOffline distingue la red caída de un error de la API', () => {
  assert.equal(isOffline(new TypeError('Failed to fetch')), true);
  assert.equal(isOffline(new Error('Load failed')), true);
  assert.equal(isOffline(new Error('El nombre es muy largo.')), false);
});

test('los pasos y los extras están completos', () => {
  assert.deepEqual(STEPS, ['foto', 'quien', 'extras']);
  assert.deepEqual(EXTRAS.map((e) => e.id), ['encuesta', 'video', 'tarjeta', 'recorrido', 'ticket']);
});
