import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, presetOf, presetsFor } from './micraFilters.js';

test('la cámara del equipo ve el modelo «Tintero aliado»', () => {
  assert.ok(presetsFor('announce').some((p) => p.usesTintero));
  assert.equal(presetOf('announce', 'tintero').id, 'tintero');
});

test('la cámara lite (barista o cliente) no ve ni puede elegir «Tintero aliado»', () => {
  const lite = presetsFor('announce', { lite: true });
  assert.ok(lite.length > 0);
  assert.ok(lite.every((p) => !p.usesTintero));
  assert.equal(lite.length, PRESETS.announce.length - 1);
  // Un id guardado del equipo cae al primer modelo de la lista, no al de tintero
  assert.equal(presetOf('announce', 'tintero', { lite: true }).id, PRESETS.announce[0].id);
  assert.deepEqual(presetsFor('invite', { lite: true }), PRESETS.invite);
});
