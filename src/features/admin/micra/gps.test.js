import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gpsErrorText, gpsFix, gpsLabel, gpsPayload, gpsQuality } from './gps.js';

const at = (lat, lng, accuracy = 12) => ({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: Date.parse('2026-10-24T15:00:00Z') });

test('el punto del GPS se guarda con su precisión y su hora', () => {
  const fix = gpsFix(at(4.6186123, -74.1359876, 11.6));
  assert.deepEqual(fix, { lat: 4.618612, lng: -74.135988, accuracy: 12, at: '2026-10-24T15:00:00.000Z' });
  assert.equal(gpsLabel(fix), 'Marcado · ±12 m');
  assert.deepEqual(gpsPayload(fix), { lat: 4.618612, lng: -74.135988, gps_accuracy_m: 12, located_at: '2026-10-24T15:00:00.000Z' });
});

test('fuera de Bogotá o sin coordenadas es un error, no un punto', () => {
  assert.match(gpsFix(at(6.2442, -75.5812)).error, /fuera de Bogotá/);
  assert.match(gpsFix({ coords: {} }).error, /no dio la ubicación/);
  assert.deepEqual(gpsPayload(gpsFix(at(0, 0))), {});
  assert.deepEqual(gpsPayload(null), {});
});

test('la precisión dice si hay que volver a marcar', () => {
  assert.equal(gpsQuality(8), 'buena');
  assert.equal(gpsQuality(60), 'regular');
  assert.equal(gpsQuality(400), 'debil');
  assert.match(gpsErrorText({ code: 1 }), /permiso/);
  assert.match(gpsErrorText({ code: 3 }), /tardó/);
});
