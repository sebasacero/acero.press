import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPE_USD, addUsage, cleanDecision, cleanDecisions, costUsd, overBudget, parseParte, partePrompt } from './celestra.js';

test('costo: Fable 5.2, Opus 5.5 si respondió el respaldo, y un modelo desconocido como Fable', () => {
  const u = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 0 };
  assert.equal(costUsd(u, 'claude-opus-5-5'), 6.2);
  assert.equal(costUsd(u, 'claude-fable-5-2'), 12.2);
  assert.equal(costUsd(u, 'otro'), 12.2);
  assert.equal(costUsd({}, 'claude-opus-5-5'), 0);
  assert.deepEqual(addUsage(addUsage({}, { input_tokens: 5 }), { input_tokens: '7', output_tokens: null }),
    { input_tokens: 12, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
});

test('tope: US$50; sin cifra (sin la migración) no frena', () => {
  assert.equal(TOPE_USD, 50);
  assert.equal(overBudget(49.99), false);
  assert.equal(overBudget(50), true);
  assert.equal(overBudget('50.10'), true);
  assert.equal(overBudget(null), false);
  assert.equal(overBudget(undefined), false);
});

test('parseParte: tolera texto y ```json```, recorta, máx. 3, oficio desconocido pasa a equipo', () => {
  const text = 'Aquí va:\n```json\n' + JSON.stringify({
    resumen: '  Hoy   van 4 tazas. ',
    propuestas: [
      { oficio: 'calle', titulo: 'Salir', por_que: 'Porque {sí} (n=6)', accion: '' },
      { oficio: 'nada', titulo: 'B', por_que: 'b' },
      { titulo: '', por_que: 'sin título' },
      { oficio: 'fincas', titulo: 'C', por_que: 'c' },
      { oficio: 'estudio', titulo: 'D', por_que: 'd' },
    ],
  }) + '\n```';
  const p = parseParte(text);
  assert.equal(p.resumen, 'Hoy van 4 tazas.');
  assert.deepEqual(p.propuestas.map((x) => x.titulo), ['Salir', 'B', 'C']);
  assert.equal(p.propuestas[0].accion, null);
  assert.equal(p.propuestas[0].por_que, 'Porque {sí} (n=6)');
  assert.equal(p.propuestas[1].oficio, 'equipo');
  assert.throws(() => parseParte('no hay json'), /no devolvió un parte/);
  assert.throws(() => parseParte('{"resumen":"x","propuestas":[]}'), /no devolvió un parte/);
});

test('memoria: solo lo decidido, corto, 20 como mucho, y entra al pedido del parte', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ dia: '2026-11-10', titulo: `P${i}`, estado: i % 2 ? 'aprobada' : 'descartada' }));
  assert.equal(cleanDecisions([...many, { titulo: 'X', estado: 'pendiente' }, null]).length, 20);
  assert.deepEqual(cleanDecisions('nada'), []);
  const prompt = partePrompt({ today: '2026-11-11', decisions: [{ dia: '2026-11-10', titulo: 'Ir a Kennedy', estado: 'hecha' }] });
  assert.match(prompt, /parte de hoy \(2026-11-11\)/);
  assert.match(prompt, /2026-11-10 · hecha: Ir a Kennedy/);
  assert.match(prompt, /Exactamente 3 propuestas/);
  assert.match(partePrompt(), /Todavía no hay decisiones/);
});

test('cleanDecision: solo aprobada, descartada o hecha', () => {
  assert.deepEqual(cleanDecision({ estado: 'hecha', nota: '  ok ' }), { estado: 'hecha', nota: 'ok' });
  assert.throws(() => cleanDecision({ estado: 'pendiente' }), /no válido/);
  assert.throws(() => cleanDecision({ estado: 'borrar' }), /no válido/);
});
