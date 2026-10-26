// Micra en la portada: qué es, sus cuatro frentes y el estudio de calle con las cifras reales
// (micra_street_map); vacío, dice que aún no hay datos y el mapa del celular es de ejemplo.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const DESK = { viewport: { width: 1440, height: 900 } };

test('con ventas y baristas reales, las cifras salen en el frente de hoy y en el celular, sin nombres', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: DESK });
  api.opts.streetMap = {
    days: 90,
    sales: [{ carrera: 7, calle: 60, cups: 40, zone: 'Chapinero' }],
    tinteros: [
      { carrera: 7, calle: 63, stage: 'activo', cups_per_hour: 30, zone: 'Chapinero' },
      // La ficha de la calle guarda el GPS y no la cuadra: también cuenta
      { carrera: null, calle: null, lat: 4.668, lng: -74.054, stage: 'prospecto', zone: 'Chapinero' },
    ],
  };
  await page.goto('/', { waitUntil: 'load' });
  const micra = page.locator('#micra');
  await micra.scrollIntoViewIfNeeded();
  await expect(micra.getByRole('heading', { level: 2 })).toContainText('Micra.');
  await expect(micra.locator('.essp-script').first()).toHaveText('la app que fomenta el barismo');
  // Los cuatro frentes, cada uno con lo que es hoy: nada se da por hecho
  const steps = micra.locator('.micra-steps > li');
  await expect(steps).toHaveCount(4);
  await expect(steps.locator('.micra-step-badge')).toHaveText(['HOY', 'EN DISEÑO', 'PRÓXIMAMENTE', 'BUSCAMOS ALIADOS']);
  await expect(steps.nth(2)).toContainText('Certificación');
  const stats = micra.locator('.micra-stats');
  await expect(stats.locator('dd')).toHaveText(['40', '1', '2']);
  await expect(stats.locator('.essp-badge')).toHaveText('DATOS REALES');
  await expect(micra.locator('.essp-phone-who')).toContainText('40 tazas en la calle');
  await expect(micra.locator('.essp-phone-who')).toContainText('1 cuadras · 2 baristas');
  // En público se dice «baristas»; ni domicilios ni nombres
  await expect(micra).not.toContainText(/tintero|domicilio|Laura|en camino/i);
  // Un aliado no se nombra antes de serlo
  await expect(page.locator('body')).not.toContainText(/Amor Perfecto/i);
  // Los llamados: WhatsApp con el mensaje listo y la Escuela
  await expect(micra.getByRole('link', { name: 'Vendo café en la calle' })).toHaveAttribute('href', /wa\.me\/\d+\?text=.*Micra/);
  await expect(micra.getByRole('link', { name: 'Soy tostador: hablemos →' })).toHaveAttribute('href', /wa\.me\/\d+\?text=.*tostadora/);
  await expect(micra.getByRole('link', { name: 'Empezar la Escuela', exact: true })).toHaveAttribute('href', '/escuela');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('sin estudio aún, dice que no hay datos y el celular marca su mapa como de ejemplo', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/', { waitUntil: 'load' });
  const micra = page.locator('#micra');
  await expect(micra.locator('.micra-stats dd')).toHaveText(['0', '0', '0']);
  await expect(micra.locator('.micra-stats .essp-badge')).toHaveText('SIN DATOS AÚN');
  await expect(micra.locator('.essp-phone-badge')).toHaveText('MAPA DE EJEMPLO');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('los enlaces viejos a /#tinteros llegan a Micra', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: DESK });
  await page.goto('/#tinteros', { waitUntil: 'load' });
  await expect.poll(() => page.evaluate(() => {
    const b = document.getElementById('micra').getBoundingClientRect();
    return b.top < window.innerHeight && b.bottom > 0;
  }), { timeout: 10000 }).toBe(true);
  expect(errors).toEqual([]);
  await page.context().close();
});
