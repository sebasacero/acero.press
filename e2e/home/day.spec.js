// El banner de 24 horas: abre en la hora de Bogotá en que se visita la web (reloj, cielo y la
// pantalla de Micra de ese momento), deja mirar otro momento del día y vuelve a «ahora».
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
// Bogotá va cinco horas detrás de UTC todo el año
const bogota = (hhmm) => new Date(`2026-11-10T${hhmm}:00-05:00`);

test('abre en la hora de Bogotá: reloj, momento del barista y su pantalla; lleva el menú y el h1', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.clock.setFixedTime(bogota('06:50'));
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/6:50\s*a\. m\./);
  await expect(day.getByTestId('day-caption')).toHaveText('Sale a vender y Micra lo pone en el mapa.');
  await expect(day.getByRole('heading', { level: 1 })).toContainText(/Vive del café\s*con tu AeroPress/);
  await expect(day.getByRole('img', { name: 'La app Micra en este momento del día' })).toHaveAttribute('src', '/image/dia/app-0530.webp');
  await expect(day.getByRole('navigation')).toBeVisible();
  await expect(day.getByRole('link', { name: 'Vendo café' })).toHaveAttribute('href', /wa\.me\/\d+\?text=/);
  await expect(day.getByRole('link', { name: 'Quiero un café' })).toHaveAttribute('href', '/micra');
  // De día el texto va en tinta; a las 6:50 todavía en claro
  await expect(day).not.toHaveClass(/is-day/);
  // En público se dice «barista»
  await expect(day).not.toContainText(/tintero/i);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('un punto de la línea muestra otro momento y «Volver a ahora» regresa', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.clock.setFixedTime(bogota('13:20'));
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/1:20\s*p\. m\./);
  await expect(day).toHaveClass(/is-day/);
  await expect(day.getByTestId('day-caption')).toHaveText('En el almuerzo, una lección de 3 minutos.');
  const dots = day.getByRole('group', { name: 'Los momentos del día' }).getByRole('button');
  await expect(dots).toHaveCount(9);
  await expect(dots.nth(4)).toHaveAttribute('aria-pressed', 'true');
  await day.getByRole('button', { name: /^4:40 p\. m\.: Meta cumplida/ }).click();
  await expect(day.getByTestId('day-caption')).toHaveText('Meta cumplida: 40 tazas.');
  await expect(day.getByTestId('day-clock')).toHaveText(/4:40\s*p\. m\./);
  await expect(day.getByRole('img', { name: 'La app Micra en este momento del día' })).toHaveAttribute('src', '/image/dia/app-1640.webp');
  await day.getByRole('button', { name: 'Volver a ahora' }).click();
  await expect(day.getByTestId('day-clock')).toHaveText(/1:20\s*p\. m\./);
  await expect(day.getByRole('button', { name: 'Volver a ahora' })).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: el menú cabe, nada se sale de lado y los puntos se pueden tocar', async ({ browser }) => {
  const { page, errors } = await openPage(browser);
  await page.clock.setFixedTime(bogota('21:10'));
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/9:10\s*p\. m\./);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  const nav = await day.getByRole('navigation').boundingBox();
  expect(nav.x).toBeGreaterThanOrEqual(0);
  expect(nav.x + nav.width).toBeLessThanOrEqual(page.viewportSize().width);
  const dot = await day.getByRole('button', { name: /^5:30 a\. m\./ }).boundingBox();
  expect(Math.min(dot.width, dot.height)).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('con «menos movimiento» no camina, pero la hora y los momentos sí cambian', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { ...DESK, reducedMotion: 'reduce' } });
  await page.clock.setFixedTime(bogota('10:05'));
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/10:05\s*a\. m\./);
  const before = await day.locator('.db-walker').evaluate((e) => e.style.transform);
  await day.getByRole('button', { name: /^11:30 p\. m\./ }).click();
  await expect(day.getByTestId('day-clock')).toHaveText(/11:30\s*p\. m\./);
  await expect(day).not.toHaveClass(/is-day/);
  expect(await day.locator('.db-walker').evaluate((e) => e.style.transform)).toBe(before);
  expect(errors).toEqual([]);
  await page.context().close();
});
