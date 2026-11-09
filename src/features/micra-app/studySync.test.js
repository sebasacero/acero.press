import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncStudy, waiting } from './studySync.js';
import { enqueue, readQueue } from './fichaFlow.js';
import { queueSurvey, readSurveyQueue } from './surveyQueue.js';

function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const fail = (message, status) => Object.assign(new Error(message), status ? { status } : {});

test('sube la ficha y luego su encuesta, con el id que le dio la API', async () => {
  const s = memory();
  enqueue(s, { ref: 'f-1', body: { name: 'Puesto · la 72' } });
  queueSurvey(s, { ref: 'e-1', tintero: { ref: 'f-1', name: 'Puesto · la 72' }, body: { consent: true, cups_per_day: 80 } });
  queueSurvey(s, { ref: 'e-2', tintero: { id: 't2' }, body: { consent: true } });
  const sent = [];
  const out = await syncStudy({
    storage: s,
    postFicha: async (body) => { sent.push(['ficha', body.name]); return { id: 'nuevo' }; },
    postSurvey: async (id, body) => { sent.push(['encuesta', id, body.cups_per_day ?? null]); },
  });
  assert.deepEqual(sent, [['ficha', 'Puesto · la 72'], ['encuesta', 'nuevo', 80], ['encuesta', 't2', null]]);
  assert.deepEqual({ fichas: out.fichas, surveys: out.surveys, left: out.left }, { fichas: 1, surveys: 2, left: { fichas: 0, surveys: 0 } });
});

test('sin señal no se pierde nada y no se insiste con el resto', async () => {
  const s = memory();
  enqueue(s, { ref: 'f-1', body: { name: 'A' } });
  enqueue(s, { ref: 'f-2', body: { name: 'B' } });
  queueSurvey(s, { ref: 'e-1', tintero: { ref: 'f-1' }, body: { consent: true } });
  let calls = 0;
  const out = await syncStudy({ storage: s, postFicha: async () => { calls += 1; throw fail('Failed to fetch'); }, postSurvey: async () => { throw new Error('no debe llamarse'); } });
  assert.equal(calls, 1);
  assert.deepEqual(out.left, { fichas: 2, surveys: 1 });
  assert.deepEqual(out.dropped, []);
});

test('sesión vencida o servidor caído: se queda en el celular (antes se borraba)', async () => {
  for (const status of [401, 500, 503]) {
    const s = memory();
    enqueue(s, { ref: 'f-1', body: { name: 'A' } });
    queueSurvey(s, { ref: 'e-1', tintero: { id: 't1' }, body: { consent: true } });
    const boom = async () => { throw fail('La API de Acero no respondió.', status); };
    const out = await syncStudy({ storage: s, postFicha: boom, postSurvey: boom }); // eslint-disable-line no-await-in-loop
    assert.deepEqual(out.left, { fichas: 1, surveys: 1 }, `estado ${status}`);
  }
});

test('lo que la API rechaza sale de la cola con su motivo, y lo demás sigue subiendo', async () => {
  const s = memory();
  enqueue(s, { ref: 'f-1', body: { name: 'Mala' } });
  enqueue(s, { ref: 'f-2', body: { name: 'Buena' } });
  queueSurvey(s, { ref: 'e-1', tintero: { ref: 'f-1', name: 'Mala' }, body: { consent: true } });
  queueSurvey(s, { ref: 'e-2', tintero: { id: 'borrada', name: 'Doña Ana' }, body: { consent: true } });
  queueSurvey(s, { ref: 'e-3', tintero: { id: 't3' }, body: { consent: true } });
  const out = await syncStudy({
    storage: s,
    postFicha: async (body) => { if (body.name === 'Mala') throw fail('El precio no se entiende', 422); return { id: 'ok' }; },
    postSurvey: async (id) => { if (id === 'borrada') throw fail('No existe', 404); },
  });
  assert.equal(out.fichas, 1);
  assert.equal(out.surveys, 1);
  assert.deepEqual(out.dropped, [{ kind: 'ficha', name: 'Mala', why: 'El precio no se entiende' }, { kind: 'encuesta', name: 'Doña Ana', why: 'No existe' }]);
  assert.deepEqual(waiting(s), { fichas: 0, surveys: 0 });
});

test('la encuesta de una ficha que no subió espera sin bloquear a las otras', async () => {
  const s = memory();
  enqueue(s, { ref: 'f-1', body: { name: 'A' } });
  queueSurvey(s, { ref: 'e-1', tintero: { ref: 'f-1' }, body: { consent: true } });
  queueSurvey(s, { ref: 'e-2', tintero: { id: 't2' }, body: { consent: true } });
  const out = await syncStudy({ storage: s, postFicha: async () => { throw fail('timeout'); }, postSurvey: async () => {} });
  assert.equal(out.surveys, 1);
  assert.equal(readQueue(s).length, 1);
  assert.deepEqual(readSurveyQueue(s).map((x) => x.ref), ['e-1']);
});
