// El café de origen (Origen.jsx, Finca.jsx, origen.js; 7 nov 2026): el cliente ve marcas
// y fincas y arma su pedido en la tienda; el barista pide café por kilo en Insumos › Café
// y escoge con cuál prepara; el caficultor crea su finca en cinco pasos. Los datos salen
// de app_config `micra_origen` (aquí, de muestra).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE, TWO_COFFEES } from '../micra/fixtures.js';
import { DEMO_ORIGEN } from '../../src/features/micra-app/origen.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;

async function open(browser, { who = 'visitor', origen = DEMO_ORIGEN, coffee } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page, coffee ? { coffee } : {});
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.admin = false;
  if (origen) api.micra.config = { micra_origen: origen, micra_precio_carga: '2.900.000' };
  if (who === 'barista') {
    api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: '2026-10-20T15:00:00Z' };
    await signIn(page);
  }
  return { page, api, errors };
}

test('cliente: Marcas y fincas lista lo de app_config, filtra y abre el perfil de una finca con sus lotes', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/origen', { waitUntil: 'load' });
  const dir = page.getByTestId('origen');
  await expect(dir).toContainText('Amor Perfecto');
  await expect(dir).toContainText('Finca La Esperanza');
  await dir.getByRole('tab', { name: 'Fincas' }).click();
  await expect(dir).not.toContainText('Amor Perfecto');
  await dir.getByTestId('seller-la-esperanza').click();
  const seller = page.getByTestId('seller');
  await expect(seller.getByRole('heading', { level: 1 })).toHaveText('Finca La Esperanza');
  await expect(page.getByTestId('lots').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByTestId('lots')).toContainText('Probado por el equipo');
  await page.getByTestId('seller-shop').click();
  await expect(page.getByTestId('tienda')).toBeVisible();
  expect(errors).toEqual([]);
});

test('cliente: la pestaña Café pone las fincas por región en un carrusel y cada una con sus cafés debajo, como restaurantes', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/cafe', { waitUntil: 'load' });
  const dir = page.getByTestId('cafe-origen-dir');
  await expect(dir.locator('.mapp-oshelf')).toHaveCount(DEMO_ORIGEN.marcas.length + DEMO_ORIGEN.fincas.length);
  await expect(dir.getByTestId('origen-empty')).toHaveCount(0);
  await expect(dir.getByTestId('shelf-sample')).toHaveCount(0);
  // El carrusel de fincas y, debajo, la finca primero con sus dos cafés en fila
  await expect(page.getByTestId('cafe-farms').getByRole('button')).toHaveCount(DEMO_ORIGEN.fincas.length);
  const finca = dir.locator('.mapp-oshelf').first();
  await expect(finca.locator('.mapp-oshelf-head')).toContainText('Finca La Esperanza');
  await expect(finca.locator('.mapp-olot')).toHaveCount(2);
  await expect(finca).toContainText('$16.000');
  // Una región deja solo sus fincas
  await dir.getByRole('tab', { name: 'Huila' }).click();
  await expect(dir.locator('.mapp-oshelf')).toHaveCount(1);
  await dir.locator('.mapp-olot').first().click();
  await expect(page).toHaveURL(/\/micra\/origen\/la-esperanza$/);
  expect(errors).toEqual([]);
});

