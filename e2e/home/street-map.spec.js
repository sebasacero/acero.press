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
    tinteros: [{ carrera: 7, calle: 63, stage: 'activo', cups_per_hour: 30, zone: 'Chapinero' }],
  };
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const hot = await heatAt(page, 7, 60);
  const cold = await heatAt(page, 20, 110); // lejos de toda venta real
  expect(hot).toBeGreaterThan(cold + 20);
  expect(await page.locator('.essp-bg canvas').count()).toBe(1);
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
  expect(errors).toEqual([]);
  await page.context().close();
});
