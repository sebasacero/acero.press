// Publicaciones de los baristas en Hoy (PostComposer, PostReview, HoyFeed;
// 20261031160000_micra_barista_posts.sql): el barista manda una foto a
// revisión, el equipo la aprueba y el cliente la ve en el muro de su inicio.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
const JAIRO = SEED.baristas[1].id;
// Una foto de 4 × 4 píxeles: suficiente para pasar por el canvas
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGO8Jy3NAANMDEgANwcAN68BHH4VDQEAAAAASUVORK5CYII=', 'base64');

/** who: 'visitor' | 'barista' | 'team' */
async function open(browser, { who = 'visitor', posts = [] } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.posts = structuredClone(posts);
  if (who === 'barista') {
    api.micra.admin = false;
    api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: '2026-10-20T15:00:00Z' };
  }
  if (who === 'team') api.micra.baristas.forEach((b) => { delete b.mine; });
  if (who === 'visitor') api.micra.admin = false;
  if (who !== 'visitor') await signIn(page);
  return { page, api, errors };
}

const post = (over) => ({ id: 'post-1', tintero_id: MARLENE, kind: 'foto', media_path: `${MARLENE}/p-abc123.jpg`, caption: 'El primer tinto del día en la 85', status: 'pending', created_at: new Date().toISOString(), ...over });

test('barista: publica una foto en Micra y queda en revisión (no sale en el muro todavía)', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista/hoy', { waitUntil: 'load' });
  await page.getByRole('button', { name: '＋ Publicar' }).click();
  await page.getByTestId('publish-micra').click();
  const composer = page.getByTestId('post-composer');
  await expect(composer.getByTestId('post-send')).toBeDisabled();
  await composer.getByTestId('post-file').setInputFiles({ name: 'tinto.png', mimeType: 'image/png', buffer: PNG });
  await expect(composer.getByRole('img', { name: 'Tu foto' })).toBeVisible();
  await composer.getByLabel(/Tu texto/).fill('  El primer   tinto del día ');
  // Sin el permiso de quien sale, no se envía
  await expect(composer.getByTestId('post-send')).toBeDisabled();
  await composer.getByTestId('post-consent').check();
  await composer.getByTestId('post-send').click();
  await expect(page.getByTestId('post-sent')).toBeVisible();

  // Se subió a su carpeta en JPEG (achicada en el celular) y quedó en revisión
  const upload = api.calls.find((c) => c.m === 'POST' && c.p.includes('/storage/v1/object/micra-posts/'));
  expect(upload.p).toMatch(new RegExp(`/micra-posts/${MARLENE}/p-[a-z0-9]+-[a-z0-9]{8}\\.jpg$`));
  const add = api.find('/rpc/micra_post_add').data;
  expect(add).toMatchObject({ p_kind: 'foto', p_caption: 'El primer tinto del día' });
  expect(add.p_path).toBe(upload.p.split('/micra-posts/')[1]);
  await composer.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByTestId('my-posts')).toContainText('En revisión');
  await expect(page.getByTestId('feed-post')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('equipo: revisa en Equipo › Hoy y aprueba; lo rechazado no sale', async ({ browser }) => {
  const { page, api, errors } = await open(browser, {
    who: 'team',
    posts: [post(), post({ id: 'post-2', tintero_id: JAIRO, media_path: `${JAIRO}/p-def456.mp4`, kind: 'video', caption: 'Mi ruta' })],
  });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const review = page.getByTestId('post-review');
  await expect(review).toContainText('Publicaciones por revisar · 2');
  await expect(review).toContainText('El primer tinto del día en la 85');
  await review.getByRole('listitem').filter({ hasText: 'Marlene' }).getByRole('button', { name: 'Aprobar' }).click();
  await expect(review).toContainText('Publicaciones por revisar · 1');
  expect(api.find('/rpc/micra_post_review').data).toEqual({ p_id: 'post-1', p_approve: true });
  await review.getByRole('button', { name: 'No publicar' }).click();
  await expect(review).toHaveCount(0);
  expect(api.micra.posts.map((p) => p.status)).toEqual(['approved', 'rejected']);
  expect(errors).toEqual([]);
});

test('cliente: lo aprobado sale en el muro de su inicio, con su barista y cómo apartarle; lo demás no', async ({ browser }) => {
  const { page, errors } = await open(browser, {
    posts: [
      post({ status: 'approved' }),
      post({ id: 'post-2', status: 'pending', caption: 'Todavía en revisión', media_path: `${MARLENE}/p-zzz999.jpg` }),
    ],
  });
  await page.goto('/micra', { waitUntil: 'load' });
  const feed = page.getByTestId('home-feed');
  const card = feed.getByTestId('feed-post');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Marlene');
  await expect(card).toContainText('El primer tinto del día en la 85');
  await expect(card.getByRole('img', { name: /Foto de Marlene/ })).toHaveAttribute('src', /\/object\/sign\/micra-posts\/.+token=/);
  await expect(feed).not.toContainText('Todavía en revisión');
  // El chip «De los baristas» deja solo lo publicado por ellos
  await feed.getByRole('tab', { name: 'De los baristas' }).click();
  await expect(feed.getByTestId('feed').getByRole('article')).toHaveCount(1);
  await card.getByRole('button', { name: 'Apartarle a Marlene ›' }).click();
  await expect(page).toHaveURL(new RegExp(`/micra/b/${MARLENE}$`));
  expect(errors).toEqual([]);
});
