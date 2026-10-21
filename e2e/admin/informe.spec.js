// Informe y presentación del piloto: lo que se lleva a la reunión con un distribuidor.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const NAMES = ['Doña Rosa', 'Don Pedro', 'Carrito de la 63', 'Doña Marta', 'Don Luis', 'Don Ernesto'];
const PLACES = [[13, 60, 'Chapinero', 1500], [13, 63, 'Chapinero', 1500], [13, 83, 'Zona T', 2000], [12, 85, 'Zona T', 1800], [11, 66, 'Chapinero', 1200], [6, 119, 'Usaquén', 1000]];

const INFORME = {
  generatedAt: '2026-10-22T15:00:00-05:00',
  days: 90,
  surveysReady: true,
  scenarioReady: true,
  scenario: null,
  week: { from: '2026-10-16', to: '2026-10-22', cur: { cups: 12, sales: 8, income: 42000, blocks: 2, zones: ['Chapinero'], kg: 0.22 }, prev: { cups: 8, sales: 5, income: 28000, blocks: 1, zones: ['Chapinero'], kg: 0.14 } },
  waitlist: { cliente: 3, barista: 1 },
  sales: [
    { id: 's1', at: '2026-10-22T13:10:00Z', total: 7000, cups: 2, what: 'Castillo taza', carrera: 13, calle: 85, zone: 'Zona T' },
    { id: 's2', at: '2026-10-21T12:00:00Z', total: 3500, cups: 1, what: 'Geisha taza', carrera: 13, calle: 72, zone: 'Chapinero' },
  ],
  tinteros: NAMES.map((name, i) => ({ id: `t${i + 1}`, name, stage: i === 1 ? 'activo' : 'prospecto', carrera: PLACES[i][0], calle: PLACES[i][1], zone: PLACES[i][2], tinto_price: PLACES[i][3], cups_per_hour: 20 + i, photo_consent: false, photo_url: null })),
  surveys: [0, 1, 2, 3, 4].map((i) => ({
    id: `e${i}`, tintero_id: `t${i + 1}`, surveyed_at: `2026-10-2${i}T10:00:00Z`, consent: true,
    cups_per_day: 80, days_per_week: 6, hours_per_day: 6, coffee_g_week: 1500, coffee_price_kg: 40000,
    coffee_brand: i < 3 ? 'Águila Roja' : 'Sello Rojo', buys_where: 'tienda',
    would_sell_specialty: i < 2 ? 'si' : 'tal_vez', specialty_price: 4000, kit_interest: 'si', kit_payment: 'cuotas',
    has_smartphone: i !== 4, payments: ['efectivo', 'nequi'], gender: i < 4 ? 'mujer' : 'hombre', age_range: '45_54', main_income: 'si',
    notes: 'NOTA PRIVADA',
  })),
  study: { surveyed: 6, with_photo: 0, consented: 0, tinto_price_avg: 1500, cups_per_hour_avg: 22.5, zones: ['Chapinero', 'Usaquén', 'Zona T'] },
};

