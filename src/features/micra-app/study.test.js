import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingOf, studyRows, studyCounts, whereLine, gpsPatch } from './study.js';

const JAIRO = { id: 't1', name: 'Don Jairo', referencia: 'Salida de la 72', localidad: 'Chapinero', lat: 4.6577, lng: -74.0634, gps_accuracy_m: 9, photo_url: 'https://x/estudio/a.jpg' };
const ROSA = { id: 't2', name: 'Doña Rosa', carrera: 13, calle: 60, zone: 'Chapinero' };
const SURVEYS = [
  { tintero_id: 't1', surveyed_at: '2026-10-20T12:00:00Z' },
  { tintero_id: 't1', surveyed_at: '2026-10-25T12:00:00Z' },
];

test('lo que le falta a una ficha', () => {
  assert.deepEqual(pendingOf(JAIRO, SURVEYS[0]), []);
  assert.deepEqual(pendingOf(ROSA, null), ['encuesta', 'gps', 'foto']);
  assert.deepEqual(pendingOf({ ...JAIRO, lng: null }, {}), ['gps']);
});

test('primero las fichas a las que más les falta, con su última encuesta', () => {
  const rows = studyRows([JAIRO, ROSA], SURVEYS);
  assert.deepEqual(rows.map((r) => r.name), ['Doña Rosa', 'Don Jairo']);
  assert.equal(rows[1].survey.surveyed_at, '2026-10-25T12:00:00Z');
  assert.deepEqual(studyCounts(rows), { total: 2, encuesta: 1, gps: 1, foto: 1, done: 1 });
  assert.deepEqual(studyRows(null, null), []);
});

test('dónde está, con referencia o cuadra', () => {
  assert.equal(whereLine(JAIRO), 'Salida de la 72 · Chapinero · GPS ±9 m');
  assert.equal(whereLine(ROSA), 'Calle 60 con 13 · Chapinero');
  assert.equal(whereLine({}), 'Sin lugar');
});

test('el GPS del celular se guarda redondeado y solo dentro de Bogotá', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  assert.deepEqual(gpsPatch({ lat: 4.65771234, lng: -74.06341234, accuracy: 8.6 }, now), { lat: 4.657712, lng: -74.063412, gps_accuracy_m: 9, located_at: '2026-10-29T12:00:00.000Z' });
  assert.equal(gpsPatch({ lat: 4.6, lng: -74.06 }, now).gps_accuracy_m, null);
  assert.match(gpsPatch({ lat: 6.24, lng: -75.58 }).error, /fuera de Bogotá/);
  assert.match(gpsPatch(null).error, /permiso/);
});
