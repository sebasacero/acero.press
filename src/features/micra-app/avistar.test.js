import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPOT_KINDS, readSightingQueue, queueSighting, unqueueSighting, sightingFrom, sightingCounts } from './avistar.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('avistar: dos cosas que se marcan al pasar', () => {
  assert.deepEqual(SPOT_KINDS.map((k) => k.id), ['puesto', 'tomando']);
});

test('avistar: el punto sale del GPS; sin lectura no hay avistamiento', () => {
  const s = sightingFrom({ lat: 4.65, lng: -74.06, accuracy: 12.4 }, 'av-123456', Date.UTC(2026, 10, 6, 15));
  assert.deepEqual(s, { ref: 'av-123456', lat: 4.65, lng: -74.06, accuracy: 12, at: '2026-11-06T15:00:00.000Z' });
  assert.equal(sightingFrom(null, 'x'), null);
  assert.equal(sightingFrom({ error: 'sin permiso' }, 'x'), null);
});

test('avistar: la cola no repite el mismo toque y se vacía al subir', () => {
  const st = mem();
  queueSighting(st, { ref: 'a', lat: 4.6, lng: -74.1, at: 'x' });
  queueSighting(st, { ref: 'a', lat: 4.6, lng: -74.1, at: 'x' });
  queueSighting(st, { ref: 'b', lat: 4.7, lng: -74.0, at: 'y' });
  assert.equal(readSightingQueue(st).length, 2);
  assert.deepEqual(unqueueSighting(st, 'a').map((x) => x.ref), ['b']);
  assert.deepEqual(readSightingQueue({ getItem: () => 'no es json' }), []);
});

test('avistar: hoy (en Bogotá), la semana y lo que espera en el celular', () => {
  const now = new Date('2026-11-06T20:00:00Z');
  const server = [{ at: '2026-11-06T14:00:00Z' }, { at: '2026-11-03T14:00:00Z' }, { at: '2026-10-01T14:00:00Z' }];
  const queued = [{ ref: 'q', at: '2026-11-06T19:00:00Z' }];
  assert.deepEqual(sightingCounts(server, queued, now), { today: 2, week: 3, pending: 1 });
  // A las 2 a. m. UTC del 7 todavía es el 6 en Bogotá
  assert.equal(sightingCounts([{ at: '2026-11-07T02:00:00Z' }], [], new Date('2026-11-06T22:00:00Z')).today, 1);
});
