// «Pedido»: la calculadora de un pedido de grupo en Vender (13 nov 2026).
// La hoja sube, suma con los precios del barista, aplica el descuento y dice si
// le alcanza el café de los termos. No anota ventas.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra-vivo.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;

test('barista en la calle: «Pedido» calcula cuánto cobrarle a un grupo de 10 tintos', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.admin = false;
  api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
  await signIn(page);
  await page.goto('/micra/barista', { waitUntil: 'load' });

  await page.getByTestId('sellhead').getByTestId('open-pedido').click();
  const sheet = page.getByTestId('pedido');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('pedido-total')).toHaveText('$0');

  const sales = () => api.calls.filter((c) => /micra_(sale|barista_sale)/.test(c.p)).length;
  const before = sales();
  await sheet.getByRole('button', { name: 'Tinto: cinco más' }).click();
  await sheet.getByRole('button', { name: 'Tinto: cinco más' }).click();
  await expect(sheet.getByTestId('pedido-n-tinto')).toHaveText('10');
  await expect(sheet.getByTestId('pedido-total')).toHaveText('$15.000');
  await expect(sheet).toContainText('2 apartados de hasta 6');

  await sheet.getByTestId('pedido-pct-10').click();
  await expect(sheet.getByTestId('pedido-total')).toHaveText('$13.500');
  await expect(sheet).toContainText('sale a $1.350 cada una');
  await expect(sheet.getByTestId('pedido-termos')).toContainText('Te alcanza');

  // Uno menos baja la cuenta; «Listo» cierra sin anotar ventas
  await sheet.getByRole('button', { name: 'Tinto: uno menos' }).click();
  await expect(sheet.getByTestId('pedido-total')).toHaveText('$12.100');
  await sheet.getByRole('button', { name: 'Listo' }).click();
  await expect(sheet).toHaveCount(0);
  expect(sales()).toBe(before);

  // También se abre desde la hoja «+1 Venta» del centro de la barra
  await page.getByTestId('tab-sale').click();
  await page.getByTestId('quick-pedido').click();
  await expect(page.getByTestId('pedido')).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});
