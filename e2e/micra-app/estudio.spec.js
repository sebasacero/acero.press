// La app Micra en modo equipo: el estudio de calle (fichas, encuesta, foto con
// GPS) y la cámara de Micra con la ficha abierta. Mismas llamadas que el panel.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const INFORME = JSON.parse(readFileSync(new URL('../data/informe.json', import.meta.url), 'utf8'));
// Frente a la estación de la 72 (Chapinero), con 9 m de precisión
const GPS = { ...PHONE, permissions: [...PHONE.permissions, 'geolocation'], geolocation: { latitude: 4.6577, longitude: -74.0634, accuracy: 9 } };

/** Una ficha ya completa (GPS, foto) y el resto como vienen del informe. */
function study() {
  const d = structuredClone(INFORME);
  Object.assign(d.tinteros[0], { referencia: 'Salida de la 72', localidad: 'Chapinero', lat: 4.6577, lng: -74.0634, gps_accuracy_m: 9, photo_consent: true, photo_url: 'https://mock.supabase.co/storage/v1/object/public/estudio/tinteros/1-dona-rosa.jpg' });
  return d;
}

async function open(browser, { who = 'team' } = {}) {
  const ctx = await browser.newContext(GPS);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.baristas.forEach((b) => { delete b.mine; });
  api.opts.piloto = study();
  if (who === 'barista') {
    api.micra.admin = false;
    api.ruta.me = { id: SEED.baristas[0].id, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
  }
  await signIn(page, { coach: true });
  return { page, api, errors };
}

test('equipo: del día al estudio; marca el GPS de una ficha y sube su foto', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const tabs = page.getByRole('navigation', { name: 'Equipo' });
  // Hoy, el mapa, la cámara al centro, la encuesta y el estudio: solo íconos, como la barra del cliente
  await expect(tabs.getByRole('button')).toHaveCount(5);
  for (const name of ['Hoy', 'Mapa', 'Encuesta', 'Estudio']) await expect(tabs.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(tabs.getByRole('button')).toHaveText(['Hoy', 'Mapa', '', 'Encuesta', 'Estudio']);
  await expect(tabs.getByRole('button', { name: 'Cámara' })).toBeVisible();
  await tabs.getByRole('button', { name: 'Estudio' }).click();
  await expect(page).toHaveURL(/\/micra\/estudio$/);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Estudio de calle');
  await expect(page.getByTestId('study-total')).toHaveText('6');
  const fichas = page.getByRole('list', { name: 'Fichas del estudio' }).getByRole('listitem');
  await expect(fichas).toHaveCount(6);
  // La completa va al final; a las demás les falta algo
  await expect(fichas.last()).toContainText('Doña Rosa');
  await expect(fichas.last()).toContainText('Completa');
  await expect(fichas.last()).toContainText('Salida de la 72 · Chapinero · GPS ±9 m');

  // GPS: solo frente al puesto
  const pedro = fichas.filter({ hasText: 'Don Pedro' });
  await expect(pedro).toContainText('Sin GPS');
  await pedro.getByRole('button', { name: 'Completar foto y GPS' }).click();
  const mark = pedro.getByRole('button', { name: '📍 Marcar su punto aquí' });
  await expect(mark).toBeDisabled();
  await pedro.getByLabel('Estoy frente a su puesto').check();
  await mark.click();
  await expect(page.getByRole('status')).toContainText('Punto de Don Pedro marcado · ±9 m');
  const gps = api.find('/api/v1/bi/tinteros/t2', 'PATCH');
  expect(gps.data).toMatchObject({ lat: 4.6577, lng: -74.0634, gps_accuracy_m: 9 });
  await expect(fichas.filter({ hasText: 'Don Pedro' })).not.toContainText('Sin GPS');

  // Foto con GPS: con su permiso, al bucket privado y a la ficha con el punto del celular
  const marta = fichas.filter({ hasText: 'Doña Marta' });
  await marta.getByRole('button', { name: 'Completar foto y GPS' }).click();
  await expect(marta.getByRole('button', { name: 'Tomar foto con GPS' })).toBeDisabled();
  await marta.getByLabel('Dio permiso para la foto').check();
  await marta.getByTestId('study-photo-input').setInputFiles({ name: 'puesto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await expect(page.getByRole('status')).toContainText('Foto de Doña Marta guardada y su punto de GPS.');
  const photo = api.all('/api/v1/bi/tinteros/t4', 'PATCH').at(-1);
  expect(photo.data.photo_url).toMatch(/\/estudio\/tinteros\/\d+-dona-marta\.jpg$/);
  expect(photo.data).toMatchObject({ photo_consent: true, lat: 4.6577, lng: -74.0634 });
  expect(errors).toEqual([]);
});

test('equipo: el botón de GPS marca al pasar un puesto (ficha sin nombre) y a alguien tomando tinto', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  await expect(page.getByTestId('study-tinto')).toHaveText('0');
  await page.getByTestId('spot-btn').click();
  await page.getByTestId('spot-tomando').click();
  await expect(page.getByRole('status')).toContainText('Alguien tomando tinto, marcado · ±9 m');
  await expect(page.getByTestId('study-tinto')).toHaveText('1');
  expect(api.find('/rest/v1/rpc/micra_sighting_add', 'POST').data).toMatchObject({ p_lat: 4.6577, p_lng: -74.0634, p_accuracy: 9 });

  await page.getByTestId('spot-btn').click();
  await page.getByTestId('spot-puesto').click();
  await expect(page.getByRole('status')).toContainText('Puesto marcado · ±9 m');
  expect(api.find('/api/v1/bi/tinteros', 'POST').data).toMatchObject({ notes: 'Marcado al pasar', lat: 4.6577, gps_accuracy_m: 9 });
  expect(api.find('/api/v1/bi/tinteros', 'POST').data.name).toMatch(/^Puesto · /);

  // El mapa de la barra abre el panel del mapa (personas, rutas y estudio)
  await page.getByTestId('tab-map').click();
  await expect(page).toHaveURL(/\/micra\/mapa$/);
  await expect(page.getByTestId('map-panel')).toBeVisible();
  expect(errors).toEqual([]);
});

test('equipo: sin la migración de avistamientos, «tomando tinto» queda en el celular', async ({ browser }) => {
  const { page, api } = await open(browser);
  api.micra.sightingsMissing = true;
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  await page.getByTestId('spot-btn').click();
  await page.getByTestId('spot-tomando').click();
  await expect(page.getByRole('status')).toContainText('Marcado en el celular');
  await expect(page.getByTestId('study-head')).toContainText('1 en el celular');
  await expect(page.getByTestId('study-tinto')).toHaveText('1');
});

test('equipo: la encuesta de una ficha y «Encuesta» de la barra abre la ficha rápida', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  const luis = page.getByRole('list', { name: 'Fichas del estudio' }).getByRole('listitem').filter({ hasText: 'Don Luis' });
  await luis.getByRole('button', { name: /encuest/ }).click();
  const enc = page.getByRole('dialog', { name: 'Encuesta de Don Luis' });
  await expect(enc).toBeVisible();
  // La misma encuesta de la ficha rápida: una pregunta por pantalla, y primero el permiso
  await expect(enc.getByRole('button', { name: 'Empezar' })).toBeDisabled();
  await enc.getByRole('button', { name: 'Cerrar' }).click();
  await expect(enc).toHaveCount(0);

  // La ficha rápida: la cámara primero (el GPS se lee solo), todo lo demás opcional
  await page.getByTestId('tab-survey').click();
  await expect(page).toHaveURL(/\/micra\/ficha$/);
  const flow = page.locator('.mff');
  await expect(flow).toHaveAttribute('data-screen', 'foto');
  await expect(flow.getByRole('button', { name: 'GPS ±9 m' })).toBeVisible();
  await flow.getByRole('button', { name: 'Sin foto ›' }).click();
  await expect(flow).toHaveAttribute('data-screen', 'quien');
  await flow.getByPlaceholder(/Don Jairo/).fill('Don Jairo');
  await flow.getByTestId('ficha-save').click();
  await expect(flow).toHaveAttribute('data-screen', 'extras');
  await expect(flow.getByRole('status')).toContainText('Don Jairo');
  expect(api.find('/api/v1/bi/tinteros', 'POST').data).toMatchObject({ name: 'Don Jairo', lat: 4.6577, gps_accuracy_m: 9 });
  // Sin su permiso de publicidad no hay tarjeta ni video; la encuesta sí, una pregunta por pantalla
  await expect(flow.getByTestId('extra-tarjeta')).toBeDisabled();
  await flow.getByTestId('extra-encuesta').click();
  await expect(page.getByTestId('survey-wizard')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await flow.getByTestId('ficha-new').click();
  await expect(flow).toHaveAttribute('data-screen', 'foto');

  // La cámara con filtros también está en su pestaña; al cerrarla se vuelve al estudio
  await page.goto('/micra/camara', { waitUntil: 'load' });
  await expect(page.locator('.mstudio.is-camera')).toHaveCount(1);
  await page.getByRole('button', { name: 'Cerrar la cámara' }).click();
  await expect(page).toHaveURL(/\/micra\/estudio$/);
  await expect(page.locator('.mstudio')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('equipo: la encuesta no se pierde: borrador al recargar, cola sin señal y «Subir ahora»', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  const row = () => page.getByRole('list', { name: 'Fichas del estudio' }).getByRole('listitem').filter({ hasText: 'Don Ernesto' });
  await row().getByRole('button', { name: 'Hacer encuesta' }).click();
  const enc = page.getByRole('dialog', { name: 'Encuesta de Don Ernesto' });
  await enc.getByLabel('Aceptó responder').check();
  await enc.getByRole('button', { name: 'Empezar' }).click();
  await expect(enc).toContainText('1 de ');
  await enc.getByRole('button', { name: 'Siguiente' }).click();
  await expect(enc).toContainText('2 de ');

  // Se recarga la página a media encuesta: la ficha ofrece seguirla, en la pregunta donde iba
  await page.reload({ waitUntil: 'load' });
  await row().getByRole('button', { name: 'Seguir la encuesta' }).click();
  await expect(enc).toContainText('2 de ');
  await expect(enc).toContainText('Seguimos donde ibas');

  // Sin señal al guardar: queda en el celular, y la ficha lo dice
  let down = true;
  await page.route('**/api/v1/bi/tinteros/*/surveys', (route) => (down ? route.abort('internetdisconnected') : route.fallback()));
  await enc.getByRole('button', { name: 'Guardar lo que hay' }).click();
  await expect(page.locator('.mapp-notice')).toContainText('Encuesta de Don Ernesto guardada en el celular');
  await expect(page.getByTestId('study-wait')).toContainText('1 encuesta en el celular');
  await expect(row()).toContainText('Encuesta en el celular, sin subir');
  await expect(row()).toContainText('Sin encuesta');
  expect(api.all('/api/v1/bi/tinteros/t6/surveys', 'POST')).toHaveLength(0);

  // Vuelve la señal: «Subir ahora» la manda con el permiso y la hora en que se hizo
  down = false;
  await page.getByTestId('study-wait').getByRole('button', { name: 'Subir ahora' }).click();
  await expect(page.locator('.mapp-notice')).toContainText('Subió lo que estaba en el celular: 1 encuesta.');
  await expect(page.getByTestId('study-wait')).toHaveCount(0);
  const sent = api.all('/api/v1/bi/tinteros/t6/surveys', 'POST');
  expect(sent).toHaveLength(1);
  expect(sent[0].data).toMatchObject({ consent: true });
  expect(sent[0].data.surveyed_at).toMatch(/^\d{4}-\d\d-\d\dT/);
  await expect(row()).not.toContainText('Sin encuesta');
  expect(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e))).toEqual([]);
});

test('equipo: «Cerca de mí» ordena las fichas por distancia y los filtros dejan lo pendiente', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  const fichas = page.getByRole('list', { name: 'Fichas del estudio' }).getByRole('listitem');
  await expect(fichas).toHaveCount(6);
  await page.getByTestId('study-near').click();
  await expect(page.getByTestId('study-near')).toHaveAttribute('aria-pressed', 'true');
  // Doña Rosa está en la salida de la 72, donde está el celular
  await expect(fichas.first()).toContainText('Doña Rosa');
  await expect(fichas.first()).toContainText('a 10 m · Salida de la 72');

  const filtros = page.getByRole('group', { name: 'Filtrar las fichas' });
  await filtros.getByRole('button', { name: /^Sin GPS/ }).click();
  await expect(fichas.filter({ hasText: 'Doña Rosa' })).toHaveCount(0);
  for (const li of await fichas.all()) await expect(li).toContainText('Sin GPS');
  await filtros.getByRole('button', { name: /^Todas · 6/ }).click();
  await expect(fichas).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('un barista sin equipo no ve el estudio ni la cámara del equipo', async ({ browser }) => {
  const { page } = await open(browser, { who: 'barista' });
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  await expect(page.getByRole('navigation', { name: 'Equipo' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Fichas del estudio' })).toHaveCount(0);
  await page.goto('/micra/camara', { waitUntil: 'load' });
  await expect(page.locator('.mapp-main')).toBeVisible();
  await expect(page.locator('.mstudio')).toHaveCount(0);
  // La cámara con filtros es solo del equipo: el barista tiene su perfil aparte (la cámara de su barra)
  await page.goto('/micra/video', { waitUntil: 'load' });
  await expect(page.locator('.mapp-main')).toBeVisible();
  await expect(page.locator('.mstudio')).toHaveCount(0);
});

test('el dueño en modo barista tampoco ve la ficha ni la encuesta en la cámara', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/video', { waitUntil: 'load' });
  await expect(page.locator('.mstudio.is-camera')).toHaveCount(1);
  await expect(page.locator('.mst-ticket')).toHaveCount(0);
  await expect(page.locator('.mst-tintero')).toHaveCount(0);
  await page.click('.mc-kinds button:has-text("Anuncio")');
  await expect(page.getByRole('option', { name: 'Tintero aliado' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar la cámara' }).click();
  await expect(page).toHaveURL(/\/micra\/barista$/);
  // En Equipo sí sigue la cámara completa, con la ficha
  await page.goto('/micra/camara', { waitUntil: 'load' });
  await expect(page.locator('.mst-tintero')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('equipo: «Tu trabajo» mide el estudio contra la propuesta en Estudio, Hoy y Mi perfil', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  const work = page.getByTestId('study-work');
  await expect(work).toContainText(/Propuesta de valor: \d de 7 cosas listas/);
  await expect(work.getByTestId('study-work-kpis')).toContainText('/20');
  await expect(work.getByTestId('study-work-pace')).toContainText('necesitas');
  await expect(work.getByTestId('study-work-needs').getByRole('progressbar')).toHaveCount(4);
  await expect(work.getByTestId('study-work-ready').getByRole('listitem')).toHaveCount(7);
  // En Equipo › Hoy, con el botón al estudio
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  await expect(page.getByTestId('study-work')).toBeVisible();
  await page.getByTestId('study-work-go').click();
  await expect(page).toHaveURL(/\/micra\/estudio$/);
  // En Mi perfil, corto
  await page.goto('/micra/equipo/perfil', { waitUntil: 'load' });
  await expect(page.getByTestId('study-work-compact')).toContainText(/de 20 encuestas/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  expect(errors).toEqual([]);
});
