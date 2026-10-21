import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_TINTERO, buildTintero, canUploadPhoto, photoPath } from './tinteroForm.js';

const at = new Date('2026-10-22T14:00:00Z');
const ok = { ...EMPTY_TINTERO, name: 'Don Jairo', place: { carrera: 13, calle: 72, zone: 'Chapinero' }, tinto_price: '1.500', cups_per_hour: '25', photo_consent: true };

test('una ficha completa queda lista para la API, con la hora del levantamiento', () => {
  const { body, error } = buildTintero(ok, { surveyedAt: at });
  assert.equal(error, undefined);
  assert.deepEqual(body, {
    name: 'Don Jairo', zone: 'Chapinero', carrera: 13, calle: 72, stage: 'prospecto',
    tinto_price: 1500, cups_per_hour: 25, photo_consent: true, surveyed_at: '2026-10-22T14:00:00.000Z',
  });
});

test('precio y tazas son opcionales, pero si vienen tienen que ser números con sentido', () => {
  assert.equal(buildTintero({ ...ok, tinto_price: '', cups_per_hour: '' }, { surveyedAt: at }).body.tinto_price, null);
  assert.match(buildTintero({ ...ok, tinto_price: 'mil' }).error, /pesos/);
  assert.match(buildTintero({ ...ok, tinto_price: '90000' }).error, /no parece/);
  assert.match(buildTintero({ ...ok, cups_per_hour: '900' }).error, /no cuadran/);
  assert.equal(buildTintero({ ...ok, tinto_price: '$ 2.000' }, { surveyedAt: at }).body.tinto_price, 2000);
});

test('lo primero que falta se dice en palabras de calle', () => {
  assert.match(buildTintero({ ...ok, name: ' ' }).error, /nombre/);
  assert.match(buildTintero({ ...ok, place: null }).error, /dónde está/);
  assert.match(buildTintero({ ...ok, place: { carrera: 13 } }).error, /carrera y calle/);
});

test('las notas se recortan y no se mandan vacías', () => {
  assert.equal('notes' in buildTintero(ok, { surveyedAt: at }).body, false);
  assert.equal(buildTintero({ ...ok, notes: ' x'.repeat(400) }, { surveyedAt: at }).body.notes.length, 500);
});

test('la foto solo sube con permiso', () => {
  assert.equal(canUploadPhoto({ photo_consent: true }, true), true);
  assert.equal(canUploadPhoto({ photo_consent: false }, true), false);
  assert.equal(canUploadPhoto({ photo_consent: true }, false), false);
});

test('la ruta de la foto es segura y lleva el nombre', () => {
  assert.equal(photoPath('Don Jairo · Calle 72', 1700000000000), 'tinteros/1700000000000-don-jairo-calle-72.jpg');
  assert.equal(photoPath('   ', 1), 'tinteros/1-puesto.jpg');
  assert.ok(photoPath('ñ'.repeat(100), 1).length < 70);
});
