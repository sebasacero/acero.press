import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed, filterFeed, chipCounts, readPrices, millions, cupCost, coffeeOrderText, HOUSE } from './feed.js';

const B = [
  { id: 'a', name: 'Marlene', referencia: 'Cl. 85 con Cra. 15', hora_inicio: 6, hora_fin: 11, prices: { tinto: 1500 }, status: 'usual' },
  { id: 'b', name: 'Wilson', localidad: 'Chapinero', status: 'live' },
  { id: 'c', name: 'Sin lugar' },
];

test('el muro abre con el precio y pone primero los puestos en la calle', () => {
  const f = buildFeed({ baristas: B });
  assert.equal(f[0].kind, 'precios');
  const puestos = f.filter((i) => i.kind === 'puestos');
  assert.deepEqual(puestos.map((p) => p.by), ['Wilson', 'Marlene']);
  assert.equal(puestos[1].text, 'Suele pasar de 6 a 11 a. m.');
  // Lo de la casa va del más nuevo al más viejo
  const house = f.filter((i) => HOUSE.some((h) => h.id === i.id));
  assert.equal(house[0].id, 'woc-bogota-2027');
  assert.equal(house.at(-1).id, 'wac-2025');
});

test('el barista no se ve a sí mismo como puesto; su día sale solo si vendió', () => {
  assert.equal(buildFeed({ baristas: B, selfId: 'a' }).some((i) => i.baristaId === 'a'), false);
  assert.equal(buildFeed({ myDay: { name: 'Marlene', cups: 0 } }).some((i) => i.kind === 'recorridos'), false);
  const mine = buildFeed({ myDay: { name: 'Marlene', cups: 17, km: 4200, streak: 4 } }).find((i) => i.kind === 'recorridos');
  assert.equal(mine.title, 'Tu día: 17 tazas');
});

test('los chips filtran y cuentan; todo muestra todo', () => {
  const f = buildFeed({ baristas: B });
  assert.equal(filterFeed(f, 'todo').length, f.length);
  assert.ok(filterFeed(f, 'recetas').every((i) => i.kind === 'recetas'));
  const c = chipCounts(f);
  assert.equal(c.todo, f.length);
  assert.equal(c.puestos, 2);
  assert.equal(c.recorridos, 0);
});

test('los precios del equipo: solo números positivos y fecha AAAA-MM-DD', () => {
  assert.deepEqual(readPrices({ micra_precio_carga: '2.850.000', micra_precio_ny: '3.8', micra_precio_fecha: '2026-10-30' }), { carga: 2850000, ny: 3.8, date: '2026-10-30' });
  assert.deepEqual(readPrices({ micra_precio_carga: 'x', micra_precio_ny: '-1', micra_precio_fecha: 'ayer' }), { carga: null, ny: null, date: null });
  assert.equal(millions(2850000), '$2,85 M');
  assert.equal(cupCost(60000), 720);
});

test('el pedido de café por WhatsApp dice quién, cuánto y dónde', () => {
  assert.equal(coffeeOrderText({ name: 'Marlene Rojas', kilos: 2, where: 'Chapinero' }), 'Hola, soy Marlene de Micra. Quiero pedir 2 kilos de café para la AeroPress, para recoger o recibir en Chapinero. ¿Cuánto es y cuándo me llega?');
  assert.match(coffeeOrderText({ name: '', kilos: 1 }), /^Hola, soy barista de Micra\. Quiero pedir 1 kilo de café para la AeroPress\. /);
});
