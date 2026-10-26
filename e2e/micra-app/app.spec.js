// La app Micra (/micra): el cliente aparta, el barista entrega y cuenta, el
// equipo ve el día. Supabase simulado (e2e/micra/fixtures.js, «App Micra»).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
const WILSON = SEED.baristas[2].id;

/** who: 'visitor' | 'barista' (enlazado, sin equipo) | 'team' (equipo, sin ficha propia) */
async function open(browser, { who = 'visitor', seed = SEED, missing = false } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(seed), { missing });
  if (who === 'barista') {
    api.micra.admin = false;
    api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
  }
  if (who === 'team') api.micra.baristas.forEach((b) => { delete b.mine; });
  if (who !== 'visitor') await signIn(page);
  else {
    api.micra.admin = false;
    await page.addInitScript(() => { localStorage.setItem('acero.consent', 'granted'); });
  }
  return { page, api, errors };
}

test('cliente: ve quién está en la calle, aparta 2 tintos y 1 perico y lo cancela', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra', { waitUntil: 'load' });

  await expect(page.getByRole('heading', { level: 1 })).toContainText('¿Quién pasa con café');
  const rows = page.getByRole('list', { name: 'Baristas' }).getByRole('listitem');
  await expect(rows).toHaveCount(3);
  // Primero la que avisó que salió
  await expect(rows.first()).toContainText('Marlene');
  await expect(rows.first()).toContainText('En la calle');
  await expect(rows.first()).toContainText('2 lo esperan');
  // Sin el modo barista ni el del equipo
  await expect(page.getByRole('tablist', { name: 'Ver Micra como' })).toHaveCount(0);

  await rows.first().getByRole('button').click();
  await expect(page).toHaveURL(new RegExp(`/micra/b/${MARLENE}$`));
  await expect(page.getByRole('heading', { name: 'Marlene' })).toBeVisible();
  await page.getByRole('button', { name: 'Sumar un tinto' }).click();
  await page.getByRole('button', { name: 'Sumar un tinto' }).click();
  await page.getByRole('button', { name: 'Sumar un perico' }).click();
  await page.getByLabel('Tu nombre (así te llama)').fill('Sebas · 302');
  await page.getByRole('button', { name: 'Apartar 3 tazas · $5.000' }).click();

  await expect(page.getByTestId('micra-hold-done')).toContainText('2 tintos y 1 perico');
  await expect(page.getByTestId('micra-hold-done')).toContainText('$5.000');
  // La base recibe producto y cantidad, nunca el precio
  const sent = api.find('/rpc/micra_hold');
  expect(sent.data.p_items).toEqual([{ product: 'tinto', qty: 2 }, { product: 'perico', qty: 1 }]);
  expect(sent.data.p_client_ref).toMatch(/^cel-/);

  // Queda en «Mis apartados» y el nombre se recuerda
  await page.getByRole('navigation', { name: 'Micra' }).getByRole('button', { name: /Mis apartados/ }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Marlene' })).toContainText('Te espera');
  await page.getByRole('listitem').filter({ hasText: 'Marlene' }).getByRole('button').click();
  await expect(page.getByLabel('Tu nombre (así te llama)')).toHaveValue('Sebas · 302');
  await page.getByRole('button', { name: 'Ya no lo necesito' }).click();
  await expect(page.getByRole('button', { name: 'Elige qué quieres' })).toBeVisible();
  expect(api.micra.holds.find((h) => h.name === 'Sebas · 302').status).toBe('cancelled');
  expect(errors).toEqual([]);
});

