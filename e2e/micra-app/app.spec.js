// La app Micra (/micra): el cliente aparta, el barista entrega y cuenta, el
// equipo ve el día. Supabase simulado (e2e/micra/fixtures.js, «App Micra»).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
const WILSON = SEED.baristas[2].id;

/** who: 'visitor' | 'barista' (enlazado, sin equipo) | 'team' (equipo, sin ficha propia) */
async function open(browser, { who = 'visitor', seed = SEED, missing = false } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(seed), { missing });
  if (who === 'barista') {
    api.micra.admin = false;
    api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
  }
  if (who === 'team') api.micra.baristas.forEach((b) => { delete b.mine; });
  if (who !== 'visitor') await signIn(page);
  else {
    api.micra.admin = false;
    await page.addInitScript(() => { localStorage.setItem('acero.consent', 'granted'); });
  }
  return { page, api, errors };
}

test('cliente: ve quién está en la calle, aparta 2 tintos y 1 perico y lo cancela', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra', { waitUntil: 'load' });

  await expect(page.getByRole('heading', { level: 1 })).toContainText('¿Quién pasa con café');
  const rows = page.getByRole('list', { name: 'Baristas' }).getByRole('listitem');
  await expect(rows).toHaveCount(3);
  // Primero la que avisó que salió
  await expect(rows.first()).toContainText('Marlene');
  await expect(rows.first()).toContainText('En la calle');
  await expect(rows.first()).toContainText('2 lo esperan');
  // Sin el modo barista ni el del equipo
  await expect(page.getByRole('tablist', { name: 'Ver Micra como' })).toHaveCount(0);

  await rows.first().getByRole('button').click();
  await expect(page).toHaveURL(new RegExp(`/micra/b/${MARLENE}$`));
  await expect(page.getByRole('heading', { name: 'Marlene' })).toBeVisible();
  await page.getByRole('button', { name: 'Sumar un tinto' }).click();
  await page.getByRole('button', { name: 'Sumar un tinto' }).click();
  await page.getByRole('button', { name: 'Sumar un perico' }).click();
  await page.getByLabel('Tu nombre (así te llama)').fill('Sebas · 302');
  await page.getByRole('button', { name: 'Apartar 3 tazas · $5.000' }).click();

  await expect(page.getByTestId('micra-hold-done')).toContainText('2 tintos y 1 perico');
  await expect(page.getByTestId('micra-hold-done')).toContainText('$5.000');
  // La base recibe producto y cantidad, nunca el precio
  const sent = api.find('/rpc/micra_hold');
  expect(sent.data.p_items).toEqual([{ product: 'tinto', qty: 2 }, { product: 'perico', qty: 1 }]);
  expect(sent.data.p_client_ref).toMatch(/^cel-/);

  // Queda en «Mis apartados» y el nombre se recuerda
  await page.getByRole('navigation', { name: 'Micra' }).getByRole('button', { name: /Mis apartados/ }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Marlene' })).toContainText('Te espera');
  await page.getByRole('listitem').filter({ hasText: 'Marlene' }).getByRole('button').click();
  await expect(page.getByLabel('Tu nombre (así te llama)')).toHaveValue('Sebas · 302');
  await page.getByRole('button', { name: 'Ya no lo necesito' }).click();
  await expect(page.getByRole('button', { name: 'Elige qué quieres' })).toBeVisible();
  expect(api.micra.holds.find((h) => h.name === 'Sebas · 302').status).toBe('cancelled');
  expect(errors).toEqual([]);
});

