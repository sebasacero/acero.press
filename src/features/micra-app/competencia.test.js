import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysLeftLabel, scoreLabel, rankEntries, voteRef, canVote, challengeDraft, VOTE_REF_KEY, CHALLENGE_IDEAS } from './competencia.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('cuánto falta y la nota', () => {
  assert.equal(daysLeftLabel(0), 'Cierra hoy');
  assert.equal(daysLeftLabel(1), 'Cierra mañana');
  assert.equal(daysLeftLabel(4), 'Quedan 4 días');
  assert.equal(daysLeftLabel(-1), 'Cerró');
  assert.equal(scoreLabel(4.25), '4,3');
  assert.equal(scoreLabel(null), '—');
});

test('el podio: 3 votos o más, por promedio y luego por votos; los demás después', () => {
  const e = (id, avg, votes, created_at = '2026-11-01') => ({ id, avg, votes, created_at });
  const out = rankEntries([e('a', 4.5, 3), e('b', 4.8, 2), e('c', 4.5, 7), e('d', 3.9, 10), null, e('e', null, 0)]);
  assert.deepEqual(out.map((x) => [x.id, x.rank]), [['c', 1], ['a', 2], ['d', 3], ['b', null], ['e', null]]);
  assert.deepEqual(rankEntries('nada'), []);
});

test('la llave de votos se guarda una vez y es distinta a las otras', () => {
  const s = mem();
  const r = voteRef(s, () => 0.5);
  assert.match(r, /^voto-/);
  assert.equal(voteRef(s), r);
  assert.equal(s.getItem(VOTE_REF_KEY), r);
  assert.match(voteRef({ getItem: () => { throw new Error('x'); } }), /^voto-/);
});

test('se califica lo de otros mientras el reto está abierto', () => {
  assert.equal(canVote({ id: 'p', mine: false }, { days_left: 2 }), true);
  assert.equal(canVote({ id: 'p', mine: true }, { days_left: 2 }), false);
  assert.equal(canVote({ id: 'p' }, { days_left: -1 }), false);
  assert.equal(canVote(null, { days_left: 2 }), false);
});

test('el formulario del equipo: nombre y fechas; las ideas vienen listas', () => {
  const ok = challengeDraft({ title: ' Arte latte:  corazón ', ends_on: '2026-11-08', kind: 'foto' }, '2026-11-01').ch;
  assert.deepEqual(ok, { title: 'Arte latte: corazón', brief: null, prize: null, kind: 'foto', starts_on: '2026-11-01', ends_on: '2026-11-08' });
  assert.match(challengeDraft({ title: '', ends_on: '2026-11-08' }, '2026-11-01').error, /nombre/);
  assert.match(challengeDraft({ title: 'Reto' }, '2026-11-01').error, /hasta cuándo/);
  assert.match(challengeDraft({ title: 'Reto', starts_on: '2026-11-09', ends_on: '2026-11-08' }, '2026-11-01').error, /después/);
  assert.equal(challengeDraft({ title: 'Reto', ends_on: '2026-11-08', kind: 'raro' }, '2026-11-01').ch.kind, 'arte_latte');
  assert.ok(CHALLENGE_IDEAS.length >= 3 && CHALLENGE_IDEAS.every((i) => i.title && i.kind));
});
