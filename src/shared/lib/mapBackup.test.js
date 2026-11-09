import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { backupStyle, BACKUP_FILE } from './mapBackup.js';
import { themeChanges } from './mapTheme.js';

const base = layers('protomaps', namedFlavor('light'), { lang: 'es' });

test('el respaldo lee el archivo de Bogotá y las letras del mismo sitio', () => {
  const s = backupStyle(base, 'https://www.aceropress.com/');
  assert.equal(s.sources.protomaps.url, 'pmtiles://https://www.aceropress.com/mapa/bogota.pmtiles');
  assert.equal(s.glyphs, 'https://www.aceropress.com/mapa/fonts/{fontstack}/{range}.pbf');
  assert.match(s.sources.protomaps.attribution, /OpenStreetMap/);
});

test('sin íconos: se quitan las capas que piden imágenes que no servimos', () => {
  const s = backupStyle(base, 'https://x.co');
  assert.ok(s.layers.length > 50);
  assert.ok(!s.layers.some((l) => l.layout && 'icon-image' in l.layout), 'ninguna capa pide íconos');
  assert.ok(s.layers.some((l) => l.id === 'roads_labels_minor'), 'los nombres de las calles se quedan');
});

test('solo se piden las letras que están en public/mapa/fonts', () => {
  const s = backupStyle(base, '');
  // text-font viene como expresión: se buscan los nombres de las letras dentro
  const stacks = new Set();
  const walk = (v) => { if (typeof v === 'string' && v.startsWith('Noto')) stacks.add(v); else if (Array.isArray(v)) v.forEach(walk); };
  s.layers.forEach((l) => walk(l.layout?.['text-font']));
  assert.ok(stacks.size >= 2);
  for (const f of stacks) {
    for (const r of ['0-255', '256-511', '8192-8447']) statSync(new URL(`../../../public/mapa/fonts/${f}/${r}.pbf`, import.meta.url));
  }
  // Y el archivo del mapa existe y es un PMTiles
  const head = readFileSync(new URL(`../../../public${BACKUP_FILE}`, import.meta.url)).subarray(0, 7).toString();
  assert.equal(head, 'PMTiles');
});

test('la piel del plano viste las capas de Protomaps: vías por jerarquía, sin bordes', () => {
  const ch = themeChanges(backupStyle(base, '').layers, 'plano');
  const color = (id) => ch.find(([l, k, p]) => l === id && k === 'paint' && p === 'line-color')?.[3];
  assert.equal(color('roads_highway'), '#2A3550');
  assert.equal(color('roads_major'), 'rgba(42,53,80,.6)');
  assert.equal(color('roads_minor'), 'rgba(42,53,80,.14)');
  assert.ok(ch.some(([l, , p, v]) => l === 'roads_minor_casing' && p === 'line-opacity' && v === 0));
  assert.ok(ch.some(([l, , p]) => l === 'earth' && p === 'fill-color'));
});
