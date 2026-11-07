import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysLeftLabel, scoreLabel, rankEntries, voteRef, canVote, challengeDraft, VOTE_REF_KEY, CHALLENGE_IDEAS, BASIC_SECTIONS, sectionOf, shortTitle, challengeDraft as draft } from './competencia.js';

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

test('retos básicos: secciones con retos que caben en el formulario y en la base', () => {
  assert.deepEqual(BASIC_SECTIONS.map((s) => s.id).slice(0, 3), ['filtrados', 'espresso', 'arte_latte']);
  const titles = new Set();
  for (const sec of BASIC_SECTIONS) {
    assert.ok(sec.label && sec.why && sec.challenges.length >= 2, sec.id);
    for (const c of sec.challenges) {
      assert.ok(['arte_latte', 'foto'].includes(c.kind), c.title);
      assert.ok(c.title.length <= 80 && c.brief.length <= 280 && c.how, c.title);
      assert.ok(!titles.has(c.title), `repetido: ${c.title}`);
      titles.add(c.title);
      // Solo arte latte pasa por el juez
      assert.equal(c.kind === 'arte_latte', sec.id === 'arte_latte', c.title);
      assert.equal(draft({ title: c.title, brief: c.brief, kind: c.kind, starts_on: '2026-11-06', ends_on: '2026-11-12' }, '2026-11-06').error, undefined);
    }
  }
  assert.equal(CHALLENGE_IDEAS.length, titles.size);
});

test('sectionOf: la sección de un reto por su nombre', () => {
  assert.equal(sectionOf({ title: 'Espresso: la crema avellana' }).id, 'espresso');
  assert.equal(sectionOf({ title: 'filtrados: mi receta' }).id, 'filtrados');
  assert.equal(sectionOf({ title: 'Arte latte: tu mejor corazón', kind: 'arte_latte' }).id, 'arte_latte');
  assert.equal(sectionOf({ title: 'Corazón libre', kind: 'arte_latte' }).id, 'arte_latte');
  assert.equal(sectionOf({ title: 'Otra cosa', kind: 'foto' }), null);
  assert.equal(sectionOf(null), null);
});

test('shortTitle: sin la sección y con mayúscula', () => {
  assert.equal(shortTitle('Espresso: la crema avellana'), 'La crema avellana');
  assert.equal(shortTitle('Corazón libre'), 'Corazón libre');
  assert.equal(shortTitle(null), '');
});

test('medallero: una medalla por sección, encendida cuando su reto cerró', async () => {
  const { medalBoard } = await import('./competencia.js');
  const b = medalBoard([
    { title: 'Arte latte: tu mejor corazón', kind: 'arte_latte', winner: { name: 'Jairo' } },
    { title: 'Tu puesto al amanecer', kind: 'foto', winner: null },
  ]);
  assert.equal(b.medals.length, BASIC_SECTIONS.length);
  const arte = b.medals.find((m) => m.id === 'arte_latte');
  assert.deepEqual([arte.done, arte.won], [1, 1]);
  assert.ok(b.medals.filter((m) => m.id !== 'arte_latte').every((m) => m.done === 0 || m.id === 'calle'));
  assert.equal(b.total, 2);
  assert.equal(b.won, 1);
  assert.deepEqual(medalBoard().medals.map((m) => m.done), BASIC_SECTIONS.map(() => 0));
});
