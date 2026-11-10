import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cafeMenu, activeItem } from './cafeMenu.js';
import { parseRoute } from './micraApp.js';

const all = (sections) => sections.flatMap((s) => s.items);

test('cliente: tienda, origen, Hoy, Competencia, Escuela y cómo vender', () => {
  const ids = all(cafeMenu('client')).map((i) => i.id);
  for (const id of ['tienda', 'origen', 'hoy', 'reto', 'escuela', 'acero', 'barista', 'finca']) assert.ok(ids.includes(id), id);
});

test('barista: su Hoy, su reto y Aprende de la app; sin «Sé barista»', () => {
  const items = all(cafeMenu('barista'));
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.hoy.to, '/micra/barista/hoy');
  assert.equal(byId.reto.to, '/micra/barista/reto');
  assert.equal(byId.aprende.to, '/micra/barista/aprende');
  assert.equal(byId.barista, undefined);
  assert.equal(byId.escuela, undefined);
});

test('ningún modo muestra nada del equipo', () => {
  for (const mode of ['client', 'barista', 'owner']) {
    for (const it of all(cafeMenu(mode))) {
      assert.ok(!/equipo|estudio|ficha|camara|mapa/.test(it.to ?? ''), `${mode}: ${it.to}`);
      assert.ok(!/equipo/i.test(it.label), `${mode}: ${it.label}`);
    }
  }
});

test('cada entrada tiene un solo destino, ids únicos, y las rutas existen en la app', () => {
  for (const mode of ['client', 'barista', 'owner']) {
    const items = all(cafeMenu(mode));
    assert.equal(new Set(items.map((i) => i.id)).size, items.length, mode);
    for (const it of items) {
      assert.equal([it.to, it.href, it.action].filter(Boolean).length, 1, it.id);
      assert.ok(it.label && it.sub && it.icon, it.id);
      if (it.to) assert.notEqual(parseRoute(it.to).view, 'home', `${it.to} no es una ruta de la app`);
    }
  }
});

test('las direcciones del sitio pasan por siteUrl (app instalada)', () => {
  const esc = all(cafeMenu('client', { siteUrl: (p) => `https://www.aceropress.com${p}` })).find((i) => i.id === 'escuela');
  assert.equal(esc.href, 'https://www.aceropress.com/escuela');
});

test('activeItem marca la entrada de la ruta actual', () => {
  const s = cafeMenu('client');
  assert.equal(activeItem(s, '/micra/tienda'), 'tienda');
  assert.equal(activeItem(s, '/micra/tienda/'), 'tienda');
  assert.equal(activeItem(s, '/micra'), null);
});
