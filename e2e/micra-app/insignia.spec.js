// La insignia del termo, el primer requisito de todo barista (Aprende, BadgeReview;
// 20261111090000_micra_badges.sql): ve las lecciones del termo, se graba sirviendo un tinto,
// el equipo lo verifica y solo entonces se enciende el ícono.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
const VIDEO = { name: 'tinto.mp4', mimeType: 'video/mp4', buffer: Buffer.from('00000018667479706d703432', 'hex') };

async function open(browser, { who = 'barista', badgeRequests = [], missing = false } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED), { badgeRequests: structuredClone(badgeRequests), badgesMissing: missing });
  if (who === 'barista') {
    api.micra.admin = false;
    api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: '2026-10-20T15:00:00Z' };
  }
  if (who === 'team') api.micra.baristas.forEach((b) => { delete b.mine; });
  await signIn(page);
  return { page, api, errors };
}

const seeAllLessons = async (page) => {
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: 'Empezar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ya la vi ✓' }).click();
  }
};

test('barista: Aprende abre en el termo; con las lecciones vistas se graba, lo manda y queda en revisión', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/barista/aprende', { waitUntil: 'load' });
  const schools = page.getByRole('tablist', { name: 'Escuelas' });
  await expect(schools.getByRole('tab')).toHaveText([/Termo/, /AeroPress/, /V60/, /Espresso/]);
  await expect(schools.getByRole('tab', { name: /Termo/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('school-progress')).toContainText('Gana la insignia del termo');
  // Sin las lecciones no se puede grabar todavía
  await expect(page.getByTestId('badge-video')).toHaveCount(0);
  await seeAllLessons(page);
  await expect(schools.getByRole('tab', { name: /Termo/ })).toContainText('Falta tu video');
  // Las lecciones solas no encienden el ícono
  await expect(schools.getByRole('tab', { name: /Termo/ })).not.toHaveClass(/is-unlocked/);
  const box = page.getByTestId('badge-video');
  await box.getByTestId('badge-file').setInputFiles(VIDEO);
  await expect(box.getByTestId('badge-preview')).toBeVisible();
  await box.getByTestId('badge-send').click();
  await expect(box).toContainText('en revisión');
  await expect(schools.getByRole('tab', { name: /Termo/ })).toContainText('En revisión');
  const upload = api.calls.find((c) => c.m === 'POST' && c.p.includes('/storage/v1/object/micra-posts/'));
  expect(upload.p).toMatch(new RegExp(`/micra-posts/${MARLENE}/insignia-termo-[a-z0-9]+-[a-z0-9]{8}\\.mp4$`));
  expect(api.find('/rpc/micra_badge_request').data).toEqual({ p_badge: 'termo', p_path: upload.p.split('/micra-posts/')[1] });
  expect(errors).toEqual([]);
});

test('equipo: verifica el video en Equipo › Hoy; el que no pasa vuelve al barista con la nota', async ({ browser }) => {
  const reqs = [
    { id: 'badge-1', tintero_id: MARLENE, badge: 'termo', media_path: `${MARLENE}/insignia-termo-a1-abcdefgh.mp4`, status: 'pending', created_at: new Date().toISOString() },
    { id: 'badge-2', tintero_id: SEED.baristas[1].id, badge: 'termo', media_path: `${SEED.baristas[1].id}/insignia-termo-a2-abcdefgh.mp4`, status: 'pending', created_at: new Date().toISOString() },
  ];
  const { page, api, errors } = await open(browser, { who: 'team', badgeRequests: reqs });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const review = page.getByTestId('badge-review');
  await expect(review).toContainText('Insignia del termo por verificar · 2');
  await review.getByRole('listitem').filter({ hasText: 'Marlene' }).getByRole('button', { name: 'Verificar' }).click();
  await expect(review).toContainText('Insignia del termo por verificar · 1');
  await review.getByRole('textbox').fill('No se ve el vaso');
  await review.getByRole('button', { name: 'No pasa' }).click();
  await expect(review).toHaveCount(0);
  expect(api.micra.badgeRequests.map((r) => r.status)).toEqual(['approved', 'rejected']);
  expect(api.calls.filter((c) => c.p.endsWith('/rpc/micra_badge_review')).at(-1).data).toEqual({ p_id: 'badge-2', p_approve: false, p_note: 'No se ve el vaso' });
  expect(errors).toEqual([]);
});

test('barista: con la insignia verificada el termo se enciende y Aprende abre en AeroPress', async ({ browser }) => {
  const { page, errors } = await open(browser, { badgeRequests: [{ id: 'badge-1', tintero_id: MARLENE, badge: 'termo', media_path: `${MARLENE}/insignia-termo-a1-abcdefgh.mp4`, status: 'approved', note: null, created_at: new Date().toISOString() }] });
  await page.goto('/micra/barista/aprende', { waitUntil: 'load' });
  const schools = page.getByRole('tablist', { name: 'Escuelas' });
  await expect(schools.getByRole('tab', { name: /AeroPress/ })).toHaveAttribute('aria-selected', 'true');
  const termo = schools.getByRole('tab', { name: /Termo/ });
  await expect(termo).toContainText('Verificada');
  await expect(termo).toHaveClass(/is-unlocked/);
  await termo.click();
  await expect(page.getByTestId('badge-video')).toContainText('verificada');
  expect(errors).toEqual([]);
});

test('barista: sin la migración la insignia sigue cerrada y lo dice sin romperse', async ({ browser }) => {
  const { page, errors } = await open(browser, { missing: true });
  await page.goto('/micra/barista/aprende', { waitUntil: 'load' });
  await seeAllLessons(page);
  const box = page.getByTestId('badge-video');
  await expect(box).toContainText('La verificación abre muy pronto');
  await box.getByTestId('badge-file').setInputFiles(VIDEO);
  await box.getByTestId('badge-send').click();
  await expect(box.getByRole('alert')).toContainText('abre muy pronto');
  await expect(page.getByRole('tablist', { name: 'Escuelas' }).getByRole('tab', { name: /Termo/ })).not.toHaveClass(/is-unlocked/);
  expect(errors.filter((e) => !/404|PGRST202/.test(e))).toEqual([]);
});