test('cliente: un barista sin cuenta en Micra no ofrece apartar; el filtro y el favorito', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto(`/micra/b/${WILSON}`, { waitUntil: 'load' });
  await expect(page.getByText('Wilson todavía no recibe apartados por Micra')).toBeVisible();
  await expect(page.getByRole('button', { name: /Apartar/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Es mi barista' }).click();
  await page.getByRole('button', { name: '‹ Baristas' }).click();
  // El favorito sube al primer lugar
  await expect(page.getByRole('list', { name: 'Baristas' }).getByRole('listitem').first()).toContainText('Wilson');
  // Sin mapa: «¿Qué te gustaría tomar hoy?» en botones grandes, con cuántos baristas la tienen
  await expect(page.getByRole('heading', { name: '¿Qué te gustaría tomar hoy?' })).toBeVisible();
  await expect(page.locator('.mapp-map')).toHaveCount(0);
  const drinks = page.getByRole('group', { name: '¿Qué te gustaría tomar hoy?' });
  await expect(drinks.getByRole('button')).toHaveCount(4);
  await expect(drinks.getByRole('button', { name: 'Lo que haya' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('drink-perico')).toContainText('2 baristas');
  await drinks.getByRole('button', { name: /Perico/ }).click();
  await expect(drinks.getByRole('button', { name: /Perico/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('list', { name: 'Baristas' }).getByRole('listitem')).toHaveCount(2);
  await drinks.getByRole('button', { name: /Lo que haya/ }).click();
  await expect(page.getByRole('list', { name: 'Baristas' }).getByRole('listitem').first()).toContainText('Wilson');
  expect(errors).toEqual([]);
});

test('cliente: sin baristas ni migración, la app dice que abre pronto (no un error)', async ({ browser }) => {
  const { page, errors } = await open(browser, { missing: true });
  await page.goto('/micra', { waitUntil: 'load' });
  await expect(page.getByText('Micra abre muy pronto.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Invitar a mi barista' })).toHaveAttribute('href', /wa\.me/);
  expect(errors).toEqual([]);
});

test('barista: entra a su día, entrega un apartado, cuenta +1, fía, deshace y cobra', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra', { waitUntil: 'load' });
  // El barista cae en su modo
  await expect(page).toHaveURL(/\/micra\/barista$/);
  await expect(page.getByRole('heading', { name: /Marlene\.$/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Equipo' })).toHaveCount(0);
  // Vender es su inicio: ahí sale, cuenta y entrega
  const tabs = page.getByRole('navigation', { name: 'Barista' });
  await expect(tabs.getByRole('button', { name: /Vender/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('2');

  // Entregar a la portería: sus 3 tintos entran a la libreta
  const porteria = page.getByRole('listitem').filter({ hasText: 'Portería Ed. Alcalá' });
  await porteria.getByRole('button', { name: 'Entregado' }).click();
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('5');
  await expect(porteria).toHaveCount(0);

  // +1 y deshacer
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('6');
  await expect(page.getByText('Todo guardado')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer el último' }).click();
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('5');

  // Fiado con nombre nuevo
  await page.getByRole('button', { name: 'Fié un perico' }).click();
  await page.getByLabel('Nombre de quien te debe').fill('Don Luis taxi');
  await page.getByRole('button', { name: 'Anotar fiado' }).click();
  // Quién le debe está en «Mi plata»
  await tabs.getByRole('button', { name: /Mi plata/ }).click();
  const luis = page.getByRole('listitem').filter({ hasText: 'Don Luis taxi' });
  await expect(luis).toContainText('$2.000');
  await expect(luis.getByRole('link', { name: 'Cobrar' })).toHaveAttribute('href', /wa\.me.*Don%20Luis%20taxi/);
  await luis.getByRole('button', { name: 'Pagó' }).click();
  await expect(luis).toHaveCount(0);

  // La flecha: vuelve a «¿Cómo sales hoy?» y sale del mapa
  await tabs.getByRole('button', { name: /Vender/ }).click();
  await page.getByRole('region', { name: 'Tu salida' }).getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('button', { name: 'Salí a vender' })).toBeVisible();
  expect(api.find('/rpc/micra_barista_out').data.p_minutes).toBe(0);
  // Nunca actúa por otro barista
  expect(api.all('/rpc/micra_barista_sale').every((c) => !c.data.p_tintero_id)).toBe(true);
  expect(errors).toEqual([]);
});

test('barista sin señal: el +1 se cuenta igual y sube una sola vez cuando vuelve la red', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista/vender', { waitUntil: 'load' });
  await expect(page.getByTestId('micra-count-perico')).toHaveText('2');
  await page.route('https://mock.supabase.co/rest/v1/rpc/micra_barista_sale', (r) => r.abort('failed'));
  await page.getByRole('button', { name: 'Vendí un perico' }).click();
  await page.getByRole('button', { name: 'Vendí un perico' }).click();
  await expect(page.getByTestId('micra-count-perico')).toHaveText('4');
  await expect(page.getByText(/2 sin subir/)).toBeVisible();
  await page.unroute('https://mock.supabase.co/rest/v1/rpc/micra_barista_sale');
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByText('Todo guardado')).toBeVisible();
  await expect(page.getByTestId('micra-count-perico')).toHaveText('4');
  expect(api.micra.sales.filter((s) => s.product === 'perico').length).toBe(3); // la del seed (2 tazas) + 2
  expect(errors.filter((e) => !/Failed to fetch/.test(e))).toEqual([]);
});

test('barista nuevo: entra con Google y enlaza su cuenta con el código del enlace', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista' });
  api.ruta.me = null;
  api.micra.baristas[0].mine = false;
  await page.goto('/micra/barista?codigo=abc234', { waitUntil: 'load' });
  await expect(page.getByLabel('Código')).toHaveValue('ABC234');
  // Al enlazar, la ficha de prueba de la simulación pasa a ser la suya
  page.on('request', (r) => { if (r.url().endsWith('/rpc/tintero_claim')) api.micra.baristas[0].mine = true; });
  await page.getByRole('button', { name: 'Enlazar mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: /Marlene\.$/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('equipo: ve el día de todos, genera el código de quien falta y actúa como un barista', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'team' });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  await expect(page.getByRole('tablist', { name: 'Ver Micra como' }).getByRole('tab')).toHaveText(['Cliente', 'Barista', 'Equipo']);
  await expect(page.getByTestId('owner-cups')).toHaveText('4');
  // Sin lista de nombres: se busca
  await expect(page.getByRole('list', { name: 'Baristas encontrados' })).toHaveCount(0);
  await page.getByLabel('Buscar un barista').fill('wilson');
  const wilson = page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem').filter({ hasText: 'Wilson' });
  await expect(wilson).toContainText('Falta enlazar su cuenta');
  await wilson.getByRole('button', { name: 'Generar código' }).click();
  await expect(wilson.locator('code')).toHaveText('K7M2QX');

  // Jairo ya está activo y no está en la calle: no sale en el resumen, se busca
  await page.getByLabel('Buscar un barista').fill('jairo');
  await page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem').filter({ hasText: 'Jairo' }).getByRole('button', { name: 'Actuar como' }).click();
  await expect(page.getByText('Actuando como')).toContainText('Jairo');
  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Vender/ }).click();
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('1');
  expect(api.find('/rpc/micra_barista_sale').data.p_tintero_id).toBe(SEED.baristas[1].id);

  // Cambiar de barista vuelve a Equipo, donde está «Actuar como»
  await page.getByRole('button', { name: 'Cambiar de barista' }).click();
  await expect(page).toHaveURL(/\/micra\/equipo$/);
  await expect(page.getByLabel('Buscar un barista')).toBeVisible();
  expect(errors).toEqual([]);
});

// ── Entrar con el celular (SMS) ─────────────────────────────────────────
/** Nadie enlazado; `phone` en la ficha de Marlene (como lo guarda la base). */
async function openSms(browser, { phone = '573001234567' } = {}) {
  const seed = structuredClone(SEED);
  seed.baristas.forEach((b) => { delete b.mine; });
  seed.baristas[0].phone = phone;
  return open(browser, { seed });
}

test('barista: entra con su celular y el código del SMS y cae en su inicio, sin código de invitación', async ({ browser }) => {
  const { page, api, errors } = await openSms(browser);
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: '¿Como quién entras?' })).toHaveCount(0);
  const phone = page.getByLabel('Tu celular');
  await phone.fill('3001234567');
  await expect(phone).toHaveValue('300 123 4567');
  await page.getByRole('button', { name: 'Enviarme el código' }).click();
  expect(api.sms.sent).toEqual(['+573001234567']);

  await expect(page.getByText('Te mandamos un SMS al')).toContainText('300 123 4567');
  await expect(page.getByRole('button', { name: /Reenviar en \d+ s/ })).toBeDisabled();
  const code = page.getByLabel('Código del SMS');
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code');
  // Un código malo se dice en español; con los seis números buenos entra solo
  await code.fill('111111');
  await expect(page.getByRole('alert')).toContainText('no sirve o ya venció');
  await code.fill('123456');

  await expect(page.getByRole('heading', { name: /Marlene\.$/ })).toBeVisible();
  await expect(page).toHaveURL(/\/micra\/barista$/);
  // La base lee el número de la sesión: el celular no lo manda
  const claim = api.find('/rpc/tintero_claim_phone');
  expect(JSON.stringify(claim.data ?? {})).not.toContain('300');
  expect(api.micra.baristas[0].mine).toBe(true);
  expect(errors).toEqual([]);
});

test('barista: un número que no está registrado lo dice y deja el WhatsApp del equipo y el código', async ({ browser }) => {
  const { page, api, errors } = await openSms(browser);
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await page.getByLabel('Tu celular').fill('+57 310 999 8877');
  await page.getByRole('button', { name: 'Enviarme el código' }).click();
  await page.getByLabel('Código del SMS').fill('123456');

  const box = page.getByTestId('phone-not-found');
  await expect(box).toContainText('310 999 8877');
  await expect(box.getByRole('alert')).toContainText('Tu número no está registrado en Micra');
  await expect(box.getByRole('button', { name: 'Escribirle al equipo por WhatsApp' })).toBeVisible();
  // El camino del código sigue ahí
  await expect(page.getByLabel('Código', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar con otro número' })).toBeVisible();
  expect(api.micra.baristas.some((b) => b.mine)).toBe(false);
  expect(errors).toEqual([]);
});

test('barista sin cuenta: «Entrar con Google» sigue debajo, para quien tiene el código de seis letras', async ({ browser }) => {
  const { page, errors } = await openSms(browser);
  await page.goto('/micra/barista', { waitUntil: 'load' });
  const oauth = page.waitForRequest(/\/auth\/v1\/authorize\?provider=google/);
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  expect((await oauth).url()).toContain('redirect_to=');
  expect(errors.filter((e) => !/Failed to fetch|ERR_/.test(e))).toEqual([]);
});

test('equipo: la pestaña Barista muestra la entrada por SMS (sin mandar nada) y pone el celular de un barista', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'team' });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(page.getByTestId('team-preview')).toContainText('Así entran los baristas');
  await expect(page.getByRole('heading', { name: '¿Como quién entras?' })).toHaveCount(0);
  await page.getByLabel('Tu celular').fill('3001234567');
  await page.getByRole('button', { name: 'Enviarme el código' }).click();
  await expect(page.getByRole('status')).toContainText('No se mandó nada');
  expect(api.sms.sent).toEqual([]);

  await page.getByRole('button', { name: 'Actuar como › Equipo' }).click();
  await expect(page).toHaveURL(/\/micra\/equipo$/);
  await page.getByLabel('Buscar un barista').fill('Wilson');
  const wilson = page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem').filter({ hasText: 'Wilson' });
  await expect(wilson).toContainText('pon su celular o genera un código');
  await wilson.getByRole('button', { name: 'Poner su celular' }).click();
  await wilson.getByLabel('Celular de Wilson').fill('310 999 8877');
  await wilson.getByRole('button', { name: 'Guardar' }).click();
  await expect(wilson).toContainText('Cel. 310 999 8877');
  await expect(wilson).toContainText('que entre con su celular');
  expect(api.micra.baristas[2].phone).toBe('573109998877');
  // Un número es de un solo barista
  await page.getByLabel('Buscar un barista').fill('Jairo');
  await page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem').filter({ hasText: 'Jairo' }).getByRole('button', { name: 'Poner su celular' }).click();
  await page.getByLabel('Celular de Jairo').fill('3109998877');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toContainText('Ese número ya lo tiene Wilson');
  expect(errors).toEqual([]);
});

test('cliente con apartado: arriba va «Tu apartado» con sus etapas; las tarjetas llevan las iniciales', async ({ browser }) => {
  const seed = structuredClone(SEED);
  seed.holds.push({ id: 'apartado-mio', tintero_id: MARLENE, client_ref: 'MI-CEL', name: 'Sebas', items: [{ product: 'tinto', qty: 2, unit_price: 1500 }], cups: 2, total: 3000, status: 'waiting' });
  const { page, errors } = await open(browser, { seed });
  await page.addInitScript(() => { localStorage.setItem('micra_device_v1', JSON.stringify('MI-CEL')); localStorage.setItem('micra_name_v1', JSON.stringify('Sebas · oficina 302')); });
  await page.goto('/micra', { waitUntil: 'load' });

  const card = page.getByRole('region', { name: 'Tu apartado de hoy' });
  await expect(card).toContainText('2 tintos con Marlene');
  // Marlene avisó que salió: la etapa actual es «Salió» (o «En tu cuadra» si es su hora)
  await expect(card.getByRole('list', { name: 'Etapas' }).locator('[aria-current="step"]')).toHaveText(/Salió|En tu cuadra/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('¿Quién pasa con café');
  // Sin mapa ya no hay pines: cada tarjeta lleva las iniciales de su barista
  const rows = page.getByRole('list', { name: 'Baristas' }).getByRole('listitem');
  await expect(rows.first().locator('.mapp-av')).toHaveText(/^[A-ZÁÉÍÓÚÑ]{1,2}$/);
  await card.getByRole('button', { name: 'Ver a Marlene' }).click();
  await expect(page).toHaveURL(new RegExp(`/micra/b/${MARLENE}$`));
  expect(errors).toEqual([]);
});

test('barista en la calle: la cabecera roja sube hasta la barra, dice hasta cuándo y lo que lleva; la flecha vuelve sin cerrar el día', async ({ browser }) => {
  const seed = structuredClone(SEED);
  seed.baristas[0].live_until = new Date(Date.now() + 100 * 60000).toISOString();
  const { page, errors } = await open(browser, { who: 'barista', seed });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  const out = page.getByRole('region', { name: 'Tu salida' });
  await expect(out).toContainText('Hasta las');
  await expect(out).toContainText('quedan 1 h 40 min');
  await expect(out.getByRole('progressbar')).toHaveAttribute('aria-valuenow', /^5[789]$/);
  await expect(out).toContainText('$7.000');
  await expect(out).toContainText('$4.000');
  // La barra de arriba va en rojo solo en Vender; el círculo de Mi perfil lleva el punto verde
  const app = page.locator('.mapp');
  await expect(app).toHaveClass(/is-redtop/);
  await expect(page.getByTestId('me-button').locator('.mapp-mebtn-live')).toHaveCount(1);
  const red = await page.getByTestId('topbar').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(red).toBe(await out.evaluate((el) => getComputedStyle(el).backgroundColor));
  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Hoy/ }).click();
  await expect(app).not.toHaveClass(/is-redtop/);
  await expect(page.getByTestId('me-button').locator('.mapp-mebtn-live')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Vender/ }).click();
  await expect(app).toHaveClass(/is-redtop/);
  const cups = await page.getByTestId('micra-count-tinto').textContent();
  await out.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('button', { name: 'Salí a vender' })).toBeVisible();
  await expect(page.getByTestId('toast')).toContainText('Tus ventas de hoy siguen aquí');
  await expect(page.getByTestId('micra-count-tinto')).toHaveText(cups);
  await expect(app).not.toHaveClass(/is-redtop/);
  await expect(page.getByTestId('me-button').locator('.mapp-mebtn-live')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('al volver de Google, el equipo cae en su panel y el barista en su día', async ({ browser }) => {
  // La vuelta de Google llega a /micra/barista con la marca de «acaba de entrar»
  const team = await open(browser, { who: 'team' });
  await team.page.addInitScript(() => { localStorage.setItem('micra_login_pending', String(Date.now())); });
  await team.page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(team.page).toHaveURL(/\/micra\/equipo$/);
  await expect(team.page.getByRole('tab', { name: 'Equipo' })).toHaveAttribute('aria-selected', 'true');
  expect(team.errors).toEqual([]);

  const barista = await open(browser, { who: 'barista' });
  await barista.page.addInitScript(() => { localStorage.setItem('micra_login_pending', String(Date.now())); });
  await barista.page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(barista.page.getByRole('tab', { name: 'Barista' })).toHaveAttribute('aria-selected', 'true');
  await expect(barista.page).toHaveURL(/\/micra\/barista$/);
  // Su panel: el mapa de lo que hay cerca y, debajo, quién le apartó
  await expect(barista.page.getByTestId('micra-map')).toBeVisible();
  await expect(barista.page.getByText(/Solicitudes cerca · Te esperan/)).toBeVisible();
  // Sin el panel del equipo (estudio, encuestas, filtros)
  await expect(barista.page.getByRole('tab', { name: 'Equipo' })).toHaveCount(0);
  expect(barista.errors).toEqual([]);
});

test('el panel del equipo es solo del dueño: otro rol de admin entra como barista', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'team' });
  api.micra.adminRole = 'editor';
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  await expect(page.getByText('Esta parte es del equipo de Micra.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Equipo' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('barista: la racha de la semana, su meta y la fiesta al cumplirla; luego comparte su día', async ({ browser }) => {
  const seed = structuredClone(SEED);
  delete seed.baristas[0].live_until;
  const { page, errors } = await open(browser, { who: 'barista', seed });
  await page.addInitScript(() => { localStorage.removeItem('micra_goal_v1'); localStorage.removeItem('micra_party_v1'); });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  // Semana de prueba: vendió los tres días anteriores y hoy ya lleva 4 tazas
  await expect(page.getByTestId('streak')).toContainText('4 días');
  await expect(page.getByRole('list', { name: 'Tu semana' }).getByRole('listitem')).toHaveCount(7);
  // La meta sale de su mejor día (25) y se cambia en un toque
  const goal = page.getByRole('region', { name: 'Meta de hoy' });
  await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '25');
  await goal.getByRole('button', { name: 'Cambiar' }).click();
  await goal.getByRole('button', { name: '10', exact: true }).click();
  await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '10');

  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Vender/ }).click();
  await expect(page.getByTestId('sell-cups')).toHaveText('4');
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByTestId('toast')).toContainText('¡Llevas 5! Te faltan 5');
  for (let i = 0; i < 5; i += 1) await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  const party = page.getByRole('dialog', { name: 'Meta cumplida' });
  await expect(party).toContainText('10 tazas');
  await party.getByRole('button', { name: 'Compartir mi día' }).click();
  const story = page.getByRole('dialog', { name: 'Mi día' });
  await expect(story).toContainText('El día de Marlene');
  await expect(story).toContainText('10');
  await story.getByRole('button', { name: 'Cerrar' }).click();
  await expect(story).toHaveCount(0);
  // Una vez al día: deshacer y volver a llegar no repite la fiesta
  await page.getByRole('button', { name: 'Deshacer el último' }).click();
  await expect(page.getByTestId('sell-cups')).toHaveText('9');
  await page.getByRole('button', { name: 'Vendí un perico' }).click();
  await expect(page.getByTestId('sell-cups')).toHaveText('10');
  await expect(party).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('barista: aprende en un camino de lecciones; lo visto queda marcado y Hoy lo cuenta como logro', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'barista' });
  await page.addInitScript(() => { localStorage.removeItem('acero.escuela.vistas'); });
  await page.goto('/micra/barista/aprende', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu camino a');
  await expect(page.getByTestId('level')).toContainText('0 de 6 lecciones');
  await page.getByRole('button', { name: 'Empezar' }).click();
  const lesson = page.getByRole('dialog');
  await expect(lesson.getByRole('heading', { name: 'Conoce tu AeroPress' })).toBeVisible();
  await lesson.getByRole('button', { name: 'Ya la vi ✓' }).click();
  await expect(page.getByTestId('level')).toContainText('1 de 6 lecciones');
  await expect(page.getByRole('button', { name: /Lección 1: Conoce tu AeroPress \(vista\)/ })).toBeVisible();
  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Hoy/ }).click();
  await expect(page.getByTestId('feed-logro-escuela')).toContainText('1 de 6 lecciones');
  expect(errors).toEqual([]);
});

