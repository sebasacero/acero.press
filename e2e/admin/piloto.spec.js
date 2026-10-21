// «Piloto»: la página de la reunión. Datos reales de /api/v1/bi/piloto, fotos firmadas del bucket privado.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const FILLED = {
  generatedAt: '2026-10-22T15:00:00-05:00', days: 90,
  week: {
    from: '2026-10-16', to: '2026-10-22',
    cur: { cups: 48, sales: 31, income: 168000, blocks: 3, zones: ['Chapinero', 'Zona T'], kg: 0.86 },
    prev: { cups: 40, sales: 25, income: 140000, blocks: 2, zones: ['Chapinero'], kg: 0.72 },
  },
  sales: [
    { id: 's1', at: '2026-10-22T13:10:00Z', total: 7000, cups: 2, what: 'Castillo taza', carrera: 13, calle: 85, zone: 'Zona T' },
    { id: 's2', at: '2026-10-21T12:00:00Z', total: 3500, cups: 1, what: 'Geisha taza', carrera: 13, calle: 72, zone: 'Chapinero' },
  ],
  tinteros: [
    { id: 't1', name: 'Don Jairo', stage: 'prospecto', carrera: 13, calle: 72, zone: 'Chapinero', tinto_price: 1500, cups_per_hour: 25, photo_consent: true, photo_url: 'https://mock.supabase.co/storage/v1/object/public/estudio/tinteros/1-don-jairo.jpg', notes: 'Termo de 10 L' },
    { id: 't2', name: 'Carrito de la 83', stage: 'activo', carrera: 13, calle: 83, zone: 'Zona T', tinto_price: 2000, cups_per_hour: 30, photo_consent: false, photo_url: null },
  ],
  study: { surveyed: 2, with_photo: 1, consented: 1, tinto_price_avg: 1750, cups_per_hour_avg: 27.5, zones: ['Chapinero', 'Zona T'] },
};

async function openPiloto(page) {
  await page.goto('/admin', { waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Piloto")');
  await expect(page.locator('.piloto .esp-title')).toHaveText('Piloto.');
}

test('con datos: KPIs de la semana, mapa real, ventas con cuadra y hora, y la foto del tintero viene firmada del bucket privado', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } }, session: { coach: true } });
  api.opts.piloto = FILLED;
  await openPiloto(page);
  const kpis = page.locator('.dash-kpis');
  await expect(kpis).toContainText('48');
  await expect(kpis).toContainText('▲ 20 % vs. 40 la semana anterior');
  await expect(kpis).toContainText('$168.000');
  await expect(kpis).toContainText('0,86 kg de café');
  await expect(kpis).toContainText('Chapinero · Zona T');
  await expect(kpis).toContainText('1 con foto · tinto a $1.750 · 27.5 tazas/h');

  // Mapa real (MapLibre): calor de 2 cuadras con venta y un pin por tintero, con su ficha al tocarlo
  const geo = page.locator('.piloto-geo');
  await expect(geo).toHaveAttribute('data-state', 'ready');
  await expect(geo).toHaveAttribute('data-style', 'vector');
  await expect(geo).toHaveAttribute('data-sales', '2');
  await expect(geo).toHaveAttribute('data-tinteros', '2');
  await expect(geo.locator('canvas.maplibregl-canvas')).toHaveCount(1);
  await expect(geo.getByRole('button', { name: 'Tintero: Don Jairo · 25/h' })).toBeVisible();
  await expect(geo.locator('.piloto-pin.is-active')).toContainText('Carrito de la 83');
  await geo.getByRole('button', { name: 'Tintero: Don Jairo · 25/h' }).click();
  await expect(page.locator('.piloto-popup')).toContainText('Calle 72 con 13 · Chapinero');
  await expect(page.locator('.piloto-popup')).toContainText('Prospecto · tinto a $1.500 · 25 tazas/h');
  await expect(page.locator('.piloto-map')).not.toContainText('todavía sin puntos');
  await expect(page.locator('.piloto-map')).toContainText('ventas y tinteros de los últimos 90 días');

  // Ventas: cuadra, hora de Bogotá, tazas y monto
  const sales = page.locator('section[aria-label="Ventas con lugar"]');
  await expect(sales).toContainText('Calle 85 con 13 · Zona T');
  await expect(sales).toContainText('2 tazas · $7.000');
  await expect(sales).toContainText('1 taza · $3.500');

  // Tinteros: ficha; la foto con permiso se pide firmada; sin permiso no se pide
  const tint = page.locator('section[aria-label="Tinteros"]');
  await expect(tint).toContainText('Don Jairo');
  await expect(tint).toContainText('Prospecto · tinto a $1.500 · 25 tazas/h');
  await expect(tint).toContainText('Termo de 10 L');
  await expect(tint.getByRole('img', { name: 'Puesto de Don Jairo' })).toHaveAttribute('src', /object\/sign\/estudio\/tinteros\/1-don-jairo\.jpg\?token=firmado/);
  await expect(tint).toContainText('Sin permiso de foto');
  // Una sola petición firmada por foto con permiso (ni una por el tintero sin permiso, ni repetidas)
  expect(api.calls.filter((c) => c.p.includes('/object/sign/'))).toHaveLength(1);
  // La API se llamó con la sesión y la ventana por defecto
  expect(errors).toEqual([]);
  await page.context().close();
});

