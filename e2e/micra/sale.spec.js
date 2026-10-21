// Venta de Micra: reintento sin cobrar dos veces y el camino de antes (sin la migración atómica).
import { test, expect } from '@playwright/test';
import { openPage, openMicraFromHome } from './fixtures.js';

test('si la respuesta no llega, reintentar el mismo ticket no duplica la venta', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser);
  await openMicraFromHome(page);
  await page.click('.mst-ticket');
  await expect(page.locator('.msheet')).toContainText('quedan 3');
  api.opts.dropNextSaleResponse = true; // la base la guarda, pero la respuesta se pierde
  await page.click('.msheet-btn.is-primary.is-big');
  await expect(page.locator('.msheet-notice.is-err')).toContainText('sin respuesta del servidor. Reintenta el mismo ticket');
  await page.click('.msheet-btn.is-primary.is-big');
  await expect(page.locator('.mst-toast')).toContainText('✓ Esa venta ya estaba registrada · $32.000');
  const [first, retry] = api.all('/rpc/micra_record_sale');
  expect(retry.data.p_client_ref).toBe(first.data.p_client_ref);
  expect(api.orders.size).toBe(1);
  expect(api.stock.get('c0-250').stock_qty).toBe(2);
  // Un ticket nuevo lleva otra referencia
  await page.click('.mst-ticket');
  await page.click('.msheet-btn.is-primary.is-big');
  await expect.poll(() => api.all('/rpc/micra_record_sale').length).toBe(3);
  expect(api.all('/rpc/micra_record_sale')[2].data.p_client_ref).not.toBe(first.data.p_client_ref);
  await expect(page.locator('.mst-toast')).toContainText('✓ Venta registrada · $32.000');
  expect(api.orders.size).toBe(2);
  expect(errors.filter((e) => !/Failed to fetch/.test(e))).toEqual([]);
  await page.context().close();
});

test('sin la migración: venta y deshacer por el camino de antes, con lo aplicado de verdad', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { backend: { atomic: false } });
  await openMicraFromHome(page);
  // 4 de un café con stock 3: «Registrar igual»
  await page.click('.mst-ticket');
  await expect(page.locator('.msheet')).toContainText('quedan 3');
  for (let i = 0; i < 3; i++) await page.click('.msheet-stepper button[aria-label="Una más"]');
  await page.click('.msheet-btn.is-primary.is-big');
  await page.click('.msheet-notice.is-warn .msheet-btn:has-text("Registrar igual")');
  await expect(page.locator('.mst-toast')).toContainText('✓ Venta registrada · $128.000');
  const order = api.find('/orders', 'POST');
  expect(order.data).toMatchObject({ source: 'esspresale', status: 'completed', total: 128000 });
  expect(api.find('/order_items', 'POST').data).toEqual([expect.objectContaining({ variant_id: 'c0-250', qty: 4, unit_price: 32000, subtotal: 128000 })]);
  // La venta pide −4; el inventario solo tenía 3: un ajuste de +1 lo deja dicho
  expect(api.all('/inventory_movements', 'POST').map((c) => [c.data.reason, c.data.change_qty])).toEqual([['sale', -4], ['adjustment', 1]]);
  expect(api.stock.get('c0-250').stock_qty).toBe(0);

  api.clear();
  await page.click('.mst-toast-action');
  await expect.poll(() => api.find('/orders', 'PATCH')?.data).toEqual({ status: 'cancelled' });
  await expect.poll(() => api.find('/inventory_movements', 'POST')?.data).toMatchObject({ reason: 'adjustment', change_qty: 3 });
  expect(api.calls.some((c) => c.p.endsWith('/publications') && c.m === 'PATCH' && c.data.order_id === null), 'publicaciones sueltas').toBe(true);
  expect(api.stock.get('c0-250').stock_qty).toBe(3);
  // Tras el primer «no existe», ya no se vuelve a pedir la función
  expect(api.all('/rpc/micra_void_sale')).toHaveLength(0);
  expect(errors).toEqual([]);
  await page.context().close();
});
