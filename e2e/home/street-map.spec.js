// El mapa de la portada dibuja el estudio de calle real (micra_street_map) y, vacío, su ejemplo.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

/** Calor promedio (rojo frente a azul) en una ventana del canvas del mapa alrededor de una cuadra. */
const heatAt = (page, carrera, calle) => page.evaluate(([c, k]) => {
  const canvas = document.querySelector('.essp-bg canvas');
  const ctx = canvas.getContext('2d');
  // Misma proyección que drawBogotaMap para la vista ancha: c=12, k=82, ax=.8, ay=.5, s=max(8, w/150)
  const W = canvas.clientWidth; const H = canvas.clientHeight; const dpr = canvas.width / W;
  const s = Math.max(8, W / 150);
  const x = (W * 0.8 + (12 - c) * s) * dpr; const y = (H * 0.5 + (82 - k) * s) * dpr;
  const d = ctx.getImageData(Math.round(x) - 6, Math.round(y) - 6, 12, 12).data;
  let r = 0; let b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; b += d[i + 2]; }
  return (r - b) / (d.length / 4);
}, [carrera, calle]);

test('con ventas y tinteros reales, el calor sigue a las cuadras del estudio y los pines no llevan nombres', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } } });
  api.opts.streetMap = {
    days: 90,
    sales: [{ carrera: 7, calle: 60, cups: 40, zone: 'Chapinero' }],
    tinteros: [
      { carrera: 7, calle: 63, stage: 'activo', cups_per_hour: 30, zone: 'Chapinero' },
      // La ficha de la calle guarda el GPS y no la cuadra: también cuenta y también tiene pin
      { carrera: null, calle: null, lat: 4.668, lng: -74.054, stage: 'prospecto', zone: 'Chapinero' },
    ],
  };
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const hot = await heatAt(page, 7, 60);
  const cold = await heatAt(page, 20, 110); // lejos de toda venta real
  expect(hot).toBeGreaterThan(cold + 20);
  expect(await page.locator('.essp-bg canvas').count()).toBe(1);
  // El panel y el celular del banner cuentan lo real: tazas, cuadras y tinteros; nada inventado
  const slide = page.locator('.essp-slide').first();
  await expect(slide.locator('.essp-panel')).toContainText('1 cuadra');
  await expect(slide.locator('.essp-odo')).toHaveText('40');
  await expect(slide.locator('.essp-phone-who')).toContainText('40 tazas en la calle');
  await expect(slide.locator('.essp-phone-who')).toContainText('1 cuadras · 2 baristas');
  await expect(slide.locator('.essp-panel .essp-badge')).toHaveText('DATOS REALES');
  await expect(slide.locator('.essp-title')).toContainText('El tintotiene ruta.');
  await expect(page.locator('.essp-hero')).not.toContainText(/domicilio|Recibir pedidos/i);
  await expect(page.locator('.essp-hero')).not.toContainText(/Laura|en camino/i);
  await expect(slide.locator('.essp-ctas a').first()).toHaveAttribute('href', '#beans');
  // Orden del inicio: tienda, barra, archivo WAC y recetas antes de Micra (#prensado) y el pie
  const order = await page.evaluate(() => ['#beans', '#metodo', '#prensado'].map((id) => document.querySelector(id)?.getBoundingClientRect().top + window.scrollY));
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('sin estudio, el mapa dibuja su demanda de ejemplo (la Zona T sigue caliente)', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } } });
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const sampleHot = await heatAt(page, 13, 83); // punto de la demanda de ejemplo
  const cold = await heatAt(page, 45, 150);
  expect(sampleHot).toBeGreaterThan(cold + 20);
  // Sin estudio aún, el panel dice 0 de verdad, no un ejemplo
  await expect(page.locator('.essp-slide').first().locator('.essp-panel')).toContainText('0 cuadras');
  // …y como el calor es de ejemplo, el panel no dice «datos reales»
  await expect(page.locator('.essp-slide').first().locator('.essp-panel .essp-badge')).toHaveText('MAPA DE EJEMPLO');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('el banner no avanza solo; «Soy barista» lleva a la pestaña del barista con WhatsApp listo', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } } });
  await page.clock.install();
  await page.goto('/', { waitUntil: 'load' });
  const tabs = page.locator('.essp-tabs').first().getByRole('tab');
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  // Un carrusel que avanza solo se ignora (NN/g): pasado el tiempo de antes (8 s) sigue en el mapa
  await page.clock.runFor(20000);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await page.locator('.essp-slide').first().getByRole('button', { name: 'Soy barista' }).click();
  // La diapositiva que se va queda inerte: las pestañas que se leen son las de la que llega
  await expect(page.locator('.essp-slide').nth(1).getByRole('tab', { name: 'Para baristas' })).toHaveAttribute('aria-selected', 'true');
  const wa = page.locator('.essp-slide').nth(1).getByRole('link', { name: 'Quiero participar' });
  await expect(wa).toHaveAttribute('href', /wa\.me\/\d+\?text=.*ruta/);
  expect(errors).toEqual([]);
  await page.context().close();
});