test('cliente: Café sin fincas: bolsas, «Crear mi finca» y cuatro espacios de muestra por región; con seis bolsas la página no se corre', async ({ browser }) => {
  // Seis bolsas, como en producción: la fila se desplaza dentro de su caja (en el iPhone empujaba la página)
  const six = [0, 1, 2].flatMap((n) => TWO_COFFEES.map((c) => ({ ...c, id: `${c.id}-${n}`, slug: `${c.slug}-${n}`, name: `${c.name} ${n}` })));
  const { page, errors } = await open(browser, { origen: null, coffee: six });
  await page.goto('/micra/cafe', { waitUntil: 'load' });
  const house = page.getByTestId('cafe-house');
  await expect(house.locator('.mapp-hcoffee')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const cta = page.getByTestId('cafe-finca-cta');
  expect(await house.evaluate((h, o) => !!(h.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING), await cta.elementHandle())).toBe(true);
  const dir = page.getByTestId('cafe-origen-dir');
  await expect(dir.getByTestId('origen-empty')).toContainText('Todavía no hay fincas');
  await expect(dir.getByTestId('shelf-sample')).toHaveCount(4);
  await expect(page.getByTestId('cafe-farms').getByRole('button')).toHaveCount(3);
  await dir.getByRole('tab', { name: 'Nariño' }).click();
  await expect(dir.getByTestId('shelf-sample')).toHaveCount(1);
  await dir.getByTestId('shelf-sample').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/micra\/finca$/);
  await page.goBack();
  await page.getByTestId('cafe-finca-cta').getByTestId('to-finca').click();
  await expect(page).toHaveURL(/\/micra\/fincas$/);
  expect(errors).toEqual([]);
});

test('cliente: sin app_config no hay marcas, solo el aviso y el camino del caficultor', async ({ browser }) => {
  const { page, errors } = await open(browser, { origen: null });
  await page.goto('/micra/origen', { waitUntil: 'load' });
  await expect(page.getByTestId('origen-empty')).toContainText('Todavía no hay');
  await expect(page.getByTestId('origen')).not.toContainText('Amor Perfecto');
  await page.getByTestId('to-finca').click();
  await page.getByTestId('fincas-start').click();
  await expect(page.getByTestId('finca')).toBeVisible();
  expect(errors).toEqual([]);
});

test('cliente: la tienda arma el pedido, abre la ficha del producto y lo manda por WhatsApp con su barista', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/tienda', { waitUntil: 'load' });
  const shop = page.getByTestId('shop');
  await expect(page.getByTestId('shop-cart')).toBeDisabled();
  await shop.getByRole('button', { name: 'Agregar Cold brew ACERO.press' }).click();
  await shop.getByRole('button', { name: 'Agregar Cold brew ACERO.press' }).click();
  await expect(page.getByTestId('qty-acero:coldbrew')).toHaveText('2');
  // La ficha del producto suma desde adentro y vuelve con la cantidad
  await page.getByTestId('shop-bolsa:la-esperanza:castillo:250').click();
  const sheet = page.getByTestId('product-sheet');
  await expect(sheet).toContainText('Castillo lavado 250 g');
  await sheet.getByRole('radio', { name: 'En grano' }).click();
  await sheet.getByRole('button', { name: /Agregar/ }).click();
  await expect(page.getByTestId('product-qty')).toHaveText('1');
  await page.getByTestId('product-done').click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId('shop-cart')).toContainText('$34.000');
  await page.getByTestId('shop-cart').click();
  const how = page.getByTestId('delivery-sheet');
  await expect(how).toContainText('¿Cómo lo recibes?');
  await how.getByTestId('delivery-recoger').click();
  const href = await page.getByTestId('shop-send').getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  const text = decodeURIComponent(href.split('text=')[1]);
  expect(text).toContain('2 × Cold brew ACERO.press');
  expect(text).toContain('Castillo lavado 250 g');
  expect(text).toContain('Castillo lavado 250 g (Finca La Esperanza), En grano');
  expect(text).toContain('Lo recojo en ACERO.press');
  expect(text).toContain('$34.000');
  expect(errors).toEqual([]);
});

