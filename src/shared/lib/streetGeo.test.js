import { test } from 'node:test';
import assert from 'node:assert/strict';
import { salesGeoJSON, tinterosGeoJSON, tinterosHeatGeoJSON, groupPins, boundsOf, routesGeoJSON } from './streetGeo.js';
import { toLngLat } from './bogotaGeo.js';

test('las ventas se agrupan por cuadra y el peso es relativo a la que más vendió', () => {
  const g = salesGeoJSON([
    { carrera: 13, calle: 85, cups: 2, zone: 'Zona T' },
    { carrera: 13.2, calle: 84.9, cups: 2, zone: 'Zona T' }, // misma cuadra redondeada
    { carrera: 13, calle: 72, cups: 1 },
    { carrera: null, calle: 72, cups: 9 }, // sin lugar: fuera
    { carrera: 13, calle: 60, cups: 0 }, // sin tazas: fuera
  ]);
  assert.equal(g.features.length, 2);
  const [zonaT, otra] = g.features;
  assert.deepEqual(zonaT.properties, { carrera: 13, calle: 85, cups: 4, sales: 2, zone: 'Zona T', weight: 1 });
  assert.equal(otra.properties.weight, 0.25);
  assert.deepEqual(zonaT.geometry.coordinates, toLngLat(13, 85));
  assert.deepEqual(salesGeoJSON(undefined).features, []);
});

test('en público los tinteros no llevan nombre; en el panel sí, con su ficha', () => {
  const t = [{ id: 't1', name: 'Don Jairo', stage: 'prospecto', carrera: 13, calle: 72, zone: 'Chapinero', tinto_price: 1500, cups_per_hour: 25, notes: 'Termo de 10 L' }, { name: 'Sin lugar', carrera: null, calle: 50 }];
  const pub = tinterosGeoJSON(t);
  assert.equal(pub.features.length, 1);
  assert.equal(pub.features[0].properties.label, 'Prospecto · 25/h');
  assert.ok(!JSON.stringify(pub).includes('Don Jairo'));
  assert.ok(!JSON.stringify(pub).includes('Termo'));
  const panel = tinterosGeoJSON(t, { withNames: true }).features[0].properties;
  assert.equal(panel.label, 'Don Jairo · 25/h');
  assert.equal(panel.detail, 'Prospecto · tinto a $1.500 · 25 tazas/h');
  assert.equal(panel.place, 'Calle 72 con 13 · Chapinero');
  assert.equal(panel.notes, 'Termo de 10 L');
});

test('los límites encierran ventas y tinteros; sin puntos no hay límites', () => {
  const s = salesGeoJSON([{ carrera: 13, calle: 85, cups: 1 }]);
  const t = tinterosGeoJSON([{ carrera: 7, calle: 60, stage: 'activo' }]);
  const [[w, south], [e, north]] = boundsOf(s, t);
  assert.ok(w < e && south < north);
  assert.equal(boundsOf(salesGeoJSON([]), tinterosGeoJSON([])), null);
});

test('routesGeoJSON: una línea por recorrido y un punto por parada, con el nombre solo si se pasa', () => {
  const routes = [
    { id: 'r1', tintero_id: 't1', ended_at: '2026-10-27T15:00:00Z', path: [[-74.0636, 4.6431], [-74.0645, 4.644]], stops: [{ lat: 4.6431, lng: -74.0636, from: '2026-10-27T11:30:00Z', minutes: 4, carrera: 9, calle: 52 }] },
    { id: 'r2', tintero_id: 't2', ended_at: null, path: [[-74.06, 4.64]], stops: [{ lat: 'x' }] },
  ];
  const g = routesGeoJSON(routes, [{ id: 't1', name: 'Marlene' }]);
  assert.equal(g.lines.features.length, 1);
  assert.equal(g.lines.features[0].properties.who, 'Marlene');
  assert.equal(g.stops.features.length, 1);
  assert.match(g.stops.features[0].properties.label, /^Marlene · parada 1 · 6:30.* · 4 min · Calle 52 con 9$/);
  assert.deepEqual(routesGeoJSON(null), { lines: { type: 'FeatureCollection', features: [] }, stops: { type: 'FeatureCollection', features: [] } });
});

test('con GPS el tintero va en su punto exacto, con la referencia y la precisión', () => {
  const t = [{ id: 't2', name: 'Sra. Julia', stage: 'prospecto', lat: '4.618612', lng: '-74.135988', gps_accuracy_m: 12, referencia: 'Puerta principal Plaza de las Américas', localidad: 'Kennedy', zone: 'Puerta principal Plaza de las Américas', carrera: null, calle: null }];
  const f = tinterosGeoJSON(t, { withNames: true }).features[0];
  assert.deepEqual(f.geometry.coordinates, [-74.135988, 4.618612]);
  assert.equal(f.properties.place, 'Puerta principal Plaza de las Américas · Kennedy · GPS ±12 m');
  assert.equal(f.properties.gps, true);
  // El GPS manda sobre una cuadra mal anotada
  const both = tinterosGeoJSON([{ ...t[0], carrera: 30, calle: 30 }]).features[0];
  assert.deepEqual(both.geometry.coordinates, [-74.135988, 4.618612]);
});

test('el calor de tinteros pesa por tazas por hora y salta a los que no tienen lugar', () => {
  const t = [
    { id: 'a', lat: 4.6186, lng: -74.1359, cups_per_hour: 13 },
    { id: 'b', lat: 4.6187, lng: -74.1360 },
    { id: 'c', carrera: null, calle: null },
  ];
  const h = tinterosHeatGeoJSON(t);
  assert.equal(h.features.length, 2);
  assert.equal(h.features[0].properties.weight, 1);
  assert.equal(h.features[1].properties.weight, 0.5);
});

test('los puestos pegados van en un solo pin con todos adentro', () => {
  const t = [
    { id: 'a', name: 'Sra. Julia', lat: 4.6186, lng: -74.1357, cups_per_hour: 13 },
    { id: 'b', name: 'Don Álvaro', lat: 4.61863, lng: -74.13567 },
    { id: 'c', name: 'Prueba gps', lat: 4.614192, lng: -74.174394 },
  ];
  const pins = groupPins(tinterosGeoJSON(t, { withNames: true }).features);
  assert.equal(pins.length, 2);
  assert.equal(pins[0].properties.label, 'Sra. Julia y 1 más');
  assert.deepEqual(pins[0].properties.group.map((p) => p.name), ['Sra. Julia', 'Don Álvaro']);
  assert.equal(pins[1].properties.label, 'Prueba gps');
});
