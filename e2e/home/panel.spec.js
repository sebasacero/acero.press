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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Centro de control · Bogotá');
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

test('computador: el mapa en vivo, las mejoras y lo que cambia mientras se mira', async ({ browser }) => {
  const { page, errors, api } = await openPage(browser, { context: DESK });
  await page.addInitScript(() => { window.__ctlPollMs = 400; });
  api.micra.baristas = [
    { id: 'b1', name: 'Marlene', full: 'Marlene Rojas', localidad: 'Chapinero', referencia: 'Cl. 57 con Cra. 7', lat: 4.643, lng: -74.064, prices: { tinto: 1500 }, takes_holds: true, live_until: '2099-01-01T00:00:00Z' },
    { id: 'b2', name: 'Jairo', full: 'Jairo Peña', localidad: 'Suba', referencia: 'Portal Suba', lat: 4.745, lng: -74.094, prices: { tinto: 1300 }, takes_holds: true },
  ];
  // Tres personas buscan perico lejos de Marlene: una zona sin cubrir
  api.micra.pings = [1, 2, 3].map((i) => ({ lat: 4.7, lng: -74.05, drink: 'perico', ref: `celular-${i}`, at: Date.now() }));
  await page.goto('/micra/', { waitUntil: 'load' });
  const panel = page.getByTestId('control-panel');
  await expect(panel.getByTestId('ctl-map')).toContainText('Quieren café · 3');
  const notes = panel.getByTestId('ctl-insights');
  await expect(notes).toContainText('Quieren café y no hay barista');
  await expect(notes).toContainText('Lo más buscado ahora: perico');
  await expect(panel.getByTestId('ctl-events')).toContainText('Aquí aparece lo que cambie');
  // Jairo sale a vender: el aviso llega solo, sin recargar
  api.micra.baristas[1].live_until = '2099-01-01T00:00:00Z';
  await expect(panel.getByTestId('ctl-events')).toContainText('Jairo salió a vender');
  await expect(panel.getByTestId('ctl-live')).toHaveText('2');
  await expect(panel).not.toContainText(/tintero|Rojas|Peña/i);
  expect(errors.filter((e) => !/Failed to fetch|WebGL|maplibre/i.test(e))).toEqual([]);
  await page.context().close();
});

test('computador sin cuenta del equipo: mapa público y avisos cerrados', async ({ browser }) => {
  const { page, api } = await openPage(browser, { context: DESK });
  api.micra.admin = false;
  await page.goto('/micra/', { waitUntil: 'load' });
  const panel = page.getByTestId('control-panel');
  await expect(panel.getByTestId('ctl-map')).toBeVisible();
  await expect(panel).toContainText('Los avisos, las mejoras y las tendencias son del equipo.');
  await expect(panel.getByTestId('ctl-insights')).toHaveCount(0);
  await page.context().close();
});
