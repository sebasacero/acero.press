import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baristaLevel, stepsLeft, missingStep, teamSummary, findBaristas, BARISTA_STEPS } from './activation.js';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 864e5).toISOString();
const base = { id: 'x', name: 'X', linked: false, public: false, has_prices: false, cups: 0, served: 0, waiting: 0, live_until: null };

test('el paso sale solo de la ficha', () => {
  assert.equal(baristaLevel(base, { now: NOW }), 'ficha');
  assert.equal(baristaLevel({ ...base, has_phone: true }, { now: NOW }), 'invitado');
  assert.equal(baristaLevel({ ...base, invite_code: 'K7M2QX' }, { now: NOW }), 'invitado');
  assert.equal(baristaLevel({ ...base, linked: true, public: true }, { now: NOW }), 'enlazado');
  const ready = { ...base, linked: true, public: true, has_prices: true };
  assert.equal(baristaLevel(ready, { now: NOW }), 'activo');
  assert.equal(baristaLevel({ ...ready, cups: 2 }, { now: NOW }), 'vendiendo');
  assert.equal(baristaLevel({ ...ready, last_active_at: daysAgo(3) }, { now: NOW }), 'vendiendo');
  assert.equal(baristaLevel({ ...ready, last_active_at: daysAgo(20) }, { now: NOW }), 'dormido');
  assert.equal(baristaLevel({ ...ready, created_at: daysAgo(30) }, { now: NOW }), 'dormido');
  // Sin dato de actividad no se acusa a nadie de dormido
  assert.equal(baristaLevel(ready, { now: NOW }), 'activo');
});

test('lo que falta, en orden, y cuántos pasos', () => {
  assert.equal(missingStep(base), 'Falta enlazar su cuenta: pon su celular o genera un código');
  assert.equal(missingStep(base, true), 'Falta enlazar su cuenta: que entre con su celular');
  assert.equal(missingStep({ ...base, linked: true }), 'Falta su permiso para salir en público (ficha › publicidad)');
  assert.equal(missingStep({ ...base, linked: true, public: true }), 'Faltan sus precios');
  assert.equal(missingStep({ ...base, linked: true, public: true, has_prices: true }), null);
  assert.equal(stepsLeft(base), 4);
  assert.equal(stepsLeft({ ...base, public: true, has_prices: true }, true), 1);
});

test('el resumen: embudo acumulado, casi listos y avisos sin la lista entera', () => {
  const rows = [
    { ...base, id: 'a', name: 'Ana', linked: true, public: true, has_prices: true, cups: 3, live_until: daysAgo(-0.1) },
    { ...base, id: 'b', name: 'Beto', linked: true, public: true, has_prices: true, last_active_at: daysAgo(30), waiting: 2 },
    { ...base, id: 'c', name: 'Caro', public: true, has_prices: true },
    { ...base, id: 'd', name: 'Dora', public: true },
    ...Array.from({ length: 56 }, (_, i) => ({ ...base, id: `f${i}`, name: `Ficha ${i}` })),
  ];
  const s = teamSummary(rows, { phones: { c: '573001112233' }, clients: { paused: 1 }, now: NOW });
  assert.equal(s.total, 60);
  assert.deepEqual(s.funnel.map((f) => f.n), [60, 3, 2, 2, 1]);
  assert.equal(s.funnel.length, BARISTA_STEPS.length);
  assert.equal(s.active, 2);
  // Caro (1 paso: entrar) antes que Dora (3 pasos: no entra); las fichas sin nada no salen
  assert.deepEqual(s.almost.map((r) => r.name), ['Caro']);
  const keys = s.alerts.map((a) => a.key);
  assert.deepEqual(keys, ['waiting', 'public', 'invited', 'dormant', 'paused']);
  assert.match(s.alerts[0].text, /^2 apartados esperan/);
  assert.match(s.alerts[1].text, /^2 salen en el mapa/);
  assert.equal(s.live.length, 1);
});

test('buscar: por nombre o lugar sin tildes, por paso, con tope', () => {
  const rows = teamSummary([
    { ...base, id: 'a', name: 'Marlene Rojas', referencia: 'Cl. 57 con Cra. 7' },
    { ...base, id: 'b', name: 'José Pérez', localidad: 'Kennedy' },
    ...Array.from({ length: 12 }, (_, i) => ({ ...base, id: `k${i}`, name: `Puesto ${i}`, localidad: 'Kennedy' })),
  ], { now: NOW }).rows;
  assert.deepEqual(findBaristas(rows).items, []);
  assert.deepEqual(findBaristas(rows, { q: 'jose' }).items.map((r) => r.id), ['b']);
  assert.deepEqual(findBaristas(rows, { q: 'cra. 7' }).items.map((r) => r.id), ['a']);
  const k = findBaristas(rows, { q: 'kennedy' });
  assert.equal(k.items.length, 8);
  assert.equal(k.more, 5);
  assert.equal(findBaristas(rows, { level: 'ficha', limit: 100 }).items.length, 14);
});
