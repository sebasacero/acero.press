import test from 'node:test';
import assert from 'node:assert/strict';
import { skyAt, sectionSky, dayPart, sectionClock } from './daySky.js';

test('de día, el cielo de una sección termina donde empieza el de la siguiente', () => {
  const uno = sectionSky(9, 1, 3), dos = sectionSky(9, 3, 6);
  assert.equal(uno.b, dos.a);
  assert.match(uno.a, /^rgba\(\d+,\d+,\d+,1\)$/);
});

test('de noche el texto va en claro y al mediodía en tinta', () => {
  assert.equal(sectionSky(22, 0, 3).dark, true);
  assert.equal(sectionSky(11, 0, 3).dark, false);
});

test('la hora da la vuelta al reloj', () => {
  assert.equal(skyAt(25), skyAt(1));
  assert.deepEqual(sectionClock(23, 3), { text: '2:00', am: true });
});

test('las partes del día', () => {
  assert.deepEqual([2, 6, 9, 12, 15, 18, 21, 27].map(dayPart), [0, 1, 2, 3, 4, 5, 6, 0]);
});

test('a toda hora el texto se lee en las dos puntas de la sección', () => {
  const L = (c) => { const [r, g, b] = c.match(/[\d.]+/g).map(Number); return r * 0.299 + g * 0.587 + b * 0.114; };
  for (let h = 0; h < 24; h += 0.25) for (const [off, next] of [[1, 3], [3, 6], [6, 9], [9, 12], [12, 15], [15, 18], [18, 21]]) {
    const s = sectionSky(h, off, next);
    for (const c of [s.a, s.b]) assert.ok(s.dark ? L(c) < 150 : L(c) > 150, `${h} +${off}: ${c} ${s.dark}`);
  }
});
