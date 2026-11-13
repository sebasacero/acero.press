// «Terminar turno» en Vender (13 nov 2026): avisa lo que queda abierto, saca al
// barista del mapa y muestra el cierre del día. Las ventas de hoy no se borran.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra-vivo.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;

test('barista en la calle: «Terminar turno» avisa, lo saca del mapa y cierra el día', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.admin = false;
  api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
  await signIn(page);
  await page.goto('/micra/barista', { waitUntil: 'load' });

  const head = page.getByTestId('sellhead');
  await head.getByTestId('end-shift').click();
  const ask = page.getByTestId('end-ask');
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('apartadas');

  // «Seguir vendiendo» no cambia nada
  await ask.getByRole('button', { name: 'Seguir vendiendo' }).click();
  await expect(ask).toHaveCount(0);
  await expect(head).toBeVisible();

  await head.getByTestId('end-shift').click();
  await page.getByTestId('end-confirm').click();
  const done = page.getByTestId('end-done');
  await expect(done).toBeVisible();
  await expect(done).toContainText('Vendiste');
  await expect(page.getByTestId('sellhead')).toHaveCount(0);
  await expect.poll(() => api.calls.filter((c) => c.p.endsWith('/rpc/micra_barista_out')).length).toBeGreaterThan(0);

  await done.getByTestId('end-share').click();
  await expect(page.getByRole('dialog', { name: /día/i })).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});
