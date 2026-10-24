import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_TINTERO, TINTERO_OPTIONS, buildTintero, canUploadPhoto, fichaProgress, hourLabel, photoPath } from './tinteroForm.js';
import { LOCALIDADES, LOCALIDAD_GROUPS } from './place.js';

const at = new Date('2026-10-22T14:00:00Z');
const ok = { ...EMPTY_TINTERO, name: 'Don Jairo', localidad: 'Chapinero', place: { carrera: 13, calle: 72, zone: 'Chapinero' }, tinto_price: '1.500', cups_per_hour: '25', photo_consent: true };

test('una ficha mínima queda lista para la API, con la hora del levantamiento', () => {
  const { body, error } = buildTintero(ok, { surveyedAt: at });
  assert.equal(error, undefined);
  assert.deepEqual(body, {
    name: 'Don Jairo', localidad: 'Chapinero', zone: 'Chapinero', carrera: 13, calle: 72, stage: 'prospecto',
    tinto_price: 1500, cups_per_hour: 25, photo_consent: true, ad_consent: false, surveyed_at: '2026-10-22T14:00:00.000Z',
  });
});

test('la ficha completa del estudio: ruta, horario, productos, precios, clientes, pagos e IPES', () => {
  const { body } = buildTintero({
    ...ok, formato: 'termos_a_pie', recorrido: 'ruta', hora_inicio: 6, hora_fin: 11, termos: '3',
    products: ['tinto', 'perico', 'tinto', 'whisky'], perico_price: '1.700', aromatica_price: '1.200',
    client_mix: 'fijos', client_types: ['porteros', 'obreros'], payments_seen: ['efectivo', 'fiado'], ipes: 'no_sabe',
  }, { surveyedAt: at });
  assert.deepEqual(body, {
    name: 'Don Jairo', localidad: 'Chapinero', zone: 'Chapinero', carrera: 13, calle: 72, stage: 'prospecto',
    formato: 'termos_a_pie', recorrido: 'ruta', hora_inicio: 6, hora_fin: 11, termos: 3,
    tinto_price: 1500, perico_price: 1700, aromatica_price: 1200, cups_per_hour: 25,
    client_mix: 'fijos', ipes: 'no_sabe', photo_consent: true, ad_consent: false, surveyed_at: '2026-10-22T14:00:00.000Z',
    products: ['tinto', 'perico'], client_types: ['porteros', 'obreros'], payments_seen: ['efectivo', 'fiado'],
  });
});

test('en el sur basta la localidad: la cuadra es opcional y la zona toma su nombre', () => {
  const { body } = buildTintero({ ...ok, localidad: 'Kennedy', place: null }, { surveyedAt: at });
  assert.equal(body.zone, 'Kennedy');
  assert.equal('carrera' in body, false);
  assert.equal('calle' in body, false);
});

test('precios, tazas, termos y horario tienen que tener sentido', () => {
  assert.equal('tinto_price' in buildTintero({ ...ok, tinto_price: '' }, { surveyedAt: at }).body, false);
  assert.match(buildTintero({ ...ok, tinto_price: 'mil' }).error, /pesos/);
  assert.match(buildTintero({ ...ok, tinto_price: '90000' }).error, /no parece de un tinto/);
  assert.match(buildTintero({ ...ok, perico_price: '90000' }).error, /perico/);
  assert.match(buildTintero({ ...ok, cups_per_hour: '900' }).error, /no cuadran/);
  assert.match(buildTintero({ ...ok, termos: '2,5' }).error, /termos/);
  assert.match(buildTintero({ ...ok, hora_inicio: 10, hora_fin: 9 }).error, /después/);
  assert.equal(buildTintero({ ...ok, tinto_price: '$ 2.000' }, { surveyedAt: at }).body.tinto_price, 2000);
  // Una opción que no existe no se manda
  assert.equal('formato' in buildTintero({ ...ok, formato: 'moto' }, { surveyedAt: at }).body, false);
});

test('lo primero que falta se dice en palabras de calle', () => {
  assert.match(buildTintero({ ...ok, name: ' ' }).error, /nombre/);
  assert.match(buildTintero({ ...ok, localidad: null }).error, /localidad/);
  assert.match(buildTintero({ ...ok, localidad: 'Medellín' }).error, /localidad/);
  assert.match(buildTintero({ ...ok, place: { carrera: 13 } }).error, /carrera y calle/);
});

test('están las 20 localidades de Bogotá, más «Otra», y las opciones no se repiten', () => {
  const ids = LOCALIDADES.map((l) => l.id);
  const bogota = ['Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón',
    'Engativá', 'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
    'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'];
  assert.deepEqual([...ids].sort(), [...bogota, 'Otra'].sort());
  // Cada una cae en un grupo que la ficha pinta (o es «Otra», que va aparte)
  const groups = new Set(LOCALIDAD_GROUPS.map(([g]) => g));
  for (const l of LOCALIDADES) assert.ok(groups.has(l.group) || l.id === 'Otra', l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const [f, opts] of Object.entries(TINTERO_OPTIONS)) assert.equal(new Set(opts.map(([v]) => v)).size, opts.length, f);
});

test('progreso de la ficha y horas legibles', () => {
  assert.deepEqual(fichaProgress(EMPTY_TINTERO), { done: 0, total: 14 });
  assert.equal(fichaProgress({ ...ok, products: ['tinto'], hora_inicio: 6 }).done, 5);
  assert.equal(hourLabel(6), '6 a. m.');
  assert.equal(hourLabel(12), '12 m.');
  assert.equal(hourLabel(16), '4 p. m.');
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

test('con GPS y referencia, la cuadra sobra: la referencia es la zona que se lee', () => {
  const gps = { lat: 4.618612, lng: -74.135988, accuracy: 12, at: '2026-10-24T15:00:00.000Z' };
  const { body } = buildTintero({ ...EMPTY_TINTERO, name: 'Sra. Julia', localidad: 'Kennedy', gps, referencia: ' Puerta principal Plaza de las Américas ' });
  assert.equal(body.zone, 'Puerta principal Plaza de las Américas');
  assert.equal(body.referencia, 'Puerta principal Plaza de las Américas');
  assert.deepEqual([body.lat, body.lng, body.gps_accuracy_m, body.located_at], [4.618612, -74.135988, 12, '2026-10-24T15:00:00.000Z']);
  assert.equal('carrera' in body, false);
  assert.match(buildTintero({ ...EMPTY_TINTERO, name: 'X1', localidad: 'Kennedy', referencia: 'x'.repeat(81) }).error, /referencia/);
});
