import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAFT_MAX_AGE_MS, surveyKey, readDraft, saveDraft, clearDraft, draftKeys,
  readSurveyQueue, queueSurvey, unqueueSurvey, linkFicha, dropFicha, queuedIds, isRejected, waitingText,
} from './surveyQueue.js';

function memory({ full = false } = {}) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (full) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
  };
}

test('surveyKey: el id de la ficha, o su ref de la cola si aún no sube', () => {
  assert.equal(surveyKey({ id: 't1', ref: 'f-1' }), 't1');
  assert.equal(surveyKey({ id: null, ref: 'f-1' }), 'ref:f-1');
  assert.equal(surveyKey({}), null);
  assert.equal(surveyKey(null), null);
});

test('borrador: se guarda por ficha con el paso y vuelve igual', () => {
  const s = memory();
  const form = { consent: true, cups_per_day: '80', payments: ['nequi'] };
  assert.equal(saveDraft(s, 't1', { form, i: 3 }, 1000), true);
  assert.deepEqual(readDraft(s, 't1', 2000), { form, i: 3, at: 1000 });
  assert.equal(readDraft(s, 't2', 2000), null);
  assert.deepEqual([...draftKeys(s, 2000)], ['t1']);
  clearDraft(s, 't1');
  assert.equal(readDraft(s, 't1', 2000), null);
});

test('borrador: sin permiso ni respuestas no queda nada; uno viejo se olvida', () => {
  const s = memory();
  saveDraft(s, 't1', { form: { consent: false, cups_per_day: '', payments: [], gender: null }, i: -1 }, 1000);
  assert.equal(readDraft(s, 't1', 1000), null);
  saveDraft(s, 't1', { form: { consent: true }, i: 0 }, 1000);
  assert.ok(readDraft(s, 't1', 1000 + DRAFT_MAX_AGE_MS - 1));
  assert.equal(readDraft(s, 't1', 1000 + DRAFT_MAX_AGE_MS), null);
});

test('borrador: basura en el celular no rompe nada y sin espacio lo dice', () => {
  const s = memory();
  s.setItem('micra_survey_draft_v1', '{no es json');
  assert.equal(readDraft(s, 't1'), null);
  s.setItem('micra_survey_draft_v1', '[1,2]');
  assert.equal(readDraft(s, 't1'), null);
  assert.equal(saveDraft(memory({ full: true }), 't1', { form: { consent: true }, i: 0 }), false);
  assert.equal(readDraft(null, 't1'), null);
});

test('borrador: solo se conservan los 20 más recientes', () => {
  const s = memory();
  for (let n = 0; n < 25; n += 1) saveDraft(s, `t${n}`, { form: { consent: true }, i: 0 }, 1000 + n);
  const keys = draftKeys(s, 2000);
  assert.equal(keys.size, 20);
  assert.ok(keys.has('t24'));
  assert.ok(!keys.has('t0'));
});

test('cola: una encuesta con su ficha, sin repetir el mismo ref', () => {
  const s = memory();
  const body = { consent: true, cups_per_day: 80 };
  assert.equal(queueSurvey(s, { ref: 'e-1', tintero: { id: 't1', name: 'Don Luis' }, body, at: 5 }), true);
  queueSurvey(s, { ref: 'e-1', tintero: { id: 't1', name: 'Don Luis' }, body, at: 6 });
  assert.deepEqual(readSurveyQueue(s), [{ ref: 'e-1', body, at: 6, name: 'Don Luis', tintero_id: 't1' }]);
  assert.deepEqual([...queuedIds(readSurveyQueue(s))], ['t1']);
  assert.deepEqual(unqueueSurvey(s, 'e-1'), []);
});

test('cola: sin ficha a la que pegarse o sin espacio, no dice que guardó', () => {
  assert.equal(queueSurvey(memory(), { ref: 'e-1', tintero: {}, body: { consent: true } }), false);
  assert.equal(queueSurvey(memory({ full: true }), { ref: 'e-1', tintero: { id: 't1' }, body: { consent: true } }), false);
});

test('cola: la encuesta de una ficha sin subir espera a su ficha', () => {
  const s = memory();
  queueSurvey(s, { ref: 'e-1', tintero: { id: null, ref: 'f-9', name: 'Puesto' }, body: { consent: true }, at: 1 });
  queueSurvey(s, { ref: 'e-2', tintero: { id: 't2' }, body: { consent: true }, at: 2 });
  assert.equal(readSurveyQueue(s)[0].ficha_ref, 'f-9');
  assert.deepEqual([...queuedIds(readSurveyQueue(s))], ['t2']);
  const linked = linkFicha(s, 'f-9', 'nuevo-id');
  assert.equal(linked[0].tintero_id, 'nuevo-id');
  assert.equal(linked[0].ficha_ref, undefined);
  assert.equal(linked[1].tintero_id, 't2');
});

test('cola: si la ficha fue rechazada, su encuesta sale; las demás siguen', () => {
  const s = memory();
  queueSurvey(s, { ref: 'e-1', tintero: { ref: 'f-9' }, body: { consent: true } });
  queueSurvey(s, { ref: 'e-2', tintero: { id: 't2' }, body: { consent: true } });
  assert.deepEqual(dropFicha(s, 'f-9').map((x) => x.ref), ['e-2']);
});

test('isRejected: solo lo que la API rechazó de verdad se saca de la cola', () => {
  for (const status of [400, 404, 410, 422]) assert.equal(isRejected({ status }), true);
  for (const status of [401, 403, 409, 429, 500, 503]) assert.equal(isRejected({ status }), false);
  assert.equal(isRejected(new Error('Failed to fetch')), false);
  assert.equal(isRejected(null), false);
});

test('waitingText: lo que espera en el celular, en palabras', () => {
  assert.equal(waitingText({ fichas: 2, surveys: 1 }), '2 fichas y 1 encuesta');
  assert.equal(waitingText({ fichas: 1, surveys: 0 }), '1 ficha');
  assert.equal(waitingText({ fichas: 0, surveys: 3 }), '3 encuestas');
  assert.equal(waitingText({}), '');
});
