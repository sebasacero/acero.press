// Mi ruta (/ruta): el tintero enlaza su cuenta, acepta compartir su ubicación,
// camina y termina. El GPS es falso y lo mueve la prueba (window.__geo.walk),
// con la hora de cada lectura: así una parada de 4 minutos no tarda 4 minutos.
import { test, expect } from '@playwright/test';
import { openPage, PHONE } from '../micra/fixtures.js';

const DLAT = 1 / 110574; // un metro en grados de latitud

async function fakeGps(page) {
  await page.addInitScript(() => {
    const watchers = new Map();
    let n = 0;
    window.__geo = {
      watching: () => watchers.size,
      // [[segundos desde ahora, lat, lng, precisión]] en orden
      walk(steps) {
        const t0 = Date.now();
        for (const [s, lat, lng, acc = 8] of steps) {
          const pos = { timestamp: t0 + s * 1000, coords: { latitude: lat, longitude: lng, accuracy: acc } };
          for (const ok of watchers.values()) ok(pos);
        }
      },
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition(ok) { n += 1; watchers.set(n, ok); return n; },
        clearWatch(id) { watchers.delete(id); },
        getCurrentPosition() {},
      },
    });
  });
}

// 4 minutos en la portería de la Cra. 9 con 52 y 200 m caminando hacia el norte
const LAT = 4.6431;
const LNG = -74.0636;
const MORNING = [
  ...[0, 60, 120, 180, 240].map((s, i) => [s, LAT + (i % 2) * 4 * DLAT, LNG]),
  ...Array.from({ length: 10 }, (_, i) => [255 + i * 15, LAT + (i + 1) * 20 * DLAT, LNG]),
];

async function openRuta(browser, { linked = false, consent = false } = {}) {
  const ctx = await openPage(browser, { context: PHONE });
  if (linked) ctx.api.ruta.me = { id: 'tintero-1', name: 'Marlene Rojas', zone: 'Chapinero', consent_at: consent ? '2026-10-22T12:00:00Z' : null };
  await fakeGps(ctx.page);
  return ctx;
}

