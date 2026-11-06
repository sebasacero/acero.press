import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHOOLS, schoolOf, schoolLessons, seenFor, markSchool, gearShelf } from './escuelas.js';

const AERO = [{ key: 'a' }, { key: 'b' }];

test('escuelas: cuatro, con claves de lección únicas y contenido completo', () => {
  assert.deepEqual(SCHOOLS.map((s) => s.id), ['aeropress', 'termo', 'v60', 'espresso']);
  const keys = SCHOOLS.flatMap((s) => s.lessons ?? []).map((l) => l.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const s of SCHOOLS.filter((x) => x.lessons)) {
    assert.ok(s.lessons.length >= 4, s.id);
    for (const l of s.lessons) assert.ok(l.title && l.lead && l.mins > 0 && l.points.length, l.key);
  }
  assert.equal(schoolOf('nada').id, 'aeropress');
});

test('escuelas: la AeroPress usa lo de /escuela; las demás, lo suyo', () => {
  assert.equal(schoolLessons(schoolOf('aeropress'), AERO), AERO);
  assert.deepEqual(seenFor('aeropress', ['a'], { termo: ['x'] }), ['a']);
  assert.deepEqual(seenFor('termo', ['a'], { termo: ['x'] }), ['x']);
  assert.deepEqual(seenFor('v60', [], null), []);
});

test('escuelas: marcar no repite y el ícono se desbloquea al terminar', () => {
  let st = markSchool({}, 'termo', 'termo-calentar');
  assert.equal(markSchool(st, 'termo', 'termo-calentar'), st);
  const termo = schoolOf('termo').lessons;
  for (const l of termo) st = markSchool(st, 'termo', l.key);
  const shelf = gearShelf(AERO, ['a'], st);
  assert.deepEqual(shelf.find((s) => s.id === 'termo'), { id: 'termo', name: 'Termo', done: termo.length, total: termo.length, unlocked: true });
  assert.equal(shelf.find((s) => s.id === 'aeropress').unlocked, false);
  assert.equal(gearShelf(AERO, ['a', 'b'], {}).find((s) => s.id === 'aeropress').unlocked, true);
});
