// «Mi perfil» y «Cerrar sesión» en la app Micra (src/features/micra-app/Perfil.jsx):
// el barista ve sus datos y sale (sin perder ventas sin subir), el cliente
// edita lo que guarda el celular y lo borra, y el equipo sale desde Equipo.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
const JAIRO = SEED.baristas[1].id;

/** who: 'visitor' | 'barista' (entró por SMS, enlazado) | 'team' (dueño sin ficha propia) */
async function open(browser, { who = 'visitor' } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  if (who === 'barista') {
    api.micra.admin = false;
    Object.assign(api.micra.baristas[0], { phone: '573001234567', pay_nequi: '3109876543' });
    api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: '2026-10-20T15:00:00Z' };
  }
  if (who === 'team') api.micra.baristas.forEach((b) => { delete b.mine; });
  if (who !== 'visitor') {
    await signIn(page);
    // La sesión como la deja el SMS (barista) o Google (equipo)
    const user = who === 'barista'
      ? { id: 'u-sms', phone: '573001234567', app_metadata: { provider: 'phone' } }
      : { id: 'u1', email: 'equipo@aceropress.com', app_metadata: { provider: 'google' } };
    await page.addInitScript((user) => {
      if (sessionStorage.getItem('e2e-session-set')) return; // solo la primera carga: cerrar sesión debe durar
      sessionStorage.setItem('e2e-session-set', '1');
      const t = JSON.parse(localStorage.getItem('sb-mock-auth-token'));
      localStorage.setItem('sb-mock-auth-token', JSON.stringify({ ...t, user }));
    }, user);
  } else {
    api.micra.admin = false;
    await page.addInitScript(() => { localStorage.setItem('acero.consent', 'granted'); });
  }
  return { page, api, errors };
}

test('barista: abre su perfil desde arriba, ve su celular a medias y sus precios, y cierra sesión', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: /Marlene\.$/ })).toBeVisible();
  // Sin quinta pestaña: el perfil está en las iniciales de arriba
  await expect(page.getByRole('navigation', { name: 'Barista' }).getByRole('button')).toHaveCount(4);
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page).toHaveURL(/\/micra\/barista\/perfil$/);

  const prof = page.getByTestId('barista-profile');
  await expect(prof.getByRole('heading', { name: 'Marlene Rojas' })).toBeVisible();
  await expect(page.getByTestId('profile-phone')).toHaveText('300 ••• 4567');
  await expect(prof).not.toContainText('300 123 4567');
  await expect(page.getByTestId('profile-method')).toHaveText('Con tu celular (SMS)');
  await expect(page.getByTestId('profile-prices')).toContainText('$1.500');
  await expect(page.getByTestId('profile-prices')).toContainText('$2.000');
  // Cómo le pagan: solo los medios, nunca un número
  await expect(page.getByTestId('profile-pay')).toHaveText('Efectivo, Nequi');
  await expect(prof).not.toContainText('310 987 6543');
  await expect(page.getByTestId('profile-public')).toContainText('Sí');
  await expect(page.getByTestId('profile-location')).toContainText('Permitida desde');
  await expect(page.getByTestId('profile-link')).toContainText(`/micra/b/${MARLENE}`);
  await expect(page.getByTestId('privacy-link')).toHaveAttribute('href', /\/privacidad$/);

  // Cambiar precios con el formulario de siempre
  await prof.getByRole('button', { name: 'Cambiar precios de tinto, perico y aromática' }).click();
  await page.getByLabel('Precio del tinto').fill('1800');
  await page.getByRole('button', { name: 'Guardar precios' }).click();
  await expect(page.getByTestId('profile-prices')).toContainText('$1.800');
  expect(api.find('/rpc/micra_barista_prices').data.p_tinto).toBe(1800);

  // Cerrar sesión: está en la calle, así que primero «Ya volví»
  await page.getByTestId('signout').click();
  await expect(page.getByTestId('signout-live')).toBeVisible();
  await page.getByRole('button', { name: 'Ya volví y cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/micra\/barista$/);
  await expect(page.getByRole('heading', { name: /Vende más/ })).toBeVisible();
  expect(api.all('/rpc/micra_barista_out').at(-1).data.p_minutes).toBe(0);
  expect(api.find('/auth/v1/logout', 'POST')).toBeTruthy();
  const left = await page.evaluate(() => ['sb-mock-auth-token', 'micra_mode_v1', 'micra_goal_v1'].map((k) => localStorage.getItem(k)));
  expect(left).toEqual([null, null, null]);
  await expect(page.getByRole('button', { name: 'Mi perfil' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('barista: «Mi QR» con su dibujo al centro lleva a su página y se descarga', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista/perfil', { waitUntil: 'load' });
  await page.getByTestId('profile-qr').click();
  await expect(page).toHaveURL(/\/micra\/barista\/qr$/);
  await expect(page.getByRole('heading', { name: 'Tu QR' })).toBeVisible();
  const qr = page.getByTestId('qr-svg');
  await expect(qr).toHaveAttribute('data-logo', 'termo');
  await expect(page.getByRole('radio')).toHaveCount(5);
  await page.getByTestId('qr-logo-sombrilla').click();
  await expect(qr).toHaveAttribute('data-logo', 'sombrilla');
  await expect(page.getByTestId('qr-logo-sombrilla')).toHaveAttribute('aria-checked', 'true');

  // El QR que se ve en pantalla se lee y abre la página del barista
  const px = await qr.evaluate(async (svg) => {
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '600'); clone.setAttribute('height', '600');
    clone.querySelector('image')?.remove();
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 600, height: 600 });
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 600, 600);
    return Array.from(g.getImageData(0, 0, 600, 600).data);
  });
  const { default: jsQR } = await import('jsqr');
  expect(jsQR(new Uint8ClampedArray(px), 600, 600)?.data).toMatch(new RegExp(`/micra/b/${MARLENE}$`));

  // Se guarda en PNG con su nombre, y el dibujo escogido se recuerda
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByTestId('qr-download').click()]);
  expect(file.suggestedFilename()).toBe('qr-micra-marlene-sombrilla.png');
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('qr-svg')).toHaveAttribute('data-logo', 'sombrilla');
  expect(errors).toEqual([]);
});

