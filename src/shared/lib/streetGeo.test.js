import { test } from 'node:test';
import assert from 'node:assert/strict';
import { salesGeoJSON, tinterosGeoJSON, boundsOf } from './streetGeo.js';
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
