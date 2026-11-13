import test from 'node:test';
import assert from 'node:assert/strict';
import { bump, orderOf, fitsTermos, orderText, QTY_MAX } from './pedido.js';

const menu = [
  { id: 'tinto', label: 'Tinto', price: 1500 },
  { id: 'perico', label: 'Perico', price: 2000 },
  { id: 'aromatica', label: 'Aromática', price: 1000 },
  { id: 'p1', label: 'Pandebono', price: 1200, custom: true },
];
const money = (n) => `$${n.toLocaleString('es-CO')}`;

test('bump suma, resta, no baja de 0 ni pasa del tope', () => {
  let q = bump({}, 'tinto', 1);
  q = bump(q, 'tinto', 9);
  assert.deepEqual(q, { tinto: 10 });
  assert.deepEqual(bump(q, 'tinto', -20), {});
  assert.equal(bump({}, 'tinto', 500).tinto, QTY_MAX);
});

test('diez tintos sin descuento', () => {
  const o = orderOf(menu, { tinto: 10 });
  assert.equal(o.cups, 10);
  assert.equal(o.total, 15000);
  assert.equal(o.each, 1500);
  assert.equal(o.holds, 2);
});

test('el descuento redondea a $100 hacia abajo', () => {
  const o = orderOf(menu, { tinto: 7, perico: 3 }, 5);
  assert.equal(o.gross, 16500);
  assert.equal(o.total, 15600); // 15.675 → 15.600
  assert.equal(o.disc, 900);
});

test('un descuento que no está en la lista no aplica', () => {
  assert.equal(orderOf(menu, { tinto: 10 }, 50).total, 15000);
});

test('líneas en el orden del menú y sin las de cero', () => {
  const o = orderOf(menu, { aromatica: 2, tinto: 1, perico: 0 });
  assert.deepEqual(o.lines.map((l) => l.id), ['tinto', 'aromatica']);
});

test('los productos propios no salen del termo', () => {
  const o = orderOf(menu, { tinto: 4, p1: 4 });
  assert.equal(o.cups, 8);
  assert.equal(o.fromTermo, 4);
});

test('pedido vacío', () => {
  const o = orderOf(menu, {});
  assert.equal(o.total, 0);
  assert.equal(o.each, 0);
  assert.equal(orderText(o, money), '');
});

test('¿le alcanza el termo?', () => {
  assert.deepEqual(fitsTermos(10, 35, 11), { ok: true, left: 25, short: 0, more: 0 });
  assert.deepEqual(fitsTermos(10, 4, 11), { ok: false, left: 0, short: 6, more: 1 });
  assert.deepEqual(fitsTermos(25, 0, 11), { ok: false, left: 0, short: 25, more: 3 });
});

test('texto para WhatsApp', () => {
  const t = orderText(orderOf(menu, { tinto: 10 }, 10), money);
  assert.match(t, /10 × Tinto/);
  assert.match(t, /Descuento de grupo 10 %/);
  assert.match(t, /Total: \$13\.500/);
});
