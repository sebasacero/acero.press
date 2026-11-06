// Micra en la portada: qué es, las cifras reales del estudio (micra_street_map) junto al celular con
// Vender (se toca +1 y la taza se llena), los dos banners de siempre, las fichas de redes y las tiendas.
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
  await expect(micra.getByRole('heading', { level: 2 }).first()).toContainText('Micra.');
  await expect(micra.locator('.essp-script').first()).toHaveText('vive del café');
  // Tres pasos cortos junto al texto y, en el panel del celular, las cifras reales del estudio
  await expect(micra.locator('.micra-steps li')).toHaveCount(3);
  await expect(micra.getByRole('list', { name: 'El estudio de calle hoy' }).locator('b')).toHaveText(['40', '1', '2']);
  await expect(micra.getByRole('group', { name: 'Descarga la app Micra' })).toBeVisible();
  // El primer botón abre la app de verdad
  await expect(micra.getByRole('link', { name: 'Abrir la app' })).toHaveAttribute('href', '/micra');
  // Abajo, las fichas de redes con su video y el botón de la app
  const banners = micra.locator('#publicaciones .posts-banner');
  await expect(banners).toHaveCount(3);
  await expect(banners.locator('video')).toHaveCount(3);
  const links = banners.getByRole('link');
  await expect(links.nth(0)).toHaveAttribute('href', /instagram\.com\/aceropress/);
  await expect(links.nth(0)).toContainText('@aceropress');
  await expect(links.nth(1)).toContainText('@acero.press');
  await expect(links.nth(2)).toHaveAttribute('href', /youtube\.com/);
  // En público se dice «baristas»; sin nombres
  await expect(micra).not.toContainText(/tintero|Laura|en camino/i);
  // Los banners principales van arriba: el primero muestra quién está en la calle (micra_baristas) y lleva a la app
  const hero = page.locator('#baristas');
  await expect(hero.getByRole('heading', { level: 1 })).toContainText(/Pide café\s*en AeroPress\s*a domicilio/);
  await expect(hero.getByTestId('hero-live').first()).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Ver quién pasa cerca' }).first()).toHaveAttribute('href', '/micra');
  // Sin enlace a las tiendas, el banner no muestra sus botones
  await expect(hero.getByRole('group', { name: 'Descarga la app Micra' })).toHaveCount(0);
  await hero.getByRole('button', { name: 'Soy barista' }).click();
  await expect(hero.getByRole('heading', { level: 2 }).filter({ hasText: 'Vive' })).toContainText(/Vive\s*del café\.\s*con tu AeroPress/);
  await expect(hero.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveAttribute('href', /wa\.me\/\d+\?text=/);
  // Un aliado no se nombra antes de serlo
  await expect(page.locator('body')).not.toContainText(/Amor Perfecto/i);
  // Los llamados: WhatsApp con el mensaje listo y la Escuela
  await expect(micra.getByRole('link', { name: 'Vendo café', exact: true })).toHaveAttribute('href', /wa\.me\/\d+\?text=.*Micra/);
  await expect(micra.getByRole('link', { name: 'Empezar la Escuela', exact: true })).toHaveAttribute('href', '/escuela');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('el celular de Micra es Vender: cada +1 suma la taza y la plata y llena la meta, sin escribir nada', async ({ browser }) => {
  const { page, errors, api } = await openPage(browser, { context: DESK });
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

test('los enlaces viejos a /#tinteros y /#baristas abren el banner «Ser barista»', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/#tinteros', { waitUntil: 'load' });
  await expect(page.locator('#baristas .essp-slide--photo')).toHaveAttribute('aria-hidden', 'false');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('los banners del principio van en carrusel, sin tabla ni botones de control', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.clock.install();
  await page.goto('/', { waitUntil: 'load' });
  const hero = page.locator('#baristas');
  await expect(hero).toHaveAttribute('aria-roledescription', 'carousel');
  await expect(hero.getByText(/^(ZONA|HORA|FECHA|PREPARA)$/)).toHaveCount(0);
  await expect(hero.getByRole('tab')).toHaveCount(0);
  await expect(hero.getByRole('button', { name: /anterior|siguiente/i })).toHaveCount(0);
  const order = hero.locator('.essp-slide--paper');
  const barista = hero.locator('.essp-slide--photo');
  await expect(order).toHaveAttribute('aria-hidden', 'false');
  // Pasa solo al siguiente banner y vuelve al primero
  await page.clock.runFor(8500);
  await expect(barista).toHaveAttribute('aria-hidden', 'false');
  await page.clock.runFor(8500);
  await expect(order).toHaveAttribute('aria-hidden', 'false');
  // Con el cursor encima se queda quieto
  await page.mouse.move(700, 400);
  await page.clock.runFor(20000);
  await expect(order).toHaveAttribute('aria-hidden', 'false');
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