test('barista: con ventas sin subir no deja cerrar sesión; cuando suben, sí', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  api.micra.baristas[0].live_until = null;
  await page.goto('/micra/barista/vender', { waitUntil: 'load' });
  await page.route('https://mock.supabase.co/rest/v1/rpc/micra_barista_sale', (r) => r.abort('failed'));
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByText(/1 sin subir/)).toBeVisible();

  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await page.getByTestId('signout').click();
  await expect(page.getByTestId('signout-block')).toContainText('1 venta sin subir');
  await expect(page.getByRole('button', { name: /cerrar sesión/i })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('micra_sales_queue_v1')).length)).toBe(1);

  // Vuelve la señal: sube y ya puede salir
  await page.unroute('https://mock.supabase.co/rest/v1/rpc/micra_barista_sale');
  await page.getByRole('button', { name: 'Reintentar subir' }).click();
  await page.getByRole('button', { name: 'Sí, cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/micra\/barista$/);
  expect(api.micra.sales.filter((s) => s.product === 'tinto').length).toBe(3);
  expect(await page.evaluate(() => localStorage.getItem('sb-mock-auth-token'))).toBeNull();
  expect(errors.filter((e) => !/Failed to fetch/.test(e))).toEqual([]);
});

test('barista: retira el permiso de ubicación desde su perfil', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista/perfil', { waitUntil: 'load' });
  await page.getByTestId('consent-withdraw').click();
  await expect(page.getByTestId('profile-location')).toHaveText('No la compartes');
  expect(api.find('/rpc/tintero_consent').data.p_accept).toBe(false);
  expect(errors).toEqual([]);
});

test('cliente: su perfil cambia el nombre, quita un barista y «Borrar mis datos» limpia el celular', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.addInitScript(([a, b]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('micra_name_v1', JSON.stringify('Sebas'));
    localStorage.setItem('micra_favs_v1', JSON.stringify([a, b]));
    localStorage.setItem('micra_device_v1', JSON.stringify('cel-prueba-1234'));
    localStorage.setItem('micra_seek_off_v1', 'true');
  }, [MARLENE, JAIRO]);
  await page.goto('/micra', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page).toHaveURL(/\/micra\/perfil$/);

  const prof = page.getByTestId('client-profile');
  await expect(prof.getByRole('heading', { name: 'Sebas' })).toBeVisible();
  await page.getByLabel('Tu nombre (así te llama el barista)').fill('Sebas · 302');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('micra_name_v1')))).toBe('Sebas · 302');

  const favs = page.getByTestId('profile-favs');
  await expect(favs).toContainText('Marlene');
  await expect(favs).toContainText('Jairo');
  await favs.getByRole('button', { name: 'Quitar a Jairo' }).click();
  await expect(favs).not.toContainText('Jairo');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('micra_favs_v1')))).toEqual([MARLENE]);

  // «Mostrar mi zona» (estaba apagada)
  await expect(page.getByTestId('zone-toggle')).not.toBeChecked();
  await page.getByTestId('zone-toggle').check();
  expect(await page.evaluate(() => localStorage.getItem('micra_seek_off_v1'))).toBe('false');
  await expect(page.getByTestId('stamps')).toBeVisible();

  await page.getByTestId('client-wipe').click();
  await expect(page.getByTestId('signout-confirm')).toContainText('sigue con el barista');
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.getByTestId('wiped')).toBeVisible();
  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^micra_(name|favs|device|seek)/.test(k)));
  expect(left).toEqual([]);
  expect(errors).toEqual([]);
});

test('equipo: cierra su sesión desde Equipo › Mi perfil; «Actuar como» sigue', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'team' });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  // «Actuar como» funciona y el perfil del barista manda a cerrar la sesión en Equipo
  await page.getByRole('listitem').filter({ hasText: 'Jairo' }).getByRole('button', { name: 'Actuar como' }).click();
  await expect(page.getByText('Actuando como')).toContainText('Jairo');
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page.getByTestId('barista-profile')).toContainText('Perfil del barista');
  await expect(page.getByTestId('signout')).toHaveCount(0);
  await page.getByRole('button', { name: 'Equipo › Mi perfil' }).click();

  await expect(page).toHaveURL(/\/micra\/equipo\/perfil$/);
  await expect(page.getByTestId('owner-account')).toHaveText('equipo@aceropress.com');
  await page.getByTestId('signout').click();
  await page.getByRole('button', { name: 'Sí, cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/micra$/);
  await expect(page.getByRole('tablist', { name: 'Ver Micra como' })).toHaveCount(0);
  expect(api.find('/auth/v1/logout', 'POST')).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem('sb-mock-auth-token'))).toBeNull();
  expect(errors).toEqual([]);
});
