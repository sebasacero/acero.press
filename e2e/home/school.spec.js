// Escuela: la tarjeta de diez pasos de la portada lleva a /escuela; ahí la receta de AeroPress Original
// contada con el scroll, las seis lecciones en tarjetas (una abierta a la vez, en su lugar),
// el modo preparar, la cuenta de la taza y lo visto recordado en el navegador.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };

test('portada: la hoja de AeroPress Go en una tarjeta de diez pasos y las seis lecciones llevan a la Escuela', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  const brew = page.locator('#escuela');
  // Sin franja en movimiento (el usuario la quitó)
  await expect(page.locator('.marquee')).toHaveCount(0);
  await brew.scrollIntoViewIfNeeded();
  await expect(brew.getByRole('heading', { level: 2 })).toHaveText('Diez pasos y sale un café.');
  await expect(brew).toContainText('AeroPress Go');
  // Una tarjeta con sus diez puntos; cada paso con su dibujo
  const sheet = brew.locator('.pg-sheet');
  const dots = sheet.locator('.pg-dots button');
  await expect(dots).toHaveCount(10);
  await expect(dots.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByRole('heading', { level: 3 })).toHaveText('Saca el émbolo de la cámara.');
  await expect(sheet.locator('svg.brew-draw')).toHaveCount(1);
  // El color térmico va solo en lo caliente: el paso 1 (prensa vacía) sin color, el 6 (agua a 80 °C) con él
  expect(await sheet.locator('.pg-sheet-pic [fill^="url(#"]').count()).toBe(0);
  await dots.nth(5).click();
  await expect(sheet).toContainText('80 °C');
  expect(await sheet.locator('.pg-sheet-pic [fill^="url(#"]').count()).toBeGreaterThan(0);
  await sheet.getByRole('button', { name: 'Siguiente' }).click();
  await expect(dots.nth(6)).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.locator('.is-hot')).toHaveText('Caliente: 10 segundos.');
  await expect(sheet.locator('.is-cold')).toHaveText('Cold brew: 1 minuto.');
  await sheet.getByRole('button', { name: 'Anterior' }).click();
  await expect(dots.nth(5)).toHaveAttribute('aria-pressed', 'true');
  await expect(brew).toContainText('aeropress.com');
  await expect(page.locator('#prensado, .school-teaser')).toHaveCount(0);
  await expect(page.locator('.navbar a[href="/escuela"]').first()).toHaveText('Aprende');
  // Las seis lecciones de la Escuela, cada una con su enlace
  const lessons = brew.locator('.pg-lessons a');
  await expect(lessons).toHaveCount(6);
  await expect(lessons.nth(0)).toContainText('Conoce tu AeroPress');
  await expect(lessons.nth(2)).toHaveAttribute('href', '/escuela#leccion-3');
  await expect(brew.getByRole('link', { name: 'Ir a la Escuela' })).toHaveAttribute('href', '/escuela');

  await brew.getByRole('link', { name: /Prepárala con cronómetro/ }).click();
  await expect(page).toHaveURL(/\/escuela#leccion-2$/);
  await expect(page.locator('#sa-btn-first')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#sa-panel-first')).toContainText('85 °C');
  await expect(page).toHaveTitle(/Escuela Acero/);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: la tarjeta de pasos cabe, no fija la página y los puntos miden 44 px', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: PHONE });
  await page.goto('/', { waitUntil: 'load' });
  const brew = page.locator('#escuela');
  await brew.scrollIntoViewIfNeeded();
  const sheet = await brew.locator('.pg-sheet').boundingBox();
  expect(sheet.x).toBeGreaterThanOrEqual(0);
  expect(sheet.x + sheet.width).toBeLessThanOrEqual(390);
  const dot = await brew.locator('.pg-dots button').nth(9).boundingBox();
  expect(Math.min(dot.width, dot.height)).toBeGreaterThanOrEqual(44);
  expect(dot.x + dot.width).toBeLessThanOrEqual(390);
  await brew.locator('.pg-dots button').nth(9).click();
  await expect(brew.locator('.pg-sheet')).toContainText('Sírvelo a tu gusto');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
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

  // Las seis lecciones a la vista y cerradas; las lecciones no son pestañas, las escuelas sí
  const heads = page.locator('.sa-h button');
  await expect(heads).toHaveCount(6);
  for (let i = 0; i < 6; i += 1) await expect(heads.nth(i)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.sa').getByRole('tab')).toHaveCount(0);
  const schools = page.getByRole('tablist', { name: 'Escuelas' });
  await expect(schools.getByRole('tab')).toHaveText([/Termo/, /AeroPress/, /V60/, /Espresso/]);
  await expect(schools.getByRole('tab', { name: /AeroPress/ })).toHaveAttribute('aria-selected', 'true');
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

test('el video de la AeroPress en el celular avanza con el scroll; con menos movimiento queda la foto', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/escuela', { waitUntil: 'load' });
  const banner = page.locator('#video');
  await expect(banner.getByRole('heading', { level: 2 })).toContainText('en movimiento');
  await expect(banner.getByRole('img', { name: /Celular con un video/ })).toBeVisible();
  const video = banner.locator('video');
  const steps = banner.locator('.sv-steps li');
  await expect(steps).toHaveCount(5);
  // El celular con el centro de la pantalla un poco abajo: primeros pasos; más arriba: los últimos
  const scrollStageTo = (frac) => page.evaluate((f) => {
    const el = document.querySelector('#video .sv-stage');
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - innerHeight * f, behavior: 'instant' });
  }, frac);
  await scrollStageTo(0.75);
  await expect(video).toHaveAttribute('src', /aeropress-metodo\.(mp4|webm)$/);
  await expect.poll(() => video.evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(1);
  await expect(steps.first()).toHaveAttribute('aria-current', 'step');
  await scrollStageTo(0.2);
  await expect(steps.nth(4)).toHaveAttribute('aria-current', 'step');
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(14);
  await scrollStageTo(0.5);
  await expect(steps.nth(2)).toHaveAttribute('aria-current', 'step');
  expect(errors).toEqual([]);
  await page.context().close();

  const still = await openPage(browser, { context: { ...DESK, reducedMotion: 'reduce' } });
  await still.page.goto('/escuela', { waitUntil: 'load' });
  await expect(still.page.locator('#video video')).toHaveCount(0);
  await expect(still.page.locator('#video img.sv-video')).toHaveAttribute('src', /poster\.webp$/);
  expect(still.errors).toEqual([]);
  await still.page.context().close();
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

test('las cuatro escuelas: termo, V60 y espresso con su video; el termo pide además el video en Micra', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/escuela', { waitUntil: 'load' });
  const schools = page.getByRole('tablist', { name: 'Escuelas' });
  await schools.getByRole('tab', { name: /Termo/ }).click();
  await expect(page.getByRole('heading', { name: 'Escuela de termo' })).toBeVisible();
  const list = page.getByTestId('web-school-lessons-termo');
  await expect(list.locator('.sa-h button')).toHaveCount(4);
  const video = list.getByTestId('lesson-video');
  await expect(video).toContainText('Prepara el termo');
  await video.getByTestId('lesson-video-play').click();
  await video.getByRole('button', { name: 'Paso siguiente' }).click();
  await expect(video).toContainText('Paso 1 de 3');
  await expect(video).toContainText('Llénalo con agua caliente');
  for (let i = 0; i < 3; i += 1) await list.getByRole('button', { name: 'Siguiente →' }).click();
  await list.getByRole('button', { name: 'Terminar la escuela' }).click();
  // En la web se ven las lecciones; la insignia se verifica en Micra con el video
  await expect(schools.getByRole('tab', { name: /Termo/ })).toContainText('Falta tu video');
  await expect(page.getByTestId('web-school-video-note')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('micra_escuelas_v1')).termo.length)).toBe(4);
  expect(errors).toEqual([]);
});
