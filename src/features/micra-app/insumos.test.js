import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, INSUMOS, bumpInsumo, orderLines, orderCount, insumosText, readLastOrder, writeLastOrder, itemsOf } from './insumos.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('insumos: cada uno en una categoría que existe, con ids únicos', () => {
  const cats = new Set(CATEGORIES.map((c) => c.id));
  assert.equal(new Set(INSUMOS.map((i) => i.id)).size, INSUMOS.length);
  for (const i of INSUMOS) assert.ok(cats.has(i.cat) && i.unit && i.units, i.id);
  for (const c of CATEGORIES) assert.ok(itemsOf(c.id).length > 0, c.id);
});

test('insumos: sumar y restar entre 0 y 99; lo que no existe no entra', () => {
  let c = bumpInsumo({}, 'vaso-4', 1);
  c = bumpInsumo(c, 'vaso-4', 1);
  assert.deepEqual(c, { 'vaso-4': 2 });
  assert.deepEqual(bumpInsumo(c, 'vaso-4', -5), {});
  assert.equal(bumpInsumo({ termo: 99 }, 'termo', 1).termo, 99);
  assert.deepEqual(bumpInsumo(c, 'whisky', 1), c);
});

test('insumos: las líneas van en el orden del catálogo, con singular y plural', () => {
  const cart = { cigarrillos: 2, 'cafe-molido': 1, nada: 3, leche: 0 };
  assert.deepEqual(orderLines(cart).map((l) => l.text), ['1 kilo · Café molido para AeroPress', '2 cajetillas de 20 · Cigarrillos']);
  assert.equal(orderCount(cart), 3);
});

test('insumos: el mensaje de WhatsApp', () => {
  const t = insumosText({ name: 'Marlene Rojas', where: 'Cl. 57 con Cra. 7', cart: { chocolate: 2 }, note: '  vasos rojos ' });
  assert.equal(t, 'Hola, soy Marlene de Micra. Quiero pedir insumos para Cl. 57 con Cra. 7:\n• 2 libras · Chocolate de mesa\nOtro: vasos rojos\n¿Cuánto es y cuándo me llega?');
  assert.match(insumosText({ name: '', cart: {} }), /^Hola, soy barista de Micra\. Quiero pedir insumos:\n¿Cuánto/);
});

test('insumos: el último pedido se guarda y se repite; lo vacío o dañado no', () => {
  const s = mem();
  assert.equal(readLastOrder(s), null);
  writeLastOrder({ tapas: 3 }, s, new Date('2026-11-06T15:00:00Z'));
  assert.deepEqual(readLastOrder(s), { cart: { tapas: 3 }, at: '2026-11-06T15:00:00.000Z' });
  s.setItem('micra_insumos_v1', '{mal');
  assert.equal(readLastOrder(s), null);
  writeLastOrder({}, s);
  assert.equal(readLastOrder(s), null);
});
