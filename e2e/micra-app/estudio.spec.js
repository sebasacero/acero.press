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
  await expect(tabs.getByRole('button')).toHaveText(['Hoy', 'Estudio', 'Cámara']);
  await tabs.getByRole('button', { name: 'Estudio' }).click();
  await expect(page).toHaveURL(/\/micra\/estudio$/);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Baristas en la calle');
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

test('equipo: la encuesta de una ficha y «Registrar un barista» abre la cámara con la ficha', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  const luis = page.getByRole('list', { name: 'Fichas del estudio' }).getByRole('listitem').filter({ hasText: 'Don Luis' });
  await luis.getByRole('button', { name: /encuest/ }).click();
  const enc = page.getByRole('dialog', { name: 'Encuesta de Don Luis' });
  await expect(enc).toBeVisible();
  await expect(enc.getByRole('button', { name: 'Guardar encuesta' })).toBeDisabled();
  await enc.getByRole('button', { name: 'Cerrar' }).click();
  await expect(enc).toHaveCount(0);

  // La ficha rápida: la cámara primero (el GPS se lee solo), todo lo demás opcional
  await page.getByRole('button', { name: 'Registrar un barista' }).click();
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

test('un barista sin equipo no ve el estudio ni la cámara del equipo', async ({ browser }) => {
  const { page } = await open(browser, { who: 'barista' });
  await page.goto('/micra/estudio', { waitUntil: 'load' });
  await expect(page.getByRole('navigation', { name: 'Equipo' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Fichas del estudio' })).toHaveCount(0);
  await page.goto('/micra/camara', { waitUntil: 'load' });
  await expect(page.locator('.mapp-main')).toBeVisible();
  await expect(page.locator('.mstudio')).toHaveCount(0);
  // Pero sí tiene la cámara con filtros para sus redes: sin venta, sin ficha, sin publicar en ACERO
  // (este barista del simulador no tiene día enlazado: se entra por la ruta, que es la del botón de su inicio)
  await page.goto('/micra/video', { waitUntil: 'load' });
  await expect(page.locator('.mstudio.is-camera')).toHaveCount(1);
  await expect(page.locator('.mst-ticket')).toHaveCount(0);
  await expect(page.locator('.mst-tintero')).toHaveCount(0);
  // Ni el modelo de anuncio «Tintero aliado», que es solo del equipo
  await page.click('.mc-kinds button:has-text("Anuncio")');
  await expect(page.getByRole('option', { name: 'Promo' })).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Tintero aliado' })).toHaveCount(0);
  await expect(page.locator('.mc-text', { hasText: /tintero/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar la cámara' }).click();
  await expect(page).toHaveURL(/\/micra\/barista$/);
});
