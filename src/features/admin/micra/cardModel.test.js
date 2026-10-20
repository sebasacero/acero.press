import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLook, resolveElements } from './cardLayout.js';
import {
  patchOverride, resetOverride, applyStyle, lookReducer, initialLook, parsePrefs, textTargets,
  elementTextKey, DEFAULT_TEXTS,
} from './cardModel.js';

const base = mergeLook({});

test('patchOverride guarda solo lo que difiere del diseño base', () => {
  let o = patchOverride({}, 'recipe', 'logo', { visible: false }, base);
  assert.deepEqual(o.recipe, { logo: { visible: false } });
  o = patchOverride(o, 'recipe', 'logo', { visible: true }, base);
  assert.deepEqual(o.recipe, {});
  o = patchOverride(o, 'recipe', 'block', { cells: { time: false } }, base);
  assert.deepEqual(o.recipe, { block: { cells: { time: false } } });
  o = patchOverride(o, 'recipe', 'block', { cells: { time: true } }, base);
  assert.deepEqual(o.recipe, {});
});

test('resetOverride borra una pieza o toda la sección', () => {
  const o = { recipe: { logo: { visible: false }, title: { size: 'l' } } };
  assert.deepEqual(resetOverride(o, 'recipe', 'logo').recipe, { title: { size: 'l' } });
  assert.deepEqual(resetOverride(o, 'recipe').recipe, {});
});

test('orden de capas: predeterminado < preset < usuario', () => {
  const preset = { price: { visible: true }, drawing: { visible: false } };
  const user = { drawing: { visible: true } };
  const el = resolveElements([preset, user]);
  assert.equal(el.price.shown, true);
  assert.equal(el.drawing.shown, true);
});

test('estilos de un toque: Limpia oculta el panel; Completa vuelve al base', () => {
  let o = applyStyle({}, 'recipe', 'limpia', base);
  const el = resolveElements([o.recipe]);
  assert.equal(el.panel.shown, false);
  assert.equal(el.logo.shown, true);
  o = applyStyle(o, 'recipe', 'completa', base);
  assert.deepEqual(o.recipe, {});
});

test('deshacer: cada edición deja un paso y el historial tiene tope de 20', () => {
  let s = initialLook();
  for (let i = 0; i < 25; i++) s = lookReducer(s, { type: 'texts', patch: { free: `t${i}` } });
  assert.equal(s.undo.length, 20);
  s = lookReducer(s, { type: 'undo' });
  assert.equal(s.texts.free, 't23');
  s = lookReducer(s, { type: 'hide', kind: 'recipe', id: 'logo', base });
  assert.deepEqual(s.overrides.recipe, { logo: { visible: false } });
  s = lookReducer(s, { type: 'undo' });
  assert.deepEqual(s.overrides.recipe, {});
});

test('cambiar de filtro borra título, subtítulo y nota; Nueva tarjeta borra los textos de la tarjeta', () => {
  let s = initialLook();
  s = lookReducer(s, { type: 'texts', patch: { title: 'X', free: 'Hola', handle: '@otra', invite: 'Ana' } });
  s = lookReducer(s, { type: 'filterChanged' });
  assert.equal(s.texts.title, null);
  assert.equal(s.texts.free, 'Hola');
  s = lookReducer(s, { type: 'newCard' });
  assert.equal(s.texts.free, '');
  assert.equal(s.texts.invite, '');
  assert.equal(s.texts.handle, '@otra');
  assert.equal(s.undo.length, 0);
});

test('el texto libre del modelo entra solo si no hay otro; restablecer pieza y texto es un paso', () => {
  let s = lookReducer(initialLook(), { type: 'filterChanged', freeText: '¡Solo esta semana!' });
  assert.equal(s.texts.free, '¡Solo esta semana!');
  s = lookReducer(s, { type: 'texts', patch: { free: 'Mío' } });
  s = lookReducer(s, { type: 'filterChanged', freeText: 'Otro' });
  assert.equal(s.texts.free, 'Mío');
  s = lookReducer(s, { type: 'set', kind: 'recipe', id: 'title', patch: { size: 'l' }, base });
  s = lookReducer(s, { type: 'texts', patch: { title: 'X' } });
  const steps = s.undo.length;
  s = lookReducer(s, { type: 'resetElement', kind: 'recipe', id: 'title', texts: { title: null } });
  assert.deepEqual(s.overrides.recipe, {});
  assert.equal(s.texts.title, null);
  assert.equal(s.undo.length, steps + 1);
});

test('cambiar de filtro vacía el deshacer (no devuelve textos de otro café)', () => {
  let s = lookReducer(initialLook(), { type: 'texts', patch: { title: 'GEISHA DE LA CASA' } });
  s = lookReducer(s, { type: 'hide', kind: 'recipe', id: 'fig', base });
  s = lookReducer(s, { type: 'filterChanged' });
  assert.equal(s.undo.length, 0);
  assert.equal(lookReducer(s, { type: 'undo' }).texts.title, null);
  assert.ok(s.seq > 0);
});

test('parsePrefs limpia lo guardado y usa valores por defecto', () => {
  const p = parsePrefs(JSON.stringify({ v: 1, format: 'tiktok', camMode: 'x', pay: 'nequi', overrides: { recipe: { logo: { visible: false, hack: 1 } }, evil: {} }, texts: { handle: '@a', free: 'no se guarda' } }));
  assert.equal(p.format, 'tiktok');
  assert.equal(p.camMode, 'photo');
  assert.equal(p.pay, 'nequi');
  assert.deepEqual(p.overrides, { recipe: { logo: { visible: false } }, invite: {}, announce: {} });
  assert.deepEqual(p.texts, { handle: '@a' });
  assert.equal(parsePrefs('basura{').format, 'feed');
  assert.equal(p.hashtags, true);
  assert.equal(parsePrefs(JSON.stringify({ v: 1, hashtags: false })).hashtags, false);
});

test('textos editables según la sección y lo que se ve', () => {
  const el = resolveElements([{ handle: { visible: true } }]);
  const keys = textTargets('invite', { textLabel: 'Para' }, el).map((t) => t.key);
  assert.deepEqual(keys.slice(0, 1), ['invite']);
  assert.ok(keys.includes('handle'));
  assert.ok(!textTargets('announce', null, el).some((t) => t.key === 'note'));
  assert.equal(elementTextKey('panel', 'announce', DEFAULT_TEXTS), 'announce');
  assert.equal(elementTextKey('subtitle', 'invite', DEFAULT_TEXTS), 'invite');
  assert.equal(elementTextKey('subtitle', 'invite', { ...DEFAULT_TEXTS, subtitle: 'X' }), 'subtitle');
});
