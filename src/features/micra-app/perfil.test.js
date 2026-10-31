import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  maskPhone, signInMethod, signOutBlock, blockText, keysToClear, clearStored,
  SALES_QUEUE_KEY, FICHA_QUEUE_KEY, ROUTE_KEY, CLIENT_KEYS, SESSION_KEYS,
} from './perfil.js';

/** Un localStorage en memoria. */
function mem(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()].sort(),
  };
}

test('maskPhone: el celular colombiano a medias, venga como venga', () => {
  assert.equal(maskPhone('573001234567'), '300 ••• 4567');
  assert.equal(maskPhone('+57 300 123 4567'), '300 ••• 4567');
  assert.equal(maskPhone('3001234567'), '300 ••• 4567');
  assert.equal(maskPhone('0057 3001234567'), '300 ••• 4567');
  // Otro país: solo los últimos cuatro
  assert.equal(maskPhone('14155550123'), '••• 0123');
  assert.equal(maskPhone(''), '');
  assert.equal(maskPhone(null), '');
  assert.equal(maskPhone('123'), '');
});

test('signInMethod: celular, Google o correo, de la sesión', () => {
  assert.equal(signInMethod(null), null);
  assert.equal(signInMethod({ app_metadata: { provider: 'phone' }, phone: '573001234567' }), 'celular');
  assert.equal(signInMethod({ phone: '573001234567' }), 'celular');
  assert.equal(signInMethod({ app_metadata: { provider: 'google' }, email: 'a@b.co' }), 'google');
  assert.equal(signInMethod({ identities: [{ provider: 'google' }] }), 'google');
  assert.equal(signInMethod({ app_metadata: { provider: 'email' }, email: 'a@b.co' }), 'correo');
  assert.equal(signInMethod({ id: 'u1' }), null);
});

test('signOutBlock: no deja salir con ventas, fichas o un recorrido sin subir', () => {
  assert.equal(signOutBlock(mem()), null);
  assert.equal(signOutBlock(mem({ [SALES_QUEUE_KEY]: '[]' })), null);
  assert.deepEqual(signOutBlock(mem({ [SALES_QUEUE_KEY]: JSON.stringify([{ ref: 'a' }, { ref: 'b' }]) })), { kind: 'sales', n: 2 });
  // Las fichas solo frenan al equipo
  const fichas = mem({ [FICHA_QUEUE_KEY]: JSON.stringify([{ id: 1 }]) });
  assert.equal(signOutBlock(fichas, 'barista'), null);
  assert.deepEqual(signOutBlock(fichas, 'owner'), { kind: 'fichas', n: 1 });
  // Un recorrido grabando no frena (se termina al salir); uno cuyo final no subió, sí
  assert.equal(signOutBlock(mem({ [ROUTE_KEY]: JSON.stringify({ routeId: 'r', points: [], queue: [] }) })), null);
  assert.deepEqual(signOutBlock(mem({ [ROUTE_KEY]: JSON.stringify({ routeId: 'r', ending: '2026-10-30T12:00:00Z' }) })), { kind: 'route' });
  // Algo ilegible no frena ni rompe
  assert.equal(signOutBlock(mem({ [SALES_QUEUE_KEY]: '{roto' })), null);
  assert.equal(signOutBlock(null), null);
});

test('blockText: dice cuántas y que se perderían', () => {
  assert.match(blockText({ kind: 'sales', n: 1 }), /1 venta sin subir/);
  assert.match(blockText({ kind: 'sales', n: 3 }), /3 ventas sin subir.*se perderían/);
  assert.match(blockText({ kind: 'fichas', n: 2 }), /2 fichas/);
  assert.match(blockText({ kind: 'route' }), /recorrido/);
  assert.equal(blockText(null), '');
});

test('keysToClear: el cliente borra lo suyo; el barista y el equipo, lo de la sesión', () => {
  assert.deepEqual(keysToClear('client'), CLIENT_KEYS);
  const b = keysToClear('barista');
  for (const k of SESSION_KEYS) assert.ok(b.includes(k));
  assert.ok(b.includes(SALES_QUEUE_KEY) && b.includes(ROUTE_KEY));
  assert.ok(!b.includes(FICHA_QUEUE_KEY));
  assert.ok(!b.some((k) => CLIENT_KEYS.includes(k)), 'salir de barista no borra lo del cliente');
  assert.ok(keysToClear('owner').includes(FICHA_QUEUE_KEY));
  // Lo visto en la Escuela es su avance: no se borra
  assert.ok(!b.includes('acero.escuela.vistas'));
});

test('clearStored: borra lo pedido, nunca una cola con algo adentro, y deja lo demás', () => {
  const s = mem({
    micra_goal_v1: '{"x":20}', micra_mode_v1: '"barista"', [SALES_QUEUE_KEY]: JSON.stringify([{ ref: 'a' }]),
    micra_name_v1: '"Sebas"', 'acero.escuela.vistas': '["l1"]',
  });
  const removed = clearStored(s, keysToClear('barista'));
  assert.deepEqual(removed.sort(), ['micra_goal_v1', 'micra_mode_v1']);
  assert.ok(s.getItem(SALES_QUEUE_KEY), 'la venta sin subir sigue');
  assert.equal(s.getItem('micra_name_v1'), '"Sebas"');
  // Con la cola vacía, sí se va
  s.setItem(SALES_QUEUE_KEY, '[]');
  assert.deepEqual(clearStored(s, [SALES_QUEUE_KEY]), [SALES_QUEUE_KEY]);
  // El cliente
  const c = mem({ micra_name_v1: '"Sebas"', micra_favs_v1: '["b1"]', micra_device_v1: '"cel-1"', micra_seek_off_v1: 'true', micra_mode_v1: '"client"' });
  clearStored(c, keysToClear('client'));
  assert.deepEqual(c.keys(), ['micra_mode_v1']);
  // Sin almacenamiento (modo privado que lanza): no rompe
  const broken = { getItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
  assert.deepEqual(clearStored(broken, ['micra_goal_v1']), []);
});
