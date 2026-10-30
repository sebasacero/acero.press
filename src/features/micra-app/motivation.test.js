import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streakOf, streakLabel, goalOf, milestone, stepText, lessonPath, figureFor, CAST, dayStory, fillOf } from './motivation.js';

// Semana del viernes 23 al jueves 29 de octubre de 2026 (el último es hoy)
const week = (cups) => cups.map((c, i) => ({ day: `2026-10-${23 + i}`, cups: c }));

test('la racha cuenta los días seguidos hasta ayer, y hoy solo si ya vendió', () => {
  const s = streakOf(week([5, 0, 12, 9, 14, 11, 0]));
  assert.equal(s.count, 4);
  assert.equal(s.todayDone, false);
  assert.equal(s.ifToday, 5);
  assert.equal(s.days.at(-1).today, true);
  assert.deepEqual(s.days.map((d) => d.letter), ['V', 'S', 'D', 'L', 'M', 'M', 'J']);
  assert.equal(streakOf(week([5, 0, 12, 9, 14, 11, 3])).count, 5);
  // Lo que se cuenta en el celular sin señal también vale para hoy
  assert.equal(streakOf(week([5, 0, 12, 9, 14, 11, 0]), 2).count, 5);
  // Ayer sin ventas: la racha vuelve a empezar
  assert.equal(streakOf(week([5, 6, 12, 9, 14, 0, 0])).count, 0);
  assert.equal(streakOf([]).count, 0);
});

test('una racha que llena la semana se dice «7+»', () => {
  const s = streakOf(week([1, 1, 1, 1, 1, 1, 1]));
  assert.equal(s.full, true);
  assert.equal(streakLabel(s), '7+ días');
  assert.equal(streakLabel(streakOf(week([0, 0, 0, 0, 0, 1, 0]))), '1 día');
});

test('la meta: la escogida o el mejor día redondeado a 5; 15 con la semana vacía', () => {
  assert.equal(goalOf(week([12, 18, 9, 22, 15, 0, 3])), 25);
  assert.equal(goalOf(week([2, 1, 0, 0, 0, 0, 0])), 5);
  assert.equal(goalOf(week([0, 0, 0, 0, 0, 0, 30])), 15); // hoy no cuenta para la meta de hoy
  assert.equal(goalOf([]), 15);
  assert.equal(goalOf(week([12, 18, 9, 22, 15, 0, 3]), 20), 20);
  assert.equal(goalOf(week([12]), 0), 15);
});

test('se celebra la meta una vez y cada 5 tazas; deshacer no celebra', () => {
  assert.deepEqual(milestone(14, 15, 15), { kind: 'goal', cups: 15 });
  assert.deepEqual(milestone(9, 10, 15), { kind: 'step', cups: 10, left: 5 });
  assert.equal(milestone(10, 11, 15), null);
  assert.equal(milestone(16, 15, 15), null);
  assert.equal(milestone(15, 15, 15), null);
  // Un apartado de 3 tazas puede saltar el 5 y la meta a la vez: gana la meta
  assert.deepEqual(milestone(13, 16, 15), { kind: 'goal', cups: 16 });
  assert.deepEqual(milestone(19, 20, 15), { kind: 'step', cups: 20, left: 0 });
  assert.equal(stepText(milestone(9, 10, 15)), '¡Llevas 10! Te faltan 5 para tu meta.');
  assert.equal(stepText(milestone(19, 20, 15)), '¡Llevas 20! Vas por encima de tu meta.');
});

test('el camino de lecciones marca lo visto, la que sigue y cuándo puede mandar su video', () => {
  const lessons = [{ key: 'a', title: 'A', mins: 3 }, { key: 'b', title: 'B', mins: 4 }, { key: 'c', title: 'C', mins: 5 }];
  const p = lessonPath(lessons, ['a', 'zz']);
  assert.deepEqual(p.steps.map((s) => s.state), ['done', 'now', 'next']);
  assert.equal(p.done, 1);
  assert.equal(p.nextIdx, 1);
  assert.equal(p.ready, false);
  // Vista salteada: sigue la primera que falta
  assert.deepEqual(lessonPath(lessons, ['b']).steps.map((s) => s.state), ['now', 'done', 'next']);
  const all = lessonPath(lessons, ['a', 'b', 'c']);
  assert.equal(all.ready, true);
  assert.equal(all.nextIdx, -1);
  assert.equal(all.pct, 1);
});

test('cada barista tiene siempre el mismo personaje', () => {
  const id = '60000000-0000-0000-0000-000000000001';
  assert.equal(figureFor(id), figureFor(id));
  assert.ok(CAST.includes(figureFor(id)));
  assert.ok(CAST.includes(figureFor(null)));
  const many = new Set(Array.from({ length: 30 }, (_, i) => figureFor(`id-${i}`)));
  assert.ok(many.size > 2);
});

test('compartir mi día y la taza que se llena', () => {
  assert.equal(dayStory({ cups: 17, total: 25500, streak: 5 }), 'Hoy vendí 17 tazas de café y 5 días seguidos en la calle. Apártame el tuyo en Micra:');
  assert.equal(dayStory({ cups: 1, total: 0, streak: 1 }), 'Hoy vendí 1 taza de café. Apártame el tuyo en Micra:');
  assert.equal(fillOf(5, 20), 0.25);
  assert.equal(fillOf(30, 20), 1);
  assert.equal(fillOf(3, 0), 0);
});
