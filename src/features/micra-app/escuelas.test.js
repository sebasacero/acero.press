import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHOOLS, schoolOf, schoolLessons, seenFor, markSchool, gearShelf, gearLabel, badgeStep, badgeVideoPath } from './escuelas.js';

const AERO = [{ key: 'a' }, { key: 'b' }];

test('escuelas: cuatro, con claves de lección únicas y contenido completo', () => {
  assert.deepEqual(SCHOOLS.map((s) => s.id), ['termo', 'aeropress', 'v60', 'espresso']);
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

test('escuelas: marcar no repite y el ícono se desbloquea al terminar (el termo pide además su video)', () => {
  let st = markSchool({}, 'v60', 'v-1');
  assert.equal(markSchool(st, 'v60', 'v-1'), st);
  const v60 = schoolOf('v60').lessons;
  for (const l of v60) st = markSchool(st, 'v60', l.key);
  const termo = schoolOf('termo').lessons;
  for (const l of termo) st = markSchool(st, 'termo', l.key);
  const shelf = gearShelf(AERO, ['a'], st);
  assert.equal(shelf.find((s) => s.id === 'v60').unlocked, true);
  assert.deepEqual(shelf.find((s) => s.id === 'termo'), { id: 'termo', name: 'Termo', done: termo.length, total: termo.length, video: true, ready: true, badge: null, unlocked: false });
  assert.equal(shelf.find((s) => s.id === 'aeropress').unlocked, false);
  assert.equal(gearShelf(AERO, ['a', 'b'], {}).find((s) => s.id === 'aeropress').unlocked, true);
});

test('la insignia del termo va primero y solo se gana cuando el equipo aprueba el video', () => {
  const none = gearShelf(AERO, [], {});
  assert.equal(none[0].id, 'termo');
  assert.equal(none[0].unlocked, false);
  assert.equal(gearLabel(none[0]), `0/${none[0].total}`);
  assert.equal(badgeStep(none[0]), 'lessons');
  let st = {};
  for (const l of schoolOf('termo').lessons) st = markSchool(st, 'termo', l.key);
  const ready = gearShelf(AERO, [], st)[0];
  assert.equal(gearLabel(ready), 'Falta tu video');
  assert.equal(badgeStep(ready), 'record');
  const pending = gearShelf(AERO, [], {}, { termo: { status: 'pending' } })[0];
  assert.equal(pending.unlocked, false);
  assert.equal(gearLabel(pending), 'En revisión');
  assert.equal(badgeStep(pending), 'pending');
  assert.equal(badgeStep(gearShelf(AERO, [], st, { termo: { status: 'rejected' } })[0]), 'retry');
  // No pasó y este celular no tiene las lecciones vistas: primero las lecciones
  assert.equal(badgeStep(gearShelf(AERO, [], {}, { termo: { status: 'rejected' } })[0]), 'lessons');
  // Verificada vale aunque este celular no tenga lo visto
  const ok = gearShelf(AERO, [], {}, { termo: { status: 'approved' } })[0];
  assert.equal(ok.unlocked, true);
  assert.equal(gearLabel(ok), 'Verificada');
  assert.equal(badgeStep(ok), 'done');
  // Las demás no dependen de insignias
  assert.equal(gearLabel(gearShelf(AERO, ['a', 'b'], {}, { termo: { status: 'approved' } })[1]), 'Desbloqueada');
  assert.equal(gearLabel(none[2], ' lecciones'), `0/${none[2].total} lecciones`);
});

test('el video de la insignia va a la carpeta del barista con un nombre que acepta la base', () => {
  const p = badgeVideoPath('abc-123', 'video/mp4', 'termo', 1e12, () => 0.5);
  assert.match(p, /^abc-123\/[A-Za-z0-9_-]{6,64}\.(mp4|mov|webm)$/);
  assert.equal(badgeVideoPath('abc', 'video/quicktime').endsWith('.mov'), true);
  assert.equal(badgeVideoPath('abc', 'video/webm;codecs=vp9').endsWith('.webm'), true);
  assert.equal(badgeVideoPath('abc', 'image/jpeg'), null);
  assert.equal(badgeVideoPath(null, 'video/mp4'), null);
});
