import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DASH, kg, money, moneyBig, nNote, num, pct, rangeOf, share } from './fmt.js';

test('cifras como se escriben en Colombia, y raya cuando no hay dato', () => {
  assert.equal(money(1500), '$1.500');
  assert.equal(money(145833.33), '$145.833');
  assert.equal(money(null), DASH);
  assert.equal(moneyBig(4680000), '$4,7 millones');
  assert.equal(moneyBig(250000), '$250.000');
  assert.equal(moneyBig(1000000), '$1 millón');
  assert.equal(moneyBig(1040000), '$1 millón');
  assert.equal(moneyBig(3000000), '$3 millones');
  assert.equal(kg(4.68), '4,7 kg');
  assert.equal(kg(46.8), '47 kg');
  assert.equal(num(27.5, 1), '27,5');
  assert.equal(pct(0.5), '▲ 50 %');
  assert.equal(pct(-0.25), '▼ 25 %');
  assert.equal(share(4, 9), '4 de 9');
  assert.equal(share(0, 0), DASH);
  assert.equal(nNote(0), 'sin datos aún');
  assert.equal(rangeOf({ n: 3, min: 1000, max: 2000 }), '$1.000 a $2.000');
  assert.equal(rangeOf({ n: 1, min: 1500, max: 1500 }), null);
});