test('barista: Insumos › Café muestra las marcas y fincas por kilo, pide por WhatsApp y guarda «Preparo con»', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'barista' });
  await page.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  await page.goto('/micra/barista/perfil', { waitUntil: 'load' });
  await expect(page.getByTestId('tile-prepara')).toContainText('Mi café');
  await page.getByTestId('tile-prepara').click();
  const sheet = page.getByTestId('insumos-sheet');
  await expect(sheet.getByRole('tab', { name: /Café/ })).toHaveAttribute('aria-selected', 'true');
  const coffee = page.getByTestId('insumos-coffee');
  await expect(coffee).toContainText('Finca La Esperanza · Castillo lavado');
  await expect(coffee).toContainText('$48.000 / kilo');
  await coffee.getByRole('button', { name: 'Agregar Finca La Esperanza · Castillo lavado' }).click();
  await coffee.getByRole('button', { name: 'Agregar Finca La Esperanza · Castillo lavado' }).click();
  await expect(page.getByTestId('insumo-lote:la-esperanza:castillo')).toHaveText('2');
  await page.getByTestId('prepara-lote:la-esperanza:castillo').click();
  await expect(page.getByTestId('prepara-lote:la-esperanza:castillo')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('insumos-sum')).toContainText('2 kilos · Finca La Esperanza · Castillo lavado ($96.000)');
  await page.getByTestId('insumos-send').click();
  const opened = await page.evaluate(() => window.__opened);
  expect(opened).toHaveLength(1);
  const text = decodeURIComponent(opened[0].split('text=')[1]);
  expect(text).toContain('• 2 kilos · Finca La Esperanza · Castillo lavado ($96.000)');
  await page.getByRole('button', { name: 'Cerrar' }).first().click().catch(() => {});
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('tile-prepara')).toContainText('Preparo con Finca La Esperanza');
  expect(errors).toEqual([]);
});

test('caficultor: la finca en cinco pasos exige lo mínimo, se queda en el celular y muestra el perfil', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/finca', { waitUntil: 'load' });
  const w = page.getByTestId('finca');
  await expect(w).toContainText('paso 1 de 5');
  await page.getByTestId('finca-next').click();
  await expect(page.getByTestId('finca-missing')).toContainText('Falta');
  await page.getByLabel('Tu nombre').fill('Rosalba Quintero');
  await page.getByLabel('Finca').fill('La Esperanza');
  await page.getByLabel('Municipio').fill('Pitalito, Huila');
  await page.getByTestId('finca-next').click();
  await expect(w).toContainText('paso 2 de 5');
  await page.getByLabel(/Altura/).fill('1750');
  await page.getByLabel(/Hectáreas/).fill('3,5');
  await page.getByLabel(/Desde qué año/).fill('2009');
  await page.getByTestId('finca-next').click();
  await expect(w).toContainText('paso 3 de 5');
  await page.getByRole('radio', { name: 'Castillo' }).click();
  await page.getByRole('radio', { name: 'Lavado' }).click();
  await page.getByLabel(/Kilos disponibles/).fill('40');
  await page.getByLabel(/Precio por kilo/).fill('48000');
  await expect(w).toContainText('La carga FNC hoy equivale a');
  await page.getByTestId('finca-next').click();
  await expect(w).toContainText('paso 4 de 5');
  await page.getByRole('button', { name: 'WhatsApp en mi celular' }).click();
  await page.getByRole('radio', { name: 'A la cooperativa o la FNC' }).click();
  await page.getByRole('radio', { name: 'Sí' }).click();
  await page.getByTestId('finca-next').click();
  await expect(w).toContainText('paso 5 de 5');
  await expect(w).toContainText('Castillo lavado');
  const href = await page.getByTestId('finca-send').getAttribute('href');
  expect(decodeURIComponent(href)).toContain('La Esperanza');
  expect(decodeURIComponent(href)).toContain('Pitalito, Huila');
  await page.getByTestId('finca-preview').click();
  const prev = page.getByTestId('finca-preview-page');
  await expect(prev.getByRole('heading', { level: 1 })).toHaveText('La Esperanza');
  await expect(prev).toContainText('3,5 ha');
  await expect(prev).toContainText('Esperando la prueba del equipo');
  // El borrador sobrevive a la recarga
  await page.goto('/micra/finca', { waitUntil: 'load' });
  await expect(page.getByLabel('Tu nombre')).toHaveValue('Rosalba Quintero');
  expect(errors).toEqual([]);
});
