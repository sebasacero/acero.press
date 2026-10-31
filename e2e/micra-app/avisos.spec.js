// Avisos dentro de la app (alerts.js, Globito.jsx, PullRefresh.jsx): el barista
// ve el globito cuando le apartan (también lo que llegó con la app cerrada), el
// cliente cuando su barista sale, y «desliza para recargar» vuelve a leer.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
const DAY = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

async function open(browser, { who = 'visitor', seed = SEED } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(seed));
  api.micra.admin = false;
  if (who === 'barista') {
    api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
    await signIn(page);
  }
  return { page, api, errors };
}
// Volver a la app (o el tic de cada 20 s): la app vuelve a mirar
const comeBack = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const hold = (id, o) => ({ id, tintero_id: MARLENE, client_ref: `cel-${id}`, name: 'Sebas · oficina 302', items: [{ product: 'tinto', qty: 1, unit_price: 1500 }], cups: 1, total: 1500, status: 'waiting', for_day: DAY, ...o });

test('barista: al abrir le avisa el apartado que llegó con la app cerrada, y luego cada uno nuevo', async ({ browser }) => {
  const seed = structuredClone(SEED);
  seed.holds = [hold('h1')];
  const { page, api, errors } = await open(browser, { who: 'barista', seed });
  // Ya usó Micra antes (ayer): lo que llegue sin avisar sale en el globito
  await page.addInitScript(() => {
    if (!localStorage.getItem('micra_holds_seen_v1')) localStorage.setItem('micra_holds_seen_v1', JSON.stringify({ scope: 'ayer', ids: [] }));
  });
  await page.goto('/micra/barista/hoy', { waitUntil: 'load' });
  const globito = page.getByTestId('globito');
  await expect(globito).toContainText('Nuevo apartado');
  await expect(globito).toContainText('Sebas · 1 tinto');
  // Tocarlo lleva a Vender, a quién te espera
  await globito.getByRole('button', { name: /Nuevo apartado/ }).click();
  await expect(page).toHaveURL(/\/micra\/barista$/);
  await expect(page.getByText(/Te esperan/).first()).toBeVisible();
  await expect(globito).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Barista' }).getByLabel('1 te esperan')).toBeVisible();

  // Llega otro mientras vende
  api.micra.holds.push(hold('h2', { name: 'Ana', items: [{ product: 'perico', qty: 2, unit_price: 2000 }], cups: 2, total: 4000 }));
  await comeBack(page);
  await expect(globito).toContainText('Ana · 2 pericos');
  await expect(page.getByRole('navigation', { name: 'Barista' }).getByLabel('2 te esperan')).toBeVisible();
  await globito.getByRole('button', { name: 'Cerrar aviso' }).click();

  // Lo ya avisado no se repite al volver a abrir
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByRole('navigation', { name: 'Barista' }).getByLabel('2 te esperan')).toBeVisible();
  await expect(globito).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('barista recién instalado: lo que ya espera sale en la lista, sin globito', async ({ browser }) => {
  const seed = structuredClone(SEED);
  seed.holds = [hold('h1')];
  const { page, errors } = await open(browser, { who: 'barista', seed });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(page.getByRole('navigation', { name: 'Barista' }).getByLabel('1 te esperan')).toBeVisible();
  await expect(page.getByTestId('globito')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('cliente: su apartado avanza y el globito le dice que el barista salió', async ({ browser }) => {
  const seed = structuredClone(SEED);
  seed.baristas[0].live_until = null;
  seed.holds = [hold('mio', { client_ref: 'MI-CEL' })];
  const { page, api, errors } = await open(browser, { seed });
  await page.addInitScript(() => { localStorage.setItem('micra_device_v1', JSON.stringify('MI-CEL')); });
  await page.goto('/micra', { waitUntil: 'load' });
  await expect(page.getByRole('region', { name: 'Tu apartado de hoy' })).toBeVisible();
  // Recién apartado: no hay nada que avisar
  await expect(page.getByTestId('globito')).toHaveCount(0);
  // Marlene sale a vender
  api.micra.baristas[0].live_until = new Date(Date.now() + 120 * 60000).toISOString();
  await comeBack(page);
  await expect(page.getByTestId('globito')).toContainText('Marlene salió');
  expect(errors).toEqual([]);
});

test('desliza para recargar: arrastrar desde arriba muestra el termo y vuelve a leer', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra', { waitUntil: 'load' });
  await expect(page.getByRole('list', { name: 'Baristas' }).getByRole('listitem').first()).toBeVisible();
  const before = api.all('/rpc/micra_baristas').length;
  // Un dedo que baja 140 px desde arriba
  await page.evaluate(async () => {
    const at = (y) => [new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: y })];
    const fire = (type, y) => window.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : at(y), changedTouches: at(y), bubbles: true, cancelable: true }));
    fire('touchstart', 120);
    for (let y = 130; y <= 260; y += 10) { fire('touchmove', y); await new Promise((r) => { requestAnimationFrame(r); }); }
  });
  await expect(page.getByTestId('pull-refresh')).toHaveAttribute('aria-label', 'Suelta para recargar');
  await page.evaluate(() => window.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true })));
  await expect(page.getByTestId('pull-refresh')).toHaveAttribute('aria-label', 'Recargando');
  await expect.poll(() => api.all('/rpc/micra_baristas').length).toBeGreaterThan(before);
  await expect(page.getByTestId('pull-refresh')).toHaveCount(0);
  expect(errors).toEqual([]);
});
