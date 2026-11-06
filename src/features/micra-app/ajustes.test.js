import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growthTips } from './ajustes.js';

const sum = { active: 10, almost: [{}, {}] };

test('qué ajustar: primero que salgan los baristas, con su número', () => {
  const t = growthTips({ sum, tot: { live: 2, waiting: 4, served: 1 }, posts: { pending: 2, week: 1 }, challenge: null, clients: { new_7d: 0 } });
  assert.equal(t[0].key, 'salir');
  assert.match(t[0].text, /2 de 10 baristas activos \(20 %\)/);
  assert.ok(t.length <= 5);
  assert.ok(t.some((x) => x.key === 'activar' && x.action.to === 'activation'));
  assert.ok(t.some((x) => x.key === 'revisar'));
  assert.deepEqual(t.find((x) => x.key === 'publicar')?.action, { label: 'Abrir un reto', to: 'challenge' });
});

test('qué ajustar: con todo al día no inventa arreglos', () => {
  const t = growthTips({ sum: { active: 2, almost: [] }, tot: { live: 2, waiting: 0, served: 4 }, posts: { pending: 0, week: 5 }, challenge: { title: 'Arte latte' }, clients: { new_7d: 3 }, week: { cups: 40, holds: 6 } });
  assert.deepEqual(t, []);
});

test('qué ajustar: con un reto abierto lo recuerda en vez de pedir otro', () => {
  const t = growthTips({ sum: { active: 4, almost: [] }, tot: { live: 4, waiting: 0, served: 0 }, posts: { pending: 0, week: 1 }, challenge: { title: 'Tu mejor perico' } });
  const p = t.find((x) => x.key === 'publicar');
  assert.match(p.text, /«Tu mejor perico» está abierto/);
  assert.equal(p.action, null);
});
