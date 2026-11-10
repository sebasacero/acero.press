// El banner de 24 horas: abre en la hora de Bogotá en que se visita la web (reloj, cielo y la
// pantalla de Micra de ese momento) y desde ahí el reloj corre: el día entero pasa en un minuto, de hora en hora,
// y toda la página cambia de color con él. Sin la línea de horas: el día sigue en la página.
// Para leer la hora de entrada las pruebas detienen el tiempo (`stopAt`) y lo sueltan con `runFor`.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
// Bogotá va cinco horas detrás de UTC todo el año
const bogota = (hhmm) => new Date(`2026-11-10T${hhmm}:00-05:00`);
/** El tiempo de la página queda quieto en esa hora de Bogotá hasta `page.clock.runFor`. */
async function stopAt(page, hhmm) {
  const at = bogota(hhmm);
  await page.clock.install({ time: new Date(at.getTime() - 1000) });
  await page.clock.pauseAt(at);
}

test('abre en la hora de Bogotá: reloj, momento del barista y su pantalla; lleva el menú y el h1', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await stopAt(page, '06:50');
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/6:00\s*a\. m\./);
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
  await stopAt(page, '13:20');
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/1:00\s*p\. m\./);
  await expect(day).toHaveClass(/is-day/);
  await expect(day.getByTestId('day-caption')).toHaveText('En el almuerzo, una lección de 3 minutos.');
  await expect(day.getByRole('img', { name: 'La app Micra en este momento del día' })).toHaveAttribute('src', '/image/dia/app-1300.webp');
  await expect(day.getByRole('group', { name: 'Los momentos del día' })).toHaveCount(0);
  await expect(day.locator('.db-day24, .db-dot')).toHaveCount(0);
  // Debajo, la primera sección sigue una hora después
  await expect(page.locator('.pg-sec > .pg-hour b').first()).toHaveText(/2:00\s*p\. m\./);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('el reloj corre apenas se entra: el día pasa y el banner y las secciones cambian de color', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await stopAt(page, '05:00');
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia'), first = page.locator('.pg-sec').first();
  await expect(day.getByTestId('day-clock')).toHaveText(/5:00\s*a\. m\./);
  await expect(day).not.toHaveClass(/is-day/);
  const sky0 = await day.evaluate((e) => e.style.getPropertyValue('--db-top'));
  const sec0 = await first.evaluate((e) => e.style.getPropertyValue('--pg-a'));
  // De hora en hora, cada una 2,5 s: 12 s de página pasan 4 horas y el reloj marca la hora en punto
  await page.clock.runFor(12000);
  await expect(day.getByTestId('day-clock')).toHaveText(/9:00\s*a\. m\./);
  await expect(day).toHaveClass(/is-day/);
  await expect(day.getByTestId('day-caption')).toHaveText('Hora pico: un toque por cada taza.');
  expect(await day.evaluate((e) => e.style.getPropertyValue('--db-top'))).not.toBe(sky0);
  expect(await first.evaluate((e) => e.style.getPropertyValue('--pg-a'))).not.toBe(sec0);
  await expect(first.locator('.pg-hour b')).toHaveText(/10:00/);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: el menú cabe y nada se sale de lado', async ({ browser }) => {
  const { page, errors } = await openPage(browser);
  await stopAt(page, '21:10');
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/9:00\s*p\. m\./);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  const nav = await day.getByRole('navigation').boundingBox();
  expect(nav.x).toBeGreaterThanOrEqual(0);
  expect(nav.x + nav.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('con «menos movimiento» no camina, pero la hora sí es la de la visita', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { ...DESK, reducedMotion: 'reduce' } });
  await stopAt(page, '23:40');
  await page.goto('/', { waitUntil: 'load' });
  const day = page.locator('#dia');
  await expect(day.getByTestId('day-clock')).toHaveText(/11:00\s*p\. m\./);
  await expect(day).not.toHaveClass(/is-day/);
  const before = await day.locator('.db-walker').evaluate((e) => e.style.transform);
  await page.clock.runFor(3000);
  expect(await day.locator('.db-walker').evaluate((e) => e.style.transform)).toBe(before);
  // …ni corre el día: el reloj y el cielo de las secciones se quedan en la hora real
  await expect(day.getByTestId('day-clock')).toHaveText(/11:00\s*p\. m\./);
  expect(errors).toEqual([]);
  await page.context().close();
});
