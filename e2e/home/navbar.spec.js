// Menú: cada enlace lleva a su sección (en la portada y desde /escuela); el logo, el idioma,
// la cuenta y el carrito hacen lo suyo; en el celular, el menú de tres rayas hace lo mismo.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };
const LINKS_ES = ['Micra', 'Publicaciones', 'Tienda', 'Recetas', 'Aprende', 'Campeones'];

/** La sección del ancla existe y quedó a la vista cuando el scroll (suave) ya se detuvo. */
async function inView(page, id) {
  await expect.poll(() => page.evaluate(async (id) => {
    const el = document.getElementById(id);
    if (!el) return 'no existe';
    const y0 = window.scrollY;
    await new Promise((r) => setTimeout(r, 150));
    if (window.scrollY !== y0) return 'todavía bajando';
    const b = el.getBoundingClientRect();
    return b.top < window.innerHeight && b.bottom > 0 ? 'a la vista' : `fuera (${Math.round(b.top)})`;
  }, id), { timeout: 10000 }).toBe('a la vista');
}

const menu = (page) => page.locator('.navbar .nav-links.left');

/** El menú vive en la cabecera (no flota): como una persona, primero se sube y después se toca. */
async function toTop(page) {
  await expect.poll(() => page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return window.scrollY;
  })).toBe(0);
}

test('escritorio: cada enlace del menú lleva a su sección, en la portada y desde la Escuela', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  await expect(menu(page).getByRole('link')).toHaveText(LINKS_ES);

  // En la portada son saltos dentro de la página
  for (const [name, id] of [['Tienda', 'beans'], ['Campeones', 'metodo'], ['Publicaciones', 'publicaciones'], ['Recetas', 'recetas']]) {
    await toTop(page);
    await menu(page).getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/#${id}$`));
    await inView(page, id);
  }

  // Aprende abre la Escuela, y ahí queda marcado como la página en la que estás
  await toTop(page);
  await menu(page).getByRole('link', { name: 'Aprende' }).click();
  await expect(page).toHaveURL(/\/escuela$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Aprende a');
  await expect(menu(page).getByRole('link', { name: 'Aprende' })).toHaveAttribute('aria-current', 'page');

  // Desde la Escuela, los enlaces vuelven a la portada, a su sección
  for (const [name, id] of [['Campeones', 'metodo'], ['Tienda', 'beans']]) {
    await page.goto('/escuela', { waitUntil: 'load' });
    await menu(page).getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`^[^#]*/#${id}$`));
    await inView(page, id);
  }
  // «Micra» no es una sección: abre la app, desde la portada y desde la Escuela
  for (const from of ['/', '/escuela']) {
    await page.goto(from, { waitUntil: 'load' });
    await expect(menu(page).getByRole('link', { name: 'Micra', exact: true })).toHaveAttribute('href', '/micra');
  }
  await page.goto('/escuela', { waitUntil: 'load' });
  await page.getByRole('link', { name: 'ACERO.press' }).click();
  await expect(page).toHaveURL(/\/#home$/);
  await expect(menu(page).getByRole('link', { name: 'Aprende' })).not.toHaveAttribute('aria-current', 'page');
  // Cambiar de página corta el contador de ventas que iba en camino («Failed to fetch»): eso no es un error de la página
  expect(errors.filter((e) => !/de ventas: TypeError: Failed to fetch/.test(e))).toEqual([]);
  await page.context().close();
});

test('escritorio: idioma, cuenta y carrito desde el menú', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  const lang = page.locator('.navbar .lang-btn');
  await lang.click(); // ES → EN
  await expect(menu(page).getByRole('link')).toHaveText(['Micra', 'Posts', 'Shop', 'Recipes', 'Learn', 'Champions']);
  await lang.click(); // EN → JA
  await expect(menu(page).getByRole('link').nth(4)).toHaveText('学ぶ');
  await lang.click(); // JA → ES
  await expect(menu(page).getByRole('link')).toHaveText(LINKS_ES);

  await page.locator('.navbar').getByRole('link', { name: 'Cuenta de usuario' }).click();
  await expect(page.locator('.account-drawer')).toHaveClass(/\bopen\b/);
  await page.locator('.account-drawer .cart-close-btn').click();
  await expect(page.locator('.account-drawer')).not.toHaveClass(/\bopen\b/);
  await page.locator('.navbar').getByRole('link', { name: 'Carrito de compras' }).click();
  await expect(page.locator('.cart-drawer:not(.account-drawer)')).toHaveClass(/\bopen\b/);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('celular: el menú de tres rayas tiene los mismos enlaces, funcionan y se maneja con teclado', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: PHONE });
  await page.goto('/', { waitUntil: 'load' });
  await expect(menu(page)).toBeHidden();
  const drawer = page.locator('.nav-drawer');
  const links = drawer.locator('.nav-drawer-links').getByRole('link');
  const burger = page.getByRole('button', { name: 'Abrir menú' });
  // Cerrado está fuera de la pantalla: no debe recibir el foco
  expect(await drawer.evaluate((el) => el.inert)).toBe(true);

  await burger.click();
  await expect(drawer).toHaveClass(/\bopen\b/);
  await expect(links).toHaveText(LINKS_ES);
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toHaveClass(/\bopen\b/);
  await expect(burger).toBeFocused();

  await burger.click();
  await links.filter({ hasText: 'Campeones' }).click();
  await expect(drawer).not.toHaveClass(/\bopen\b/);
  await expect(page).toHaveURL(/#metodo$/);
  await inView(page, 'metodo');

  await toTop(page);
  await burger.click();
  await links.filter({ hasText: 'Aprende' }).click();
  await expect(page).toHaveURL(/\/escuela$/);
  await burger.click();
  await expect(links.filter({ hasText: 'Aprende' })).toHaveAttribute('aria-current', 'page');
  await links.filter({ hasText: 'Tienda' }).click();
  await expect(page).toHaveURL(/\/#beans$/);
  await inView(page, 'beans');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('tableta chica: el menú pasa a tres rayas antes de dejar de caber', async ({ browser }) => {
  for (const [w, burger] of [[780, true], [900, true], [1024, true], [1100, true], [1180, false]]) {
    const { page } = await openPage(browser, { context: { viewport: { width: w, height: 800 } } });
    await page.goto('/', { waitUntil: 'load' });
    if (burger) {
      await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
      await expect(menu(page)).toBeHidden();
    } else {
      await expect(menu(page).getByRole('link')).toHaveText(LINKS_ES);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(w);
    await page.context().close();
  }
});
