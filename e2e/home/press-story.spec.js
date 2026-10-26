// Receta guiada: la animación del AeroPress sigue al scroll en cinco pasos
// (y sin movimiento, pasos con foto). Sin inicio de sesión ni tiendas: la app aún no existe.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

/** Lleva el scroll a un avance 0–1 de la pista de la sección. */
const scrollTrack = (page, p) => page.evaluate((p) => {
  const t = document.querySelector('.ps-track');
  const top = window.scrollY + t.getBoundingClientRect().top;
  window.scrollTo({ top: top + p * (t.offsetHeight - innerHeight), behavior: 'instant' });
}, p);
const videoTime = (page) => page.evaluate(() => document.querySelector('.ps-video').currentTime);
const activeItem = (page) => page.locator('.ps-step.is-on .ps-body b');
/** El video se acerca al scroll con suavidad: espera a que se quede quieto y devuelve su segundo. */
async function settledTime(page) {
  let prev = -1;
  await expect.poll(async () => {
    const t = await videoTime(page);
    const d = Math.abs(t - prev);
    prev = t;
    return d;
  }, { intervals: [200] }).toBeLessThan(0.005);
  return prev;
}

test('escritorio: la receta guiada sigue al scroll en cinco pasos, sin login ni tiendas', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await expect(page.locator('#ps-title')).toContainText('Tu primera taza');
  await expect(page.locator('#ps-title .essp-script')).toHaveText('con AeroPress');
  // La hoja de la portada: marco con zonas y panel oscuro con el odómetro
  await expect(page.locator('#prensado .essp-sheet')).toHaveCount(1);
  await expect(page.locator('#prensado .pb-panel .essp-badge')).toHaveText(/0[1-5] \/ 05/);
  await expect(page.locator('.pb-side .ps-step')).toHaveCount(5);
  await expect(page.locator('#prensado')).not.toContainText('Google');
  await expect(page.locator('#prensado .essp-stores, #prensado .pb-login')).toHaveCount(0);
  await expect(page.locator('.pb-phone')).toHaveAttribute('data-scene', 'brew');

  // Lo que Safari de iOS necesita para cargar y buscar sin un toque: preload auto,
  // atributo muted (no solo la propiedad) y el video quieto tras el arranque
  await scrollTrack(page, 0);
  await page.waitForFunction(() => document.querySelector('.ps-video')?.readyState >= 2);
  await expect.poll(() => page.evaluate(() => {
    const v = document.querySelector('.ps-video');
    return [v.preload, v.hasAttribute('muted'), v.hasAttribute('playsinline'), v.paused];
  })).toEqual(['auto', true, true, true]);
  expect(await settledTime(page)).toBeLessThan(0.05);

  // El video avanza con el scroll y los pasos van en orden
  const seen = [];
  let last = -1;
  for (const p of [0.2, 0.4, 0.6, 0.8, 1]) {
    await scrollTrack(page, p);
    const t = await settledTime(page);
    expect(t).toBeGreaterThan(last + 0.5);
    last = t;
    seen.push(await activeItem(page).textContent());
  }
  expect(last).toBeGreaterThan(16);
  expect(seen.at(-1)).toBe('Disco fuera');
  const order = ['Filtro y tapa', 'Café molido', 'Agua y remover', 'Presiona', 'Disco fuera'];
  const idx = seen.map((s) => order.indexOf(s));
  expect(idx).toEqual([...idx].sort((a, b) => a - b));
  await expect(page.locator('.pb-card')).toContainText('PASO 05 / 05');

  // Tocar un paso de la lista lleva a él
  await page.click('.pb-side .ps-step:has-text("Presiona") button');
  await expect(activeItem(page)).toHaveText('Presiona', { timeout: 6000 });
  await expect(page.locator('.pb-card b')).toHaveText('Presiona');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: el celular llena la pantalla, sin la lista, y la sección mide menos de cuatro pantallas', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await scrollTrack(page, 0.6);
  await page.waitForFunction(() => document.querySelector('.ps-video')?.readyState >= 2);
  await expect.poll(() => videoTime(page)).toBeGreaterThan(5);
  const r = await page.evaluate(() => {
    const b = document.querySelector('.pb-phone').getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, side: getComputedStyle(document.querySelector('.pb-side')).display, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: innerHeight, track: document.querySelector('.ps-track').offsetHeight };
  });
  expect(r.sw).toBe(390);
  expect(r.side).toBe('none');
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(390);
  expect(r.w).toBeGreaterThanOrEqual(300);
  expect(r.bottom).toBeLessThanOrEqual(r.h);
  // Antes eran seis pantallas de scroll (la mitad de la portada)
  expect(r.track).toBeLessThan(r.h * 4);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('con movimiento reducido: los cinco pasos como tarjetas, sin celular animado ni pista larga', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await expect(page.locator('.ps-card')).toHaveCount(5);
  await expect(page.locator('.ps-track, .ps-video, .pb-phone')).toHaveCount(0);
  await expect(page.locator('.ps-card img').first()).toHaveAttribute('src', '/image/metodo/paso-1.webp');
  expect(errors).toEqual([]);
  await page.context().close();
});
