import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CELL_DEG, MIN_SIGNALS, SEEK_GAP_MS, cellOf, canSeek, drinkOf, seekPayload, visibleCells, cellSquare,
  zonesGeoJSON, legendLabel, legendCounts, topDrink, shouldPoll,
} from './liveMap.js';
import { meters } from './micraApp.js';

test('la celda: el centro de un cuadro de ~440 m, el mismo para todo el que esté dentro', () => {
  const a = cellOf(4.64512, -74.06381);
  assert.deepEqual(a, { lat: 4.646, lng: -74.062 });
  // Otro punto del mismo cuadro cae en la misma celda
  assert.deepEqual(cellOf(4.6441, -74.0639), a);
  // El borde exacto es del cuadro de arriba (como floor en la base)
  assert.deepEqual(cellOf(4.644, -74.064), { lat: 4.646, lng: -74.062 });
  assert.deepEqual(cellOf(4.6439999, -74.0640001), { lat: 4.642, lng: -74.066 });
  // Nunca la posición exacta: lo que sale está a lo más media celda del punto, y la celda mide unos 440 m
  const p = { lat: 4.65877, lng: -74.05551 };
  const c = cellOf(p.lat, p.lng);
  assert.ok(meters(p, c) <= 320);
  assert.notEqual(c.lat, p.lat);
  const side = meters({ lat: 4.6, lng: -74.06 }, { lat: 4.6 + CELL_DEG, lng: -74.06 });
  assert.ok(side > 400 && side < 500, `lado ${side} m`);
  // Fuera de Bogotá o sin dato: nada
  assert.equal(cellOf(6.25, -75.56), null);
  assert.equal(cellOf(null, -74.06), null);
  assert.equal(cellOf('x', -74.06), null);
});

test('el freno del «busco café»: uno cada 15 minutos por celular', () => {
  const t0 = 1_000_000_000;
  assert.equal(canSeek(null, t0), true);
  assert.equal(canSeek(t0, t0 + 60_000), false);
  assert.equal(canSeek(t0, t0 + SEEK_GAP_MS - 1), false);
  assert.equal(canSeek(t0, t0 + SEEK_GAP_MS), true);
  // Un reloj que se fue para atrás no deja el celular sin poder mandar nunca
  assert.equal(canSeek(t0, t0 - 5_000), true);
  assert.equal(canSeek('basura', t0), true);
});

test('lo que se manda: celda y bebida, sin nombre ni posición exacta', () => {
  const p = seekPayload('busco-abc12345', { lat: 4.64512, lng: -74.06381, accuracy: 9 }, 'perico');
  assert.deepEqual(p, { p_ref: 'busco-abc12345', p_cell_lat: 4.646, p_cell_lng: -74.062, p_drink: 'perico' });
  assert.deepEqual(Object.keys(p).sort(), ['p_cell_lat', 'p_cell_lng', 'p_drink', 'p_ref']);
  assert.equal(seekPayload('busco-abc12345', { lat: 4.64512, lng: -74.06381 }, 'ponque').p_drink, 'all');
  assert.equal(seekPayload('busco-abc12345', null, 'tinto'), null);
  assert.equal(seekPayload('', { lat: 4.64, lng: -74.06 }, 'tinto'), null);
  assert.equal(drinkOf('aromatica'), 'aromatica');
  assert.equal(drinkOf(undefined), 'all');
});

test('las zonas: solo con 2 señales o más', () => {
  const cells = [{ lat: 4.646, lng: -74.062, n: 3 }, { lat: 4.65, lng: -74.058, n: 1 }, { lat: 4.642, lng: -74.066, n: 2 }, { n: 5 }];
  assert.equal(MIN_SIGNALS, 2);
  assert.deepEqual(visibleCells(cells).map((c) => c.n), [3, 2]);
  assert.deepEqual(visibleCells(cells, 3).map((c) => c.n), [3]);
  assert.deepEqual(visibleCells(null), []);
});

test('el cuadrado de una celda y las capas con su intensidad', () => {
  const sq = cellSquare({ lat: 4.646, lng: -74.062 })[0];
  assert.equal(sq.length, 5);
  assert.deepEqual(sq[0], sq[4]);
  assert.ok(Math.abs(sq[1][0] - sq[0][0] - CELL_DEG) < 1e-9);
  const z = zonesGeoJSON({
    demand: [{ lat: 4.646, lng: -74.062, n: 4 }, { lat: 4.65, lng: -74.058, n: 2 }, { lat: 4.654, lng: -74.058, n: 1 }],
    study: [{ lat: 4.642, lng: -74.066, n: 2 }],
  });
  assert.equal(z.demand.features.length, 2);
  assert.deepEqual(z.demand.features.map((f) => f.properties.w), [1, 0.5]);
  assert.equal(z.study.features[0].properties.kind, 'study');
  assert.equal(zonesGeoJSON(null).demand.features.length, 0);
});

test('la leyenda: baristas en línea sin contarse, personas cerca y en plural', () => {
  assert.equal(legendLabel(1, 1), '1 barista en línea · 1 persona busca café cerca');
  assert.equal(legendLabel(0, 5), '0 baristas en línea · 5 personas buscan café cerca');
  const data = {
    baristas: [{ id: 'yo', me: true }, { id: 'b' }, { id: 'c' }],
    demand: [
      { lat: 4.646, lng: -74.062, n: 3 }, // cerca
      { lat: 4.75, lng: -74.05, n: 4 }, // lejos (unos 12 km)
      { lat: 4.642, lng: -74.066, n: 1 }, // bajo el umbral: no cuenta
    ],
    waiting_cups: 5,
  };
  const me = { lat: 4.645, lng: -74.063 };
  assert.deepEqual(legendCounts(data, { me }), { online: 2, seeking: 3, waiting: 5, label: '2 baristas en línea · 3 personas buscan café cerca' });
  // Sin posición se cuentan todas las zonas visibles; el equipo no se descuenta a nadie
  assert.equal(legendCounts(data).seeking, 7);
  assert.equal(legendCounts({ baristas: [{ id: 'a' }, { id: 'b' }] }).online, 2);
  assert.equal(legendCounts({ baristas: [{ id: 'a' }, { id: 'b' }] }, { selfId: 'a' }).online, 1);
  assert.deepEqual(legendCounts(null), { online: 0, seeking: 0, waiting: 0, label: '0 baristas en línea · 0 personas buscan café cerca' });
});

test('lo más pedido de una zona y cuándo refrescar', () => {
  assert.equal(topDrink({ drinks: { tinto: 2, perico: 3 } }), 'perico');
  assert.equal(topDrink({ drinks: { all: 4 } }), null);
  assert.equal(topDrink(null), null);
  assert.equal(shouldPoll({ enabled: true, visible: true }), true);
  assert.equal(shouldPoll({ enabled: true, visible: false }), false);
  assert.equal(shouldPoll({ enabled: false, visible: true }), false);
});
