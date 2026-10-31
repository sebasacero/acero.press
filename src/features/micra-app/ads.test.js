import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adsFor, withAds, seenToday, markSeen, ctr, adDraft, bogotaHour, AD_SEEN_KEY } from './ads.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const ad = (o) => ({ id: 'a1', title: 'Leche de finca', cta_url: 'https://wa.me/573001234567', placement: 'feed', hour_from: null, hour_to: null, ...o });

test('cada formato con lo suyo y en su franja (hora de Bogotá)', () => {
  const rows = [ad(), ad({ id: 'a2', placement: 'story' }), ad({ id: 'a3', hour_from: 6, hour_to: 11 }), ad({ id: 'a4', cta_url: 'http://x' }), null];
  assert.deepEqual(adsFor(rows, { placement: 'feed', hour: 8 }).map((a) => a.id), ['a1', 'a3']);
  assert.deepEqual(adsFor(rows, { placement: 'feed', hour: 11 }).map((a) => a.id), ['a1']);
  assert.deepEqual(adsFor(rows, { placement: 'story', hour: 20 }).map((a) => a.id), ['a2']);
  assert.equal(bogotaHour(new Date('2026-10-31T13:30:00Z')), 8);
});

test('en el muro: el primero después de 3 publicaciones y luego cada 5, una vez cada uno', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` }));
  const out = withAds(items, [ad(), ad({ id: 'a2' }), ad({ id: 'a3' })]);
  assert.deepEqual(out.map((x) => x.id).slice(0, 5), ['p0', 'p1', 'p2', 'ad-a1', 'p3']);
  assert.equal(out[9].id, 'ad-a2');
  assert.equal(out.filter((x) => x.kind === 'patrocinado').length, 2); // 12 publicaciones: caben 2
  assert.equal(out.find((x) => x.adId === 'a1').kind, 'patrocinado');
  assert.deepEqual(withAds([{ id: 'p0' }], [ad()]).map((x) => x.id), ['p0']);
});

test('una vista por celular al día', () => {
  const s = mem();
  assert.equal(seenToday(s, 'a1', '2026-10-31'), false);
  markSeen(s, 'a1', '2026-10-31');
  markSeen(s, 'a1', '2026-10-31');
  assert.equal(seenToday(s, 'a1', '2026-10-31'), true);
  assert.equal(JSON.parse(s.getItem(AD_SEEN_KEY)).ids.length, 1);
  assert.equal(seenToday(s, 'a1', '2026-11-01'), false);
  assert.equal(seenToday({ getItem: () => '{roto' }, 'a1', '2026-10-31'), false);
});

test('toques por cada 100 vistas', () => {
  assert.equal(ctr(0, 0), '—');
  assert.equal(ctr(1000, 32), '3,2 %');
  assert.equal(ctr(3, 1), '33,3 %');
});

test('el formulario del equipo: enlace https o WhatsApp, fechas y franja', () => {
  const base = { advertiser: ' Panadería  La 85 ', title: 'Pan de bono caliente', cta_url: '300 123 4567', ends_on: '2026-11-07' };
  const ok = adDraft(base, '2026-10-31').ad;
  assert.equal(ok.advertiser, 'Panadería La 85');
  assert.equal(ok.cta_url, 'https://wa.me/573001234567');
  assert.equal(ok.starts_on, '2026-10-31');
  assert.equal(ok.cta_label, 'Ver más');
  assert.equal(ok.placement, 'feed');
  assert.equal(ok.audience, 'all');
  assert.match(adDraft({ ...base, cta_url: 'ftp://x' }, '2026-10-31').error, /https/);
  assert.match(adDraft({ ...base, ends_on: '2026-10-01' }, '2026-10-31').error, /después/);
  assert.match(adDraft({ ...base, ends_on: '' }, '2026-10-31').error, /hasta cuándo/);
  assert.match(adDraft({ ...base, hour_from: '11', hour_to: '6' }, '2026-10-31').error, /franja/);
  assert.deepEqual([adDraft({ ...base, hour_from: '6', hour_to: '11' }, '2026-10-31').ad.hour_from, adDraft({ ...base, hour_from: '6', hour_to: '11' }, '2026-10-31').ad.hour_to], [6, 11]);
  assert.match(adDraft({ ...base, advertiser: '' }, '2026-10-31').error, /anunciante/);
});
