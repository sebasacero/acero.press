import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radarView, radarTitle, bearing } from './radar.js';

const me = { lat: 4.643, lng: -74.064 };
const b = (id, name, lat, lng, status = 'live', prices = { tinto: 1500 }) => ({ id, name, lat, lng, status, prices });

test('rumbo: norte 0°, oriente 90°', () => {
  assert.ok(Math.abs(bearing(me, { lat: 4.65, lng: -74.064 })) < 1);
  assert.ok(Math.abs(bearing(me, { lat: 4.643, lng: -74.05 }) - 90) < 1);
});

test('con ubicación: los de la calle a su distancia, el más cerca primero y con su precio', () => {
  const v = radarView([b('w', 'Wilson', 4.64, -74.062), b('m', 'Marlene', 4.6445, -74.0645), b('o', 'Off', 4.643, -74.0641, 'off')], me);
  assert.equal(v.mode, 'live');
  assert.equal(v.count, 2);
  assert.deepEqual(v.dots.map((d) => d.id), ['m', 'w']);
  assert.equal(v.nearest.name, 'Marlene');
  assert.equal(v.nearest.distance, 'a 2 cuadras');
  assert.equal(v.nearest.price, 'Tinto a $1.500');
  // Marlene está al norte: arriba del centro; Wilson al sur: abajo
  assert.ok(v.dots[0].top < 50);
  assert.ok(v.dots[1].top > 50);
  assert.deepEqual(radarTitle(v), { big: '2 baristas', small: 'en la calle cerca de ti' });
});

test('con ubicación: los de más allá del borde no salen ni cuentan', () => {
  const v = radarView([b('x', 'Lejos', 4.75, -74.064)], me);
  assert.equal(v.count, 0);
  assert.equal(v.dots.length, 0);
  assert.equal(v.nearest, null);
});

test('sin ubicación: todos los de la calle, sin cuadras', () => {
  const v = radarView([b('w', 'Wilson', 4.64, -74.062), b('j', 'Jairo', 4.646, -74.066)], null);
  assert.equal(v.count, 2);
  assert.equal(v.nearest, null);
  assert.ok(v.dots.every((d) => d.distance === null && d.left >= 0 && d.left <= 100 && d.top >= 0 && d.top <= 100));
  assert.deepEqual(radarTitle(v), { big: '2 baristas', small: 'en la calle ahora' });
});

test('nadie en la calle: los que suelen estar; nadie con punto: sin radar', () => {
  const v = radarView([b('j', 'Jairo', 4.646, -74.066, 'usual')], me);
  assert.equal(v.mode, 'usual');
  assert.deepEqual(radarTitle(v), { big: 'Nadie en la calle', small: '1 barista suele salir a esta hora' });
  assert.equal(radarView([{ id: 'a', name: 'A', status: 'live' }], me).mode, 'off');
  // El radar no se esconde: sin nadie dice que no hay nadie en la calle
  assert.equal(radarTitle(radarView([], me)).big, 'Nadie en la calle');
  // De noche (nadie en la calle ni de turno) salen apagados los que están en Micra
  const night = radarView([{ id: 'a', name: 'Ana', status: 'off', lat: 4.64, lng: -74.06 }, { id: 'b', name: 'Beto', status: 'off', lat: 4.65, lng: -74.07 }], null);
  assert.equal(night.mode, 'off');
  assert.equal(night.dots.length, 2);
  assert.match(radarTitle(night).small, /2 baristas están en Micra/);
});

test('a lo sumo seis puntos y nunca encima del centro', () => {
  const many = Array.from({ length: 9 }, (_, i) => b(`b${i}`, `B${i}`, 4.643 + i * 0.0005, -74.064));
  const v = radarView(many, me);
  assert.equal(v.dots.length, 6);
  assert.equal(v.count, 9);
  for (const d of v.dots) assert.ok(Math.hypot(d.left - 50, d.top - 50) >= 9.9);
});
