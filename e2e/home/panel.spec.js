// /micra en computador es el centro de control a pantalla completa; el celular sigue en la app,
// y en computador la app queda en /micra?app.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };

test('computador: /micra abre el centro de control y «Abrir la app» lleva a la app', async ({ browser }) => {
  const { page, errors, api } = await openPage(browser, { context: DESK });
  api.micra.baristas = [{ id: 'b1', name: 'Marlene', localidad: 'Chapinero', referencia: 'Cl. 57', prices: { tinto: 1500 }, takes_holds: true, live_until: '2099-01-01T00:00:00Z' }];
  // En Vite dev «/micra» sirve micra.html (la entrada nativa); en Vercel cae en index.html. «/micra/» va por main.jsx.
  await page.goto('/micra/', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Centro de control');
  const panel = page.getByTestId('control-panel');
  await expect(panel.getByTestId('ctl-live')).toHaveText('1');
  await expect(panel.getByRole('navigation', { name: 'Controles' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir la app' }).click();
  await expect(page).toHaveURL(/\/micra\?app$/);
  await expect(page.getByTestId('control-panel')).toHaveCount(0);
  expect(errors.filter((e) => !/Failed to fetch/.test(e))).toEqual([]);
  await page.context().close();
});

test('celular: /micra sigue siendo la app', async ({ browser }) => {
  const { page, errors } = await openPage(browser);
  await page.goto('/micra', { waitUntil: 'load' });
  await expect(page.locator('.mapp-main')).toBeVisible();
  await expect(page.getByTestId('control-panel')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});
