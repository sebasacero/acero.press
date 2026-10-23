// Escuela: seis lecciones en la hoja de la portada, el cronómetro de la primera
// taza, la cuenta de la taza y lo visto recordado en el navegador.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

test('escritorio: lecciones, cronómetro, cuenta de la taza y progreso recordado', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } } });
  await page.clock.install();
  await page.goto('/', { waitUntil: 'load' });
  const school = page.locator('#escuela');
  await school.scrollIntoViewIfNeeded();
  await expect(page.locator('#school-title')).toContainText('Aprende a');
  await expect(school.getByRole('tab')).toHaveCount(6);
  await expect(school.getByRole('tabpanel')).toContainText('Conoce tu AeroPress');
  // Se llega desde el menú y desde el banner «Ser barista»
  await expect(page.locator('nav a[href="#escuela"]').first()).toHaveText('Escuela');
  await expect(page.locator('.essp-slide a[href="#escuela"]')).toHaveText('Aprende a preparar');

  // «Siguiente lección» marca la vista y abre la primera taza, con su cronómetro
  await school.getByRole('button', { name: /Siguiente lección/ }).click();
  await expect(school.getByRole('tab', { name: /Tu primera taza/ })).toHaveAttribute('aria-selected', 'true');
  await expect(school.getByRole('tab', { name: /Conoce tu AeroPress/ })).toContainText('vista');
  await expect(school.locator('.school-progress')).toContainText('1 de 6 vistas');
  const timer = school.locator('.school-timer');
  await expect(timer.locator('.school-clock')).toHaveText('0:00');
  await timer.getByRole('button', { name: 'Empezar' }).click();
  await page.clock.runFor(12_000);
  await expect(timer.locator('.school-now b')).toHaveText('Remueve 10 veces');
  await expect(timer.locator('.school-clock')).toHaveText('0:12');
  await timer.getByRole('button', { name: 'Pausar' }).click();
  await page.clock.runFor(5_000);
  await expect(timer.locator('.school-clock')).toHaveText('0:12');
  await timer.getByRole('button', { name: 'Seguir' }).click();
  await page.clock.runFor(120_000);
  await expect(timer.locator('.school-clock')).toHaveText('2:00');
  await expect(timer.locator('.school-now b')).toHaveText('Listo: para cuando sisee');
  await timer.getByRole('button', { name: 'Reiniciar' }).click();
  await expect(timer.locator('.school-clock')).toHaveText('0:00');

  // La cuenta de la taza con números de Colombia
  await school.getByRole('tab', { name: /Cuánto cobrar/ }).click();
  const cost = school.locator('.school-cost');
  await expect(cost).toContainText('Escribe el precio de la libra');
  await cost.getByLabel('Precio de la libra (500 g)').fill('20.000');
  await cost.getByLabel('Vaso, tapa y filtro por taza').fill('200');
  await cost.getByLabel('Precio de venta').fill('3.000');
  await expect(cost.locator('.school-results')).toContainText('$800');
  await expect(cost.locator('.school-results')).toContainText('$2.200');
  await expect(cost.locator('.school-results')).toContainText('73 %');
  await expect(cost).toContainText('Tazas por libra: 33');

  // Lo visto sigue al volver
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#escuela .school-progress')).toContainText('1 de 6 vistas');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: las lecciones se deslizan en una fila y nada se sale de la pantalla', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } });
  await page.goto('/', { waitUntil: 'load' });
  const school = page.locator('#escuela');
  await school.scrollIntoViewIfNeeded();
  const r = await page.evaluate(() => {
    const list = document.querySelector('.school-list');
    return { sw: document.documentElement.scrollWidth, display: getComputedStyle(list).display, scrolls: list.scrollWidth > list.clientWidth };
  });
  expect(r.sw).toBe(390);
  expect(r.display).toBe('flex');
  expect(r.scrolls).toBe(true);
  await school.getByRole('tab', { name: /Cuánto cobrar/ }).click();
  await expect(school.locator('.school-cost')).toBeVisible();
  expect(errors).toEqual([]);
  await page.context().close();
});