test('primera vez: código del enlace, permiso, recorrido con una parada y terminar', async ({ browser }) => {
  const { page, api, errors } = await openRuta(browser);
  await page.goto('/ruta?codigo=abc234', { waitUntil: 'load' });

  // El código llega escrito desde el enlace
  await expect(page.getByLabel('Código')).toHaveValue('ABC234');
  await page.getByRole('button', { name: 'Enlazar mi cuenta' }).click();

  // Permiso explícito antes de cualquier ubicación
  await expect(page.getByRole('heading', { name: 'Hola, Marlene.' })).toBeVisible();
  await expect(page.locator('.ruta-terms')).toContainText('Ley 1581 de 2012');
  expect(await page.evaluate(() => window.__geo.watching())).toBe(0);
  await page.getByRole('button', { name: 'Acepto compartir mi ubicación' }).click();

  await page.getByRole('button', { name: 'Empezar recorrido' }).click();
  await expect(page.getByRole('button', { name: 'Terminar recorrido' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__geo.watching())).toBe(1);

  await page.evaluate((steps) => window.__geo.walk(steps), MORNING);
  await expect(page.getByTestId('ruta-stops')).toHaveText('1');
  await expect(page.getByTestId('ruta-km')).toHaveText('0,2 km');
  await expect(page.locator('.ruta-gps')).toContainText('GPS con señal');

  await page.getByRole('button', { name: 'Terminar recorrido' }).click();
  await expect(page.getByRole('status')).toContainText('Recorrido guardado: 0,2 km y 1 parada.');
  // Todo subió, sin repetidos, y el resumen lleva la parada con su cuadra
  expect(api.ruta.points).toHaveLength(api.ruta.routes[0].points_n);
  expect(api.ruta.points.length).toBeGreaterThanOrEqual(13);
  expect(api.ruta.summary.stops).toHaveLength(1);
  expect(api.ruta.summary.stops[0].minutes).toBe(4);
  expect(api.ruta.summary.stops[0]).toHaveProperty('calle');
  expect(await page.evaluate(() => window.__geo.watching())).toBe(0);
  await expect(page.locator('.ruta-route')).toHaveCount(1);
  await expect(page.locator('.ruta-route')).toContainText('1 parada');
  expect(errors).toEqual([]);
});

test('sin señal: los puntos esperan en el teléfono, sobreviven a recargar la página y suben al terminar', async ({ browser }) => {
  const { page, api } = await openRuta(browser, { linked: true, consent: true });
  await page.goto('/ruta', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Empezar recorrido' }).click();
  await expect(page.getByRole('button', { name: 'Terminar recorrido' })).toBeVisible();

  api.ruta.down = true;
  await page.evaluate((steps) => window.__geo.walk(steps), MORNING);
  await expect(page.getByTestId('ruta-points')).toHaveText(/^1[3-5]$/);
  const kept = Number(await page.getByTestId('ruta-points').textContent());

  // Se cierra la app sin señal y se vuelve a abrir con señal: retoma el mismo recorrido
  api.ruta.down = false;
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByRole('button', { name: 'Terminar recorrido' })).toBeVisible();
  await expect(page.getByTestId('ruta-points')).toHaveText(String(kept));
  await page.getByRole('button', { name: 'Terminar recorrido' }).click();
  await expect(page.getByRole('status')).toContainText('Recorrido guardado');
  expect(api.ruta.routes).toHaveLength(1);
  expect(api.ruta.points).toHaveLength(kept);
});

test('sin señal al terminar: queda pendiente y se termina al volver la señal', async ({ browser }) => {
  const { page, api } = await openRuta(browser, { linked: true, consent: true });
  await page.goto('/ruta', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Empezar recorrido' }).click();
  await expect(page.getByRole('button', { name: 'Terminar recorrido' })).toBeVisible();
  await page.evaluate((steps) => window.__geo.walk(steps), MORNING.slice(0, 3));
  api.ruta.down = true;
  await page.getByRole('button', { name: 'Terminar recorrido' }).click();
  await expect(page.getByRole('alert')).toContainText('Toca «Terminar» otra vez cuando tengas señal.');
  api.ruta.down = false;
  await page.getByRole('button', { name: 'Terminar recorrido' }).click();
  await expect(page.getByRole('status')).toContainText('Recorrido guardado');
  expect(api.ruta.routes[0].ended_at).toBeTruthy();
});

test('código equivocado, borrar un recorrido y dejar de compartir', async ({ browser }) => {
  const { page, api } = await openRuta(browser);
  await page.goto('/ruta', { waitUntil: 'load' });
  await page.getByLabel('Código').fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Enlazar mi cuenta' }).click();
  await expect(page.getByRole('alert')).toContainText('Ese código no sirve');

  api.ruta.me = { id: 'tintero-1', name: 'Marlene Rojas', consent_at: '2026-10-22T12:00:00Z' };
  api.ruta.routes.push({ id: 'ruta-viejo', client_ref: 'ruta-viejo-1', started_at: '2026-10-22T11:30:00Z', ended_at: '2026-10-22T14:30:00Z', points_n: 300, distance_m: 3640, stops: [] });
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.ruta-route')).toContainText('3,6 km');
  await page.getByRole('button', { name: /Borrar el recorrido/ }).click();
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.locator('.ruta-route')).toHaveCount(0);
  expect(api.ruta.routes).toHaveLength(0);

  await page.getByRole('button', { name: 'Dejar de compartir mi ubicación' }).click();
  await page.getByRole('button', { name: 'Sí, dejar de compartir' }).click();
  await expect(page.getByRole('button', { name: 'Acepto compartir mi ubicación' })).toBeVisible();
});

test('sin sesión: entrar con Google, guardando el código para después', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await page.route(/supabase\.co/, (route) => route.abort());
  await page.goto('/ruta?codigo=ABC234', { waitUntil: 'load' });
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('micra_ruta_codigo'))).toBe('ABC234');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/ruta.webmanifest');
});

