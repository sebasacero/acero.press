// La portada como marca: después de Micra y la tienda, la barra de Chapinero con el banner de las recetas (video y cuadro) en la vitrina,
// la tienda con sus botones de siempre y Visítanos con el mapa.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };

test('escritorio: la foto del local con el banner original de las recetas en la vitrina, sin avanzar solas', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.clock.install();
  await page.goto('/', { waitUntil: 'load' });
  // Un solo h1, el de Micra arriba; la marca y la barra vienen después de la tienda
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Micra.');
  const order = await page.locator('#micra, #publicaciones, #beans, #visitanos, #recetas, #escuela, #metodo').evaluateAll((els) => els.map((e) => e.id));
  expect(order).toEqual(['micra', 'publicaciones', 'beans', 'visitanos', 'recetas', 'escuela', 'metodo']);
  // «Café de especialidad para todos» ya no está
  await expect(page.getByRole('heading', { name: /para todos/i })).toHaveCount(0);
  // Sin el botón flotante de la meta de ventas
  await expect(page.locator('.sales-float')).toHaveCount(0);
  const store = page.locator('#recetas');
  await store.scrollIntoViewIfNeeded();
  await expect(store.getByRole('img', { name: /barra de ACERO\.press en Chapinero/ })).toBeVisible();
  const banner = store.locator('.lh-banner');
  await expect(banner.getByRole('heading', { level: 3 })).toHaveAccessibleName('COLD BREW.');
  // El banner original de la barra: video de fondo, el logo, el cuadro oscuro con su odómetro
  await expect(banner.locator('video')).toHaveAttribute('src', '/image/cans.mp4');
  await expect(banner.locator('.logo-acero1')).toHaveAttribute('src', '/image/logo.png');
  await expect(banner.locator('.logo-press')).toHaveText('.press');
  await expect(banner.locator('.odometer .digit')).toHaveText(['0', '2', '4', 'g']);
  await expect(banner.locator('.odometer-target')).toHaveText('155ml H₂O');
  await expect(banner.locator('.cota-badge')).toHaveText('RATIO 1:6.5');
  await expect(banner.getByRole('link', { name: /Prepárala en casa/ })).toHaveAttribute('href', '#beans');

  // El banner queda dentro del vidrio de la vitrina (x 17–60 %, y 4–98 % de la foto)
  const photo = await store.locator('.lh-photo > img').boundingBox();
  const box = await banner.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(photo.x + photo.width * 0.17);
  expect(box.x + box.width).toBeLessThanOrEqual(photo.x + photo.width * 0.61);
  expect(box.y + box.height).toBeLessThan(photo.y + photo.height * 0.98);

  // No avanza solo; las pestañas y la flecha sí
  await page.clock.runFor(20000);
  await expect(banner.getByRole('heading', { level: 3 })).toHaveAccessibleName('COLD BREW.');
  await store.getByRole('tab', { name: 'LATTE' }).click();
  await expect(store.getByRole('tab', { name: 'LATTE' })).toHaveAttribute('aria-selected', 'true');
  await expect(store.locator('.lh-banner h3')).toHaveAccessibleName('LATTE.');
  await store.getByRole('button', { name: 'Receta anterior' }).click();
  await store.getByRole('button', { name: 'Receta anterior' }).click();
  await expect(store.locator('.lh-banner h3')).toHaveAccessibleName('MATCHA MAMBÉ.');
  // La vitrina y sus pestañas caben juntas en la pantalla
  const stage = await store.locator('.lh-stage').boundingBox();
  const tabs = await store.locator('.lh-tabs').boundingBox();
  expect(tabs.y + tabs.height - stage.y).toBeLessThan(900);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: la vitrina entera a la vista, el banner se lee completo y nada se sale de lado', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: PHONE });
  await page.goto('/', { waitUntil: 'load' });
  const banner = page.locator('.lh-banner');
  await banner.scrollIntoViewIfNeeded();
  const stage = await page.locator('.lh-stage').boundingBox();
  const box = await banner.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(stage.x);
  expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width);
  // El botón de abajo del banner no queda cortado por el cuadro
  const cta = await banner.getByRole('link', { name: /Prepárala en casa/ }).boundingBox();
  expect(cta.y + cta.height).toBeLessThanOrEqual(stage.y + stage.height);
  // Deslizar cambia de receta
  const y = box.y + box.height / 2;
  await page.locator('.lh-stage').dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 300, clientY: y }], changedTouches: [{ identifier: 1, clientX: 300, clientY: y }] });
  await page.locator('.lh-stage').dispatchEvent('touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: 120, clientY: y }] });
  await expect(page.locator('.lh-banner h3')).toHaveAccessibleName('LATTE.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('tienda: los botones de siempre (Café, AeroPress, Kit) y sin enlaces muertos', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  const shop = page.locator('#beans');
  await shop.scrollIntoViewIfNeeded();
  const tabs = shop.locator('.shop-tabs').getByRole('tab');
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(shop.locator('a[href="#"]')).toHaveCount(0);
  await tabs.nth(2).click();
  await expect(shop.getByRole('button', { name: 'Añadir kit al carrito' })).toBeVisible();
  await tabs.nth(0).click();
  await shop.getByRole('button', { name: 'Añadir al carrito' }).first().click();
  await expect(page.locator('.navbar .cart-count-badge').first()).toHaveText('1');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('Visítanos va junto a la foto de las recetas, con el pin que abre Google Maps', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: PHONE });
  await page.goto('/', { waitUntil: 'load' });
  // La ubicación: el plano con el pin, el toque abre Google Maps con la dirección
  const visit = page.locator('#visitanos');
  await visit.scrollIntoViewIfNeeded();
  await expect(visit.getByRole('heading', { level: 2 })).toHaveText('Visítanos.');
  await expect(page.locator('section.lh #visitanos, section.lh #recetas')).toHaveCount(2);
  await expect(visit.locator('.visit-pin')).toBeVisible();
  await expect(visit.locator('.visit-logo')).toHaveAttribute('href', /google\.com\/maps.*Cra\.%2013%20%2385-32/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
  await page.context().close();
});
