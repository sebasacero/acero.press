import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapIndex } from './houseRecipes.js';

test('el índice da la vuelta en los dos sentidos', () => {
  assert.equal(wrapIndex(-1, 4), 3);
  assert.equal(wrapIndex(4, 4), 0);
  assert.equal(wrapIndex(2, 0), 0);
});
