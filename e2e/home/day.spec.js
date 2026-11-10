// El banner de 24 horas: abre en la hora de Bogotá en que se visita la web (reloj, cielo y la
// pantalla de Micra de ese momento). Sin la línea de horas: el día sigue en el resto de la página.
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

test('de día va en tinta y ya no lleva la línea de horas ni sus puntos', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.clock.setFixedTime(bogota('13:20'));
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/1:20\s*p\. m\./);
  await expect(day).toHaveClass(/is-day/);
  await expect(day.getByTestId('day-caption')).toHaveText('En el almuerzo, una lección de 3 minutos.');
  await expect(day.getByRole('img', { name: 'La app Micra en este momento del día' })).toHaveAttribute('src', '/image/dia/app-1300.webp');
  await expect(day.getByRole('group', { name: 'Los momentos del día' })).toHaveCount(0);
  await expect(day.locator('.db-day24, .db-dot')).toHaveCount(0);
  // Debajo, la primera sección sigue una hora después
  await expect(page.locator('.pg-sec > .pg-hour b').first()).toHaveText(/2:20\s*p\. m\./);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: el menú cabe y nada se sale de lado', async ({ browser }) => {
  const { page, errors } = await openPage(browser);
  await page.clock.setFixedTime(bogota('21:10'));
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/9:10\s*p\. m\./);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  const nav = await day.getByRole('navigation').boundingBox();
  expect(nav.x).toBeGreaterThanOrEqual(0);
  expect(nav.x + nav.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('con «menos movimiento» no camina, pero la hora sí es la de la visita', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { ...DESK, reducedMotion: 'reduce' } });
  await page.clock.install({ time: bogota('23:40') });
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/11:40\s*p\. m\./);
  await expect(day).not.toHaveClass(/is-day/);
  const before = await day.locator('.db-walker').evaluate((e) => e.style.transform);
  await page.clock.runFor(3000);
  expect(await day.locator('.db-walker').evaluate((e) => e.style.transform)).toBe(before);
  expect(errors).toEqual([]);
  await page.context().close();
});
