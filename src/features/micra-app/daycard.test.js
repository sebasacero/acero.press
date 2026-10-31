import test from 'node:test';
import assert from 'node:assert/strict';
import { storyVariant, storyFigure, routeLine, dayTripOf, streakBadgeToday, firstSaleMoment, goalTimeLabel } from './daycard.js';

test('la tarjeta y el dibujo siguen cómo sale', () => {
  assert.equal(storyVariant('caminando'), 'calle');
  assert.equal(storyVariant('fijo'), 'puesto');
  assert.equal(storyVariant(null), 'puesto');
  assert.equal(storyFigure('caminando'), 'empujando');
  assert.equal(storyFigure('sombrilla'), 'sombrilla');
  assert.equal(storyFigure('fijo'), 'carrito');
  assert.equal(storyFigure(undefined), 'carrito');
});

test('el trazo cabe en la caja sin deformarse y empieza donde empezó', () => {
  const path = [[-74.064, 4.643], [-74.062, 4.645], [-74.060, 4.647], [-74.058, 4.646]];
  const r = routeLine(path, { w: 300, h: 160, pad: 10 });
  assert.ok(r.d.startsWith('M'));
  assert.equal(r.points.length, 4);
  for (const [x, y] of r.points) { assert.ok(x >= 9.9 && x <= 290.1, `x=${x}`); assert.ok(y >= 9.9 && y <= 150.1, `y=${y}`); }
  // Más al norte = más arriba
  assert.ok(r.points[2][1] < r.points[0][1]);
  assert.deepEqual(r.start, r.points[0]);
  assert.deepEqual(r.end, r.points[3]);
});

test('sin recorrido no hay trazo', () => {
  assert.equal(routeLine([]), null);
  assert.equal(routeLine([[-74, 4.6]]), null);
  assert.equal(routeLine([[-74, 4.6], [-74, 4.6]]), null);
  assert.equal(routeLine(null), null);
  // Una línea recta (norte-sur) sí se dibuja
  assert.ok(routeLine([[-74, 4.6], [-74, 4.61]]));
});

test('el recorrido de hoy: el que graba, o el guardado del mismo día', () => {
  const view = { points: 12, distance: 4200, stops: 5, path: [[1, 2], [3, 4]] };
  const saved = { day: '2026-10-31', distance: 3000, stops: 2, path: [[0, 0], [1, 1]] };
  assert.deepEqual(dayTripOf(view, saved, '2026-10-31'), { distance: 4200, stops: 5, path: [[1, 2], [3, 4]] });
  assert.deepEqual(dayTripOf({ points: 0, path: [] }, saved, '2026-10-31'), { distance: 3000, stops: 2, path: [[0, 0], [1, 1]] });
  assert.deepEqual(dayTripOf(null, saved, '2026-11-01'), { distance: 0, stops: 0, path: [] });
});

test('primera taza: racha que sigue, o el hito del día', () => {
  assert.equal(streakBadgeToday(7).days, 7);
  assert.equal(streakBadgeToday(8), null);
  const a = firstSaleMoment({ streak: 1, goal: 15 });
  assert.equal(a.id, 'primera');
  assert.match(a.sub, /Arrancó tu racha/);
  assert.deepEqual(a.stats[2], ['14', 'te faltan']);
  const b = firstSaleMoment({ streak: 5, goal: 15, name: 'Marlene' });
  assert.equal(b.big, '5 días');
  assert.match(b.sub, /^Marlene, tu racha sigue viva/);
  const c = firstSaleMoment({ streak: 7, goal: 15 });
  assert.equal(c.id, 'racha-7');
  assert.match(c.sub, /Una semana entera/);
});

test('la hora de la meta, en Bogotá', () => {
  assert.equal(goalTimeLabel(new Date('2026-10-31T15:24:00Z')), '10:24');
});
