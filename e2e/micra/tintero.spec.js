// Estudio de calle: registrar un tintero desde la cámara de Micra en dos minutos.
import { test, expect } from '@playwright/test';
import { openPage, openMicraFromHome } from './fixtures.js';

test('tintero con foto y permiso: la foto va al bucket privado y la ficha a la API de BI', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser);
  await openMicraFromHome(page);
  await page.waitForFunction(() => document.querySelector('.mc-video')?.readyState >= 2);
  await page.getByRole('button', { name: 'Registrar un tintero' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ficha de un tintero' });
  await expect(sheet).toBeVisible();
  await expect(page.locator('.mstudio.is-camera')).toHaveCount(1); // la cámara sigue detrás

  await sheet.getByRole('button', { name: 'Tomar foto' }).click();
  await expect(sheet.getByRole('img', { name: 'Foto del puesto' })).toBeVisible();
  await expect(page.locator('.mstudio.is-edit')).toHaveCount(0); // la foto de ficha no abre el editor
  await sheet.getByRole('checkbox').check();

  await sheet.getByPlaceholder(/Don Jairo/).fill('Don Jairo');
  await sheet.getByRole('option', { name: 'Chapinero' }).click();
  await sheet.getByLabel('Calle').fill('72');
  await sheet.getByLabel('Precio del tinto').fill('1.500');
  await sheet.getByLabel('Tazas por hora').fill('25');
  await sheet.getByRole('button', { name: 'Guardar tintero' }).click();
  await expect(page.locator('.mst-toast')).toContainText('Don Jairo quedó en el estudio con su foto');

  const upload = api.calls.find((c) => c.p.includes('/storage/v1/object/'));
  expect(upload.p).toContain('/object/estudio/tinteros/');
  expect(upload.p).not.toContain('marketing');
  const post = api.find('/api/v1/bi/tinteros', 'POST');
  expect(post.data).toMatchObject({ name: 'Don Jairo', zone: 'Chapinero', carrera: 13, calle: 72, tinto_price: 1500, cups_per_hour: 25, photo_consent: true, stage: 'prospecto' });
  expect(post.data.photo_url).toMatch(/^https:\/\/.+\/estudio\/tinteros\//);
  expect(post.data.surveyed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(api.tinteros).toHaveLength(1);
  await expect(sheet).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('sin permiso la foto no sube; sin nombre no se guarda nada', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser);
  await openMicraFromHome(page);
  await page.waitForFunction(() => document.querySelector('.mc-video')?.readyState >= 2);
  await page.getByRole('button', { name: 'Registrar un tintero' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ficha de un tintero' });
  await sheet.getByRole('button', { name: 'Tomar foto' }).click();
  await expect(sheet.getByRole('img', { name: 'Foto del puesto' })).toBeVisible();

  // Sin nombre: se explica y no sale ninguna petición
  await sheet.getByRole('option', { name: 'Zona T' }).click();
  await sheet.getByRole('button', { name: 'Guardar tintero' }).click();
  await expect(sheet.getByRole('alert')).toContainText('nombre');
  expect(api.find('/api/v1/bi/tinteros', 'POST')).toBeUndefined();
  expect(api.calls.some((c) => c.p.includes('/storage/v1/object/'))).toBe(false);

  // Con nombre pero sin permiso: la ficha sí, la foto no
  await sheet.getByPlaceholder(/Don Jairo/).fill('Carrito de la 83');
  await sheet.getByRole('button', { name: 'Guardar tintero' }).click();
  await expect(page.locator('.mst-toast')).toContainText('Carrito de la 83 quedó en el estudio');
  await expect(page.locator('.mst-toast')).not.toContainText('con su foto');
  expect(api.calls.some((c) => c.p.includes('/storage/v1/object/'))).toBe(false);
  const post = api.find('/api/v1/bi/tinteros', 'POST');
  expect(post.data.photo_consent).toBe(false);
  expect(post.data.photo_url).toBeUndefined();
  expect(post.data).toMatchObject({ zone: 'Zona T', carrera: 13, calle: 83 });
  expect(errors).toEqual([]);
  await page.context().close();
});
