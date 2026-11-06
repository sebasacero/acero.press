import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, pick, isPicked, cleanAnswers, answeredCount, tasteProfile, readGustos, writeGustos } from './gustos.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('gustos: cinco preguntas, cada una con su dato didáctico y opciones únicas', () => {
  assert.deepEqual(QUESTIONS.map((q) => q.id), ['bebida', 'marcas', 'fuerza', 'dulce', 'hora']);
  for (const q of QUESTIONS) {
    assert.ok(q.title && q.fact && q.options.length >= 3, q.id);
    assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length, q.id);
  }
});

test('gustos: escoger, desmarcar y «No compro café» va solo', () => {
  let a = pick({}, 'marcas', 'sello-rojo');
  a = pick(a, 'marcas', 'libertario');
  assert.deepEqual(a.marcas, ['sello-rojo', 'libertario']);
  a = pick(a, 'marcas', 'ninguno');
  assert.deepEqual(a.marcas, ['ninguno']);
  a = pick(a, 'marcas', 'finca');
  assert.deepEqual(a.marcas, ['finca']);
  a = pick(a, 'fuerza', 'medio');
  assert.equal(a.fuerza, 'medio');
  assert.equal(pick(a, 'fuerza', 'medio').fuerza, undefined);
  assert.ok(isPicked(a, 'marcas', 'finca') && isPicked(a, 'fuerza', 'medio'));
  assert.deepEqual(pick(a, 'fuerza', 'raro'), a);
});

test('gustos: lo guardado se limpia y se cuenta', () => {
  const a = cleanAnswers({ bebida: ['tinto', 'x', 'tinto'], fuerza: 'nada', dulce: 'panela', otra: 1 });
  assert.deepEqual(a, { bebida: ['tinto'], dulce: 'panela' });
  assert.equal(answeredCount(a), 2);
  assert.deepEqual(cleanAnswers(null), {});
});

test('gustos: el perfil sale con dos respuestas o más', () => {
  assert.equal(tasteProfile({ bebida: ['tinto'] }), null);
  const exp = tasteProfile({ bebida: ['tinto'], marcas: ['amor-perfecto'], dulce: 'nada', hora: ['manana'] });
  assert.equal(exp.id, 'explorador');
  assert.deepEqual(exp.brands, ['Amor Perfecto']);
  assert.deepEqual(exp.chips, ['Tinto', 'Sin nada', 'Temprano']);
  assert.equal(tasteProfile({ bebida: ['tinto'], marcas: ['sello-rojo'], fuerza: 'fuerte' }).id, 'clasico');
  assert.equal(tasteProfile({ bebida: ['perico'], fuerza: 'medio' }).id, 'leche');
  assert.equal(tasteProfile({ bebida: ['frio', 'tinto'], fuerza: 'suave' }).id, 'frio');
  assert.equal(tasteProfile({ bebida: ['aromatica'], dulce: 'panela' }).id, 'aromatica');
  assert.equal(tasteProfile({ bebida: ['tinto'], dulce: 'azucar' }).id, 'tintero');
});

test('gustos: se guarda solo en el celular', () => {
  const s = mem();
  assert.equal(readGustos(s), null);
  writeGustos({ answers: { fuerza: 'medio' } }, s);
  assert.deepEqual(readGustos(s), { answers: { fuerza: 'medio' } });
});

test('gustos: el punto en Mi perfil sale solo si ya vio las preguntas y no respondió nada', async () => {
  const { gustosPending, markIntroSeen, introSeen, writeGustos } = await import('./gustos.js');
  const m = new Map(); const s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.equal(introSeen(s), false);
  assert.equal(gustosPending(s), false);
  markIntroSeen(s);
  assert.equal(gustosPending(s), true);
  writeGustos({ answers: { fuerza: 'suave' } }, s);
  assert.equal(gustosPending(s), false);
});
