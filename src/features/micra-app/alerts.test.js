import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seenHolds, rememberHolds, hasHoldMemory, newHolds, holdAlert, stageAlert, pullProgress, HOLDS_SEEN_KEY } from './alerts.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const h = (id, o) => ({ id, status: 'waiting', name: 'Sebas · oficina 302', items: [{ product: 'tinto', qty: 1 }], cups: 1, ...o });

test('el barista: avisa solo los apartados nuevos, también los que llegaron con la app cerrada', () => {
  const s = mem();
  const scope = 'b1:2026-10-31';
  assert.equal(hasHoldMemory(s), false); // recién instalada: sin globito la primera vez
  // Al abrir: lo que espera y no se avisó, se avisa
  const fresh = newHolds([h('a'), h('b', { status: 'served' })], seenHolds(s, scope));
  assert.deepEqual(fresh.map((x) => x.id), ['a']);
  rememberHolds(s, scope, ['a']);
  assert.equal(hasHoldMemory(s), true);
  assert.deepEqual(newHolds([h('a'), h('c')], seenHolds(s, scope)).map((x) => x.id), ['c']);
  // Otro día u otro barista empieza de cero
  assert.equal(seenHolds(s, 'b1:2026-11-01').size, 0);
  assert.equal(seenHolds({ getItem: () => '{roto' }, scope).size, 0);
  assert.ok(JSON.parse(s.getItem(HOLDS_SEEN_KEY)).ids.includes('a'));
});

test('el globito del barista dice quién y qué', () => {
  assert.deepEqual(holdAlert([h('a')]), { title: 'Nuevo apartado', body: 'Sebas · 1 tinto', kind: 'hold' });
  assert.deepEqual(holdAlert([h('a'), h('b', { name: 'Ana', cups: 2 })]).title, '2 apartados nuevos');
  assert.equal(holdAlert([h('a'), h('b', { name: 'Ana', cups: 2 })]).body, 'Sebas, Ana · 3 tazas');
  assert.equal(holdAlert([]), null);
});

test('el cliente: avisa cuando su apartado avanza, no la primera vez ni si retrocede', () => {
  const s = mem();
  assert.equal(stageAlert(s, 'x', 0, 'Marlene Rojas'), null); // lo acaba de apartar
  assert.deepEqual(stageAlert(s, 'x', 1, 'Marlene Rojas'), { title: 'Marlene salió', body: 'Ya va en camino con tu café.', kind: 'stage' });
  assert.equal(stageAlert(s, 'x', 1, 'Marlene'), null); // ya avisado
  assert.match(stageAlert(s, 'x', 2, 'Marlene').title, /en tu cuadra/);
  assert.equal(stageAlert(s, 'x', 1, 'Marlene'), null); // retrocede (volvió a casa): no avisa
  assert.equal(stageAlert(s, 'x', 3, 'Marlene').title, '¡Tu café llegó!');
  assert.equal(stageAlert(s, null, 2, 'Marlene'), null);
});

test('desliza para recargar: con resistencia y un punto para soltar', () => {
  assert.deepEqual(pullProgress(0), { offset: 0, progress: 0, ready: false });
  assert.equal(pullProgress(36).ready, false);
  assert.equal(pullProgress(72).ready, true);
  assert.ok(pullProgress(300).offset <= 72 * 1.6);
  assert.ok(pullProgress(100).offset > pullProgress(72).offset);
  assert.equal(pullProgress(-20).offset, 0);
});

test('outAlert: avisa una vez por barista por día, solo de los suyos en la calle, y se apaga', async () => {
  const { outAlert, setOutAlertsOff } = await import('./alerts.js');
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const marlene = { id: 'm', name: 'Marlene Rojas', referencia: 'Cl. 57 con Cra. 7', status: 'live' };
  const jairo = { id: 'j', name: 'Jairo', localidad: 'Chapinero', status: 'usual' };
  assert.equal(outAlert(store, [jairo], '2026-11-07'), null);
  const a = outAlert(store, [marlene, jairo], '2026-11-07');
  assert.deepEqual(a, { title: 'Marlene salió a vender', body: 'Cl. 57 con Cra. 7 · Apártale tu café.', kind: 'out', id: 'm' });
  // Ya avisado hoy: no se repite
  assert.equal(outAlert(store, [marlene], '2026-11-07'), null);
  // Sale otro: avisa solo ese
  assert.equal(outAlert(store, [marlene, { ...jairo, status: 'live' }], '2026-11-07').title, 'Jairo salió a vender');
  // Al otro día vuelve a avisar; dos a la vez van en un solo globito
  assert.equal(outAlert(store, [marlene, { ...jairo, status: 'live' }], '2026-11-08').title, 'Marlene salió a vender (y 1 más)');
  setOutAlertsOff(store, true);
  assert.equal(outAlert(store, [marlene], '2026-11-09'), null);
});
