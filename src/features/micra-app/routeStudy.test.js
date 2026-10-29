import test from 'node:test';
import assert from 'node:assert/strict';
import { routeSectors, teamRouteBody, CELL } from './routeStudy.js';

// Carrera 7 hacia el norte (Chapinero), dos carritos por la misma calle y uno aparte
const r = (id, path, source = 'relato') => ({ tintero_id: id, path, source });
const SEVENTH = [[-74.0631, 4.6400], [-74.0590, 4.6560]];

test('routeSectors: cuenta carritos distintos por sector, no recorridos', () => {
  const s = routeSectors([
    r('a', SEVENTH),
    r('a', SEVENTH), // el mismo carrito dos días: sigue siendo uno
    r('b', SEVENTH),
    r('c', [[-74.1500, 4.6200], [-74.1490, 4.6205]]),
  ]);
  assert.equal(s.carts, 3);
  assert.equal(s.lines.features.length, 4);
  assert.equal(s.top[0].carts, 2);
  const weights = s.cells.features.map((f) => f.properties.weight);
  assert.equal(Math.max(...weights), 1);
  assert.ok(weights.includes(0.5));
});

test('routeSectors: un tramo largo marca todos los sectores que cruza', () => {
  const s = routeSectors([r('a', SEVENTH)]);
  // ~0,016° de latitud: al menos 3 celdas de 0,005°
  assert.ok(s.cells.features.length >= 3, `celdas: ${s.cells.features.length}`);
  assert.ok(CELL === 0.005);
});

test('routeSectors: sin trazo o con un solo punto, nada; sin recorridos, vacío', () => {
  assert.equal(routeSectors([r('a', [[-74.06, 4.65]]), r('b', null)]).carts, 0);
  const empty = routeSectors(null);
  assert.deepEqual(empty.cells.features, []);
  assert.deepEqual(empty.top, []);
});

test('teamRouteBody: lo que cuenta el tintero (puntos tocados, sin hora)', () => {
  const { body, error } = teamRouteBody({ tinteroId: 't1', source: 'relato', ref: 'r-abcdefgh', points: [{ lng: -74.0631, lat: 4.64 }, { lng: -74.059, lat: 4.656 }] });
  assert.equal(error, undefined);
  assert.equal(body.p_source, 'relato');
  assert.deepEqual(body.p_path, [[-74.0631, 4.64], [-74.059, 4.656]]);
  assert.equal(body.p_started_at, null);
  assert.ok(body.p_distance_m > 1500 && body.p_distance_m < 2000, `distancia ${body.p_distance_m}`);
});

test('teamRouteBody: acompañándolo toma la hora del primer y último punto', () => {
  const { body } = teamRouteBody({ tinteroId: 't1', source: 'acompanado', ref: 'r-abcdefgh', points: [
    { lng: -74.06, lat: 4.65, t: '2026-10-29T12:10:00Z' }, { lng: -74.061, lat: 4.651, t: '2026-10-29T12:00:00Z' },
  ] });
  assert.equal(body.p_started_at, '2026-10-29T12:00:00Z');
  assert.equal(body.p_ended_at, '2026-10-29T12:10:00Z');
});

test('teamRouteBody: sin ficha, sin origen o con un solo punto, avisa', () => {
  assert.match(teamRouteBody({ source: 'relato', points: [] }).error, /ficha/);
  assert.match(teamRouteBody({ tinteroId: 't', source: 'gps', points: [] }).error, /Elige/);
  assert.match(teamRouteBody({ tinteroId: 't', source: 'relato', points: [{ lng: -74, lat: 4.6 }] }).error, /dos puntos/);
  assert.match(teamRouteBody({ tinteroId: 't', source: 'acompanado', points: [] }).error, /camina/);
});
