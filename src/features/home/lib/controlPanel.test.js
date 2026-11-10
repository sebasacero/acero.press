import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelState, ago } from './controlPanel.js';

const NOW = Date.parse('2026-11-10T15:00:00Z');
const later = '2026-11-10T18:00:00Z';

test('público: en la calle primero, nombre de pila y sin cifras de plata', () => {
  const s = panelState({
    now: NOW,
    baristas: [
      { id: 'a', name: 'Ana', localidad: 'Suba', waiting: 0 },
      { id: 'b', name: 'Luis', referencia: 'Cl. 57', localidad: 'Chapinero', live_until: later, waiting: 2, takes_holds: true, prices: { tinto: 1500 } },
    ],
  });
  assert.equal(s.owner, false);
  assert.deepEqual(s.rows.map((r) => r.name), ['Luis', 'Ana']);
  assert.equal(s.rows[0].where, 'Cl. 57 · Chapinero');
  assert.deepEqual(s.kpis, { live: 1, baristas: 2, waiting: 2, cups: null, total: null, served: null });
  assert.deepEqual(s.alerts, []);
});

test('dueño: cifras del día y lo que hay que atender', () => {
  const s = panelState({
    now: NOW,
    pending: 3,
    owner: {
      baristas: [
        { id: 'a', name: 'Marlene Rojas', live_until: later, cups: 12, total: 18000, waiting: 1, served: 4, linked: true, has_prices: true },
        { id: 'b', name: 'Jairo Peña', cups: 0, total: 0, waiting: 2, served: 0, linked: true, has_prices: false },
        { id: 'c', name: 'Rosa', linked: false },
      ],
      week: [{ day: '2026-11-10', cups: 12 }],
    },
  });
  assert.equal(s.owner, true);
  assert.equal(s.rows[0].name, 'Marlene');
  assert.deepEqual(s.kpis, { live: 1, baristas: 3, waiting: 3, cups: 12, total: 18000, served: 4 });
  assert.deepEqual(s.alerts.map((a) => [a.key, a.n]), [['posts', 3], ['prices', 1], ['unlinked', 1], ['waitingOff', 1]]);
  assert.equal(s.week.length, 1);
});

test('ago: palabras cortas', () => {
  assert.equal(ago(null, NOW), '');
  assert.equal(ago('2026-11-10T15:00:20Z', NOW), 'ahora');
  assert.equal(ago('2026-11-10T14:55:00Z', NOW), 'hace 5 min');
  assert.equal(ago('2026-11-10T12:00:00Z', NOW), 'hace 3 h');
});
