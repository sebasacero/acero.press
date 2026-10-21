import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heatFromSales, pinsFromTinteros, summarize, mapLayers } from './streetMap.js';

const sales = [
  { carrera: 13, calle: 85, cups: 40, zone: 'Zona T' },
  { carrera: 13, calle: 72, cups: 10, zone: 'Chapinero' },
  { carrera: 'x', calle: 72, cups: 5 }, // basura: fuera
  { carrera: 7, calle: 60, cups: 0 }, // sin tazas: fuera
];

test('el calor es relativo a la cuadra que más vendió y crece con las tazas', () => {
  const h = heatFromSales(sales);
  assert.equal(h.length, 2);
  const [top, low] = h;
  assert.deepEqual(top.slice(0, 3), [13, 85, 1]);
  assert.equal(low[2], 0.25);
  assert.ok(top[3] > low[3], 'más tazas, más radio');
  assert.deepEqual(heatFromSales([]), []);
  assert.deepEqual(heatFromSales(undefined), []);
});

test('los pines no llevan nombre: solo etapa y tazas por hora; el activo va destacado', () => {
  const pins = pinsFromTinteros([
    { carrera: 13, calle: 72, stage: 'prospecto', cups_per_hour: 25.4, zone: 'Chapinero', name: 'NO DEBE SALIR' },
    { carrera: 10, calle: 68, stage: 'activo', cups_per_hour: null },
    { carrera: null, calle: 1, stage: 'piloto' }, // sin carrera: no es la cuadra 0
    { carrera: '', calle: 50, stage: 'piloto' },
  ]);
  assert.deepEqual(pins, [[13, 72, 'T · 25/h', false], [10, 68, 'A', true]]);
  assert.ok(!JSON.stringify(pins).includes('NO DEBE SALIR'));
});

test('el resumen cuenta cuadras, tazas, tinteros y zonas sin repetir', () => {
  const s = summarize({ days: 30, sales, tinteros: [{ carrera: 13, calle: 72, zone: 'Chapinero' }, { zone: 'Zona T' }] });
  assert.deepEqual(s, { blocks: 4, cups: 55, tinteros: 2, zones: ['Zona T', 'Chapinero'], days: 30 });
  assert.deepEqual(summarize(null), { blocks: 0, cups: 0, tinteros: 0, zones: [], days: 90 });
});

test('las capas dicen si hay datos reales; vacío deja el ejemplo', () => {
  assert.equal(mapLayers(null).real, false);
  assert.equal(mapLayers({ sales: [], tinteros: [] }).real, false);
  assert.equal(mapLayers({ sales, tinteros: [] }).real, true);
  assert.equal(mapLayers({ sales: [], tinteros: [{ carrera: 13, calle: 72, stage: 'piloto' }] }).real, true);
});
