// Recetas campeonas: el fondo de cada banner es el campeón, su foto (del sitio
// oficial del WAC, con crédito y enlace) a pantalla completa y encima su video
// sin sonido cuando existe. La hoja completa enlaza la receta oficial, la final
// y el video. Si la foto no carga, no queda un hueco roto.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
const PHOTO = readFileSync(new URL('../../public/image/local.jpg', import.meta.url));
const servePhotos = (page) => page.route(/cdn\.shopify\.com/, (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
// Sin red en las pruebas: el reproductor responde una página vacía
const serveVideos = (page) => page.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>video</title>' }));

test('banner y hoja: el campeón de fondo (foto y video), crédito, receta oficial y final', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await servePhotos(page);
  await serveVideos(page);
  await page.goto('/#metodo', { waitUntil: 'load' });

  const first = page.locator('.rb-slide').first();
  const photo = first.locator('.rb-bg .rb-photo');
  await expect(photo).toHaveAttribute('src', /cdn\.shopify\.com/);
  await expect.poll(() => photo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(photo).toHaveAttribute('alt', /Némo Pop/);
  await expect(first.getByRole('link', { name: 'Foto: WAC ↗' })).toHaveAttribute('href', /2025-world-aeropress-championship$/);
  await expect(first.locator('.rb-place')).toHaveText('1er lugar · Final Mundial · Seúl');
  // La foto cubre todo el banner y encima corre la final, muda, en bucle y sin controles
  await expect.poll(() => photo.evaluate((img) => img.getBoundingClientRect().width / img.closest('.rb-slide').getBoundingClientRect().width)).toBe(1);
  await expect(first.locator('.rb-bgvideo')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/G1e1FfR162c\?autoplay=1&mute=1&loop=1/);
  await expect(first.locator('.rb-champ')).toHaveCount(0);
  // Los banners que no se ven no piden su foto ni su video
  await expect(page.locator('.rb-slide').nth(1).locator('.rb-photo, iframe')).toHaveCount(0);

  // 2024: el campeón es George Stanica (Rumania), no quien decía antes
  await page.getByRole('tab', { name: '2024' }).click();
  const slide = page.locator('.rb-slide').nth(1);
  await expect(slide.getByRole('heading', { level: 3 })).toHaveText('George Stanica');
  await expect(slide.getByRole('link', { name: 'Foto: Matthew Machanda / WAC ↗' })).toBeVisible();
  await slide.getByRole('button', { name: /Ver receta completa/ }).click();
  const sheet = page.locator('dialog[open] .rs');
  await expect(sheet.getByRole('link', { name: 'Receta oficial (WAC) ↗' })).toHaveAttribute('href', 'https://worldaeropresschampionship.com/pages/recipes');
  await expect(sheet.getByRole('link', { name: 'La final de 2024 ↗' })).toHaveAttribute('target', '_blank');
  await expect(sheet.getByRole('link', { name: /Ver la final/ })).toHaveCount(0);
  await expect(slide.locator('.champ-play')).toHaveCount(0);
  // Sin video: de fondo queda solo su foto
  await expect(slide.locator('.rb-photo')).toHaveCount(1);
  await expect(slide.locator('.rb-bgvideo')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // 2025 sí tiene el video oficial de la final
  await page.getByRole('tab', { name: '2025' }).click();
  await first.getByRole('button', { name: /Ver receta completa/ }).click();
  await expect(page.locator('dialog[open] .rs').getByRole('link', { name: 'Ver la final ↗' })).toHaveAttribute('href', /youtube\.com\/watch\?v=/);
  await page.keyboard.press('Escape');
  // En el banner, el botón ▶ abre el video con sonido ahí mismo (el reproductor, solo al abrir)
  await expect(page.locator('.champ-video iframe')).toHaveCount(0);
  await first.getByRole('button', { name: /Ver la final/ }).click();
  const player = page.getByRole('dialog', { name: /Ver la final · Némo Pop 2025/ });
  await expect(player.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/G1e1FfR162c/);
  await expect(player.getByRole('link', { name: /World AeroPress Championship ↗/ })).toHaveAttribute('href', /youtube\.com\/watch/);
  await player.getByRole('button', { name: /Cerrar/ }).click();
  await expect(page.locator('.champ-video iframe')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('si la foto oficial no carga, el fondo sigue con el video del campeón o el de la casa', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.route(/cdn\.shopify\.com/, (route) => route.fulfill({ status: 404, body: '' }));
  await serveVideos(page);
  await page.goto('/#metodo', { waitUntil: 'load' });
  const first = page.locator('.rb-slide').first();
  await expect(first.getByRole('heading', { level: 3 })).toHaveText('Némo Pop');
  await expect(first.locator('.rb-photo')).toHaveCount(0);
  await expect(first.locator('.rb-bgvideo')).toHaveCount(1);
  // 2024 no tiene video: va el de la casa, nunca un hueco roto
  await page.getByRole('tab', { name: '2024' }).click();
  const slide = page.locator('.rb-slide').nth(1);
  await expect(slide.locator('.rb-photo')).toHaveCount(0);
  await expect(slide.locator('video.rb-video')).toHaveCount(1);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('con «menos movimiento» el campeón queda en foto quieta', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { ...DESK, reducedMotion: 'reduce' } });
  await servePhotos(page);
  await page.goto('/#metodo', { waitUntil: 'load' });
  const first = page.locator('.rb-slide').first();
  await expect(first.locator('.rb-photo')).toHaveCount(1);
  await expect(first.locator('.rb-bgvideo')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});