async function openInforme(page) {
  await page.goto('/admin', { waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Piloto")');
  await page.getByRole('tab', { name: 'Informe y presentación' }).click();
  await expect(page.getByRole('article', { name: 'Informe del piloto' })).toBeVisible();
}

const desk = { context: { viewport: { width: 1440, height: 900 } }, session: { coach: true } };

test('informe: cada cifra con su n, el precio techo, grupos de 5 y supuestos que se guardan', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, desk);
  api.opts.piloto = INFORME;
  await openInforme(page);
  const doc = page.getByRole('article', { name: 'Informe del piloto' });
  const ready = page.getByRole('region', { name: 'Listo para la reunión' });
  await expect(ready).toContainText('5 de 20');
  await expect(ready).toContainText('2 de 3');

  // 01: tinto observado en los 6 puestos; café declarado por los 5 encuestados (1,5 kg/semana cada uno)
  await expect(doc).toContainText('5 tinteros encuestados en Chapinero, Zona T');
  await expect(doc).toContainText('observado en 6 puestos · $1.000 a $2.000');
  await expect(doc).toContainText('33 kg'); // 5 × 1,5 kg × 52/12
  await expect(doc).toContainText('$1,3 millones');
  // 02: la línea de precios dice la mediana y el rango
  await expect(doc.getByRole('img', { name: /Precio del tinto en 6 puestos: mediana \$1\.500, de \$1\.000 a \$2\.000/ })).toBeVisible();
  // 03 y 04: café por taza, margen y el precio techo por kilo
  await expect(doc).toContainText('Águila Roja');
  await expect(doc).toContainText('3 de 5');
  await expect(doc).toContainText('$145.833 / kg');
  // 07: 4 mujeres y 1 hombre: ningún grupo llega a 5, no se muestra; la edad sí (5 de 5)
  const quienes = doc.getByRole('region', { name: 'Quiénes son' });
  await expect(quienes).toContainText('5 respuestas quedan en grupos de menos de 5');
  await expect(quienes).not.toContainText('Mujer');
  await expect(quienes).toContainText('45 a 54');
  // 08: el piloto de Acero y la lista de espera
  await expect(doc).toContainText('▲ 50 % frente a la anterior');
  await expect(doc).toContainText('3 quieren pedir · 1 quieren ser baristas');
  // Nada privado en el documento: ni notas ni nombres
  await expect(doc).not.toContainText('NOTA PRIVADA');
  for (const name of NAMES) await expect(doc).not.toContainText(name);

  // Supuestos: la plata se escribe como en Colombia, el informe se actualiza y se guarda en la base
  const sc = page.getByRole('region', { name: 'Supuestos del informe' });
  await sc.getByLabel('Para quién es la propuesta').fill('Distribuidora de prueba');
  await sc.getByLabel('Costo del kit por tintero').fill('300.000');
  await sc.getByLabel('Precio de distribuidor por kilo').fill('100.000');
  await expect(doc).toContainText('Propuesta de piloto para Distribuidora de prueba.');
  await expect(doc).toContainText('$4 millones'); // 10 kits de $300.000 + 10 kg a $100.000
  await expect(doc).toContainText('por debajo del techo de $145.833');
  await expect(sc.getByRole('status')).toHaveText('Guardado.');
  await expect.poll(() => api.all('/api/v1/bi/piloto/escenario', 'PUT').at(-1)?.data).toMatchObject({ partner: 'Distribuidora de prueba', kitCost: 300000, distributorPriceKg: 100000, gramsPerCup: 18 });
  await expect(ready.locator('li', { hasText: 'Costo del kit por tintero' })).toHaveClass(/is-done/);
  await expect(ready.locator('li', { hasText: 'Para quién es la propuesta' })).toHaveClass(/is-done/);
  await expect(ready.locator('li', { hasText: 'Tu precio objetivo por kilo' })).toHaveClass(/is-done/); // $100.000, bajo el techo
  expect(errors).toEqual([]);
  await page.context().close();
});

