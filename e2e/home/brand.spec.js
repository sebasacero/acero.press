// La portada como marca: la barra de Chapinero con las recetas de la casa pegadas en la vitrina,
// la tienda que pregunta qué quieres llevar y las publicaciones (o, sin Instagram, las redes).
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';
import { readFileSync } from 'node:fs';

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };
const POSTS = JSON.parse(readFileSync('e2e/data/posts.json', 'utf8'));

test('escritorio: la marca arriba, la foto del local y las recetas en la vitrina, sin avanzar solas', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.clock.install();
  await page.goto('/', { waitUntil: 'load' });
  // Un solo h1, el de la marca
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Café de especialidad');
  const store = page.locator('#recetas');
  await expect(store.getByRole('img', { name: /barra de ACERO\.press en Chapinero/ })).toBeVisible();
  const poster = store.locator('.lh-poster');
  await expect(poster.getByRole('heading', { level: 3 })).toHaveText('COLD BREW.');
  // Cada cartel dice algo, además de la receta
  await expect(poster.locator('.lh-poster-story')).toContainText('frío');
  await expect(poster.locator('.lh-poster-specs dd')).toHaveText(['24 g', '155ml H₂O', '1:6.5']);
  await expect(poster.getByRole('link', { name: /Prepárala en casa/ })).toHaveAttribute('href', '#beans');

  // El cartel queda dentro del vidrio de la vitrina (x 17–60 %, y 4–98 % de la foto)
  const photo = await store.locator('.lh-photo img').boundingBox();
  const box = await poster.boundingBox();
  expect(box.x).toBeGreaterThan(photo.x + photo.width * 0.17);
  expect(box.x + box.width).toBeLessThan(photo.x + photo.width * 0.61);
  expect(box.y + box.height).toBeLessThan(photo.y + photo.height * 0.98);

  // No avanza solo; las pestañas y la flecha sí
  await page.clock.runFor(20000);
  await expect(poster.getByRole('heading', { level: 3 })).toHaveText('COLD BREW.');
  await store.getByRole('tab', { name: 'LATTE' }).click();
  await expect(store.getByRole('tab', { name: 'LATTE' })).toHaveAttribute('aria-selected', 'true');
  await expect(store.locator('.lh-poster h3')).toHaveText('LATTE.');
  await store.getByRole('button', { name: 'Receta anterior' }).click();
  await store.getByRole('button', { name: 'Receta anterior' }).click();
  await expect(store.locator('.lh-poster h3')).toHaveText('MATCHA MAMBÉ.');
  // La sección cabe en la pantalla: las pestañas no quedan debajo del pliegue
  expect(((await store.locator('.lh-tabs').boundingBox()).y)).toBeLessThan(900);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: la vitrina llena el cuadro, el cartel se lee entero y nada se sale de lado', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: PHONE });
  await page.goto('/', { waitUntil: 'load' });
  const stage = await page.locator('.lh-stage').boundingBox();
  const poster = page.locator('.lh-poster');
  await poster.scrollIntoViewIfNeeded();
  const box = await poster.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(stage.x);
  expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width);
  // Deslizar cambia de receta
  const y = box.y + box.height / 2;
  await page.locator('.lh-stage').dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 300, clientY: y }], changedTouches: [{ identifier: 1, clientX: 300, clientY: y }] });
  await page.locator('.lh-stage').dispatchEvent('touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: 120, clientY: y }] });
  await expect(page.locator('.lh-poster h3')).toHaveText('LATTE.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('tienda: primero «¿qué quieres llevar?», con el precio desde de cada opción', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  const shop = page.locator('#beans');
  await shop.scrollIntoViewIfNeeded();
  await expect(shop.getByRole('heading', { level: 2 })).toHaveText('¿Qué quieres llevar?');
  const choices = shop.getByRole('tab');
  await expect(choices).toHaveCount(3);
  await expect(choices.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(choices.nth(0)).toContainText('desde $32.000'); // la bolsa de 250 g más barata
  await expect(choices.nth(1)).toContainText('Muy pronto'); // sin equipo en el catálogo de prueba
  await expect(choices.nth(2)).toContainText('RECOMENDADO');
  // Sin enlaces muertos
  await expect(shop.locator('a[href="#"]')).toHaveCount(0);
  await choices.nth(2).click();
  await expect(shop.getByRole('button', { name: 'Añadir kit al carrito' })).toBeVisible();
  await choices.nth(0).click();
  await shop.getByRole('button', { name: 'Añadir al carrito' }).first().click();
  await expect(page.locator('.navbar .cart-count-badge').first()).toHaveText('1');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('publicaciones: lo último de Instagram, cada una enlazada a su post', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: DESK });
  api.opts.igPosts = POSTS;
  await page.goto('/', { waitUntil: 'load' });
  const posts = page.locator('#publicaciones');
  await posts.scrollIntoViewIfNeeded();
  const cards = posts.locator('.posts-grid a');
  await expect(cards).toHaveCount(6);
  await expect(cards.first()).toHaveAttribute('href', 'https://www.instagram.com/p/p1/');
  await expect(cards.first()).toHaveAttribute('target', '_blank');
  await expect(cards.first()).toContainText('La barra de Chapinero, una mañana cualquiera');
  await expect(cards.nth(1).locator('.posts-video')).toHaveText('VIDEO');
  await expect.poll(() => cards.first().locator('img').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(posts.getByRole('link', { name: 'Seguir en Instagram' })).toHaveAttribute('href', /instagram\.com\/aceropress/);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('publicaciones: con Instagram caído, la sección lleva a cada red en vez de quedar vacía', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: PHONE });
  await page.goto('/', { waitUntil: 'load' });
  const posts = page.locator('#publicaciones');
  await expect(posts.locator('.posts-fallback')).toBeVisible();
  const links = posts.locator('.posts-channels a');
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveAttribute('href', /instagram\.com\/aceropress/);
  await expect(links.nth(0)).toContainText('@aceropress');
  await expect(links.nth(1)).toContainText('@acero.press');
  await expect(links.nth(2)).toHaveAttribute('href', /youtube\.com/);
  expect(errors).toEqual([]);
  await page.context().close();
});