test('sin datos: lo dice claro y explica cómo se llena', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } }, session: { coach: true } });
  await openPiloto(page);
  await expect(page.locator('.dash-kpis')).toContainText('Registra el primero desde Micra › Tintero');
  await expect(page.locator('.piloto-map')).toContainText('El mapa se llena solo');
  await expect(page.locator('section[aria-label="Ventas con lugar"]')).toContainText('Aún no hay ventas con lugar');
  await expect(page.locator('section[aria-label="Tinteros"]')).toContainText('Aún no hay tinteros');
  await expect(page.locator('.piloto-geo')).toHaveAttribute('data-state', 'ready'); // el mapa se dibuja igual, centrado en Chapinero
  await expect(page.locator('.piloto-pin')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('si OpenFreeMap no responde, el mapa usa OpenStreetMap y sigue mostrando los datos', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } }, session: { coach: true } });
  api.opts.piloto = FILLED;
  api.opts.styleDown = true;
  await openPiloto(page);
  const geo = page.locator('.piloto-geo');
  await expect(geo).toHaveAttribute('data-style', 'osm');
  await expect(geo).toHaveAttribute('data-state', 'ready');
  await expect(geo.locator('.piloto-pin')).toHaveCount(2);
  // El único error aceptado es el del estilo caído, que es lo que se simula
  expect(errors.filter((e) => !/AJAXError|503/.test(e))).toEqual([]);
  await page.context().close();
});

test('sin WebGL queda el mapa ilustrado con los mismos datos', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } }, session: { coach: true } });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); };
  });
  api.opts.piloto = FILLED;
  await openPiloto(page);
  const geo = page.locator('.piloto-geo');
  await expect(geo).toHaveAttribute('data-state', 'fallback');
  await expect(geo.locator('canvas')).toHaveCount(1);
  await expect(geo.locator('.maplibregl-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('el mapa real se viste como la app: plano por defecto, noche y calles, y recuerda la elección', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } }, session: { coach: true } });
  api.opts.piloto = FILLED;
  await openPiloto(page);
  const geo = page.locator('.piloto-geo');
  await expect(geo).toHaveAttribute('data-state', 'ready');
  const paint = (layer, prop) => page.evaluate(([l, p]) => document.querySelector('.piloto-geo-map').__map.getPaintProperty(l, p), [layer, prop]);
  // Plano: papel, tinta azul en la autopista, sin el borde naranja; retícula de hoja encima
  await expect(geo).toHaveAttribute('data-theme', 'plano');
  await expect.poll(() => paint('background', 'background-color')).toBe('#EDE6D3');
  expect(await paint('road_motorway', 'line-color')).toBe('#2A3550');
  expect(await paint('road_motorway_casing', 'line-opacity')).toBe(0);
  expect(await paint('water', 'fill-color')).toBe('#C9D3DC');
  await expect(geo.locator('.piloto-geo-sheet')).toHaveCount(1);
  // El calor del estudio sigue ahí después de vestir el mapa
  expect(await page.evaluate(() => !!document.querySelector('.piloto-geo-map').__map.getLayer('ventas-calor'))).toBe(true);

  const themes = geo.getByRole('group', { name: 'Estilo del mapa' });
  await themes.getByRole('button', { name: 'Noche' }).click();
  await expect(geo).toHaveAttribute('data-theme', 'noche');
  await expect.poll(() => paint('background', 'background-color')).toBe('#141518');
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.piloto-geo-map').__map.getLayer('ventas-calor'))).toBe(true);
  await expect(geo.locator('.piloto-pin')).toHaveCount(2); // los pines no se duplican ni se pierden

  await themes.getByRole('button', { name: 'Calles' }).click();
  await expect.poll(() => paint('background', 'background-color')).toBe('#efe9dc');
  expect(await paint('road_motorway', 'line-color')).toBe('#fc8');
  await expect(geo.locator('.piloto-geo-sheet')).toHaveCount(0);

  // Se recuerda al volver
  await page.reload({ waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Piloto")');
  await expect(page.locator('.piloto-geo')).toHaveAttribute('data-theme', 'calles');
  expect(errors).toEqual([]);
  await page.context().close();
});