test('presentar: once diapositivas con flechas, sin nombres de tinteros, y Esc sale', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, desk);
  api.opts.piloto = { ...INFORME, scenario: { partner: 'Distribuidora de prueba', kitCost: 300000, distributorPriceKg: 100000 } };
  await openInforme(page);
  await page.getByRole('button', { name: 'Presentar' }).click();
  const deck = page.getByRole('dialog', { name: 'Presentación del piloto' });
  await expect(deck).toBeVisible();
  await expect(deck.locator('.deck-count')).toHaveText('1 / 11');
  await expect(deck).toContainText('Para Distribuidora de prueba');
  await page.keyboard.press('ArrowRight');
  await expect(deck.locator('.deck-count')).toHaveText('2 / 11');
  await expect(deck.getByRole('heading', { level: 2 })).toHaveText('5 tinteros en Chapinero, Zona T');
  await page.keyboard.press('ArrowRight');
  // El mapa real: los pines del distribuidor no llevan nombres
  const geo = deck.locator('.piloto-geo');
  await expect(geo).toHaveAttribute('data-state', 'ready');
  await expect(geo.locator('.piloto-pin')).toHaveCount(6);
  for (const name of NAMES) await expect(deck).not.toContainText(name);
  await deck.getByRole('button', { name: 'Siguiente' }).click();
  await deck.getByRole('button', { name: 'Siguiente' }).click();
  await expect(deck.getByRole('heading', { level: 2 })).toHaveText('Si no gana más, no hay negocio');
  await expect(deck).toContainText('$145.833 / kg');
  await page.keyboard.press('End');
  await expect(deck.locator('.deck-count')).toHaveText('11 / 11');
  await expect(deck).toContainText('Hablemos del piloto.');
  await page.keyboard.press('ArrowLeft');
  await expect(deck.getByRole('heading', { level: 2 })).toHaveText('Lo que proponemos');
  await expect(deck).toContainText('$4 millones');
  await page.keyboard.press('Escape');
  await expect(deck).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Informe del piloto' })).toBeVisible();
  expect(errors).toEqual([]);
  await page.context().close();
});

test('imprimir: el PDF trae solo el documento, en varias páginas A4', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, desk);
  api.opts.piloto = INFORME;
  await openInforme(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.ax-side')).toBeHidden();
  await expect(page.locator('.rep-tools')).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Estudio' })).toBeHidden();
  await expect(page.getByRole('article', { name: 'Informe del piloto' })).toBeVisible();
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBeGreaterThan(1);
  expect(pages).toBeLessThan(9);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('desde Piloto se encuesta a un tintero que no tenía encuesta', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, desk);
  api.opts.piloto = INFORME;
  await page.goto('/admin', { waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Piloto")');
  const card = page.locator('.piloto-tintero', { hasText: 'Don Ernesto' });
  await expect(card).toContainText('Sin encuesta');
  await card.getByRole('button', { name: 'Encuestar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Encuesta de Don Ernesto' });
  await expect(dialog.getByRole('button', { name: 'Guardar encuesta' })).toBeDisabled();
  await dialog.getByLabel('Aceptó responder').check();
  await dialog.getByRole('group', { name: 'Tazas al día: valores rápidos' }).getByRole('button', { name: '50' }).click();
  await dialog.getByRole('group', { name: 'Edad' }).getByRole('button', { name: '55 a 64' }).click();
  await dialog.getByRole('button', { name: 'Guardar encuesta' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Encuesta de Don Ernesto guardada' })).toBeVisible();
  await expect(card).toContainText('Encuestado el');
  expect(api.surveys.at(-1)).toMatchObject({ tintero_id: 't6', consent: true, cups_per_day: 50, age_range: '55_64' });
  expect(errors).toEqual([]);
  await page.context().close();
});

test('sin la migración: Piloto lo avisa, no ofrece encuestar y los supuestos quedan en el navegador', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, desk);
  api.opts.piloto = { ...INFORME, surveys: [], surveysReady: false, scenarioReady: false };
  api.opts.surveysDown = true;
  await page.goto('/admin', { waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Piloto")');
  await expect(page.getByRole('note')).toContainText('20261022140000_tintero_surveys');
  await expect(page.getByRole('button', { name: 'Encuestar' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Informe y presentación' }).click();
  const sc = page.getByRole('region', { name: 'Supuestos del informe' });
  await sc.getByLabel('Costo del kit por tintero').fill('250.000');
  await expect(sc.getByRole('status')).toHaveText(/Guardado solo en este navegador/);
  // Se recuerda al volver aunque la base no lo guarde
  await page.reload({ waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Piloto")');
  await page.getByRole('tab', { name: 'Informe y presentación' }).click();
  await expect(page.getByRole('region', { name: 'Supuestos del informe' }).getByLabel('Costo del kit por tintero')).toHaveValue('250.000');
  expect(errors).toEqual([]);
  await page.context().close();
});
