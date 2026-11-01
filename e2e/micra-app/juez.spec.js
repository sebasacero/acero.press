// El juez de arte latte (Juez.jsx, arteLatte.js; 20261101150000_micra_juez.sql):
// al entrar a un reto de arte latte, el celular califica la foto y el puntaje
// va con la entrada; en la competencia se ve el sello y el detalle; el equipo
// califica como jurado en la revisión.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
const JAIRO = SEED.baristas[1].id;
const DAY = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const plus = (n) => new Date(Date.parse(`${DAY}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
// Una taza dibujada: crema café con un corazón blanco centrado (240 × 240)
const CORAZON = Buffer.from('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', 'base64');
const RETO = { id: 'reto-1', title: 'Arte latte: tu mejor corazón', kind: 'arte_latte', starts_on: plus(-1), ends_on: plus(5) };

async function open(browser, { who = 'visitor', posts = [] } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED), { challenges: [RETO], posts: structuredClone(posts), votes: {} });
  if (who === 'team') { api.micra.baristas.forEach((b) => { delete b.mine; }); await signIn(page); } else api.micra.admin = false;
  if (who === 'barista') { api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null }; await signIn(page); }
  return { page, api, errors };
}

test('barista: el juez califica la foto en el celular y el puntaje va con la entrada', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista/reto', { waitUntil: 'load' });
  await page.getByTestId('reto-enter').click();
  const composer = page.getByTestId('post-composer');
  await composer.getByTestId('post-file').setInputFiles({ name: 'corazon.png', mimeType: 'image/png', buffer: CORAZON });
  const juez = composer.getByTestId('juez');
  await expect(juez).toContainText('Juez Micra');
  const score = Number(await juez.getByTestId('juez-score').getAttribute('data-score'));
  expect(score).toBeGreaterThanOrEqual(75);
  await expect(juez).toContainText('Simetría');
  await expect(juez.getByTestId('juez-canvas')).toBeVisible();
  await composer.getByTestId('post-consent').check();
  await composer.getByTestId('post-send').click();
  await expect(page.getByTestId('post-sent')).toBeVisible();
  const sent = api.find('/rpc/micra_post_add').data;
  expect(sent.p_judge).toMatchObject({ v: 1, score });
  expect(Object.keys(sent.p_judge.scores).sort()).toEqual(['centrado', 'contraste', 'definicion', 'limpieza', 'simetria', 'tamano']);
  await composer.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByTestId('my-entry')).toContainText(`Juez Micra: ${score} de 100`);
  expect(errors).toEqual([]);
});

test('cliente: ve el sello del juez en las entradas y su detalle; el equipo califica como jurado', async ({ browser }) => {
  const judge = { v: 1, score: 82, scores: { contraste: 9, definicion: 8, simetria: 8.5, centrado: 9, tamano: 7, limpieza: 8 } };
  const posts = [
    { id: 'e1', tintero_id: JAIRO, kind: 'foto', media_path: `${JAIRO}/p-e1.jpg`, caption: 'Rosetta', status: 'approved', created_at: new Date().toISOString(), challenge_id: 'reto-1', judge },
    { id: 'e2', tintero_id: JAIRO, kind: 'foto', media_path: `${JAIRO}/p-e2.jpg`, caption: 'Pendiente', status: 'pending', created_at: new Date().toISOString(), challenge_id: 'reto-1', judge },
  ];
  const c = await open(browser, { posts });
  await c.page.goto('/micra/reto', { waitUntil: 'load' });
  const entries = c.page.getByTestId('entries');
  await expect(entries.getByLabel('Juez Micra: 82 de 100')).toBeVisible();
  await entries.getByRole('button', { name: /^Jairo/ }).click();
  await expect(c.page.getByTestId('entry-judge')).toContainText('Juez Micra');
  await expect(c.page.getByTestId('entry-judge')).toContainText('Contraste');
  expect(c.errors).toEqual([]);

  const t = await open(browser, { who: 'team', posts });
  await t.page.goto('/micra/equipo', { waitUntil: 'load' });
  const review = t.page.getByTestId('post-review');
  await expect(review).toContainText('Juez Micra');
  const jurado = review.getByTestId('jurado');
  // El total va de 0 a 100 con los pesos de los criterios
  await expect(jurado).toContainText('Como jurado · 83');
  await jurado.getByLabel('Simetría').fill('10');
  await jurado.getByTestId('jurado-save').click();
  await expect.poll(() => t.api.find('/rpc/micra_judge_set')?.data).toMatchObject({ p_post_id: 'e2', p_scores: { simetria: 10, contraste: 9 } });
  await expect(jurado.getByTestId('jurado-save')).toContainText('Cambiar mi calificación');
  expect(t.errors).toEqual([]);
});