test('panel › Piloto: invitar a un tintero, sus recorridos en la lista y en el mapa', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } }, session: { coach: true } });
  const empty = { cups: 0, sales: 0, income: 0, blocks: 0, zones: [], kg: 0 };
  api.opts.piloto = {
    generatedAt: '2026-10-27T15:00:00-05:00', days: 90,
    week: { from: '2026-10-21', to: '2026-10-27', cur: empty, prev: empty },
    sales: [],
    tinteros: [
      { id: 't1', name: 'Marlene Rojas', stage: 'piloto', carrera: 9, calle: 52, zone: 'Chapinero', linked: true, tracking_consent_at: '2026-10-22T12:00:00Z' },
      { id: 't2', name: 'Don Jairo', stage: 'prospecto', carrera: 13, calle: 72, zone: 'Chapinero', linked: false },
      { id: 't3', name: 'Doña Luz', stage: 'prospecto', localidad: 'Kennedy', zone: 'Kennedy', formato: 'carrito', recorrido: 'ruta', hora_inicio: 5, hora_fin: 12, termos: 4, client_mix: 'fijos', client_types: ['obreros', 'taxistas'], payments_seen: ['efectivo', 'fiado'], linked: false },
    ],
    routes: [{
      id: 'r1', tintero_id: 't1', started_at: '2026-10-27T11:30:00Z', ended_at: '2026-10-27T15:10:00Z', points_n: 410, distance_m: 3640,
      stops: [{ lat: LAT, lng: LNG, from: '2026-10-27T11:30:00Z', to: '2026-10-27T11:41:00Z', minutes: 11, carrera: 9, calle: 52 }],
      path: [[LNG, LAT], [LNG, LAT + 300 * DLAT], [LNG - 0.002, LAT + 600 * DLAT]],
    }],
    routesReady: true,
    study: { surveyed: 2, with_photo: 0, consented: 0, tinto_price_avg: null, cups_per_hour_avg: null, zones: ['Chapinero'] },
  };
  await page.goto('/admin', { waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Piloto")');
  const list = page.getByRole('region', { name: 'Recorridos' });
  await expect(list).toContainText('Marlene Rojas');
  await expect(list).toContainText('220 min · 3,6 km · 1 parada');
  await expect(list).toContainText('11 min en Calle 52 con 9');
  await expect(page.locator('.piloto-geo')).toHaveAttribute('data-routes', '1');
  await expect(page.locator('.piloto-geo')).toHaveAttribute('data-stops', '1');

  // La ficha del estudio: localidad sin cuadra (sur), cómo vende y quién le compra
  const luz = page.locator('.piloto-tintero', { hasText: 'Doña Luz' });
  await expect(luz).toContainText('Kennedy');
  await expect(luz).toContainText('Carrito · hace una ruta · 5 a. m. a 12 m. · 4 termos');
  await expect(luz).toContainText('Casi todos fijos · obreros, taxistas · fía');
  const jairo = page.locator('.piloto-tintero', { hasText: 'Don Jairo' });
  await expect(page.locator('.piloto-tintero', { hasText: 'Marlene Rojas' })).toContainText('Usa Mi ruta');
  await jairo.getByRole('button', { name: 'Invitar a Mi ruta' }).click();
  await expect(jairo.getByTestId('invite-code')).toHaveText('K7M2QX');
  const wa = await jairo.getByRole('link', { name: 'Enviar por WhatsApp' }).getAttribute('href');
  expect(decodeURIComponent(wa)).toContain('/ruta?codigo=K7M2QX');
  expect(errors).toEqual([]);
});
