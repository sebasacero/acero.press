import { test } from 'node:test';
import assert from 'node:assert/strict';
import { salePhotoPoints, pendingOf, studyRows, studyCounts, whereLine, gpsPatch, distanceM, distLabel, nearRows, filterRows, filterCounts } from './study.js';

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

test('heatPoints: solo las fichas con GPS; el peso sale de las tazas por hora', async () => {
  const { heatPoints } = await import('./study.js');
  const g = heatPoints([
    { id: 'a', lat: 4.65, lng: -74.06, cups_per_hour: 80 },
    { id: 'b', lat: '4.60', lng: '-74.10', cups_per_hour: 4 },
    { id: 'c', lat: 4.7, lng: -74.05 },
    { id: 'd', lat: null, lng: -74.05 },
  ]);
  assert.equal(g.type, 'FeatureCollection');
  assert.deepEqual(g.features.map((f) => f.properties.id), ['a', 'b', 'c']);
  assert.deepEqual(g.features[1].geometry.coordinates, [-74.1, 4.6]);
  assert.deepEqual(g.features.map((f) => f.properties.weight), [1, 0.3, 0.5]);
  assert.deepEqual(heatPoints(null).features, []);
});

test('salePhotoPoints: las fotos de venta con punto válido, en [lng, lat]', () => {
  const g = salePhotoPoints([{ lat: 4.6485, lng: -74.0585, at: '2026-11-06' }, { lat: null, lng: -74 }, { lat: 'x', lng: 1 }, null]);
  assert.equal(g.features.length, 1);
  assert.deepEqual(g.features[0].geometry.coordinates, [-74.0585, 4.6485]);
  assert.equal(salePhotoPoints(undefined).features.length, 0);
});

test('distanceM: metros entre dos puntos de Bogotá; null si falta alguno', () => {
  // De la estación de la 72 una cuadra al norte: ~111 m por milésima de grado
  assert.equal(distanceM({ lat: 4.6577, lng: -74.0634 }, { lat: 4.6587, lng: -74.0634 }), 111);
  assert.equal(distanceM({ lat: 4.6577, lng: -74.0634 }, { lat: 4.6577, lng: -74.0634 }), 0);
  assert.equal(distanceM({ lat: 4.6577, lng: -74.0634 }, { lat: null, lng: null }), null);
  assert.equal(distanceM(null, { lat: 4.6, lng: -74 }), null);
});

test('distLabel: como se camina', () => {
  assert.equal(distLabel(4), 'a 10 m');
  assert.equal(distLabel(118), 'a 120 m');
  assert.equal(distLabel(1240), 'a 1,2 km');
  assert.equal(distLabel(12400), 'a 12 km');
  assert.equal(distLabel(null), null);
});

test('nearRows: la más cercana primero y las que no tienen GPS al final', () => {
  const rows = [
    { id: 'lejos', lat: 4.70, lng: -74.06, pending: [] },
    { id: 'sin', lat: null, lng: null, pending: ['gps'] },
    { id: 'cerca', lat: 4.6578, lng: -74.0634, pending: ['encuesta'] },
    { id: 'sin2', pending: ['gps'] },
  ];
  const out = nearRows(rows, { lat: 4.6577, lng: -74.0634 });
  assert.deepEqual(out.map((r) => r.id), ['cerca', 'lejos', 'sin', 'sin2']);
  assert.equal(out[0].dist, 11);
  assert.equal(out[2].dist, null);
});

test('filterRows y filterCounts: lo que falta por hacer', () => {
  const rows = [{ id: 1, pending: ['encuesta', 'gps'] }, { id: 2, pending: ['encuesta'] }, { id: 3, pending: [] }];
  assert.deepEqual(filterRows(rows, 'encuesta').map((r) => r.id), [1, 2]);
  assert.deepEqual(filterRows(rows, 'gps').map((r) => r.id), [1]);
  assert.equal(filterRows(rows, 'todas').length, 3);
  assert.deepEqual(filterCounts(rows), { todas: 3, encuesta: 2, gps: 1, foto: 0 });
});
