import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeKey, storyFor, doseText, wrapIndex } from './houseRecipes.js';

const STORIES = { 'matcha mambe': 'Mambé batido', 'cold brew': 'Frío' };

test('la llave de una bebida ignora tildes, el punto final y mayúsculas', () => {
  assert.equal(recipeKey('MATCHA MAMBÉ.'), 'matcha mambe');
  assert.equal(recipeKey('  Cold   Brew. '), 'cold brew');
  assert.equal(recipeKey(undefined), '');
});

test('el cartel usa la frase guardada con el lápiz y, si no hay, la de la casa', () => {
  const slide = { title1: { es: 'COLD BREW.', en: 'COLD BREW.' } };
  assert.equal(storyFor(slide, 'en', STORIES), 'Frío');
  assert.equal(storyFor({ ...slide, story: { es: 'Propia', en: '' } }, 'en', STORIES), 'Propia');
  assert.equal(storyFor({ ...slide, story: { es: 'Propia', en: 'Own' } }, 'en', STORIES), 'Own');
  assert.equal(storyFor({ ...slide, story: { es: '   ' } }, 'es', STORIES), 'Frío');
  // Una bebida nueva sin frase no inventa una
  assert.equal(storyFor({ title1: { es: 'TINTO.' } }, 'es', STORIES), '');
});

test('la dosis del odómetro se lee sin ceros a la izquierda', () => {
  assert.equal(doseText(['0', '2', '4', 'g']), '24 g');
  assert.equal(doseText(['0', '0', '2', 'g']), '2 g');
  assert.equal(doseText('018'), '18 g');
  assert.equal(doseText(['1', '2', 'x', '?']), '12x?');
});

test('el índice da la vuelta en los dos sentidos', () => {
  assert.equal(wrapIndex(-1, 4), 3);
  assert.equal(wrapIndex(4, 4), 0);
  assert.equal(wrapIndex(2, 0), 0);
});
