// Regresiones de Micra Studio en el celular: ventas enlazadas a tarjetas, Esc, pie de foto y avisos.
import { test, expect } from '@playwright/test';
import { openPage, openMicraFromHome, openEditorPlain, waitForCard, center } from './fixtures.js';

test.describe.configure({ mode: 'serial' });

let page;
let api;
let errors;
test.beforeAll(async ({ browser }) => {
  ({ page, api, errors } = await openPage(browser));
  await openMicraFromHome(page);
});
test.afterAll(() => page?.context().close());

test('los faltantes se suman por presentación', async () => {
  await page.click('.mst-ticket');
  await expect(page.locator('.msheet')).toContainText('quedan 3');
  await page.click('.msheet-stepper button[aria-label="Una más"]');
  await page.click('.msheet-add:has-text("Otro café")');
  await page.click('.msheet-line.is-open .msheet-stepper button[aria-label="Una más"]');
  // 2 + 2 del mismo 250 g con stock 3
  await page.click('.msheet-btn.is-primary.is-big');
  await page.waitForSelector('.msheet-notice.is-warn');
  await page.click('.msheet-notice.is-warn .msheet-btn.is-ghost');
  await page.click('.msheet-line-x');
  await page.keyboard.press('Escape');
});

test('el WhatsApp del cliente no pasa a la venta siguiente', async () => {
  api.clear();
  await page.click('.mst-ticket');
  await page.waitForSelector('.msheet');
  await page.click('.msheet-add:has-text("WhatsApp")');
  await page.fill('.msheet input[type=tel]', '300 123 4567');
  await page.click('.msheet-btn.is-primary.is-big');
  await page.waitForSelector('.mst-toast');
  expect(api.find('/rpc/micra_record_sale').data.p_phone).toBe('573001234567');
  api.clear();
  await page.click('.mst-ticket');
  await page.waitForSelector('.msheet');
  await page.click('.msheet-btn.is-primary.is-big');
  await expect.poll(() => api.find('/rpc/micra_record_sale')?.data).toMatchObject({ p_phone: null });
});

test('venta de la cámara enlazada a la tarjeta: no se ofrece registrarla otra vez', async () => {
  await openEditorPlain(page);
  await expect(page.locator('.mst-salepill')).toContainText('Vendido');
  await page.click('.mst-salepill');
  await page.waitForSelector('.msheet-success');
  const sheet = page.locator('.msheet');
  await expect(sheet).not.toContainText('Registrar venta');
  await expect(sheet).toContainText('Publicar · Feed');
  await expect(sheet).toContainText('Deshacer');
  await expect(sheet).toContainText('Nueva venta');
  await page.click('.msheet-btn:has-text("Nueva venta")');
  await expect(sheet).toContainText('Registrar venta');
  await page.click('.msheet-x');
  await page.waitForTimeout(300);
});

test('Esc durante la cuenta regresiva la cancela sin publicar', async () => {
  api.clear();
  await page.click('.mst-quick');
  await page.waitForSelector('.mst-job.is-countdown');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3600);
  await expect(page.locator('.mstudio.is-edit')).toHaveCount(1);
  expect(api.calls.some((c) => c.p.includes('storage') || c.p.includes('publish-content'))).toBe(false);
});

test('publicar usa la venta enlazada una sola vez', async () => {
  api.clear();
  await page.click('.mst-quick');
  await page.waitForSelector('.mst-job.is-done', { timeout: 9000 });
  const used = api.find('/publications', 'POST')?.data?.order_id;
  expect(used, 'sin order_id').toBeTruthy();
  // La tarjeta publicada sigue mostrándose vendida (no invita a registrarla otra vez)
  await expect(page.locator('.mst-salepill')).toContainText('Vendido');
  await page.click('.mst-job .mst-toast-action[aria-label="Cerrar aviso"]');
  // Otra tarjeta: volver a la cámara y publicar de nuevo
  await page.click('.mst-top .mc-round[aria-label="Volver a la cámara"]');
  await page.waitForSelector('.mstudio.is-camera');
  await page.click('.mc-filter.on');
  await waitForCard(page);
  api.clear();
  await page.click('.mst-quick');
  await page.waitForSelector('.mst-job.is-done', { timeout: 9000 });
  expect(api.find('/publications', 'POST').data.order_id, `reutilizó ${used}`).toBeFalsy();
  await page.click('.mst-job .mst-toast-action[aria-label="Cerrar aviso"]');
});

test('el pie de foto editado no pasa a otro café', async () => {
  await page.click('.mst-send');
  await page.waitForSelector('#mst-caption');
  await page.fill('#mst-caption', 'Texto a mano');
  await page.keyboard.press('Escape');
  await page.click('.mst-filterchip');
  await page.click('.msheet-filter:not(.on)');
  await page.keyboard.press('Escape');
  await page.click('.mst-send');
  await page.waitForSelector('#mst-caption');
  expect(await page.inputValue('#mst-caption')).toMatch(/^☕/);
  await page.keyboard.press('Escape');
});

test('el aviso «Se ocultó» se cierra con la siguiente edición', async () => {
  const a = await center(page, 'logo');
  await page.mouse.click(a.x, a.y);
  await page.click('.mst-ctx-btn:has-text("Ocultar")');
  await page.waitForSelector('.mst-toast');
  const t = await center(page, 'title');
  await page.mouse.click(t.x, t.y);
  await page.click('.mst-ctx-btn:has-text("Tamaño")');
  await page.click('.mst-ctx-chip:has-text("L")');
  await expect(page.locator('.mst-toast')).toHaveCount(0);
});

test('un sticker recién puesto queda seleccionado', async () => {
  await page.click('.mst-ctx-btn.is-done');
  await page.click('.mst-rail-btn[aria-label="Stickers"]');
  await page.click('.msheet-tile:has-text("Mención")');
  await expect(page.locator('.mst-sel-tag')).toHaveText('MENCIÓN');
});

test('sin errores en la página', () => {
  expect(errors).toEqual([]);
});
