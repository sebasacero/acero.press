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
async function open(browser, { who = 'visitor', gustosIntro = false } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page, { gustosIntro });
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
  // Cuatro pestañas y la cámara al centro; el perfil está en las iniciales de arriba
  await expect(page.getByRole('navigation', { name: 'Barista' }).getByRole('button')).toHaveCount(5);
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page).toHaveURL(/\/micra\/barista\/perfil$/);

  // Como en las apps de domicilios: el saludo, su camino y los accesos por secciones
  const prof = page.getByTestId('barista-profile');
  await expect(prof.getByRole('heading', { name: 'Marlene Rojas', level: 1 })).toBeVisible();
  await expect(page.getByTestId('profile-camino')).toContainText('Barista de calle');
  for (const g of ['Tu negocio', 'Tu plata', 'Mi cuenta', 'Otros']) await expect(prof.getByRole('region', { name: g })).toBeVisible();
  await expect(page.getByTestId('privacy-link')).toHaveAttribute('href', /\/privacidad$/);

  // Mis datos: el celular a medias, cómo entra y su enlace, en la hoja de abajo
  await page.getByTestId('tile-datos').click();
  await expect(page.getByTestId('profile-phone')).toHaveText('300 ••• 4567');
  await expect(page.getByTestId('sheet-datos')).not.toContainText('300 123 4567');
  await expect(page.getByTestId('profile-method')).toHaveText('Con tu celular (SMS)');
  await expect(page.getByTestId('profile-link')).toContainText(`/micra/b/${MARLENE}`);
  await page.getByTestId('sheet-datos').getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByTestId('sheet-datos')).toHaveCount(0);

  // Cómo le pagan: solo los medios, nunca un número
  await page.getByTestId('tile-pagos').click();
  await expect(page.getByTestId('profile-pay')).toHaveText('Efectivo, Nequi');
  await expect(page.getByTestId('sheet-pagos')).not.toContainText('310 987 6543');
  await page.keyboard.press('Escape');

  // Permisos
  await page.getByTestId('tile-permisos').click();
  await expect(page.getByTestId('profile-public')).toContainText('Sí');
  await expect(page.getByTestId('profile-location')).toContainText('Permitida desde');
  await page.keyboard.press('Escape');

  // Lo que vende: cambiar precios con el formulario de siempre
  await page.getByTestId('tile-precios').click();
  await expect(page.getByTestId('profile-prices')).toContainText('$1.500');
  await expect(page.getByTestId('profile-prices')).toContainText('$2.000');
  await page.getByRole('button', { name: 'Cambiar precios de tinto, perico y aromática' }).click();
  await page.getByLabel('Precio del tinto').fill('1800');
  await page.getByRole('button', { name: 'Guardar precios' }).click();
  await expect(page.getByTestId('profile-prices')).toContainText('$1.800');
  expect(api.find('/rpc/micra_barista_prices').data.p_tinto).toBe(1800);
  await page.keyboard.press('Escape');

  // Cerrar sesión: está en la calle, así que primero sale del mapa
  await page.getByTestId('signout').click();
  await expect(page.getByTestId('signout-live')).toBeVisible();
  await page.getByRole('button', { name: 'Salir del mapa y cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/micra\/barista$/);
  await expect(page.getByRole('heading', { name: /Vende más/ })).toBeVisible();
  expect(api.all('/rpc/micra_barista_out').at(-1).data.p_minutes).toBe(0);
  expect(api.find('/auth/v1/logout', 'POST')).toBeTruthy();
  const left = await page.evaluate(() => ['sb-mock-auth-token', 'micra_mode_v1', 'micra_goal_v1'].map((k) => localStorage.getItem(k)));
  expect(left).toEqual([null, null, null]);
  // Arriba ya no está su círculo; abajo queda la barra del cliente, como en toda la app
  await expect(page.locator('header').getByRole('button', { name: 'Mi perfil' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Micra' })).toBeVisible();
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
  await page.getByTestId('tile-permisos').click();
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
  await expect(prof.getByRole('heading', { name: 'Sebas', level: 1 })).toBeVisible();
  await page.getByTestId('tile-nombre').click();
  await page.getByLabel('Tu nombre (así te llama el barista)').fill('Sebas · 302');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('micra_name_v1')))).toBe('Sebas · 302');
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('tile-baristas')).toContainText('2 Mis baristas');
  await page.getByTestId('tile-baristas').click();
  const favs = page.getByTestId('profile-favs');
  await expect(favs).toContainText('Marlene');
  await expect(favs).toContainText('Jairo');
  await favs.getByRole('button', { name: 'Quitar a Jairo' }).click();
  await expect(favs).not.toContainText('Jairo');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('micra_favs_v1')))).toEqual([MARLENE]);
  await page.keyboard.press('Escape');

  // «Mostrar mi zona» (estaba apagada)
  await page.getByTestId('tile-zona').click();
  await expect(page.getByTestId('zone-toggle')).not.toBeChecked();
  await page.getByTestId('zone-toggle').check();
  expect(await page.evaluate(() => localStorage.getItem('micra_seek_off_v1'))).toBe('false');
  await page.keyboard.press('Escape');
  // La tarjeta de sellos ya no va en Mi perfil (pedido del usuario, 6 nov 2026)
  await expect(page.getByTestId('stamps')).toHaveCount(0);

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
  await page.getByLabel('Buscar un barista').fill('Jairo');
  await page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem').filter({ hasText: 'Jairo' }).getByRole('button', { name: 'Actuar como' }).click();
  await expect(page.getByText('Actuando como')).toContainText('Jairo');
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page.getByTestId('barista-profile')).toContainText('Perfil del barista');
  await expect(page.getByTestId('signout')).toHaveCount(0);
  await page.getByRole('button', { name: 'Equipo › Mi perfil' }).click();

  await expect(page).toHaveURL(/\/micra\/equipo\/perfil$/);
  await expect(page.getByTestId('owner-account')).toHaveText('equipo@aceropress.com');
  await expect(page.getByTestId('owner-profile').getByRole('region', { name: 'El equipo' })).toBeVisible();
  await page.getByTestId('signout').click();
  await page.getByRole('button', { name: 'Sí, cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/micra$/);
  await expect(page.getByRole('tablist', { name: 'Ver Micra como' })).toHaveCount(0);
  expect(api.find('/auth/v1/logout', 'POST')).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem('sb-mock-auth-token'))).toBeNull();
  expect(errors).toEqual([]);
});

