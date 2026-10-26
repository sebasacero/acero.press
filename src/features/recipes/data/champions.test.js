import { test } from 'node:test';
import assert from 'node:assert/strict';
import recipes from './recipes.js';
import champions, { championOf } from './champions.js';

test('cada receta tiene su campeón con foto, crédito y la final oficial', () => {
  for (const r of recipes) {
    const c = championOf(r.year);
    assert.ok(c, `falta el campeón de ${r.year}`);
    assert.match(c.photo, /^https:\/\/cdn\.shopify\.com\//, `${r.year}: foto fuera del sitio oficial`);
    assert.ok(c.credit, `${r.year}: foto sin crédito`);
    assert.match(c.final, /^https:\/\/worldaeropresschampionship\.com\/pages\//, `${r.year}: sin enlace a la final`);
    if (c.video) assert.match(c.video, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/, `${r.year}: video mal formado`);
  }
});

test('no hay campeones de años sin receta', () => {
  const years = new Set(recipes.map((r) => String(r.year)));
  for (const y of Object.keys(champions)) assert.ok(years.has(y), `${y} no tiene receta`);
  assert.equal(championOf(2020), null);
});

test('las recetas tienen los mismos pasos en los tres idiomas', () => {
  for (const r of recipes) {
    assert.equal(r.steps.en.length, r.steps.es.length, `${r.year} en`);
    assert.equal(r.steps.ja.length, r.steps.es.length, `${r.year} ja`);
    for (const e of r.equipment) for (const l of ['es', 'en', 'ja']) assert.ok(e.value[l], `${r.year} ${e.label} ${l}`);
  }
});
