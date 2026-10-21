// «Así funciona»: la animación del AeroPress sigue al scroll (y sin movimiento, pasos con foto).
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

/** Lleva el scroll a un avance 0–1 de la pista de la sección. */
const scrollTrack = (page, p) => page.evaluate((p) => {
  const t = document.querySelector('.ps-track');
  const top = window.scrollY + t.getBoundingClientRect().top;
  window.scrollTo({ top: top + p * (t.offsetHeight - innerHeight), behavior: 'instant' });
}, p);
const videoTime = (page) => page.evaluate(() => document.querySelector('.ps-video').currentTime);
const activeStep = (page) => page.locator('.ps-step.is-on .ps-body b');
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

test('escritorio: el scroll mueve el video y los pasos, y tocar un paso lleva a él', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await expect(page.locator('#ps-title')).toHaveText('Así funciona una AeroPress');
  await expect(page.locator('.ps-step')).toHaveCount(5);

  await scrollTrack(page, 0);
  await page.waitForFunction(() => document.querySelector('.ps-video')?.readyState >= 2);
  await expect(activeStep(page)).toHaveText('Filtro y tapa');
  const seen = [];
  let last = -1;
  for (const p of [0.2, 0.4, 0.6, 0.8, 1]) {
    await scrollTrack(page, p);
    const t = await settledTime(page);
    expect(t).toBeGreaterThan(last + 0.5);
    last = t;
    seen.push(await activeStep(page).textContent());
  }
  expect(last).toBeGreaterThan(16);
  expect(seen.at(-1)).toBe('Disco fuera');
  // Los pasos avanzan en orden, sin saltar hacia atrás
  const order = ['Filtro y tapa', 'Café molido', 'Agua y remover', 'Presiona', 'Disco fuera'];
  const idx = seen.map((s) => order.indexOf(s));
  expect(idx).toEqual([...idx].sort((a, b) => a - b));

  // Volver arriba devuelve el video al comienzo
  await scrollTrack(page, 0);
  expect(await settledTime(page)).toBeLessThan(0.05);
  await page.click('.ps-step:nth-child(4) button');
  await expect(activeStep(page)).toHaveText('Presiona', { timeout: 6000 });
  expect(await page.locator('.ps-fig').textContent()).toContain('04 Presiona');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: solo se ve el paso de ahora y nada se sale de la pantalla', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await scrollTrack(page, 0.5);
  await page.waitForFunction(() => document.querySelector('.ps-video')?.readyState >= 2);
  await expect.poll(() => videoTime(page)).toBeGreaterThan(5);
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    visible: [...document.querySelectorAll('.ps-step')].filter((li) => getComputedStyle(li).visibility === 'visible').length,
    frame: document.querySelector('.ps-frame').getBoundingClientRect().right,
    card: document.querySelector('.ps-step.is-on').getBoundingClientRect().bottom,
    h: innerHeight,
  }));
  expect(r.sw).toBe(390);
  expect(r.visible).toBe(1);
  expect(r.frame).toBeLessThanOrEqual(390);
  // La tarjeta del paso queda por encima de los botones flotantes del sitio
  expect(r.card).toBeLessThanOrEqual(r.h - 90);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('con movimiento reducido: los cinco pasos con su foto, sin video ni pista larga', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await expect(page.locator('.ps-card')).toHaveCount(5);
  await expect(page.locator('.ps-track, .ps-video')).toHaveCount(0);
  await expect(page.locator('.ps-card img').first()).toHaveAttribute('src', '/image/metodo/paso-1.webp');
  expect(errors).toEqual([]);
  await page.context().close();
});
