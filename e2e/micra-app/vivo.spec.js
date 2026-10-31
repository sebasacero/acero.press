// El mapa en vivo de Micra: el barista que sale a vender ve a los otros
// baristas en la calle, las zonas donde quieren café (2 o más señales) y las
// del estudio; el cliente manda su zona aproximada una vez cada 15 min.
// Supabase simulado (e2e/micra/fixtures.js, «Mapa en vivo»).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra-vivo.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
// El cliente en Chapinero: el punto exacto que nunca debe salir del celular
const HERE = { latitude: 4.64512, longitude: -74.06381, accuracy: 9 };

async function open(browser, { who = 'visitor', seed = SEED, gps = false } = {}) {
  const ctx = await browser.newContext(gps ? { ...PHONE, permissions: [...PHONE.permissions, 'geolocation'], geolocation: HERE } : PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(seed));
  // El refresco cada 30 s, en la prueba cada 0,6 s
  await page.addInitScript(() => { window.__micraLivePollMs = 600; });
  if (who === 'barista') {
    api.micra.admin = false;
    api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
    await signIn(page);
  } else if (who === 'team') {
    api.micra.baristas.forEach((b) => { delete b.mine; });
    await signIn(page);
  } else {
    api.micra.admin = false;
    await page.addInitScript(() => { localStorage.setItem('acero.consent', 'granted'); });
  }
  const liveCalls = () => api.calls.filter((c) => c.p.endsWith('/rpc/micra_live_map')).length;
  const seeks = () => api.calls.filter((c) => c.p.endsWith('/rpc/micra_seek'));
  return { page, api, errors, liveCalls, seeks };
}

const zonesOf = (page) => page.evaluate(() => {
  const z = document.querySelector('[data-testid="live-panel"] [data-testid="micra-map"]')?.__zones;
  return z ? { demand: z.demand.features.map((f) => f.properties.n), study: z.study.features.map((f) => f.properties.n) } : null;
});

test('barista: sale a vender y ve a los otros baristas y dónde quieren café; la flecha de volver apaga el mapa en vivo', async ({ browser }) => {
  const seed = structuredClone(SEED);
  delete seed.baristas[0].live_until;
  const { page, errors, liveCalls } = await open(browser, { who: 'barista', seed });
  await page.goto('/micra/barista', { waitUntil: 'load' });

  // Sin salir: la vista previa con la invitación, sin demanda
  const panel = page.getByTestId('live-panel');
  await expect(panel).toHaveAttribute('data-live', 'false');
  await expect(panel.getByTestId('live-nudge')).toHaveText('Sal a vender para ver quién busca café ahora');
  await expect(panel).toContainText('2 baristas en la calle');
  await expect.poll(() => zonesOf(page)).toEqual({ demand: [], study: [3, 2] });

  await page.getByTestId('mode-fijo').click();
  await page.getByTestId('go-out').click();
  await page.getByTestId('consent-location').check();
  await page.getByTestId('consent-accept').click();

  // En línea: el mapa grande con los otros dos, la cuenta y lo suyo aparte
  await expect(panel).toHaveAttribute('data-live', 'true');
  await expect(panel.getByTestId('live-count')).toHaveText('2 baristas en línea · 5 personas buscan café cerca');
  await expect(panel).toContainText('a ti te esperan 5 tazas');
  await expect(panel.getByRole('button', { name: 'Ver a Jairo' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Ver a Wilson' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Ver a Marlene' })).toHaveCount(0);
  await expect(panel.getByRole('list', { name: 'Qué muestra el mapa' })).toContainText('Quieren café');
  // Las zonas: dos de demanda (3 y 2); la de una sola señal y las viejas (más de 45 min) no salen
  await expect.poll(() => zonesOf(page)).toEqual({ demand: [3, 2], study: [3, 2] });
  const box = await panel.getByTestId('micra-map').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(320);

  // Se refresca solo mientras está en la calle
  const before = liveCalls();
  await expect.poll(liveCalls).toBeGreaterThanOrEqual(before + 2);

  // La flecha: vuelve la vista previa y deja de refrescar
  await page.getByRole('region', { name: 'Tu salida' }).getByRole('button', { name: 'Volver' }).click();
  await expect(panel).toHaveAttribute('data-live', 'false');
  await expect(panel.getByTestId('live-nudge')).toBeVisible();
  await expect(panel).toContainText('baristas en la calle');
  const after = liveCalls();
  // Tres vueltas del refresco de prueba sin pedir nada nuevo
  await page.evaluate(() => new Promise((r) => { setTimeout(r, 2000); }));
  expect(liveCalls()).toBe(after);
  expect(errors).toEqual([]);
});

