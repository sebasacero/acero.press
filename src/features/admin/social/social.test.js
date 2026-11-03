import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOf, pillarOf, bogotaTime, rates, median, analyze, bestOf, splitCsv, csvDate, parseMetaCsv,
  buildIdea, weekPlan, mondayOf, planText, postText, mixOf, MIN_N,
} from './social.js';

const NOW = Date.parse('2026-11-03T15:00:00Z');
const post = (o) => ({ media_product: 'REELS', caption: '', reach: 100, like_count: 10, comments_count: 1, saved: 2, shares: 3, posted_at: '2026-10-27T23:30:00Z', ...o });

test('formatOf: reel, carrusel, foto e historia desde Instagram o el CSV', () => {
  assert.equal(formatOf({ media_product: 'REELS', media_type: 'VIDEO' }), 'reel');
  assert.equal(formatOf({ media_product: 'FEED', media_type: 'CAROUSEL_ALBUM' }), 'carrusel');
  assert.equal(formatOf({ media_product: 'FEED', media_type: 'IMAGE' }), 'foto');
  assert.equal(formatOf({ media_product: 'STORY' }), 'historia');
  assert.equal(formatOf({ media_product: 'Secuencia de IG' }), 'carrusel');
  assert.equal(formatOf({}), 'foto');
});

test('pillarOf: por palabras clave, sin tildes; null si no hay ninguna', () => {
  assert.equal(pillarOf('La receta de la final del WAC 2019, campeona'), 'campeones');
  assert.equal(pillarOf('Molienda media, agua a 85 °C: receta'), 'receta');
  assert.equal(pillarOf('Un día con un barista en la calle'), 'calle');
  assert.equal(pillarOf('La LATA de cold brew ya está en la tienda'), 'barra');
  assert.equal(pillarOf('Así va MICRA, la app'), 'micra');
  assert.equal(pillarOf('Feliz domingo'), null);
});

test('bogotaTime: UTC-5, franja de la noche cruza la medianoche', () => {
  assert.deepEqual(bogotaTime('2026-10-27T23:30:00Z'), { day: 2, hour: 18, slot: 'noche' });
  assert.deepEqual(bogotaTime('2026-10-28T04:00:00Z'), { day: 2, hour: 23, slot: 'noche' });
  assert.deepEqual(bogotaTime('2026-10-28T13:00:00Z'), { day: 3, hour: 8, slot: 'manana' });
  assert.equal(bogotaTime('nope'), null);
});

