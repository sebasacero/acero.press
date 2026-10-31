// La entrada de la app instalada (micra.html → Android e iOS con Capacitor), en
// el navegador: Capacitor cae a sus versiones web, así que aquí se prueba que
// arranca en /micra y que lo que sale de la app apunta al sitio, no a localhost.
// Lo propio del celular (GPS nativo, volver de Google) no corre en Chromium.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;

test('app instalada: arranca en Micra y comparte enlaces del sitio', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.admin = false;
  await page.goto('/micra.html', { waitUntil: 'load' });

  await expect(page).toHaveURL(/\/micra$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('¿Quién pasa con café');
  await expect(page.getByRole('list', { name: 'Baristas' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('navigation', { name: 'Micra' }).getByRole('link', { name: /aceropress/ })).toHaveAttribute('href', 'https://www.aceropress.com/');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('app instalada: el barista ve su enlace con la dirección del sitio', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.admin = false;
  api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
  await signIn(page);
  await page.goto('/micra.html', { waitUntil: 'load' });

  await expect(page).toHaveURL(/\/micra\/barista$/);
  // Mi ruta está en «Mi plata»; el enlace, solo en Mi perfil
  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Mi plata/ }).click();
  await expect(page.getByRole('link', { name: 'Medir mi recorrido (Mi ruta)' })).toHaveAttribute('href', 'https://www.aceropress.com/ruta');
  await expect(page.locator('.mapp-share')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page.getByTestId('profile-link')).toHaveText(`www.aceropress.com/micra/b/${MARLENE}`);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('app instalada: el arranque se dibuja una vez por sesión y se puede saltar', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.admin = false;
  await page.goto('/micra.html', { waitUntil: 'load' });
  const splash = page.getByTestId('micra-splash');
  await expect(splash).toBeVisible();
  await splash.click();
  await expect(splash).toHaveCount(0);
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('¿Quién pasa con café');
  await expect(splash).toHaveCount(0);
  expect(errors).toEqual([]);
  await ctx.close();
});
