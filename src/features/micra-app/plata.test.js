import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byProductRows, byHourRows, addExpense, removeExpense, expensesOf, ledger, bogotaDay } from './plata.js';

const SALES = [
  { product: 'tinto', qty: 1, total: 1500, at: '2026-11-06T11:40:00Z' }, // 6:40 a. m. en Bogotá
  { product: 'tinto', qty: 1, total: 1500, at: '2026-11-06T11:45:00Z' },
  { product: 'perico', qty: 2, total: 4000, fiado_name: 'Señora', at: '2026-11-06T13:10:00Z' }, // 8:10 a. m.
];

test('byProductRows: por producto, de más a menos plata, con su parte', () => {
  const rows = byProductRows(SALES, [{ id: 'tinto', label: 'Tinto' }, { id: 'perico', label: 'Perico' }]);
  assert.deepEqual(rows.map((r) => [r.label, r.cups, r.total]), [['Perico', 2, 4000], ['Tinto', 2, 3000]]);
  assert.equal(Math.round(rows[0].share * 100), 57);
  assert.deepEqual(byProductRows([]), []);
});

test('byHourRows: tazas por hora de Bogotá y la mejor hora', () => {
  const { hours, best } = byHourRows(SALES);
  assert.equal(hours.find((h) => h.hour === 6).cups, 2);
  assert.equal(hours.find((h) => h.hour === 8).cups, 2);
  assert.equal(best, 6);
  assert.equal(byHourRows([]).best, null);
});

test('gastos: se agregan solo los válidos, se quitan y se filtran por día', () => {
  const at = new Date('2026-11-06T15:00:00Z');
  let list = addExpense([], 'cafe', 12000, at);
  list = addExpense(list, 'vasos', '3500', at);
  assert.equal(addExpense(list, 'cafe', -1, at).length, 2);
  assert.equal(addExpense(list, 'joyas', 100, at).length, 2);
  assert.equal(addExpense(list, 'cafe', 5_000_000, at).length, 2);
  assert.equal(expensesOf(list, '2026-11-06').length, 2);
  assert.equal(expensesOf(list, '2026-11-05').length, 0);
  assert.equal(removeExpense(list, list[0].id).length, 1);
  // Los de hace más de 60 días se van al anotar uno nuevo
  const old = [{ id: 'x', kind: 'cafe', amount: 1, day: '2026-08-01' }];
  assert.equal(addExpense(old, 'cafe', 100, at).length, 1);
});

test('ledger: la ganancia es lo cobrado menos lo gastado (lo fiado aún no es plata)', () => {
  const l = ledger({ total: 7000, cash: 3000, fiado: 4000, expenses: [{ amount: 1000 }, { amount: 500 }] });
  assert.deepEqual([l.vendido, l.cobrado, l.fiado, l.gastos, l.ganancia], [7000, 3000, 4000, 1500, 1500]);
  assert.equal(l.margen, 0.5);
  assert.equal(ledger({}).margen, null);
});

test('bogotaDay: la fecha en Bogotá, no en UTC', () => {
  assert.equal(bogotaDay('2026-11-07T03:00:00Z'), '2026-11-06');
});
