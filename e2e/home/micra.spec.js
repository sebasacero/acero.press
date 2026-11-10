// Micra en la portada: qué es, las cifras reales del estudio (micra_street_map) junto al centro de
// celular de Micra con Vender, las tiendas, y arriba los dos banners de siempre como dos
// puertas a la vez. Las fichas de redes van al final de la página.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };

test('con ventas y baristas reales, las cifras salen en el celular, sin nombres; abajo, las fichas de redes', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: DESK });
  api.opts.streetMap = {
    days: 90,
    sales: [{ carrera: 7, calle: 60, cups: 40, zone: 'Chapinero' }],
    tinteros: [
      { carrera: 7, calle: 63, stage: 'activo', cups_per_hour: 30, zone: 'Chapinero' },
      // La ficha de la calle guarda el GPS y no la cuadra: también cuenta
      { carrera: null, calle: null, lat: 4.668, lng: -74.054, stage: 'prospecto', zone: 'Chapinero' },
    ],
  };
  await page.goto('/', { waitUntil: 'load' });
  const micra = page.locator('#micra');
  await micra.scrollIntoViewIfNeeded();
  await expect(micra.getByRole('heading', { level: 2 })).toHaveText(/El mejor café lo vende\s*alguien cerca de ti\./);
  await expect(micra).toContainText('Micra es para quienes venden café');
  // Tres pasos que caen como notificaciones y, junto al celular, las cifras reales del estudio
  await expect(micra.locator('.pg-notes li b')).toHaveText(['Aprende', 'Vende', 'Certifícate']);
  await expect(micra.locator('.pg-notes')).toHaveClass(/is-on/);
  await expect(micra.getByRole('list', { name: 'El estudio de calle hoy' }).locator('b')).toHaveText(['40', '1', '2']);
  // Sin enlace a las tiendas, dicen «Pronto» y no son enlaces
  const stores = micra.getByRole('group', { name: 'Descarga la app Micra' });
  await expect(stores).toContainText('App Store');
  await expect(stores.locator('i')).toHaveText(['Pronto', 'Pronto']);
  await expect(stores.getByRole('link')).toHaveCount(0);
  // En público se dice «baristas»; sin nombres
  await expect(micra).not.toContainText(/tintero|Laura|en camino/i);
  // Las fichas de redes van al final, con su video y el botón de la app
  const banners = page.locator('#publicaciones .posts-banner');
  await expect(banners).toHaveCount(3);
  await expect(banners.locator('video')).toHaveCount(3);
  const links = banners.getByRole('link');
  await expect(links.nth(0)).toHaveAttribute('href', /instagram\.com\/aceropress/);
  await expect(links.nth(0)).toContainText('@aceropress');
  await expect(links.nth(1)).toContainText('@acero.press');
  await expect(links.nth(2)).toHaveAttribute('href', /youtube\.com/);
  // Un aliado no se nombra antes de serlo
  await expect(page.locator('body')).not.toContainText(/Amor Perfecto/i);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('el celular de Micra es Vender: cada +1 suma la taza y la plata y llena la meta, sin escribir nada', async ({ browser }) => {
  // Con «menos movimiento» el celular no se toca solo: así la cuenta es la de la prueba
  const { page, errors, api } = await openPage(browser, { context: { ...DESK, reducedMotion: 'reduce' } });
  await page.goto('/', { waitUntil: 'load' });
  const phone = page.getByRole('group', { name: /el panel de vender del barista/ });
  await phone.scrollIntoViewIfNeeded();
  await expect(phone.locator('.sellp-count b')).toHaveText('4');
  await expect(phone.locator('.sellp-cash')).toContainText('$6.000');
  await phone.getByRole('button', { name: 'Vendí un perico' }).click();
  await expect(phone.locator('.sellp-count b')).toHaveText('5');
  await expect(phone.locator('.sellp-cash')).toContainText('$8.000');
  await expect(phone.locator('.sellp-pop em')).toHaveText('+$2.000');
  // Es un ejemplo: no registra ventas
  expect(api.micra.sales ?? []).toEqual([]);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('el celular se toca solo mientras nadie lo use: la taza sube', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  const phone = page.getByRole('group', { name: /el panel de vender del barista/ });
  await phone.scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await phone.locator('.sellp-count b').textContent()), { timeout: 8000 }).toBeGreaterThan(4);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('las dos puertas: los dos banners de siempre a la vez, sin carrusel', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  const doors = page.locator('#baristas');
  await doors.scrollIntoViewIfNeeded();
  await expect(doors.getByRole('heading', { level: 2 })).toHaveText(/¿Tomas café\s*o lo vendes\?/);
  await expect(doors).not.toHaveAttribute('aria-roledescription', 'carousel');
  const order = doors.locator('[data-door="order"]'), barista = doors.locator('[data-door="barista"]');
  await expect(order).toBeVisible();
  await expect(barista).toBeVisible();
  await expect(order.getByRole('heading', { level: 3 })).toHaveText(/Pide café\s*en AeroPress\s*a domicilio/);
  await expect(order.getByRole('link', { name: 'Abrir Micra' })).toHaveAttribute('href', '/micra');
  await expect(barista.getByRole('heading', { level: 3 })).toHaveText(/Vive\s*del café\s*con tu AeroPress/);
  await expect(barista.getByRole('link', { name: 'Soy barista' })).toHaveAttribute('href', '/micra/barista');
  // Lado a lado en computador
  const a = await order.boundingBox(), b = await barista.boundingBox();
  expect(b.x).toBeGreaterThan(a.x + a.width);
  await expect(doors).not.toContainText(/tintero/i);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('los enlaces viejos a /#tinteros y /#baristas señalan la puerta del barista', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/#tinteros', { waitUntil: 'load' });
  await expect(page.locator('#baristas [data-door="barista"]')).toHaveClass(/is-focus/);
  await expect(page.locator('#baristas [data-door="barista"]')).toBeInViewport();
  expect(errors).toEqual([]);
  await page.context().close();
});

test('la pestaña del navegador lleva el icono térmico', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('link[rel="icon"]')).toHaveCount(2);
  for (const href of ['/image/icono-32.png', '/image/icono-64.png']) {
    await expect(page.locator(`link[rel="icon"][href="${href}"]`)).toHaveCount(1);
    expect((await page.request.get(href)).status(), href).toBe(200);
  }
  await expect(page.locator('link[rel="apple-touch-icon"], link[rel="manifest"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});