test('rates: por alcance y el puntaje pesa envíos y guardados', () => {
  const r = rates(post());
  assert.equal(r.engagement, 16);
  assert.equal(r.shares, 3);
  assert.equal(r.saves, 2);
  assert.equal(r.score, 3 * 3 + 2 * 2 + 1.5 + 10);
  assert.equal(rates(post({ reach: 0 })), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('analyze: sin posts lo dice y no inventa comparaciones', () => {
  const a = analyze([], [], { now: NOW });
  assert.equal(a.totals.feed, 0);
  assert.equal(a.top.length, 0);
  assert.match(a.findings[0], /Todavía no hay posts/);
});

test('analyze: compara formatos solo con n ≥ 3 y separa las historias', () => {
  const reels = [0, 1, 2].map((i) => post({ id: `r${i}`, shares: 10, caption: 'receta molienda' }));
  const fotos = [0, 1, 2].map((i) => post({ id: `f${i}`, media_product: 'FEED', media_type: 'IMAGE', shares: 0, saved: 0, caption: 'la lata en la tienda' }));
  const carrusel = [post({ id: 'c', media_type: 'CAROUSEL_ALBUM', media_product: 'FEED' })];
  const story = post({ id: 's', media_product: 'STORY' });
  const old = post({ id: 'viejo', posted_at: '2026-01-01T00:00:00Z' });
  const a = analyze([...reels, ...fotos, ...carrusel, story, old], [], { now: NOW });
  assert.equal(a.totals.feed, 7);
  assert.equal(a.totals.stories, 1);
  const b = bestOf(a.byFormat);
  assert.equal(b.best.key, 'reel');
  assert.equal(b.worst.key, 'foto'); // el carrusel (n=1) no entra
  assert.ok(a.findings.some((f) => /formato que mejor funciona: Reel/.test(f) && /n=3/.test(f)));
  assert.ok(a.findings.some((f) => /pilar que mejor funciona: Receta/.test(f)));
  assert.equal(a.top[0].id.startsWith('r'), true);
  assert.equal(bestOf([{ key: 'a', n: MIN_N - 1, score: 9 }, { key: 'b', n: 9, score: 1 }]), null);
});

test('analyze: seguidores ganados en la ventana', () => {
  const a = analyze([], [{ day: '2026-10-01', followers_count: 400 }, { day: '2026-11-02', followers_count: 452 }], { now: NOW });
  assert.deepEqual(a.followers, { now: 452, delta: 52, days: 2 });
});

test('splitCsv: comillas, saltos dentro de comillas, ; o , y BOM', () => {
  assert.deepEqual(splitCsv('﻿a,b\n"x, y","di ""hola""\notra"\n'), [['a', 'b'], ['x, y', 'di "hola"\notra']]);
  assert.deepEqual(splitCsv('a;b\r\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('csvDate: formatos de Meta en hora de Bogotá', () => {
  assert.equal(csvDate('10/28/2026 18:30'), '2026-10-28T23:30:00.000Z');
  assert.equal(csvDate('28/10/2026 18:30'), '2026-10-28T23:30:00.000Z');
  assert.equal(csvDate('2026-10-28T18:30'), '2026-10-28T23:30:00.000Z');
  assert.equal(csvDate('2026-10-28T18:30:00Z'), '2026-10-28T18:30:00.000Z');
  assert.equal(csvDate(''), null);
});

test('parseMetaCsv: columnas en español, números con punto de miles y filas sin fecha', () => {
  const csv = [
    'Identificador de la publicación,Descripción,Hora de publicación,Enlace permanente,Tipo de publicación,Alcance,Me gusta,Comentarios,Veces que se compartió,Veces que se guardó',
    '1,"Receta, paso a paso",10/28/2026 18:30,https://ig/p/1,Reel de IG,1.250,80,4,12,30',
    '2,Sin fecha,,https://ig/p/2,Imagen de IG,10,1,0,0,0',
  ].join('\n');
  const r = parseMetaCsv(csv);
  assert.equal(r.posts.length, 1);
  assert.equal(r.skipped, 1);
  const p = r.posts[0];
  assert.equal(p.reach, 1250);
  assert.equal(p.saved, 30);
  assert.equal(p.shares, 12);
  assert.equal(p.caption, 'Receta, paso a paso');
  assert.equal(formatOf(p), 'reel');
  assert.match(parseMetaCsv('a,b\n1,2').error, /fecha y alcance/);
});

test('buildIdea: estable con la misma semilla, sin «tintero», con campeón del WAC', () => {
  const champions = [{ year: 2019, name: 'Wendelien van Bunnik' }];
  const a = buildIdea({ pillar: 'campeones', format: 'reel', seed: 's1', champions });
  const b = buildIdea({ pillar: 'campeones', format: 'reel', seed: 's1', champions });
  assert.deepEqual(a, b);
  assert.match(a.hook, /Wendelien van Bunnik \(2019\)/);
  assert.deepEqual(a.source, { kind: 'wac', year: 2019 });
  assert.ok(a.hashtags.includes('#AeroPress'));
  for (const pillar of ['receta', 'campeones', 'calle', 'barra', 'micra']) {
    for (let i = 0; i < 12; i += 1) assert.doesNotMatch(postText(buildIdea({ pillar, seed: i })), /tintero/i);
  }
});

test('weekPlan: lunes a domingo, series del plan, 5 cortos + 1 carrusel + historias', () => {
  assert.equal(mondayOf('2026-11-05T15:00:00Z'), '2026-11-02');
  assert.equal(mondayOf('2026-11-02T04:00:00Z'), '2026-10-26'); // domingo 23:00 en Bogotá
  const plan = weekPlan({ monday: '2026-11-02', champions: [{ year: 2025, name: 'Némo Pop' }] });
  assert.equal(plan.length, 7);
  assert.deepEqual(plan.map((p) => p.date), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.equal(plan.filter((p) => p.format === 'reel').length, 5);
  assert.equal(plan.filter((p) => p.format === 'carrusel').length, 1);
  assert.equal(plan[0].series, 'Receta del lunes');
  assert.match(plan[2].hook, /Némo Pop/);
  assert.equal(plan[0].time, '19:00');
  assert.equal(weekPlan({ monday: '2026-11-02', bestSlot: 'manana' })[0].time, '06:00');
  assert.deepEqual(weekPlan({ monday: '2026-11-02' }), weekPlan({ monday: '2026-11-02' }));
  const text = planText(plan);
  assert.match(text, /⬜ Lunes 2\/11 · 19:00 · Reel · Receta en un minuto \(Receta del lunes\)/);
  const mix = mixOf(plan);
  assert.equal(mix.find((m) => m.id === 'receta').actual, 2 / 6);
});
