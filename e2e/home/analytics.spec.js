// Medición del sitio (GA4): aviso de cookies con Consent Mode, eventos de la tienda y de
// WhatsApp, y nada en el panel. Google está bloqueado en las pruebas: se mira dataLayer.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };
const layer = (page) => page.evaluate(() => (window.dataLayer ?? []).map((a) => Array.from(a)));
const events = async (page, name) => (await layer(page)).filter(([k, n]) => k === 'event' && n === name).map(([, , p]) => p);

test('primera visita: sin cookies hasta aceptar; la respuesta se recuerda', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  // Esta prueba sí es una primera visita: sin la respuesta que dejan las demás
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e.fresh')) { localStorage.removeItem('acero.consent'); sessionStorage.setItem('e2e.fresh', '1'); }
  });
  await page.goto('/?utm_source=instagram&utm_medium=bio', { waitUntil: 'load' });
  const first = await layer(page);
  expect(first.find(([k, v]) => k === 'consent' && v === 'default')[2]).toMatchObject({ analytics_storage: 'denied', ad_storage: 'denied' });
  expect(first.some(([k, id]) => k === 'config' && id === 'G-6F6S72KWWQ')).toBe(true);

  const banner = page.getByRole('region', { name: 'Aviso de cookies' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Aceptar' }).click();
  await expect(banner).toHaveCount(0);
  expect((await layer(page)).find(([k, v]) => k === 'consent' && v === 'update')[2]).toMatchObject({ analytics_storage: 'granted', ad_user_data: 'granted' });

  await page.reload({ waitUntil: 'load' });
  await expect(page.getByRole('region', { name: 'Aviso de cookies' })).toHaveCount(0);
  expect((await layer(page)).find(([k, v]) => k === 'consent' && v === 'default')[2].analytics_storage).toBe('granted');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('la tienda cuenta carrito, pago y WhatsApp con su valor en pesos', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Añadir al carrito' }).first().click();
  await expect.poll(async () => (await events(page, 'add_to_cart')).length).toBe(1);
  const [add] = await events(page, 'add_to_cart');
  expect(add.currency).toBe('COP');
  expect(add.value).toBeGreaterThan(0);
  expect(add.items[0]).toMatchObject({ quantity: 1 });
  expect(add.items[0].item_name).toBeTruthy();

  // Cualquier enlace a WhatsApp cuenta como contacto, con la sección donde está (sin abrir otra pestaña)
  await page.evaluate(() => {
    document.addEventListener('click', (e) => { if (e.target.closest('a[href*="wa.me/"]')) e.preventDefault(); });
    const a = Object.assign(document.createElement('a'), { href: 'https://wa.me/573000000000', textContent: 'Pedir por WhatsApp' });
    document.getElementById('beans').append(a);
  });
  await page.getByRole('link', { name: 'Pedir por WhatsApp' }).dispatchEvent('click');
  await expect.poll(async () => (await events(page, 'contact_whatsapp')).length).toBe(1);
  expect((await events(page, 'contact_whatsapp'))[0]).toMatchObject({ section: 'beans', page: '/' });
  expect(errors).toEqual([]);
  await page.context().close();
});

test('el panel no carga Google Analytics y quien entra como admin deja de contar', async ({ browser }) => {
  const { page } = await openPage(browser, { context: DESK });
  await page.goto('/admin', { waitUntil: 'load' });
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('acero.team'))).toBe('1');
  await page.goto('/', { waitUntil: 'load' });
  expect(await page.evaluate(() => window['ga-disable-G-6F6S72KWWQ'])).toBe(true);
  await page.context().close();
});
