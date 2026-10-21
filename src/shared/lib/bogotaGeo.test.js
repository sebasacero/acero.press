import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, makeGeo, meters, toLngLat } from './bogotaGeo.js';

test('cada referencia cae exacta en sus coordenadas publicadas', () => {
  for (const [c, k, lat, lng] of ANCHORS) assert.ok(meters(toLngLat(c, k), [lng, lat]) < 1, `${c}/${k}`);
});

test('en Chapinero y el norte, una referencia que se deja afuera se predice a menos de dos cuadras', () => {
  for (const i of [3, 4]) { // Centro Andino y Parque de la 93: la zona del piloto
    const [c, k, lat, lng] = ANCHORS[i];
    const geo = makeGeo(ANCHORS.filter((_, j) => j !== i));
    assert.ok(meters(geo(c, k), [lng, lat]) < 200, `${c}/${k}`);
  }
});

test('más calle es más al norte y más carrera es más al occidente', () => {
  const [, lat72] = toLngLat(13, 72);
  const [, lat85] = toLngLat(13, 85);
  assert.ok(lat85 > lat72);
  const [lng7] = toLngLat(7, 72);
  const [lng15] = toLngLat(15, 72);
  assert.ok(lng15 < lng7);
  // Zona T queda en Bogotá norte, no en otra parte
  const [lng, lat] = toLngLat(13, 83);
  assert.ok(lat > 4.65 && lat < 4.68 && lng > -74.07 && lng < -74.04);
});

test('sin cuadra o fuera de Bogotá no hay coordenadas (null no es la cuadra 0)', () => {
  for (const [c, k] of [[null, 72], [13, ''], ['x', 72], [0, 72], [13, 250], [undefined, undefined]]) assert.equal(toLngLat(c, k), null);
  assert.deepEqual(toLngLat('13', '72'), toLngLat(13, 72));
});
