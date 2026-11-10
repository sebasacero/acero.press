import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insights, diffEvents, snapshot, pushLog, placeName, meters } from './panelInsights.js';

const row = (o) => ({ id: 'a', name: 'Marlene', where: 'Cl. 57', live: false, waiting: 0, cups: 0, linked: true, prices: true, ...o });
const cell = (lat, lng, n, drinks = {}) => ({ lat, lng, n, drinks });
const keys = (list) => list.map((i) => i.key.split(':')[0]);

test('meters y placeName: el punto conocido más cercano nombra la zona', () => {
  assert.ok(Math.abs(meters({ lat: 4.64, lng: -74.06 }, { lat: 4.65, lng: -74.06 }) - 1112) < 5);
  const places = [{ lat: 4.643, lng: -74.064, referencia: 'Cl. 57 con Cra. 7' }, { lat: 4.75, lng: -74.09, localidad: 'Suba' }];
  assert.equal(placeName({ lat: 4.644, lng: -74.064 }, places), 'Cl. 57 con Cra. 7');
  assert.equal(placeName({ lat: 4.751, lng: -74.09 }, places), 'Suba');
  assert.equal(placeName({ lat: 4.9, lng: -74.2 }, places), null);
});

test('mejora: una zona con demanda sin barista cerca avisa, y la cubierta no', () => {
  const live = { min_count: 2, minutes: 45, baristas: [{ id: 'a', lat: 4.643, lng: -74.064, referencia: 'Cl. 57' }],
    demand: [cell(4.644, -74.064, 4), cell(4.70, -74.05, 3, { perico: 2, tinto: 1 }), cell(4.72, -74.05, 1)], study: [] };
  const list = insights({ live });
  const gaps = list.filter((i) => i.key.startsWith('gap:'));
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].level, 'alta');
  assert.match(gaps[0].text, /3 personas .* Lo más pedido: perico/);
  // con 3 señales con bebida sale también lo más buscado
  assert.ok(list.some((i) => i.key === 'drink' && /perico/.test(i.title)));
});

test('nunca compara con menos de 3: semana, notas y precio pagado', () => {
  const few = insights({ state: { rows: [], kpis: null, week: [{ day: '2026-11-08', cups: 9 }, { day: '2026-11-09', cups: 4 }, { day: '2026-11-10', cups: 2 }] },
    ratings: [{ id: 'a', name: 'Marlene Rojas', n: 2, avg: 1, paid_n: 2, paid_cup: 3000, listed_cup: 1500 }] });
  assert.deepEqual(few, []);
  const week = [12, 18, 9, 22, 15, 0, 30].map((cups, i) => ({ day: `2026-11-0${4 + i}`.replace('010', '10'), cups }));
  const list = insights({ state: { rows: [], kpis: null, week },
    ratings: [{ id: 'a', name: 'Marlene Rojas', n: 4, avg: 3.2, paid_n: 3, paid_cup: 1800, listed_cup: 1500 }] });
  assert.deepEqual(keys(list), ['rating', 'price', 'week', 'best']);
  assert.match(list[0].title, /^Marlene tiene 3,2 granos/);
  assert.doesNotMatch(JSON.stringify(list), /Rojas/);
  assert.match(list[1].text, /\$1\.800 por taza; pide \$1\.500 \(3 respuestas\)\. Puede subir/);
  assert.match(list[2].title, /pasó el promedio/);
  assert.match(list[3].title, /sábado/);
});

test('mejora: pocos baristas en la calle y apartados entregados', () => {
  const rows = [row({ id: 'a', live: true }), row({ id: 'b' }), row({ id: 'c' }), row({ id: 'd' }), row({ id: 'e', linked: false })];
  const list = insights({ state: { rows, kpis: { served: 2, waiting: 1 }, week: [] } });
  assert.match(list.find((i) => i.key === 'coverage').title, /Solo 1 de 4/);
  assert.match(list.find((i) => i.key === 'holds').title, /2 de 3 apartados/);
});

test('tiempo real: lo que cambió entre dos lecturas', () => {
  const a = snapshot({ state: { rows: [row({ id: 'a' }), row({ id: 'b', name: 'Jairo', live: true, cups: 2 })] }, live: { min_count: 2, demand: [cell(4.7, -74.05, 2)] } });
  const b = snapshot({ state: { rows: [row({ id: 'a', live: true, waiting: 1 }), row({ id: 'b', name: 'Jairo', live: false, cups: 5 }), row({ id: 'n', name: 'Nueva' })] },
    live: { min_count: 2, demand: [cell(4.7, -74.05, 5), cell(4.6, -74.07, 2), cell(4.5, -74.07, 1)] } });
  assert.deepEqual(diffEvents(null, b), []);
  assert.deepEqual(diffEvents(a, a), []);
  const ev = diffEvents(a, b, { now: 1000, places: [{ lat: 4.7, lng: -74.05, referencia: 'Portal Norte' }] });
  assert.deepEqual(ev.map((e) => e.title), [
    'Marlene salió a vender', 'Le apartaron a Marlene', 'Jairo salió de la calle', 'Jairo vendió 3 tazas',
    'Sube la demanda cerca de Portal Norte', 'Nueva zona que quiere café',
  ]);
  assert.ok(ev.every((e) => e.at === 1000 && e.kind === 'evento'));
  assert.equal(ev[4].text, 'De 2 a 5 personas.');
});

test('la bitácora deja lo nuevo arriba y no crece sin fin', () => {
  const log = pushLog([{ key: 'viejo' }], [{ key: 'x' }, { key: 'y' }], 2);
  assert.deepEqual(log.map((e) => e.key), ['y', 'x']);
});
