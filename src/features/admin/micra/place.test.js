import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, parsePlace, isValidPlace, placeLabel, placePayload, placeOfZone, editPlace } from './place.js';

test('vacío es null; una sola coordenada o solo la zona es error', () => {
  assert.equal(parsePlace(null), null);
  assert.equal(parsePlace({}), null);
  assert.equal(parsePlace({ carrera: '', calle: '', zone: '' }), null);
  assert.match(parsePlace({ carrera: 13 }).error, /carrera y calle/);
  assert.match(parsePlace({ calle: '85' }).error, /carrera y calle/);
  assert.match(parsePlace({ zone: 'Zona T' }).error, /Falta la cuadra/);
});

test('acepta números escritos a mano, con coma, y los redondea a una décima', () => {
  const p = parsePlace({ carrera: '13', calle: ' 85,25 ', zone: '  Zona T ' });
  assert.deepEqual(p, { carrera: 13, calle: 85.3, zone: 'Zona T' });
  assert.ok(isValidPlace(p));
  assert.match(parsePlace({ carrera: 'trece', calle: 85 }).error, /números/);
});

test('fuera de Bogotá no vale (mismos rangos que el check de la base)', () => {
  assert.match(parsePlace({ carrera: 900, calle: 85 }).error, /Bogotá/);
  assert.match(parsePlace({ carrera: 13, calle: 0 }).error, /Bogotá/);
  assert.ok(isValidPlace(parsePlace({ carrera: 120, calle: 200 })));
  assert.ok(isValidPlace(parsePlace({ carrera: 1, calle: 1 })));
});

test('la etiqueta se lee como se dice en la calle', () => {
  assert.equal(placeLabel(parsePlace({ carrera: 13, calle: 85, zone: 'Zona T' })), 'Calle 85 con 13 · Zona T');
  assert.equal(placeLabel(parsePlace({ carrera: 7.5, calle: 72 })), 'Calle 72 con 7,5');
  assert.equal(placeLabel(null), null);
  assert.equal(placeLabel({ error: 'x' }), null);
});

test('el payload solo lleva lo que la función de la base entiende', () => {
  assert.deepEqual(placePayload(parsePlace({ carrera: 13, calle: 85 })), { carrera: 13, calle: 85, zone: null });
  assert.equal(placePayload(null), null);
  assert.equal(placePayload({ error: 'x' }), null);
});

test('cada zona trae una cuadra válida por defecto', () => {
  for (const z of ZONES) assert.ok(isValidPlace(parsePlace(z)), z.id);
  assert.equal(new Set(ZONES.map((z) => z.id)).size, ZONES.length);
});

test('elegir una zona trae su cuadra y su nombre', () => {
  const z = ZONES.find((x) => x.id === 'Zona T');
  assert.deepEqual(placeOfZone(z), { carrera: 13, calle: 83, zone: 'Zona T' });
});

test('editar un campo conserva lo ya escrito, también a medias', () => {
  const ok = placeOfZone(ZONES[0]);
  assert.deepEqual(editPlace(ok, { calle: '85' }), { carrera: ok.carrera, calle: 85, zone: ok.zone });
  // A medias: la calle escrita se queda y se ve; con la carrera, se valida el conjunto
  const half = editPlace(null, { calle: '85' });
  assert.match(half.error, /carrera y calle/);
  assert.equal(half.calle, '85');
  assert.match(editPlace(half, { carrera: '900' }).error, /Bogotá/);
  assert.deepEqual(editPlace(half, { carrera: '13' }), { carrera: 13, calle: 85, zone: null });
  // Borrar lo escrito vuelve a vacío (sin lugar), no a un error
  assert.equal(editPlace(half, { calle: '' }), null);
});