test('cliente: la publicidad de ACERO.press ya no está en el inicio; se abre desde Mi perfil (video de la lata y luego las latas)', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra', { waitUntil: 'load' });
  await expect(page.getByTestId('micra-splash')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Qué te gustaría probar/ })).toBeVisible();
  await expect(page.getByTestId('acero-ad')).toHaveCount(0);

  // En Mi perfil no sale sola; se abre desde «Otros › ACERO.press» y se cierra con Escape
  await page.getByRole('navigation', { name: 'Micra' }).getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page.getByTestId('client-profile')).toBeVisible();
  const promo = page.getByTestId('promo-acero');
  await expect(promo).toHaveCount(0);
  await page.getByTestId('tile-coldbrew').click();
  await expect(promo).toBeVisible();
  await expect(promo).toContainText('Recetas de la casa');
  const skip = page.getByTestId('acero-skip');
  await expect(page.getByTestId('acero-video').or(page.getByTestId('acero-cans'))).toBeVisible();
  if (await skip.isVisible()) await skip.click({ timeout: 3000 }).catch(() => {});
  const cans = page.getByTestId('acero-cans');
  await expect(cans.getByRole('listitem')).toHaveCount(4);
  await expect(cans).toContainText('Matcha mambé');
  await page.keyboard.press('Escape');
  await expect(promo).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('barista: Insumos en su perfil arma el pedido y lo manda por WhatsApp al equipo; luego lo repite', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'barista' });
  await page.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  await page.goto('/micra/barista/perfil', { waitUntil: 'load' });
  const ins = page.getByTestId('insumos');
  await expect(ins.getByRole('heading', { name: 'Insumos' })).toBeVisible();
  await expect(page.getByTestId('insumos-repeat')).toHaveCount(0);
  await page.getByTestId('insumos-vasos').click();
  const sheet = page.getByTestId('insumos-sheet');
  await expect(sheet.getByRole('tab', { name: /Vasos/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('insumos-send')).toBeDisabled();
  await sheet.getByRole('button', { name: 'Agregar Vasos de 4 oz (tinto)' }).click();
  await sheet.getByRole('button', { name: 'Agregar Vasos de 4 oz (tinto)' }).click();
  await expect(page.getByTestId('insumo-vaso-4')).toHaveText('2');
  await sheet.getByRole('tab', { name: /Cigarrillos/ }).click();
  await expect(sheet).toContainText('Nunca a menores de edad');
  await sheet.getByRole('button', { name: 'Agregar Cigarrillos' }).click();
  await sheet.getByRole('tab', { name: /Vasos/ }).click();
  await expect(sheet.getByRole('tab', { name: /Vasos/ })).toContainText('2');
  await expect(page.getByTestId('insumos-sum')).toHaveText('Tu pedido: 2 paquetes de 50 · Vasos de 4 oz (tinto) · 1 cajetilla de 20 · Cigarrillos');
  await page.getByTestId('insumos-send').click();
  const url = await page.evaluate(() => window.__opened[0]);
  expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  const text = decodeURIComponent(url.split('text=')[1]);
  expect(text).toContain('Hola, soy Marlene de Micra. Quiero pedir insumos');
  expect(text).toContain('• 2 paquetes de 50 · Vasos de 4 oz (tinto)\n• 1 cajetilla de 20 · Cigarrillos');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  // Repetir el último pedido: la hoja vuelve con lo mismo
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('insumos-repeat')).toContainText('3 cosas');
  await page.getByTestId('insumos-repeat').click();
  await expect(page.getByTestId('insumos-sum')).toContainText('2 paquetes de 50');
  expect(errors).toEqual([]);
});

