import test from 'node:test';
import assert from 'node:assert/strict';
import { BREW_STEPS, brewStepAt, untilNext, clock, parseAmount, cupMath } from './school.js';

test('el cronómetro avanza de paso en los segundos de la receta', () => {
  assert.equal(brewStepAt(0), 0);
  assert.equal(brewStepAt(9.9), 0);
  assert.equal(brewStepAt(10), 1);
  assert.equal(brewStepAt(89), 2);
  assert.equal(brewStepAt(90), 3);
  assert.equal(brewStepAt(500), BREW_STEPS.length - 1);
});

test('dice cuánto falta para el siguiente paso, y nada al terminar', () => {
  assert.equal(untilNext(0), 10);
  assert.equal(untilNext(25), 65);
  assert.equal(untilNext(120), null);
});

test('formatea el reloj en minutos y segundos', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(75.8), '1:15');
  assert.equal(clock(-3), '0:00');
});

test('lee precios como se escriben en Colombia', () => {
  assert.equal(parseAmount('18.500'), 18500);
  assert.equal(parseAmount('$ 18.500'), 18500);
  assert.equal(parseAmount('18500'), 18500);
  assert.equal(parseAmount('1.250.000'), 1250000);
  assert.equal(parseAmount('16,5'), 16.5);
  assert.equal(parseAmount('2.5'), 2.5);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('-4'), null);
});

test('la cuenta de la taza: costo, ganancia y margen', () => {
  // Libra de $20.000 y 15 g por taza: $600 de café; con $200 de vaso y filtro, $800; vendida a $3.000 deja $2.200
  const r = cupMath({ libra: 20000, grams: 15, extras: 200, price: 3000 });
  assert.equal(r.coffee, 600);
  assert.equal(r.cost, 800);
  assert.equal(r.profit, 2200);
  assert.ok(Math.abs(r.margin - 2200 / 3000) < 1e-9);
  assert.equal(r.cupsPerLibra, 33);
});

test('sin precio de venta no inventa ganancia; sin libra no inventa costo', () => {
  const a = cupMath({ libra: 20000, grams: 15, extras: 0, price: null });
  assert.equal(a.cost, 600);
  assert.equal(a.profit, null);
  const b = cupMath({ libra: null, grams: 15, price: 3000 });
  assert.equal(b.cost, null);
  assert.equal(b.margin, null);
});

test('retomar: la primera lección sin ver; -1 si ya vio todas', async () => {
  const { resumeIndex } = await import('./school.js');
  const ls = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  assert.equal(resumeIndex(ls, []), 0);
  assert.equal(resumeIndex(ls, ['a']), 1);
  assert.equal(resumeIndex(ls, ['a', 'c']), 1);
  assert.equal(resumeIndex(ls, ['a', 'b', 'c']), -1);
});

test('enlace por lección: ida y vuelta, y nada raro se acepta', async () => {
  const { lessonHash, lessonFromHash } = await import('./school.js');
  assert.equal(lessonHash(2), '#leccion-3');
  assert.equal(lessonFromHash('#leccion-3', 6), 2);
  assert.equal(lessonFromHash('#leccion-7', 6), null);
  assert.equal(lessonFromHash('#leccion-0', 6), null);
  assert.equal(lessonFromHash('#beans', 6), null);
  assert.equal(lessonFromHash('', 6), null);
});

test('la meta de la barra suma 3 minutos y sus partes dan 1', async () => {
  const { shares } = await import('./school.js');
  const { LESSONS } = await import('./lessons.js');
  const bar = LESSONS.es.find((l) => l.figure.kind === 'bar').figure;
  const r = shares(bar.time);
  assert.equal(r.total, 180);
  assert.ok(Math.abs(r.parts.reduce((n, p) => n + p.share, 0) - 1) < 1e-9);
});

test('los tres idiomas tienen las mismas lecciones, figuras y pasos', async () => {
  const { LESSONS } = await import('./lessons.js');
  const shape = (ls) => ls.map((l) => [l.key, l.mins, l.figure.kind, l.points.length, l.practice.length,
    l.figure.steps?.length ?? 0, l.figure.readouts?.length ?? 0, l.figure.stations?.length ?? 0, l.figure.time?.map((p) => p.s).join(',') ?? '']);
  assert.deepEqual(shape(LESSONS.en), shape(LESSONS.es));
  assert.deepEqual(shape(LESSONS.ja), shape(LESSONS.es));
  // El despiece numera cuatro partes y la receta trae un texto por cada momento del cronómetro
  const es = LESSONS.es;
  assert.equal(es.find((l) => l.figure.kind === 'parts').points.length, 4);
  assert.equal(es.find((l) => l.figure.kind === 'brew').figure.steps.length, BREW_STEPS.length);
  // Medir: dos lecturas de báscula (café y agua) en cada idioma; la molienda no se elige en ninguna lección
  for (const lang of ['es', 'en', 'ja']) {
    assert.equal(LESSONS[lang].find((l) => l.figure.kind === 'measure').figure.readouts.length, 2);
    assert.equal(LESSONS[lang].some((l) => l.figure.kind === 'grind'), false);
  }
});