test('barista: una zona con una sola señal no sale; con otra señal en la misma celda, sí', async ({ browser }) => {
  const seed = structuredClone(SEED);
  seed.pings = [{ lat: 4.646, lng: -74.062, drink: 'tinto', ref: 'solo-uno', ago: 2 }];
  const { page, api, errors } = await open(browser, { who: 'barista', seed });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  const panel = page.getByTestId('live-panel');
  await expect(panel.getByTestId('live-count')).toHaveText('2 baristas en línea · 0 personas buscan café cerca');
  await expect.poll(() => zonesOf(page)).toEqual({ demand: [], study: [3, 2] });
  // Llega otra persona a la misma celda: en el siguiente refresco aparece la zona
  api.micra.pings.push({ lat: 4.6461, lng: -74.0619, drink: 'perico', ref: 'otro-dos', ago: 1 });
  await expect(panel.getByTestId('live-count')).toHaveText('2 baristas en línea · 2 personas buscan café cerca');
  await expect.poll(() => zonesOf(page)).toEqual({ demand: [2], study: [3, 2] });
  expect(errors).toEqual([]);
});

test('cliente: «Cerca de mí» manda una sola señal con la celda, sin su punto ni su nombre; otra solo después de 15 min', async ({ browser }) => {
  const { page, errors, seeks } = await open(browser, { gps: true });
  await page.addInitScript(() => { localStorage.setItem('micra_name_v1', JSON.stringify('Sebas · 302')); });
  await page.goto('/micra', { waitUntil: 'load' });

  // Antes de pedir la ubicación, la línea que dice qué se comparte
  await expect(page.getByTestId('seek-note')).toContainText('tu zona aproximada (unos 400 m)');
  await expect(page.getByTestId('seek-note')).toContainText('Nunca tu ubicación exacta ni tu nombre');
  await page.getByRole('button', { name: '◎ Cerca de mí' }).click();
  await expect.poll(() => seeks().length).toBe(1);
  const sent = seeks()[0].data;
  expect(Object.keys(sent).sort()).toEqual(['p_cell_lat', 'p_cell_lng', 'p_drink', 'p_ref']);
  expect(sent).toMatchObject({ p_cell_lat: 4.646, p_cell_lng: -74.062, p_drink: 'all' });
  const raw = JSON.stringify(sent);
  expect(raw).not.toContain('4.6451');
  expect(raw).not.toContain('74.0638');
  expect(raw).not.toContain('Sebas');
  // La llave no es la de los apartados (cel-…): no une la señal con un apartado
  expect(sent.p_ref).toMatch(/^busco-/);

  // Con la ubicación ya dada, escoger una bebida dentro de los 15 min no manda otra
  const drinks = page.getByRole('group', { name: '¿Qué quieres tomar?' });
  await drinks.getByRole('button', { name: 'Perico' }).click();
  await expect(drinks.getByRole('button', { name: 'Perico' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => new Promise((r) => { setTimeout(r, 500); }));
  expect(seeks()).toHaveLength(1);

  // Pasaron 16 minutos: la siguiente bebida sí cuenta, con su bebida
  await page.evaluate(() => localStorage.setItem('micra_seek_at_v1', JSON.stringify(Date.now() - 16 * 60000)));
  await drinks.getByRole('button', { name: 'Tinto' }).click();
  await expect.poll(() => seeks().length).toBe(2);
  expect(seeks()[1].data).toMatchObject({ p_cell_lat: 4.646, p_cell_lng: -74.062, p_drink: 'tinto', p_ref: sent.p_ref });

  // «No mostrar mi zona»: ya no se manda nada
  await page.getByRole('button', { name: 'No mostrar mi zona' }).click();
  await expect(page.getByTestId('seek-note')).toContainText('No le muestras tu zona');
  await page.evaluate(() => localStorage.setItem('micra_seek_at_v1', JSON.stringify(Date.now() - 16 * 60000)));
  await drinks.getByRole('button', { name: 'Aromática' }).click();
  await expect(drinks.getByRole('button', { name: 'Aromática' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => new Promise((r) => { setTimeout(r, 500); }));
  expect(seeks()).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('equipo: ve el mismo mapa en vivo con todos los que salieron y las zonas', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'team' });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const panel = page.getByTestId('live-panel');
  await expect(panel).toHaveAttribute('data-live', 'true');
  await expect(panel).toContainText('En vivo · toda la calle');
  // Marlene, Jairo y Wilson; las zonas incluyen los apartados que esperan a Marlene (2)
  await expect(panel.getByTestId('live-count')).toHaveText('3 baristas en línea · 7 personas buscan café');
  await expect(panel.getByRole('button', { name: 'Ver a Marlene' })).toBeVisible();
  await expect.poll(() => zonesOf(page)).toEqual({ demand: [3, 2, 2], study: [3, 2] });
  expect(errors).toEqual([]);
});
