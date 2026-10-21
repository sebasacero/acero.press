// Estudio de calle: «Hoy vendo en» viaja con cada venta y se recuerda entre visitas.
import { test, expect } from '@playwright/test';
import { openPage, openMicraFromHome } from './fixtures.js';

test('la zona elegida va en la venta como p_place y se recuerda al volver', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser);
  await openMicraFromHome(page);
  await page.click('.mst-ticket');
  await expect(page.locator('.msheet')).toContainText('quedan 3');
  const place = page.getByTestId('sale-place');
  await expect(place).toContainText('Opcional');
  await place.getByRole('option', { name: 'Zona T' }).click();
  await expect(place).toContainText('Calle 83 con 13 · Zona T');
  // Afinar la cuadra a mano conserva la zona
  await place.getByLabel('Calle').fill('85');
  await expect(place).toContainText('Calle 85 con 13 · Zona T');
  await page.click('.msheet-btn.is-primary.is-big');
  await expect(page.locator('.mst-toast')).toContainText('✓ Venta registrada');
  expect(api.find('/rpc/micra_record_sale').data.p_place).toEqual({ carrera: 13, calle: 85, zone: 'Zona T' });

  // Al recargar, el lugar sigue puesto: no hay que elegirlo en cada venta
  await page.reload({ waitUntil: 'load' });
  await page.click('.espresale-float');
  await page.click('.mh-dock .mh-app[aria-label="Micra"]');
  await page.waitForSelector('.mstudio.is-camera');
  await page.click('.mst-ticket');
  await expect(page.getByTestId('sale-place')).toContainText('Calle 85 con 13 · Zona T');
  api.clear();
  await page.click('.msheet-btn.is-primary.is-big');
  await expect.poll(() => api.find('/rpc/micra_record_sale')?.data?.p_place).toEqual({ carrera: 13, calle: 85, zone: 'Zona T' });
  expect(errors).toEqual([]);
  await page.context().close();
});

test('un lugar a medias avisa y la venta sale sin lugar; sin lugar, p_place es null', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser);
  await openMicraFromHome(page);
  await page.click('.mst-ticket');
  await expect(page.locator('.msheet')).toContainText('quedan 3');
  const place = page.getByTestId('sale-place');
  await place.getByLabel('Calle').fill('85');
  await expect(place.getByRole('alert')).toContainText('necesita carrera y calle');
  await page.click('.msheet-btn.is-primary.is-big');
  await expect(page.locator('.mst-toast')).toContainText('✓ Venta registrada');
  expect(api.find('/rpc/micra_record_sale').data.p_place).toBeNull();
  // Fuera de Bogotá tampoco pasa
  await page.click('.mst-ticket');
  await place.getByLabel('Carrera').fill('900');
  await expect(place.getByRole('alert')).toContainText('no está en Bogotá');
  expect(errors).toEqual([]);
  await page.context().close();
});
