import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THERMAL_STOPS, heatStops, channel, thermalTable } from './thermal.js';

test('la escala va de caliente a frío y lleva el rojo de la marca', () => {
  assert.equal(THERMAL_STOPS[0], '#FFF3B0');
  assert.ok(THERMAL_STOPS.includes('#DE1B1B'));
});

test('heatStops reparte las paradas de 0 a 1', () => {
  const s = heatStops();
  assert.equal(s.length, THERMAL_STOPS.length - 1);
  assert.equal(s[0].offset, 0);
  assert.equal(s.at(-1).offset, 1);
  assert.ok(s.every((p, i) => i === 0 || p.offset > s[i - 1].offset));
});

test('from recorta lo más caliente y nunca deja menos de dos paradas', () => {
  assert.equal(heatStops({ from: 1 })[0].color, '#FFC23C');
  assert.equal(heatStops({ from: 99 }).length, 2);
});

test('channel lee cada canal de 0 a 1', () => {
  assert.equal(channel('#FF0000', 0), 1);
  assert.equal(channel('#FF0000', 1), 0);
  assert.equal(channel('#0D0820', 2), 0.125);
  assert.throws(() => channel('red', 0));
  assert.throws(() => channel('#FF0000', 3));
});

test('en las fotos lo claro es caliente; en los dibujos, la tinta', () => {
  const foto = thermalTable(0).split(' ').map(Number);
  const tinta = thermalTable(0, { inkHot: true }).split(' ').map(Number);
  assert.equal(foto.length, THERMAL_STOPS.length);
  assert.equal(foto[0], channel('#0D0820', 0));
  assert.equal(foto.at(-1), channel('#FFF3B0', 0));
  assert.deepEqual(tinta, [...foto].reverse());
});
