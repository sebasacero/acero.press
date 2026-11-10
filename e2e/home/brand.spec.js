// La portada que sigue el día: las dos puertas, Micra, la tienda, Aprende, Visítanos con las recetas
// de la casa (el banner de la barra: video y cuadro), los campeones y las redes.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };

test('escritorio: el orden de la portada y el banner original de las recetas de la casa, sin avanzar solas', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.clock.install();
  await page.goto('/', { waitUntil: 'load' });
  // Un solo h1, el del banner de 24 horas; luego los dos banners de siempre, Micra y la tienda
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Vive del café\s*con tu AeroPress/);
  const order = await page.locator('#dia, #baristas, #micra, #publicaciones, #beans, #visitanos, #recetas, #escuela, #metodo').evaluateAll((els) => els.map((e) => e.id));
  expect(order).toEqual(['dia', 'baristas', 'micra', 'beans', 'escuela', 'visitanos', 'recetas', 'metodo', 'publicaciones']);
  // Cada sección lleva su hora, una después de la otra
  await expect(page.locator('.pg-sec > .pg-hour')).toHaveCount(7);
  // «Café de especialidad para todos» ya no está
  await expect(page.getByRole('heading', { name: /para todos/i })).toHaveCount(0);
  // Sin el botón flotante de la meta de ventas
  await expect(page.locator('.sales-float')).toHaveCount(0);
  const store = page.locator('#recetas');
  await store.scrollIntoViewIfNeeded();
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

  // El banner llena su marco
  const frame = await store.locator('.lh-stage').boundingBox();
  const box = await banner.boundingBox();
  expect(Math.abs(box.width - frame.width)).toBeLessThan(4);

  // No avanza solo; las pestañas y la flecha sí
  await page.clock.runFor(20000);
  await expect(banner.getByRole('heading', { level: 3 })).toHaveAccessibleName('COLD BREW.');
  await store.getByRole('tab', { name: 'LATTE' }).click();
  await expect(store.getByRole('tab', { name: 'LATTE' })).toHaveAttribute('aria-selected', 'true');
  await expect(store.locator('.lh-banner h3')).toHaveAccessibleName('LATTE.');
  await store.getByRole('button', { name: 'Receta anterior' }).click();
  await store.getByRole('button', { name: 'Receta anterior' }).click();
  await expect(store.locator('.lh-banner h3')).toHaveAccessibleName('MATCHA MAMBÉ.');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: el banner de las recetas se lee completo y nada se sale de lado', async ({ browser }) => {
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

test('Visítanos y las recetas de la casa van en una sola pieza, con Google Maps y WhatsApp', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: PHONE });
  await page.goto('/', { waitUntil: 'load' });
  const visit = page.locator('#visitanos');
  await visit.scrollIntoViewIfNeeded();
  await expect(visit.getByRole('heading', { level: 2 })).toHaveText('Ven a conocer nuestra tienda.');
  await expect(visit).toContainText('Cra. 13 #85-32 · Bogotá');
  await expect(page.locator('section.pg-visit #visitanos, section.pg-visit #recetas')).toHaveCount(2);
  await expect(visit.getByRole('link', { name: /Cómo llegar/ })).toHaveAttribute('href', /google\.com\/maps.*Cra\.%2013%20%2385-32/);
  await expect(visit.getByRole('link', { name: 'Escribir por WhatsApp' })).toHaveAttribute('href', /wa\.me\/\d+\?text=/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('a cualquier hora el texto de cada sección se lee: claro sobre cielo oscuro, tinta sobre cielo claro', async ({ browser }) => {
  for (const hhmm of ['05:40', '12:00', '17:45', '22:30']) {
    const { page, errors } = await openPage(browser, { context: DESK });
    await page.clock.setFixedTime(new Date(`2026-11-10T${hhmm}:00-05:00`));
    await page.goto('/', { waitUntil: 'load' });
    const tones = await page.locator('.pg-sec').evaluateAll((els) => els.map((e) => {
      const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).map(Number); return r * 0.299 + g * 0.587 + b * 0.114; };
      const st = getComputedStyle(e);
      return [lum(st.color) > 150, lum(st.getPropertyValue('--pg-a')) < 150, lum(st.getPropertyValue('--pg-b')) < 150];
    }));
    for (const [light, a, b] of tones) expect([a, b], hhmm).toEqual([light, light]);
    expect(errors).toEqual([]);
    await page.context().close();
  }
});
