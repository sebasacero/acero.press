import { test } from 'node:test';
import assert from 'node:assert/strict';
import recipes from './recipes.js';
import champions, { championOf, embedOf, backdropOf } from './champions.js';

test('cada receta tiene su campeón con foto, crédito y la final oficial', () => {
  for (const r of recipes) {
    const c = championOf(r.year);
    assert.ok(c, `falta el campeón de ${r.year}`);
    assert.match(c.photo, /^https:\/\/cdn\.shopify\.com\//, `${r.year}: foto fuera del sitio oficial`);
    assert.ok(c.credit, `${r.year}: foto sin crédito`);
    assert.match(c.final, /^https:\/\/worldaeropresschampionship\.com\/pages\//, `${r.year}: sin enlace a la final`);
    if (c.video) {
      assert.ok(embedOf(c.video), `${r.year}: video mal formado`);
      assert.ok(['final', 'champion', 'recipe'].includes(c.videoKind), `${r.year}: video sin tipo`);
      assert.ok(c.videoBy, `${r.year}: video sin canal`);
    }
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

test('embedOf: YouTube sin cookies, Vimeo sin rastreo, lo demás no', () => {
  assert.equal(embedOf('https://www.youtube.com/watch?v=G1e1FfR162c'), 'https://www.youtube-nocookie.com/embed/G1e1FfR162c?autoplay=1&rel=0');
  assert.equal(embedOf('https://vimeo.com/115890941'), 'https://player.vimeo.com/video/115890941?autoplay=1&dnt=1');
  assert.equal(embedOf('https://evil.example/watch?v=G1e1FfR162c'), null);
  assert.equal(embedOf(undefined), null);
});

test('backdropOf: de fondo va mudo, en bucle y sin controles', () => {
  assert.equal(
    backdropOf('https://www.youtube.com/watch?v=G1e1FfR162c'),
    'https://www.youtube-nocookie.com/embed/G1e1FfR162c?autoplay=1&mute=1&loop=1&playlist=G1e1FfR162c&controls=0&playsinline=1&rel=0&disablekb=1',
  );
  assert.equal(backdropOf('https://vimeo.com/115890941'), 'https://player.vimeo.com/video/115890941?background=1&dnt=1');
  assert.equal(backdropOf('https://evil.example/x'), null);
});
