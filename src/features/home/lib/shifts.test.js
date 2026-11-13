import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShifts, dur, todayShifts, hoursByBarista, availability, gaps, labelEnds, bogotaParts, kindLabel } from './shifts.js';

// 13 nov 2026, 3:00 p. m. en Bogotá = 20:00 UTC
const NOW = Date.parse('2026-11-13T20:00:00Z');
const at = (h, m = 0, day = 13) => new Date(Date.UTC(2026, 10, day, h + 5, m)).toISOString(); // hora de Bogotá

const rows = [
  { id: 1, tintero_id: 'a', name: 'Marlene', started_at: at(7), planned_until: at(11), ended_at: at(10, 30), end_kind: 'turno', mode: 'fijo', cups: 30 },
  { id: 2, tintero_id: 'b', name: 'Jairo', started_at: at(13), planned_until: at(17), ended_at: null, end_kind: null, mode: 'caminando', cups: 6 },
  { id: 3, tintero_id: 'a', name: 'Marlene', started_at: at(7, 0, 12), planned_until: at(9, 0, 12), ended_at: null, end_kind: null, mode: 'fijo', cups: 12 },
  { id: 4, tintero_id: 'c', name: 'Wilson', started_at: at(6), planned_until: at(10), ended_at: at(8), end_kind: 'volver', cups: 9 },
];

test('hora y día de Bogotá', () => {
  assert.deepEqual(bogotaParts(NOW), { hour: 15, day: '2026-11-13' });
});

test('normaliza: abierto, cerrado y lo vencido sin cerrar se cierra a su hora', () => {
  const s = normalizeShifts(rows, NOW);
  const j = s.find((x) => x.id === 2);
  assert.equal(j.open, true);
  assert.equal(j.ms, 2 * 3600000);
  const old = s.find((x) => x.id === 3);
  assert.equal(old.open, false);
  assert.equal(old.kind, 'auto');
  assert.equal(old.ms, 2 * 3600000);
  assert.equal(s[0].id, 2); // el más reciente primero
});

test('duración en palabras', () => {
  assert.equal(dur(30000), 'menos de 1 min');
  assert.equal(dur(45 * 60000), '45 min');
  assert.equal(dur(130 * 60000), '2 h 10 min');
  assert.equal(dur(120 * 60000), '2 h');
});

test('cómo terminó', () => {
  assert.equal(kindLabel('turno'), 'terminó su turno');
  assert.equal(kindLabel(null), 'salió de la calle');
});

test('hoy: los abiertos primero', () => {
  const t = todayShifts(normalizeShifts(rows, NOW), NOW);
  assert.deepEqual(t.map((x) => x.id), [2, 1, 4]);
});

test('horas por barista con tazas por hora', () => {
  const h = hoursByBarista(normalizeShifts(rows, NOW));
  const m = h.find((x) => x.id === 'a');
  assert.equal(m.shifts, 2);
  assert.equal(m.days, 2);
  assert.equal(m.ms, 5.5 * 3600000);
  assert.equal(m.ended, 1);
  assert.ok(Math.abs(m.perHour - 42 / 5.5) < 1e-9);
  assert.equal(h[0].id, 'a');
});

test('disponibilidad por franja y huecos', () => {
  const s = normalizeShifts(rows, NOW);
  const av = availability(s, { now: NOW, days: 7, from: 5, to: 21 });
  const h7 = av.find((x) => x.hour === 7);
  assert.equal(h7.daysCovered, 2); // 12 y 13 nov
  assert.equal(h7.baristas, 3); // 13: Marlene y Wilson; 12: Marlene
  assert.equal(av.find((x) => x.hour === 11).daysCovered, 0);
  assert.equal(av.find((x) => x.hour === 14).daysCovered, 1);
  const g = gaps(av);
  assert.deepEqual(g.map((x) => x.label), ['5 a. m.', '11 a. m. a 1 p. m.', '3 p. m. a 10 p. m.']);
});

test('«Ahora mismo» dice si terminó su turno', () => {
  const s = normalizeShifts(rows, NOW);
  const ev = labelEnds([
    { key: `in:a:${NOW}`, title: 'Marlene salió de la calle', text: '' },
    { key: 'in:c', title: 'Wilson salió de la calle', text: '' },
    { key: 'out:b', title: 'Jairo salió a vender', text: '' },
  ], s);
  assert.equal(ev[0].title, 'Marlene terminó su turno');
  assert.match(ev[0].text, /3 h 30 min en la calle · 30 tazas/);
  assert.equal(ev[1].title, 'Wilson salió de la calle');
  assert.equal(ev[2].title, 'Jairo salió a vender');
});
