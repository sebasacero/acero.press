// Escuela: la receta oficial de la portada lleva a /escuela; ahí la receta de AeroPress Original
// contada con el scroll, las seis lecciones en tarjetas (una abierta a la vez, en su lugar),
// el modo preparar, la cuenta de la taza y lo visto recordado en el navegador.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };

test('portada: la franja separa Aprende y la hoja de AeroPress Go en diez pasos lleva a la Escuela', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  const brew = page.locator('#escuela');
  // La franja en movimiento va justo antes de Aprende; la copia del texto es decorado
  const marquee = page.locator('.marquee + #escuela');
  await expect(marquee).toHaveCount(1);
  await expect(page.locator('.marquee').first()).toHaveAttribute('aria-label', /APRENDE · CAFÉ CALIENTE/);
  await brew.scrollIntoViewIfNeeded();
  await expect(brew.getByRole('heading', { level: 2 })).toContainText('AeroPress Go');
  // Diez pasos, cada uno con su dibujo; caliente y cold brew como en la hoja oficial
  const steps = brew.locator('.brew-sheet > li');
  await expect(steps).toHaveCount(10);
  await expect(steps.locator('svg.brew-draw')).toHaveCount(10);
  await expect(steps.nth(5)).toContainText('80 °C');
  await expect(steps.nth(6).locator('.is-hot')).toHaveText('Caliente: 10 segundos.');
  await expect(steps.nth(6).locator('b.is-cold')).toHaveText('Cold brew: 1 minuto.');
  await expect(brew).toContainText('aeropress.com');
  await expect(page.locator('#prensado, .school-teaser')).toHaveCount(0);
  await expect(page.locator('.navbar a[href="/escuela"]').first()).toHaveText('Aprende');

  await brew.getByRole('link', { name: /Prepárala con cronómetro/ }).click();
  await expect(page).toHaveURL(/\/escuela#leccion-2$/);
  await expect(page.locator('#sa-btn-first')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#sa-panel-first')).toContainText('85 °C');
  await expect(page).toHaveTitle(/Escuela Acero/);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular acostado: sin altura para fijar la hoja, los pasos de Aprende quedan en fila y a la vista', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 844, height: 390 }, hasTouch: true } });
  await page.goto('/', { waitUntil: 'load' });
  const brew = page.locator('#escuela');
  await brew.scrollIntoViewIfNeeded();
  await expect(brew.locator('.brew-dots')).toBeHidden();
  const steps = brew.locator('.brew-sheet > li');
  await expect(steps.nth(4)).toHaveCSS('opacity', '1');
  expect(await brew.locator('.brew-sheet').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('escritorio: la receta paso a paso, lecciones en tarjetas, modo preparar, enlace directo y cuenta de la taza', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.clock.install();
  await page.goto('/escuela', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Aprende a');
  await expect(page.getByRole('list', { name: 'La receta de un vistazo' })).toContainText('85 °C');
  // La receta oficial de AeroPress Original, en nueve pasos con su dibujo
  const recipe = page.locator('#receta');
  await expect(recipe.getByRole('heading', { level: 2 })).toContainText('nueve pasos');
  await expect(recipe.locator('.brew-sheet > li')).toHaveCount(9);
  await expect(recipe.locator('.brew-sheet > li').nth(3)).toContainText('85 °C hasta el n.º 4');
  await expect(recipe).toContainText('AeroPress Original (aeropress.com)');

  // Las seis lecciones a la vista y cerradas; sin pestañas
  const heads = page.locator('.sa-h button');
  await expect(heads).toHaveCount(6);
  for (let i = 0; i < 6; i += 1) await expect(heads.nth(i)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await heads.first().click();
  await expect(heads.first()).toHaveAttribute('aria-expanded', 'true');
  const first = page.getByRole('region', { name: /Conoce tu AeroPress/ });
  await expect(first.getByRole('img', { name: /Despiece de la AeroPress/ })).toBeVisible();
  await expect(first.locator('.sl-points.is-numbered li')).toHaveCount(4);
  // La práctica queda plegada hasta que se pide
  await expect(first.locator('.sl-practice')).toBeHidden();
  await first.getByText('Practica').click();
  await expect(first.locator('.sl-practice')).toBeVisible();

  // «Siguiente lección» marca la vista, abre la siguiente con el foco y el avance lo dice
  await first.getByRole('button', { name: /Siguiente lección/ }).click();
  await expect(heads.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(heads.nth(1)).toBeFocused();
  await expect(heads.first()).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/#leccion-2$/);
  const progress = page.locator('.sp-progress');
  await expect(progress).toContainText('1 de 6 vistas');
  await expect(progress.getByRole('button')).toHaveText('Seguir con la lección 2');

  // Modo preparar desde arriba: el paso en grande, pausa, Esc cierra, el foco vuelve y el reloj sigue donde iba
  const head = page.locator('.sp-head');
  await head.getByRole('button', { name: 'Preparar ahora' }).click();
  const cook = page.getByRole('dialog', { name: 'Prepara conmigo' });
  await expect(cook).toBeVisible();
  await cook.getByRole('button', { name: 'Empezar', exact: true }).click();
  await page.clock.runFor(12_000);
  await expect(cook.locator('.cook-now b')).toHaveText('Remueve 3 segundos');
  await expect(cook.locator('.cook-clock')).toHaveText('0:12');
  await expect(cook.locator('.cook-next')).toContainText('Pon el émbolo y espera');
  await cook.getByRole('button', { name: 'Pausar' }).click();
  await page.clock.runFor(5_000);
  await expect(cook.locator('.cook-clock')).toHaveText('0:12');
  for (let k = 0; k < 5; k += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(cook).toHaveCount(0);
  const back = head.getByRole('button', { name: /Volver al cronómetro · 0:12/ });
  await expect(back).toBeFocused();
  await back.click();
  await cook.getByRole('button', { name: 'Seguir' }).click();
  await page.clock.runFor(120_000);
  await expect(cook.locator('.cook-clock')).toHaveText('1:45');
  await expect(cook.locator('.cook-now b')).toHaveText('Listo');
  await expect(cook.getByRole('button', { name: 'Otra taza' })).toBeVisible();
  await cook.getByRole('button', { name: 'Cerrar' }).click();
  await expect(cook).toHaveCount(0);

  // Un enlace a otra lección estando en la página la abre: la cuenta de la taza
  await page.goto('/escuela#leccion-6');
  await expect(heads.nth(5)).toHaveAttribute('aria-expanded', 'true');
  const cost = page.locator('.sf-cost');
  await expect(cost).toContainText('Escribe el precio de la libra');
  await cost.getByLabel('Precio de la libra (500 g)').fill('20.000');
  await cost.getByLabel('Vaso, tapa y filtro por taza').fill('200');
  await cost.getByLabel('Precio de venta').fill('3.000');
  const results = cost.locator('.sf-results');
  await expect(results).toContainText('$880');
  await expect(results).toContainText('$2.120');
  await expect(results).toContainText('71 %');
  await expect(cost).toContainText('Tazas por libra: 29');

  // Lo visto sigue al volver
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.sp-progress')).toContainText('1 de 6 vistas');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: el temario completo a la vista, una lección abierta a la vez y nada se sale', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: PHONE });
  await page.goto('/escuela', { waitUntil: 'load' });
  const heads = page.locator('.sa-h button');
  await expect(heads).toHaveCount(6);
  for (let i = 0; i < 6; i += 1) await expect(heads.nth(i)).toHaveAttribute('aria-expanded', 'false');

  // El botón del avance abre la lección y le pasa el foco; «Siguiente» deja el foco en el título de la nueva
  await page.locator('.sp-progress').getByRole('button', { name: 'Empezar la lección 1' }).click();
  await expect(heads.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(heads.nth(0)).toBeFocused();
  await page.getByRole('region', { name: /Conoce tu AeroPress/ }).getByRole('button', { name: /Siguiente lección/ }).click();
  await expect(heads.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(heads.nth(1)).toBeFocused();
  await expect(heads.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await heads.nth(1).click();
  await expect(heads.nth(1)).toHaveAttribute('aria-expanded', 'false');

  await heads.nth(1).click();
  await expect(page.locator('#sa-panel-first')).toContainText('Lo que necesitas');
  await heads.nth(5).click();
  await expect(heads.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(heads.nth(5)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.sf-cost')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  // Modo preparar en el celular: botón grande y dentro de la pantalla
  await page.locator('.sp-head').getByRole('button', { name: 'Preparar ahora' }).click();
  const start = page.getByRole('dialog').getByRole('button', { name: 'Empezar', exact: true });
  const box = await start.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(56);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('el carrito sigue al pasar de la portada a la Escuela y volver', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Añadir al carrito' }).first().click();
  const badge = () => page.locator('.navbar .cart-count-badge').first();
  await expect(badge()).toHaveText('1');
  await page.locator('.navbar a[href="/escuela"]').first().click();
  await expect(page).toHaveURL(/\/escuela$/);
  await expect(badge()).toHaveText('1');
  await page.locator('.navbar a[href="/#beans"]').first().click();
  await expect(page).toHaveURL(/\/#beans$/);
  await expect(badge()).toHaveText('1');
  expect(errors).toEqual([]);
  await page.context().close();
});
