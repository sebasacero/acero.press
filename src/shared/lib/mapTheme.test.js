import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, themeLayer, themeChanges } from './mapTheme.js';

// Capas típicas de Liberty (esquema OpenMapTiles)
const L = (id, type, src, paint = {}) => ({ id, type, 'source-layer': src, paint });

test('fondo, agua y parques toman la paleta del plano', () => {
  assert.deepEqual(themeLayer(L('background', 'background'), 'plano').paint, { 'background-color': '#EDE6D3' });
  assert.equal(themeLayer(L('water', 'fill', 'water'), 'plano').paint['fill-color'], THEMES.plano.water);
  assert.equal(themeLayer(L('park', 'fill', 'park'), 'plano').paint['fill-color'], THEMES.plano.park);
  assert.equal(themeLayer(L('landcover_wood', 'fill', 'landcover'), 'noche').paint['fill-color'], THEMES.noche.park);
  // Las texturas se quitan
  const wet = themeLayer(L('landcover_wetland', 'fill', 'landcover', { 'fill-pattern': 'wetland' }), 'plano');
  assert.ok('fill-pattern' in wet.paint && wet.paint['fill-pattern'] === undefined);
});

test('las vías se jerarquizan como en el mapa ilustrado y sus bordes se apagan', () => {
  assert.equal(themeLayer(L('road_motorway', 'line', 'transportation'), 'plano').paint['line-color'], '#2A3550');
  assert.equal(themeLayer(L('road_trunk_primary', 'line', 'transportation'), 'plano').paint['line-color'], THEMES.plano.hw);
  assert.equal(themeLayer(L('road_secondary_tertiary', 'line', 'transportation'), 'plano').paint['line-color'], THEMES.plano.road);
  assert.equal(themeLayer(L('road_minor', 'line', 'transportation'), 'plano').paint['line-color'], THEMES.plano.minor);
  assert.deepEqual(themeLayer(L('road_motorway_casing', 'line', 'transportation'), 'plano').paint, { 'line-opacity': 0 });
  assert.equal(themeLayer(L('waterway_river', 'line', 'waterway'), 'noche').paint['line-color'], THEMES.noche.water);
});

test('sin íconos ni edificios 3D; los nombres llevan tinta y halo de papel', () => {
  assert.deepEqual(themeLayer(L('poi_r1', 'symbol', 'poi'), 'plano').layout, { visibility: 'none' });
  assert.deepEqual(themeLayer(L('highway-shield', 'symbol', 'transportation_name'), 'plano').layout, { visibility: 'none' });
  assert.deepEqual(themeLayer(L('building-3d', 'fill-extrusion', 'building'), 'plano').layout, { visibility: 'none' });
  const city = themeLayer(L('label_city', 'symbol', 'place'), 'plano').paint;
  assert.equal(city['text-color'], THEMES.plano.label);
  assert.equal(city['text-halo-color'], '#EDE6D3');
  assert.equal(themeLayer(L('highway-name-major', 'symbol', 'transportation_name'), 'noche').paint['text-color'], THEMES.noche.labelSoft);
});

test('las capas del estudio y los temas desconocidos no se tocan; las propiedades son del tipo de cada capa', () => {
  assert.equal(themeLayer(L('ventas-calor', 'heatmap'), 'plano'), null);
  assert.equal(themeLayer(L('background', 'background'), 'calles'), null);
  const changes = themeChanges([L('background', 'background'), L('osm', 'raster'), L('ventas-cuadras', 'circle'), L('road_minor', 'line', 'transportation')], 'plano');
  for (const [, kind, prop] of changes) {
    if (kind === 'paint') assert.match(prop, /^(background|raster|line)-/);
  }
  assert.ok(changes.some(([id, , prop]) => id === 'osm' && prop === 'raster-saturation'));
  assert.ok(!changes.some(([id]) => id === 'ventas-cuadras'));
});
