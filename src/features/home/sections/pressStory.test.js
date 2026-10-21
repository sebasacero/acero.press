import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DURATION, STEPS, trackProgress, timeAt, stepAt, stepStart, progressForStep,
  LOGIN_SHARE, LOGIN_BEATS, LOGIN_ITEMS, ITEM_COUNT, sceneAt, itemAt, progressForItem,
} from './pressStory.js';

test('el avance va de 0 a 1 dentro de la pista y no se sale', () => {
  assert.equal(trackProgress(100, 5000, 800), 0);
  assert.equal(trackProgress(0, 5000, 800), 0);
  assert.equal(trackProgress(-2100, 5000, 800), 0.5);
  assert.equal(trackProgress(-4200, 5000, 800), 1);
  assert.equal(trackProgress(-9000, 5000, 800), 1);
  // Pista más baja que la ventana: no hay recorrido
  assert.equal(trackProgress(10, 500, 800), 0);
  assert.equal(trackProgress(-10, 500, 800), 1);
});

test('el clip arranca quieto, recorre todo y termina quieto', () => {
  assert.equal(timeAt(0), 0);
  assert.equal(timeAt(0.03), 0);
  assert.equal(timeAt(1), DURATION);
  assert.equal(timeAt(0.95), DURATION);
  const a = timeAt(0.3);
  const b = timeAt(0.6);
  assert.ok(a > 0 && b > a && b < DURATION);
});

test('cada segundo cae en un solo paso, en orden', () => {
  assert.equal(stepAt(0), 0);
  assert.equal(stepAt(4.69), 0);
  assert.equal(stepAt(4.7), 1);
  assert.equal(stepAt(12), 3);
  assert.equal(stepAt(DURATION), STEPS.length - 1);
  assert.equal(stepAt(99), STEPS.length - 1);
  assert.equal(STEPS.at(-1).end, DURATION);
});

test('saltar a un paso lleva justo dentro de ese paso', () => {
  for (let i = 0; i < STEPS.length; i++) {
    const t = timeAt(progressForStep(i));
    assert.equal(stepAt(t), i, `paso ${i}`);
    assert.ok(t >= stepStart(i));
  }
});


test('primero el inicio de sesión, en orden, y el video quieto en 0', () => {
  const beats = [];
  for (let p = 0; p < LOGIN_SHARE; p += 0.005) {
    const s = sceneAt(p);
    assert.equal(s.scene, 'login');
    assert.equal(s.time, 0);
    if (beats.at(-1) !== s.beat) beats.push(s.beat);
  }
  assert.deepEqual(beats, LOGIN_BEATS.map((b) => b.key));
});

test('después de entrar, la receta recorre todo el clip', () => {
  assert.equal(sceneAt(LOGIN_SHARE).scene, 'brew');
  assert.equal(sceneAt(LOGIN_SHARE).time, 0);
  assert.equal(sceneAt(1).time, DURATION);
  assert.ok(sceneAt(0.6).time > sceneAt(0.4).time);
});

test('lo narrado avanza de 0 a 7 sin volver atrás', () => {
  let last = 0;
  for (let p = 0; p <= 1; p += 0.002) {
    const i = itemAt(p);
    assert.ok(i >= last && i < ITEM_COUNT, `p=${p}: ${i} tras ${last}`);
    last = i;
  }
  assert.equal(last, ITEM_COUNT - 1);
});

test('saltar a un ítem lleva justo a ese ítem', () => {
  for (let i = 0; i < ITEM_COUNT; i++) assert.equal(itemAt(progressForItem(i)), i, `ítem ${i}`);
  assert.equal(LOGIN_ITEMS.length, 3);
});