test('cliente: un barista sin cuenta en Micra no ofrece apartar; el filtro y el favorito', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto(`/micra/b/${WILSON}`, { waitUntil: 'load' });
  await expect(page.getByText('Wilson todavía no recibe apartados por Micra')).toBeVisible();
  await expect(page.getByRole('button', { name: /Apartar/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Es mi barista' }).click();
  await page.getByRole('button', { name: '‹ Baristas' }).click();
  // El favorito sube al primer lugar
  await expect(page.getByRole('list', { name: 'Baristas' }).getByRole('listitem').first()).toContainText('Wilson');
  await page.getByRole('button', { name: 'Perico' }).click();
  await expect(page.getByRole('list', { name: 'Baristas' }).getByRole('listitem')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('cliente: sin baristas ni migración, la app dice que abre pronto (no un error)', async ({ browser }) => {
  const { page, errors } = await open(browser, { missing: true });
  await page.goto('/micra', { waitUntil: 'load' });
  await expect(page.getByText('Micra abre muy pronto.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Invitar a mi barista' })).toHaveAttribute('href', /wa\.me/);
  expect(errors).toEqual([]);
});

test('barista: entra a su día, entrega un apartado, cuenta +1, fía, deshace y cobra', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra', { waitUntil: 'load' });
  // El barista cae en su modo
  await expect(page).toHaveURL(/\/micra\/barista$/);
  await expect(page.getByRole('heading', { name: /Marlene\.$/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Equipo' })).toHaveCount(0);
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('2');

  // Entregar a la portería: sus 3 tintos entran a la libreta
  const porteria = page.getByRole('listitem').filter({ hasText: 'Portería Ed. Alcalá' });
  await porteria.getByRole('button', { name: 'Entregado' }).click();
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('5');
  await expect(porteria).toHaveCount(0);

  // +1 y deshacer
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('6');
  await expect(page.getByText('Todo guardado')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer el último' }).click();
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('5');

  // Fiado con nombre nuevo
  await page.getByRole('button', { name: 'Fié un perico' }).click();
  await page.getByLabel('Nombre de quien te debe').fill('Don Luis taxi');
  await page.getByRole('button', { name: 'Anotar fiado' }).click();
  const luis = page.getByRole('listitem').filter({ hasText: 'Don Luis taxi' });
  await expect(luis).toContainText('$2.000');
  await expect(luis.getByRole('link', { name: 'Cobrar' })).toHaveAttribute('href', /wa\.me.*Don%20Luis%20taxi/);
  await luis.getByRole('button', { name: 'Pagó' }).click();
  await expect(luis).toHaveCount(0);

  // Ya volví
  await page.getByRole('button', { name: 'Ya volví' }).click();
  await expect(page.getByRole('button', { name: 'Salí a vender' })).toBeVisible();
  expect(api.find('/rpc/micra_barista_out').data.p_minutes).toBe(0);
  // Nunca actúa por otro barista
  expect(api.all('/rpc/micra_barista_sale').every((c) => !c.data.p_tintero_id)).toBe(true);
  expect(errors).toEqual([]);
});

test('barista sin señal: el +1 se cuenta igual y sube una sola vez cuando vuelve la red', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(page.getByTestId('micra-count-perico')).toHaveText('2');
  await page.route('https://mock.supabase.co/rest/v1/rpc/micra_barista_sale', (r) => r.abort('failed'));
  await page.getByRole('button', { name: 'Vendí un perico' }).click();
  await page.getByRole('button', { name: 'Vendí un perico' }).click();
  await expect(page.getByTestId('micra-count-perico')).toHaveText('4');
  await expect(page.getByText(/2 sin subir/)).toBeVisible();
  await page.unroute('https://mock.supabase.co/rest/v1/rpc/micra_barista_sale');
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByText('Todo guardado')).toBeVisible();
  await expect(page.getByTestId('micra-count-perico')).toHaveText('4');
  expect(api.micra.sales.filter((s) => s.product === 'perico').length).toBe(3); // la del seed (2 tazas) + 2
  expect(errors.filter((e) => !/Failed to fetch/.test(e))).toEqual([]);
});

test('barista nuevo: entra con Google y enlaza su cuenta con el código del enlace', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  api.ruta.me = null;
  api.micra.baristas[0].mine = false;
  await page.goto('/micra/barista?codigo=abc234', { waitUntil: 'load' });
  await expect(page.getByLabel('Código')).toHaveValue('ABC234');
  // Al enlazar, la ficha de prueba de la simulación pasa a ser la suya
  page.on('request', (r) => { if (r.url().endsWith('/rpc/tintero_claim')) api.micra.baristas[0].mine = true; });
  await page.getByRole('button', { name: 'Enlazar mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: /Marlene\.$/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('equipo: ve el día de todos, genera el código de quien falta y actúa como un barista', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'team' });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  await expect(page.getByRole('tablist', { name: 'Ver Micra como' }).getByRole('tab')).toHaveText(['Cliente', 'Barista', 'Equipo']);
  await expect(page.getByTestId('owner-cups')).toHaveText('4');
  const wilson = page.getByRole('listitem').filter({ hasText: 'Wilson' });
  await expect(wilson).toContainText('Falta enlazar su cuenta');
  await wilson.getByRole('button', { name: 'Generar código' }).click();
  await expect(wilson.locator('code')).toHaveText('K7M2QX');

  await page.getByRole('listitem').filter({ hasText: 'Jairo' }).getByRole('button', { name: 'Actuar como' }).click();
  await expect(page.getByText('Actuando como')).toContainText('Jairo');
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('1');
  expect(api.find('/rpc/micra_barista_sale').data.p_tintero_id).toBe(SEED.baristas[1].id);

  // Sin ficha propia, el modo barista pide escoger a quién
  await page.getByRole('button', { name: 'Cambiar de barista' }).click();
  await expect(page.getByRole('heading', { name: '¿Como quién entras?' })).toBeVisible();
  expect(errors).toEqual([]);
});