test('cliente: los baristas en tarjetas con su personaje y la tarjeta de 10 tazas', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra', { waitUntil: 'load' });
  const cards = page.getByRole('list', { name: 'Baristas' }).getByRole('listitem');
  await expect(cards.first().locator('.mapp-fig svg')).toBeVisible();
  await expect(cards.first()).toContainText('Apártame');
  // Wilson aún no recibe apartados: su tarjeta no promete apartar
  await expect(cards.filter({ hasText: 'Wilson' })).toContainText('Ver dónde está');
  await expect(page.getByTestId('stamps')).toContainText('7 de 10');
  await expect(page.getByTestId('stamps')).toContainText('Te faltan 3');
  expect(errors).toEqual([]);
});

test('cliente como Instagram: historias de los baristas arriba, mensajes al equipo y la barra de cinco íconos', async ({ browser }) => {
  const seed = structuredClone(SEED);
  seed.baristas[1].live_until = new Date(Date.now() + 60 * 60000).toISOString();
  const { page, errors } = await open(browser, { seed });
  await page.goto('/micra', { waitUntil: 'load' });
  // Arriba: Hoy y luego los baristas; quien está en la calle lleva «AHORA»
  const stories = page.getByTestId('stories');
  await expect(stories.getByRole('button').first()).toHaveAccessibleName('Hoy en el café');
  await expect(stories.getByRole('button', { name: /en la calle ahora/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+/);
  // Debajo de los baristas sigue el muro de Hoy, como el feed de Instagram (un solo h1 en la página)
  const feed = page.getByTestId('home-feed');
  await expect(feed.getByRole('heading', { level: 2, name: 'Hoy en el café' })).toBeVisible();
  await expect(feed.getByTestId('price-card')).toContainText('$1.300');
  await expect(feed).toContainText('World of Coffee llega a Bogotá en 2027');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  // Sin «Soy barista» ni círculo arriba: el perfil va abajo
  await expect(page.getByRole('banner').getByRole('button', { name: 'Mi perfil' })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Micra' });
  await expect(nav.getByRole('button')).toHaveCount(5);
  await expect(nav.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  // El «+» abre la hoja de publicar del muro (receta, café o barista, por WhatsApp)
  await nav.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByTestId('publish').getByRole('link')).toHaveCount(3);
  await page.getByTestId('publish').getByRole('button', { name: 'Cerrar' }).click({ force: true });
  // Una historia abre la página del barista
  await stories.getByRole('button', { name: /en la calle ahora/ }).first().click();
  await expect(page).toHaveURL(/\/micra\/b\//);
  await nav.getByRole('button', { name: 'Mi perfil' }).click();
  await expect(page).toHaveURL(/\/micra\/perfil$/);
  await expect(nav.getByRole('button', { name: 'Mi perfil' })).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('cliente: Hoy es el muro del café, sin logros ni ideas de foto; publicar le escribe al equipo', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra', { waitUntil: 'load' });
  await page.getByRole('navigation', { name: 'Micra' }).getByRole('button', { name: /Hoy/ }).click();
  await expect(page).toHaveURL(/\/micra\/hoy$/);
  await expect(page.getByRole('heading', { name: 'Hoy en el café' })).toBeVisible();
  await expect(page.getByTestId('price-card')).toContainText('$1.300');
  const feed = page.getByTestId('feed');
  await expect(feed).toContainText('World of Coffee llega a Bogotá en 2027');
  await expect(page.getByTestId('feed-cafe').first()).toContainText('Federación Nacional de Cafeteros');
  await expect(page.locator('[data-testid^="feed-logro"], [data-testid="feed-idea"]')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Logros' })).toHaveCount(0);
  // El video lleva a la Escuela del sitio, no a Aprende del barista
  await page.getByRole('tab', { name: 'Videos' }).click();
  await expect(feed.getByRole('link', { name: 'Aprender en la Escuela ›' })).toHaveAttribute('href', /\/escuela$/);
  // Un puesto abre su tarjeta para apartar
  await page.getByRole('tab', { name: 'Puestos' }).click();
  await feed.getByRole('button', { name: 'Ver en el mapa ›' }).first().click();
  await expect(page).toHaveURL(/\/micra\/b\//);
  await page.goto('/micra/hoy', { waitUntil: 'load' });
  // Publicar: receta, café o barista de su cuadra, por WhatsApp al equipo (sin cámara)
  await page.getByRole('button', { name: '＋ Publicar' }).click();
  const sheet = page.getByTestId('publish');
  await expect(sheet).not.toContainText('Video con filtro');
  await expect(sheet.getByRole('link', { name: /Un barista de tu cuadra/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);
  await expect(sheet.getByRole('link')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('barista: Hoy es el muro del barismo (precio, puestos, recetas, noticia) y Vender pide café por WhatsApp', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista/hoy', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: 'Hoy en la calle' })).toBeVisible();
  await expect(page.getByTestId('price-card')).toContainText('$1.300');
  const feed = page.getByTestId('feed');
  await expect(feed).toContainText('World of Coffee llega a Bogotá en 2027');
  // Los chips filtran: en «Puestos» solo quedan los puestos de otros baristas
  await page.getByRole('tab', { name: 'Puestos' }).click();
  await expect(feed).not.toContainText('World of Coffee');
  await expect(feed.getByRole('button', { name: 'Ver en el mapa ›' }).first()).toBeVisible();
  // Publicar lleva a lo que ya existe
  await page.getByRole('button', { name: '＋ Publicar' }).click();
  await expect(page.getByTestId('publish')).toContainText('Video con filtro');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Vender/ }).click();
  await page.getByTestId('coffee-bar').click();
  const order = page.getByTestId('coffee-order');
  await order.getByRole('button', { name: '2 kg' }).click();
  await expect(order.getByTestId('coffee-order-send')).toHaveAttribute('href', /wa\.me\/\d+\?text=.*2%20kilos/);
  expect(errors).toEqual([]);
});

test('barista: sale aunque no estaba en el mapa (escoge cómo sale y acepta en la misma hoja), agrega un producto con + y escoge cómo le pagan', async ({ browser }) => {
  const seed = structuredClone(SEED);
  delete seed.baristas[0].live_until;
  seed.baristas[0].public = false;
  const { page, api, errors } = await open(browser, { who: 'barista', seed });
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 4.6432, longitude: -74.0641 });
  await page.goto('/micra/barista', { waitUntil: 'load' });

  // «Salí a vender» ya no espera al equipo: siempre se puede tocar
  const go = page.getByTestId('go-out');
  await expect(go).toBeEnabled();
  await go.click();
  await expect(page.getByRole('alert')).toContainText('Escoge primero cómo sales hoy');
  await page.getByTestId('mode-caminando').click();
  await expect(page.getByTestId('mode-caminando')).toHaveAttribute('aria-checked', 'true');
  expect(api.find('/rpc/micra_barista_mode').data.p_mode).toBe('caminando');
  await go.click();
  const sheet = page.getByRole('dialog', { name: 'Permisos para salir' });
  await expect(sheet).toContainText('Salir en el mapa de Micra');
  await expect(sheet.getByTestId('consent-accept')).toBeDisabled();
  await sheet.getByTestId('consent-public').check();
  await sheet.getByTestId('consent-location').check();
  await sheet.getByTestId('consent-accept').click();
  await expect(page.locator('.mapp-now-live')).toHaveText('En la calle · Caminando');
  expect(api.find('/rpc/micra_barista_public').data.p_on).toBe(true);
  expect(api.micra.baristas[0].public).toBe(true);
  expect(api.find('/rpc/micra_barista_out').data.p_lat).toBeCloseTo(4.6432, 3);
  // Caminando: se graba el recorrido
  await expect(page.getByTestId('trip-recording')).toBeVisible();

  // El + junto a tinto, perico y aromática
  await page.getByTestId('product-add').click();
  const form = page.getByTestId('product-form');
  await form.getByLabel('¿Qué vendes?').fill('Empanada');
  await form.getByLabel('Precio').fill('2500');
  await form.getByRole('button', { name: 'Agregar' }).click();
  await page.getByRole('button', { name: 'Vendí un empanada' }).click();
  await expect.poll(() => api.micra.sales.filter((s) => s.product === 'x0000000001').length).toBe(1);
  expect(api.micra.sales.find((s) => s.product === 'x0000000001').total).toBe(2500);

  // Cómo le pagan: solo el medio, sin número
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await page.getByTestId('tile-precios').click();
  await expect(page.getByTestId('product-grid')).toContainText('Empanada');
  await page.keyboard.press('Escape');
  await page.getByTestId('tile-pagos').click();
  await page.getByRole('button', { name: 'Cambiar cómo me pagan' }).click();
  const pay = page.getByTestId('pay-settings');
  await expect(pay.locator('input')).toHaveCount(0);
  await pay.getByRole('button', { name: /Daviplata/ }).click();
  await pay.getByTestId('pay-save').click();
  await expect(page.getByTestId('profile-pay')).toHaveText('Efectivo, Nequi, Daviplata');
  expect(api.find('/rpc/micra_barista_payments_set').data.p_methods).toEqual(['efectivo', 'nequi', 'daviplata']);

  await page.keyboard.press('Escape');

  // En el perfil (Permisos) también se apaga y se prende el mapa
  await page.getByTestId('tile-permisos').click();
  await page.getByTestId('profile-public-toggle').click();
  await expect(page.getByTestId('profile-public')).toContainText('No');
  await page.keyboard.press('Escape');

  // Mi plata ya no tiene «Tu enlace»
  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Mi plata/ }).click();
  await expect(page.getByText('Tu enlace')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('barista: Hoy celebra la racha y sugiere qué publicar; no publica cuántas tazas vendió', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'barista' });
  await page.goto('/micra/barista/hoy', { waitUntil: 'load' });
  await expect(page.getByTestId('price-card')).toContainText('Precio del día en la FNC');
  await expect(page.getByTestId('feed-logro-racha')).toContainText('4 días en racha');
  await expect(page.getByTestId('feed-idea')).toHaveCount(2);
  await expect(page.getByTestId('feed-myday')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Café de Colombia' }).click();
  await expect(page.getByTestId('feed-cafe').first()).toContainText('Federación Nacional de Cafeteros');
  await page.getByRole('tab', { name: 'Para publicar' }).click();
  await page.getByTestId('feed-idea').first().getByRole('button', { name: /Tomar la foto/ }).click();
  await expect(page).toHaveURL(/\/micra\/video$/);
  expect(errors).toEqual([]);
});

test('barista caminando: la primera taza celebra la racha; al volver no se cierra el día y «Mi día en la calle» lleva su ruta', async ({ browser }) => {
  const seed = structuredClone(SEED);
  seed.sales = [];
  seed.holds = [];
  seed.baristas[0].live_until = new Date(Date.now() + 120 * 60000).toISOString();
  const { page, errors } = await open(browser, { who: 'barista', seed });
  await page.addInitScript(() => {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    localStorage.setItem('micra_out_mode_v1', 'caminando');
    // El recorrido de hoy, como queda al volver de la calle (4,2 km, 5 paradas)
    localStorage.setItem('micra_dia_v1', JSON.stringify({ day, distance: 4230, stops: 5, path: [[-74.064, 4.643], [-74.062, 4.645], [-74.06, 4.648], [-74.057, 4.647], [-74.058, 4.651]] }));
  });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(page.getByLabel(/^0 de \d+ tazas$/)).toBeVisible();

  // La primera taza del día: la racha arranca (una vez al día)
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  const first = page.getByTestId('moment-primera');
  await expect(first).toContainText('¡Primera del día!');
  await first.getByRole('button', { name: 'A vender' }).click();
  await expect(first).toHaveCount(0);
  await page.getByRole('button', { name: 'Vendí un tinto' }).click();
  await expect(page.getByLabel(/^2 de \d+ tazas$/)).toBeVisible();
  await expect(page.getByTestId('moment-primera')).toHaveCount(0);

  // Hoy: «El día de Marlene» con su ruta, sin tazas ni plata
  await page.getByRole('navigation', { name: 'Barista' }).getByRole('button', { name: /Hoy/ }).click();
  const dia = page.getByTestId('feed-dia');
  await expect(dia).toContainText('El día de Marlene');
  await expect(dia).toContainText('4,2 km · 5 paradas');
  await expect(dia).not.toContainText('taza');
  await expect(dia.locator('.mapp-routebox-line')).toHaveCount(1);
  await expect(page.getByTestId('feed-idea').first().locator('.mapp-ig-tag')).toHaveText('Idea de foto');

  // La flecha: sale del mapa sin resumen de cierre (las ventas siguen) y «Mi día en la calle» está en Mi plata
  const nav = page.getByRole('navigation', { name: 'Barista' });
  await nav.getByRole('button', { name: /Vender/ }).click();
  await page.getByRole('region', { name: 'Tu salida' }).getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByTestId('toast')).toContainText('Tus ventas de hoy siguen aquí');
  await expect(page.locator('.mapp-party')).toHaveCount(0);
  await expect(page.getByTestId('micra-count-tinto')).toHaveText('2');
  await nav.getByRole('button', { name: /Mi plata/ }).click();
  await page.getByTestId('story-open').click();
  const story = page.getByTestId('story');
  await expect(story).toHaveAttribute('data-variant', 'calle');
  await expect(story).toContainText('Mi día en la calle');
  await expect(story).toContainText('N1 Aprendiz');
  await expect(story.locator('.mapp-routebox-line')).toHaveCount(1);
  await expect(story.getByTestId('story-wa')).toBeVisible();
  await expect(story.getByTestId('story-share')).toHaveText('Historias');
  await story.getByRole('button', { name: 'Cerrar' }).click();
  await expect(story).toHaveCount(0);
  expect(errors).toEqual([]);
});

// ── Activación automática: el resumen del equipo en vez de la lista ─────
const EQUIPO = JSON.parse(readFileSync(new URL('../data/micra-equipo.json', import.meta.url), 'utf8'));

test('equipo con 60 fichas: resumen, avisos y clientes en cifras; la lista entera no sale', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'team', seed: EQUIPO });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const act = page.getByTestId('owner-activation');
  await expect(act).toContainText('2 activos de 60 fichas');
  await expect(act.getByRole('listitem').first()).toContainText('60');
  await expect(page.getByTestId('owner-alerts')).toContainText('salen en el mapa pero aún no reciben apartados');
  await expect(page.getByTestId('owner-alerts')).toContainText('1 cliente frenado');
  await expect(page.getByTestId('owner-clients')).toContainText('23');
  // Ningún nombre a la vista: solo el buscador
  await expect(page.locator('.mapp-team > li')).toHaveCount(0);
  await expect(page.getByLabel('Buscar un barista')).toBeVisible();
  // Las reglas, a la mano
  await page.getByText('Reglas de activación').click();
  await expect(page.locator('.mapp-rules')).toContainText('no aparta por 7 días y vuelve solo');

  // El buscador encuentra por paso, por lugar y sin tildes
  await page.getByLabel('Buscar un barista').fill('invitado');
  await expect(page.getByRole('status').filter({ hasText: 'baristas' })).toHaveText('2 baristas');
  await page.getByLabel('Buscar un barista').fill('en la calle');
  await expect(page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem')).toHaveText([/Marlene/]);
  await page.getByLabel('Buscar un barista').fill('kennedy');
  await expect(page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem')).toHaveCount(8);
  await page.getByRole('button', { name: /^Ver \d+ más$/ }).click();
  await expect(page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem')).toHaveCount(EQUIPO.baristas.filter((b) => /kennedy/i.test(`${b.localidad} ${b.referencia}`)).length);
  await page.getByLabel('Buscar un barista').fill('hernan');
  await expect(page.getByRole('list', { name: 'Baristas encontrados' }).getByRole('listitem')).toHaveText(/Hernán/);
  expect(errors).toEqual([]);
});

test('equipo sin la migración de activación: el resumen sale igual, sin la tarjeta de clientes', async ({ browser }) => {
  const seed = structuredClone(EQUIPO);
  delete seed.clients;
  const { page, errors } = await open(browser, { who: 'team', seed });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  await expect(page.getByTestId('owner-activation')).toContainText('de 60 fichas');
  await expect(page.getByTestId('owner-clients')).toHaveCount(0);
  expect(errors).toEqual([]);
});
