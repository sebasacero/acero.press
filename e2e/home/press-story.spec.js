// Banner de la app Micra: el celular inicia sesión con Google y abre la receta,
// donde la animación del AeroPress sigue al scroll (y sin movimiento, pasos con foto).
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
const phone = (page) => page.locator('.pb-phone');
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

test('escritorio: entra con Google, abre la receta y el AeroPress sigue al scroll', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await expect(page.locator('#ps-title')).toContainText('Entra a Micra');
  await expect(page.locator('#ps-title .essp-script')).toHaveText('tu AeroPress');
  // La hoja de la portada: marco con zonas, panel oscuro con el odómetro y cajetín
  await expect(page.locator('#prensado .essp-sheet')).toHaveCount(1);
  await expect(page.locator('#prensado .pb-block')).toContainText(/0[1-8] \/ 08/);
  await expect(page.locator('.pb-side .ps-step')).toHaveCount(8);
  await expect(page.locator('#prensado .essp-stores')).toHaveCount(1);

  // Inicio de sesión: entrada → toque → cuenta → bienvenida → receta
  const beats = [];
  for (const p of [0.01, 0.07, 0.12, 0.17, 0.2, 0.26]) {
    await scrollTrack(page, p);
    await page.waitForTimeout(150);
    beats.push(await phone(page).getAttribute('data-beat'));
  }
  expect(beats).toEqual(['screen', 'tap', 'chooser', 'pick', 'welcome', 'open']);
  await scrollTrack(page, 0.12);
  await expect(page.locator('.pb-chooser')).toContainText('Elige una cuenta');
  await expect(activeItem(page)).toHaveText('Elige tu cuenta');
  expect(await settledTime(page)).toBeLessThan(0.05);

  // Lo que Safari de iOS necesita para cargar y buscar sin un toque: preload auto,
  // atributo muted (no solo la propiedad) y el video quieto tras el arranque
  await page.waitForFunction(() => document.querySelector('.ps-video')?.readyState >= 2);
  await expect.poll(() => page.evaluate(() => {
    const v = document.querySelector('.ps-video');
    return [v.preload, v.hasAttribute('muted'), v.hasAttribute('playsinline'), v.paused];
  })).toEqual(['auto', true, true, true]);

  // La receta: el video avanza con el scroll y los pasos van en orden
  const seen = [];
  let last = -1;
  for (const p of [0.4, 0.55, 0.7, 0.85, 1]) {
    await scrollTrack(page, p);
    const t = await settledTime(page);
    expect(t).toBeGreaterThan(last + 0.5);
    last = t;
    await expect(phone(page)).toHaveAttribute('data-scene', 'brew');
    seen.push(await activeItem(page).textContent());
  }
  expect(last).toBeGreaterThan(16);
  expect(seen.at(-1)).toBe('Disco fuera');
  const order = ['Filtro y tapa', 'Café molido', 'Agua y remover', 'Presiona', 'Disco fuera'];
  const idx = seen.map((s) => order.indexOf(s));
  expect(idx).toEqual([...idx].sort((a, b) => a - b));
  await expect(page.locator('.pb-card')).toContainText('PASO 05 / 05');

  // Tocar un ítem lleva a él: al inicio de sesión y a un paso de la receta
  await page.click('.pb-side .ps-step:has-text("Elige tu cuenta") button');
  await expect(phone(page)).toHaveAttribute('data-beat', /chooser|pick/, { timeout: 6000 });
  await page.click('.pb-side .ps-step:has-text("Presiona") button');
  await expect(activeItem(page)).toHaveText('Presiona', { timeout: 6000 });
  await expect(page.locator('.pb-card b')).toHaveText('Presiona');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: el celular llena la pantalla, sin la lista y sobre los botones flotantes', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await scrollTrack(page, 0.6);
  await page.waitForFunction(() => document.querySelector('.ps-video')?.readyState >= 2);
  await expect.poll(() => videoTime(page)).toBeGreaterThan(5);
  const r = await page.evaluate(() => {
    const b = document.querySelector('.pb-phone').getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, side: getComputedStyle(document.querySelector('.pb-side')).display, left: b.left, right: b.right, bottom: b.bottom, h: innerHeight };
  });
  expect(r.sw).toBe(390);
  expect(r.side).toBe('none');
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(390);
  expect(r.bottom).toBeLessThanOrEqual(r.h - 90);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('con movimiento reducido: los ocho pasos como tarjetas, sin celular animado ni pista larga', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' } });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#prensado').scrollIntoViewIfNeeded();
  await expect(page.locator('.ps-card')).toHaveCount(8);
  await expect(page.locator('.ps-card.is-login').first()).toContainText('Continuar con Google');
  await expect(page.locator('.ps-track, .ps-video, .pb-phone')).toHaveCount(0);
  await expect(page.locator('.ps-card img').first()).toHaveAttribute('src', '/image/metodo/paso-1.webp');
  expect(errors).toEqual([]);
  await page.context().close();
});