test('cliente: la primera vez salen solas las preguntas de gustos; si las salta, punto en Mi perfil y las completa allá', async ({ browser }) => {
  const { page, errors } = await open(browser, { gustosIntro: true });
  await page.goto('/micra', { waitUntil: 'load' });
  // Primera vez: salen solas con la bienvenida; «Saltar todo» las cierra y deja el punto
  await expect(page.getByTestId('gustos-welcome')).toContainText('Bienvenido a Micra');
  await page.getByTestId('gustos-close').click();
  await expect(page.getByTestId('gustos-quiz')).toHaveCount(0);
  await expect(page.getByTestId('gustos-dot')).toBeVisible();
  // No vuelven a salir solas
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('micra-splash')).toHaveCount(0);
  await expect(page.getByTestId('gustos-quiz')).toHaveCount(0);
  // En Mi perfil, «Mis gustos» con su punto abre las mismas preguntas
  await page.getByRole('navigation', { name: 'Micra' }).getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page.getByTestId('tile-gustos').locator('.mapp-ptile-dot')).toHaveCount(1);
  await page.getByTestId('tile-gustos').click();
  const quiz = page.getByTestId('gustos-quiz');
  await expect(quiz.getByRole('heading', { name: '¿Cómo te tomas el café?' })).toBeVisible();
  await page.getByTestId('gusto-bebida-tinto').click();
  await expect(page.getByTestId('gusto-bebida-tinto')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('gustos-next').click();
  // Las marcas van con su nombre; «No compro café» va sola
  await page.getByTestId('gusto-marcas-sello-rojo').click();
  await page.getByTestId('gusto-marcas-ninguno').click();
  await expect(page.getByTestId('gusto-marcas-sello-rojo')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('gusto-marcas-amor-perfecto').click();
  await page.getByTestId('gustos-next').click();
  await page.getByTestId('gusto-fuerza-suave').click();
  await page.getByTestId('gustos-next').click();
  await expect(page.getByTestId('gustos-next')).toHaveText('Saltar');
  await page.getByTestId('gustos-next').click();
  await page.getByTestId('gustos-next').click();
  await expect(page.getByTestId('gustos-result')).toContainText('Explorador de especialidad');
  await page.getByTestId('gustos-done').click();
  await expect(quiz).toHaveCount(0);
  await expect(page.getByTestId('tile-gustos')).toContainText('Explorador de especialidad');
  await expect(page.getByTestId('tile-gustos').locator('.mapp-ptile-dot')).toHaveCount(0);
  await expect(page.getByTestId('gustos-dot')).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('micra_gustos_v1')).answers);
  expect(saved).toEqual({ bebida: ['tinto'], marcas: ['amor-perfecto'], fuerza: 'suave' });

  await page.goto('/micra/apartados', { waitUntil: 'load' });
  const head = page.getByTestId('gustos-head');
  await expect(head.getByRole('heading', { level: 1 })).toHaveText('Explorador de especialidad');
  await expect(page.getByTestId('gustos-chips')).toContainText('Amor Perfecto');
  await expect(head).toContainText('7/10');
  expect(errors).toEqual([]);
});

test('barista sin sesión: la cabecera en gradiente con las cifras de Micra y sin la tarjeta de ventajas', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/barista', { waitUntil: 'load' });
  const head = page.getByTestId('join-head');
  await expect(head.getByRole('heading', { level: 1 })).toContainText('Vende más en');
  await expect(page.getByTestId('join-kpis')).toContainText('baristas en Micra');
  await expect(page.getByTestId('join-kpis')).toContainText('el tinto típico');
  await expect(page.locator('.mapp-perks')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('cliente: «Mis apartados» muestra sus baristas (favoritos y a quién le ha apartado) con si están en la calle', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.addInitScript(([m, j]) => {
    localStorage.setItem('micra_favs_v1', JSON.stringify([j]));
    localStorage.setItem('micra_mis_baristas_v1', JSON.stringify({ [m]: { n: 2, holds: ['x', 'y'], last: '2026-11-05' } }));
  }, [MARLENE, JAIRO]);
  await page.goto('/micra/apartados', { waitUntil: 'load' });
  const mine = page.getByTestId('my-baristas');
  await expect(mine.getByRole('heading', { level: 2 })).toContainText('Tus baristas');
  await expect(page.getByTestId(`my-barista-${MARLENE}`)).toContainText('le apartaste 2 veces');
  await expect(page.getByTestId(`my-barista-${JAIRO}`)).toContainText('Jairo ♥');
  await expect(mine).not.toContainText('Wilson');
  await page.getByTestId(`my-barista-${JAIRO}`).click();
  await expect(page).toHaveURL(new RegExp(`/micra/b/${JAIRO}`));
  expect(errors).toEqual([]);
});
