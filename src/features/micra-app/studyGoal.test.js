import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studyGoal, studyTips, streetDaysLeft, bogotaDay, zoneOf, STUDY_GOAL } from './studyGoal.js';

const NOW = new Date('2026-11-11T15:00:00Z'); // miércoles 10 a. m. en Bogotá
const ficha = (i, extra = {}) => ({ id: `t${i}`, created_at: '2026-10-29T01:00:00Z', lat: 4.6, lng: -74.1, survey: null, ...extra });
const surveyed = (i, extra = {}) => ficha(i, { survey: { surveyed_at: '2026-10-29T01:00:00Z' }, ...extra });

test('días de calle: de lunes a sábado hasta el 30 de noviembre, contando hoy', () => {
  // 11 al 30 nov: 20 días, 2 domingos (15, 22, 29 → 3) → 17
  assert.equal(streetDaysLeft(NOW), 17);
  assert.equal(streetDaysLeft(new Date('2026-12-05T15:00:00Z')), 1);
  assert.equal(bogotaDay('2026-11-12T03:00:00Z'), '2026-11-11');
});

test('la localidad sale del formulario o de la zona escrita', () => {
  assert.equal(zoneOf({ localidad: 'Kennedy' }), 'Kennedy');
  assert.equal(zoneOf({ zone: ' Chapinero ' }), 'Chapinero');
  assert.equal(zoneOf({}), null);
});

test('como hoy: 66 fichas, 3 encuestas en Kennedy y 58 sin localidad', () => {
  const rows = [
    ...[1, 2, 3].map((i) => surveyed(i, { localidad: 'Kennedy' })),
    ...[4, 5, 6, 7, 8].map((i) => ficha(i, { localidad: 'Kennedy', tinto_price: 1000 })),
    ...Array.from({ length: 58 }, (_, i) => ficha(100 + i)),
  ];
  const g = studyGoal(rows, NOW);
  assert.equal(g.surveyed, 3);
  assert.equal(g.surveysLeft, 17);
  // Kennedy: faltan 2 encuestas y ya hay 5 fichas sin encuesta: no hay que mapear ahí
  assert.deepEqual(g.plan[0], { zone: 'Kennedy', surveys: 2, map: 0, fresh: false });
  // Dos localidades nuevas: 5 encuestas y 10 puestos cada una
  assert.deepEqual(g.plan.slice(1), [{ zone: null, surveys: 5, map: 10, fresh: true }, { zone: null, surveys: 5, map: 10, fresh: true }]);
  // Las 5 encuestas que sobran salen de volver a las 58 sin localidad: nada más que mapear
  assert.equal(g.extra, 5);
  assert.equal(g.toMap, 20);
  assert.deepEqual(g.perDay, { surveys: 1, fichas: 2 });
  assert.equal(g.done, false);
  assert.equal(g.needs[0].key, 'celular');
  assert.equal(g.needs.find((n) => n.key === 'localidad').missing, 58);
  const tips = studyTips(g).map((t) => t.key);
  assert.deepEqual(tips, ['volver', 'localidad', 'zona']);
});

test('lo de hoy cuenta para el reto del día, en la hora de Bogotá', () => {
  const rows = [
    ficha(1, { created_at: '2026-11-11T13:00:00Z' }),
    surveyed(2, { created_at: '2026-11-11T14:00:00Z', survey: { surveyed_at: '2026-11-11T14:30:00Z' } }),
    ficha(3, { created_at: '2026-11-11T03:00:00Z' }), // 10 p. m. del 10 en Bogotá
  ];
  const g = studyGoal(rows, NOW);
  assert.deepEqual([g.challenge.fichas.have, g.challenge.surveys.have], [2, 1]);
});

test('con la meta cumplida no queda nada por mapear', () => {
  const zones = ['Kennedy', 'Chapinero', 'Teusaquillo', 'Bosa'];
  const rows = Array.from({ length: 20 }, (_, i) => surveyed(i, { localidad: zones[i % 4] }));
  const g = studyGoal(rows, NOW);
  assert.equal(g.done, true);
  assert.equal(g.toMap, 0);
  assert.deepEqual(g.perDay, { surveys: 0, fichas: 0 });
  assert.equal(g.challenge.done, true);
  assert.equal(STUDY_GOAL.surveys, 20);
});

test('sin fichas: empezar por una localidad', () => {
  const g = studyGoal([], NOW);
  // 20 encuestas a una de cada dos: 40 puestos
  assert.equal(g.toMap, 40);
  assert.equal(g.surveysLeft, 20);
  assert.equal(studyTips(g)[0].key, 'start');
});

test('el ritmo: lo de los últimos 7 días frente a lo que pide la fecha', () => {
  const rows = [
    surveyed(1, { localidad: 'Kennedy', created_at: '2026-11-10T15:00:00Z', survey: { surveyed_at: '2026-11-10T16:00:00Z' } }),
    ficha(2, { created_at: '2026-11-09T15:00:00Z' }),
    ficha(3, { created_at: '2026-11-01T15:00:00Z' }),
  ];
  const g = studyGoal(rows, NOW);
  assert.deepEqual(g.week, { surveys: 1, fichas: 2, prevSurveys: 0, prevFichas: 1 });
  // 19 encuestas en 17 días de calle (≈ 2,8 semanas): 7 por semana
  assert.equal(g.pace.surveys, 7);
  assert.equal(g.onTrack, false);
  assert.equal(g.usable, 1);
});
