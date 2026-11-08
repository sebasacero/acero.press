// La presencia digital de las fincas (presencia.js, Fincas.jsx, FincasPanel.jsx;
// 20261109090000_micra_finca_presencia.sql): la oferta para caficultores con su
// enlace de invitación, el paso «Tu finca en internet» que con permiso guarda las
// respuestas sin nombres, y el panel del equipo con la cifra, el sorteo y los enlaces.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));

async function open(browser, { who = 'visitor', fincas = [], missing = false } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.fincas = structuredClone(fincas);
  api.micra.fincasMissing = missing;
  if (who === 'team') { api.micra.baristas.forEach((b) => { delete b.mine; }); await signIn(page); } else api.micra.admin = false;
  await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>wa</title>' }));
  return { page, api, errors, ctx };
}

async function fillFinca(page) {
  await page.getByLabel('Tu nombre').fill('Rosalba Quintero');
  await page.getByLabel('Finca').fill('La Esperanza');
  await page.getByLabel('Municipio').fill('Pitalito, Huila');
  await page.getByTestId('finca-next').click();
  await page.getByLabel(/Altura/).fill('1750');
  await page.getByLabel(/Hectáreas/).fill('3,5');
  await page.getByLabel(/Desde qué año/).fill('2009');
  await page.getByTestId('finca-next').click();
  await page.getByLabel(/Kilos disponibles/).fill('40');
  await page.getByLabel(/Precio por kilo/).fill('48000');
  await page.getByTestId('finca-next').click();
}

test('caficultor: llega por la invitación de la muestra, cuenta qué tiene en internet y con permiso queda en el estudio sin su nombre', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/fincas?ref=coop-pitalito&m=1', { waitUntil: 'load' });
  const offer = page.getByTestId('fincas');
  await expect(offer.getByRole('heading', { level: 1 })).toHaveText('Tu finca en internet, con baristas que te compran');
  await expect(page.getByTestId('fincas-gap')).toContainText('1 a 3 de cada 100');
  await page.getByTestId('fincas-start').click();
  const w = page.getByTestId('finca');
  await expect(w).toContainText('paso 1 de 5');
  await fillFinca(page);
  await expect(w).toContainText('paso 4 de 5');
  await expect(w.getByRole('heading', { level: 1 })).toHaveText('Tu finca en internet');
  await page.getByTestId('finca-next').click();
  await expect(page.getByTestId('finca-missing')).toContainText('qué tiene tu finca en internet');
  const step = page.getByTestId('finca-internet');
  await step.getByRole('button', { name: 'WhatsApp en mi celular' }).click();
  await step.getByRole('button', { name: 'Instagram de la finca' }).click();
  await step.getByLabel(/Usuario de Instagram/).fill('@FincaLaEsperanza');
  await step.getByRole('radio', { name: 'A un comprador del pueblo' }).click();
  await step.getByRole('radio', { name: 'Sí' }).click();
  await step.getByLabel(/Acepto que Micra guarde/).check();
  await page.getByTestId('finca-next').click();
  await expect(w).toContainText('paso 5 de 5');
  await expect(page.getByTestId('finca-study-ok')).toBeVisible();
  await expect.poll(() => api.micra.fincas.length).toBe(1);
  const row = api.micra.fincas[0];
  expect(row).toMatchObject({ departamento: 'Huila', hectareas: 3.5, nivel: 2, canales: ['whatsapp', 'instagram'], venta: 'intermediario', interes: 'si', ig: 'fincalaesperanza', ref: 'coop-pitalito', muestra: true });
  expect(JSON.stringify(row)).not.toContain('Rosalba');
  const href = decodeURIComponent(await page.getByTestId('finca-send').getAttribute('href'));
  expect(href).toContain('En internet: whatsapp en mi celular, instagram de la finca (@fincalaesperanza)');
  expect(errors).toEqual([]);
});

test('caficultor: sin permiso no se guarda nada; la migración sin aplicar no rompe el final', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { missing: true });
  await page.goto('/micra/finca', { waitUntil: 'load' });
  await fillFinca(page);
  const step = page.getByTestId('finca-internet');
  await step.getByRole('button', { name: 'Nada de esto' }).click();
  await step.getByRole('radio', { name: 'A la cooperativa o la FNC' }).click();
  await step.getByRole('radio', { name: 'Tal vez' }).click();
  await page.getByTestId('finca-next').click();
  await expect(page.getByTestId('finca')).toContainText('paso 5 de 5');
  await expect(page.getByTestId('finca-send')).toBeVisible();
  await expect(page.getByTestId('finca-study-ok')).toHaveCount(0);
  expect(api.micra.fincas).toEqual([]);
  expect(errors).toEqual([]);
});

test('equipo: ve la cifra de la muestra con su margen, sortea una lista y arma el enlace de invitación', async ({ browser }) => {
  const fincas = [
    { departamento: 'Huila', nivel: 0, canales: ['ninguna'], venta: 'cooperativa', interes: 'si', muestra: true },
    { departamento: 'Huila', nivel: 1, canales: ['whatsapp'], venta: 'intermediario', interes: 'si', muestra: true },
    { departamento: 'Tolima', nivel: 2, canales: ['whatsapp', 'facebook'], venta: 'cooperativa', interes: 'tal_vez', muestra: true },
    { departamento: 'Nariño', nivel: 3, canales: ['instagram', 'web'], venta: 'marca', interes: 'no', muestra: false },
  ];
  const { page, errors } = await open(browser, { who: 'team', fincas });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const panel = page.getByTestId('fincas-panel');
  await expect(panel.getByTestId('fp-n')).toContainText('3 fincas de 203');
  await expect(panel.getByTestId('fp-cifras')).toContainText('33,3 %');
  await expect(panel.getByTestId('fp-cifras')).toContainText('En el país:');
  await panel.getByRole('tab', { name: 'Todas' }).click();
  await expect(panel.getByTestId('fp-n')).toContainText('4 fincas');
  await expect(panel.getByTestId('fp-cifras')).toContainText('50 %');

  await panel.getByTestId('fp-sorteo').locator('summary').click();
  await panel.getByTestId('fp-lista').fill('Finca La Cruz, 300 123 4567\nEl Mirador\nLa Piragua, 310 555 0000');
  await panel.getByTestId('fp-ref').fill('Coop Pitalito');
  await panel.getByTestId('fp-sortear').click();
  const out = panel.getByTestId('fp-sorteadas');
  await expect(out.getByRole('listitem')).toHaveCount(3);
  const link = out.getByRole('link', { name: 'WhatsApp ›' }).first();
  expect(decodeURIComponent(await link.getAttribute('href'))).toContain('/micra/fincas?ref=coop-pitalito&m=1');

  await panel.getByTestId('fp-enlace').locator('summary').click();
  await panel.getByTestId('fp-enlace').getByLabel('Código').fill('Feria Cafés Huila');
  await expect(panel.getByTestId('fp-url')).toHaveText(/\/micra\/fincas\?ref=feria-cafes-huila$/);
  expect(errors).toEqual([]);
});

test('equipo: sin la migración, el panel lo dice y el sorteo sigue sirviendo', async ({ browser }) => {
  const { page, errors } = await open(browser, { who: 'team', missing: true });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  await expect(page.getByTestId('fp-falta')).toContainText('20261109090000');
  await expect(page.getByTestId('fp-sorteo')).toBeVisible();
  expect(errors).toEqual([]);
});
