// Anuncios «Patrocinado», etapa 1 (Ads.jsx, AdsPanel.jsx, ads.js;
// 20261031190000_micra_ads.sql): el equipo carga y pausa un anuncio; el cliente
// lo ve en el muro y en las historias; se cuentan vistas (una por celular al
// día) y toques, sin saber quién.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGO8Jy3NAANMDEgANwcAN68BHH4VDQEAAAAASUVORK5CYII=', 'base64');
const DAY = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const plus = (n) => new Date(Date.parse(`${DAY}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
const AD = { advertiser: 'Panadería La 85', title: 'Pan de bono recién salido', body: 'A dos cuadras de tu barista.', image_url: null, cta_label: 'Pedir', cta_url: 'https://wa.me/573001234567', placement: 'feed', audience: 'client', hour_from: null, hour_to: null, starts_on: DAY, ends_on: plus(6), active: true };

async function open(browser, { who = 'visitor', ads = [] } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.ads = structuredClone(ads);
  if (who === 'team') { api.micra.baristas.forEach((b) => { delete b.mine; }); await signIn(page); } else api.micra.admin = false;
  if (who === 'barista') { api.ruta.me = { id: SEED.baristas[0].id, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null }; await signIn(page); }
  // El botón abre WhatsApp en otra pestaña: aquí responde una página vacía
  await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>wa</title>' }));
  return { page, api, errors };
}

test('equipo: carga un anuncio (con imagen y WhatsApp), lo ve al aire con sus cifras y lo pausa', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'team' });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const panel = page.getByTestId('ads-panel');
  await expect(panel).toContainText('Anuncios · 0 al aire');
  await panel.getByTestId('ad-new').click();
  const form = panel.getByTestId('ad-form');
  await form.getByLabel('Anunciante').fill('Panadería La 85');
  await form.getByLabel('Título').fill('Pan de bono recién salido');
  await form.getByLabel(/Enlace/).fill('300 123 4567');
  await form.getByTestId('ad-image').setInputFiles({ name: 'pan.png', mimeType: 'image/png', buffer: PNG });
  await expect(form.getByRole('img', { name: 'La imagen del anuncio' })).toHaveAttribute('src', /\/object\/public\/marketing\/micra-ads\/.+\.jpg$/);
  // Sin fecha final no se guarda
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form.getByRole('alert')).toContainText('hasta cuándo');
  await form.getByTestId('ad-ends').fill(plus(6));
  await form.getByRole('group', { name: 'Para quién' }).getByRole('button', { name: 'Clientes' }).click();
  await form.getByRole('button', { name: 'Guardar' }).click();
  const saved = api.find('/rpc/micra_ad_save').data;
  expect(saved.p_ad).toMatchObject({ advertiser: 'Panadería La 85', cta_url: 'https://wa.me/573001234567', placement: 'feed', audience: 'client', starts_on: DAY, ends_on: plus(6) });
  const row = panel.getByTestId('ad-row');
  await expect(row).toContainText('Al aire');
  await expect(row).toContainText('Publicación en Hoy · Clientes');
  await expect(panel).toContainText('Anuncios · 1 al aire');
  await row.getByRole('button', { name: 'Pausar' }).click();
  await expect(row).toContainText('Pausado');
  expect(api.find('/rpc/micra_ad_toggle').data).toMatchObject({ p_active: false });
  expect(errors).toEqual([]);
});

test('cliente: el post patrocinado sale en el muro y la historia en la fila; una vista por día y cada toque cuentan', async ({ browser }) => {
  const { page, api, errors } = await open(browser, {
    ads: [
      { id: 'ad-feed', ...AD },
      { id: 'ad-story', ...AD, advertiser: 'Leche de la finca', title: 'Tu perico con leche de finca', placement: 'story', audience: 'all' },
      { id: 'ad-barista', ...AD, advertiser: 'Vasos y tapas', title: 'Vasos para tu puesto', audience: 'barista' },
      { id: 'ad-old', ...AD, advertiser: 'Ya pasó', starts_on: plus(-10), ends_on: plus(-3) },
    ],
  });
  await page.goto('/micra', { waitUntil: 'load' });

  // La historia patrocinada, después de Hoy
  const bubble = page.getByTestId('stories').getByTestId('story-ad');
  await expect(bubble).toContainText('Patrocinado');
  await bubble.click();
  const story = page.getByTestId('ad-story');
  await expect(story).toContainText('Tu perico con leche de finca');
  await expect.poll(() => api.micra.adStats['ad-story']?.views).toBe(1);
  const [wa] = await Promise.all([page.waitForEvent('popup'), story.getByTestId('ad-story-cta').click()]);
  await wa.close();
  await expect.poll(() => api.micra.adStats['ad-story']?.taps).toBe(1);
  await story.getByRole('button', { name: 'Cerrar' }).click();

  // En el muro: el de clientes sí; el de baristas y el que ya terminó, no
  const feed = page.getByTestId('home-feed');
  const ad = feed.getByTestId('feed-ad');
  await expect(ad).toHaveCount(1);
  await expect(ad).toContainText('Panadería La 85');
  await expect(ad).toContainText('Patrocinado');
  await expect(feed).not.toContainText('Vasos para tu puesto');
  await expect(feed).not.toContainText('Ya pasó');
  await ad.scrollIntoViewIfNeeded();
  await expect.poll(() => api.micra.adStats['ad-feed']?.views).toBe(1);
  await expect(ad.getByTestId('ad-cta')).toHaveAttribute('rel', /sponsored/);

  // Volver a abrir el mismo día no suma otra vista
  await page.reload({ waitUntil: 'load' });
  await page.getByTestId('home-feed').getByTestId('feed-ad').scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((r) => { setTimeout(r, 600); }));
  expect(api.micra.adStats['ad-feed'].views).toBe(1);
  expect(errors).toEqual([]);
});

test('barista: ve lo patrocinado para baristas en su Hoy, no lo de clientes', async ({ browser }) => {
  const { page, api, errors } = await open(browser, {
    who: 'barista',
    ads: [{ id: 'ad-client', ...AD }, { id: 'ad-barista', ...AD, advertiser: 'Vasos y tapas', title: 'Vasos para tu puesto', audience: 'barista' }],
  });
  await page.goto('/micra/barista/hoy', { waitUntil: 'load' });
  const ad = page.getByTestId('feed-ad');
  await expect(ad).toHaveCount(1);
  await expect(ad).toContainText('Vasos y tapas');
  expect(api.find('/rpc/micra_ads_live', 'POST').data).toEqual({ p_audience: 'barista' });
  expect(errors).toEqual([]);
});
