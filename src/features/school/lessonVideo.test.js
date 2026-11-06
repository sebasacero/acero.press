import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconFor, sceneMs, videoScenes, totalMs, sceneAt, startOf } from './lessonVideo.js';
import { SCHOOLS } from '../micra-app/escuelas.js';
import { lessonsFor } from './lessons.js';

test('lessonVideo: el dibujo sale de las palabras del paso', () => {
  assert.equal(iconFor('Llénalo con agua caliente y tápalo.'), 'agua');
  assert.equal(iconFor('Espera dos minutos.'), 'tiempo');
  assert.equal(iconFor('Muele 18 g directo en la canasta seca.'), 'balanza');
  assert.equal(iconFor('Agrio o aguado, y bajó muy rápido: muele más fino.'), 'molino');
  assert.equal(iconFor('Lava con agua caliente y una cucharada de bicarbonato.'), 'limpiar');
  assert.equal(iconFor('Apisona con fuerza firme y pareja'), 'presion');
  assert.equal(iconFor('Leche fría en la jarra'), 'leche');
  assert.equal(iconFor('Prepara el termo'), 'termo');
  assert.equal(iconFor('Hola'), 'cafe');
});

test('lessonVideo: cada escena dura lo que tarda en leerse, entre 3 y 7 s', () => {
  assert.equal(sceneMs(''), 3000);
  assert.equal(sceneMs('x'.repeat(500)), 7000);
  assert.equal(sceneMs('x'.repeat(40)), 4000);
});

test('lessonVideo: título, hasta seis pasos y el truco', () => {
  const s = videoScenes({ title: 'T', lead: 'Uno. Dos.', numbered: true, points: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], tip: 'ojo' }, 'v60');
  assert.deepEqual(s.map((x) => x.kind), ['title', 'step', 'step', 'step', 'step', 'step', 'step', 'tip']);
  assert.equal(s[0].icon, 'v60');
  assert.equal(s[0].sub, 'Uno.');
  assert.equal(s[6].n, 6);
  assert.equal(s[6].total, 6);
  assert.deepEqual(videoScenes(null), []);
});

test('lessonVideo: el reloj ubica la escena y salta al inicio de cada una', () => {
  const s = [{ ms: 1000 }, { ms: 2000 }, { ms: 1000 }];
  assert.equal(totalMs(s), 4000);
  assert.deepEqual(sceneAt(s, 0), { i: 0, p: 0 });
  assert.deepEqual(sceneAt(s, 2000), { i: 1, p: 0.5 });
  assert.deepEqual(sceneAt(s, 9000), { i: 2, p: 1, done: true });
  assert.equal(startOf(s, 2), 3000);
});

test('lessonVideo: todas las lecciones de las cuatro escuelas tienen video', () => {
  const all = [...lessonsFor('es'), ...SCHOOLS.flatMap((x) => x.lessons ?? [])];
  for (const l of all) assert.ok(videoScenes(l).length >= 2, l.key);
});
