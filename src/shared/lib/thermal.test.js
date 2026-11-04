import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THERMAL_STOPS, channel, thermalTable } from './thermal.js';

test('channel lee cada canal de 0 a 1', () => {
  assert.equal(channel('#FF0000', 0), 1);
  assert.equal(channel('#FF0000', 1), 0);
  assert.equal(channel('#0D0820', 2), 0.125);
  assert.throws(() => channel('red', 0));
  assert.throws(() => channel('#FF0000', 3));
});

test('la escala lleva el rojo de la marca', () => {
  assert.ok(THERMAL_STOPS.includes('#DE1B1B'));
});

test('en las fotos lo claro es caliente; en los dibujos, la tinta', () => {
  const foto = thermalTable(0).split(' ').map(Number);
  const tinta = thermalTable(0, { inkHot: true }).split(' ').map(Number);
  assert.equal(foto.length, THERMAL_STOPS.length);
  // rojo del primer tramo (negro) frío y del último (blanco) caliente
  assert.equal(foto[0], channel('#0D0820', 0));
  assert.equal(foto.at(-1), channel('#FFF3B0', 0));
  assert.deepEqual(tinta, [...foto].reverse());
});
