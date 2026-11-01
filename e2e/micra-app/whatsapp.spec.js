// Avisos por WhatsApp al barista (20261031210000_micra_whatsapp_alerts.sql y
// la Edge Function micra-notify, que se prueba en rules.test.js): el barista los
// activa en Vender o en Mi perfil › Permisos, y la app le dice a la base que
// tiene Micra abierta para no mandarle WhatsApp cuando ya ve el globito.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;

async function open(browser, { phone = '573001234567', missing = false } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.admin = false;
  api.micra.alertsMissing = missing;
  if (phone) api.micra.baristas[0].phone = phone;
  api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null };
  await signIn(page);
  return { page, api, errors };
}

test('barista: en Vender lo invitan a los avisos por WhatsApp y los activa; la app dice que Micra está abierta', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await expect.poll(() => api.micra.seenPings ?? 0).toBeGreaterThan(0);
  const nudge = page.getByTestId('wa-nudge');
  await expect(nudge).toContainText('¿Te avisamos por WhatsApp cuando te aparten?');
  await nudge.getByRole('button', { name: 'Activar' }).click();
  await expect(nudge).toHaveCount(0);
  expect(api.find('/rpc/micra_barista_alerts', 'POST') && api.all('/rpc/micra_barista_alerts').at(-1).data).toMatchObject({ p_on: true });
  expect(api.micra.baristas[0].wa_alerts).toBe(true);

  // En Mi perfil › Permisos se ve y se apaga
  await page.getByRole('button', { name: 'Mi perfil' }).click();
  await page.getByTestId('tile-permisos').click();
  await expect(page.getByTestId('profile-wa-state')).toContainText('Sí');
  await expect(page.getByTestId('profile-wa')).toContainText('300 ••• 4567');
  await page.getByTestId('profile-wa-toggle').click();
  await expect(page.getByTestId('profile-wa-state')).toHaveText('No');
  expect(api.micra.baristas[0].wa_alerts).toBe(false);
  expect(errors).toEqual([]);
});

test('barista: «Ahora no» guarda la invitación; sin celular registrado no hay invitación ni botón', async ({ browser }) => {
  const a = await open(browser);
  await a.page.goto('/micra/barista', { waitUntil: 'load' });
  await a.page.getByTestId('wa-nudge').getByRole('button', { name: 'Ahora no' }).click();
  await expect(a.page.getByTestId('wa-nudge')).toHaveCount(0);
  await a.page.reload({ waitUntil: 'load' });
  await expect(a.page.getByRole('button', { name: /Salí a vender|Volver/ }).first()).toBeVisible();
  await expect(a.page.getByTestId('wa-nudge')).toHaveCount(0);
  expect(a.errors).toEqual([]);

  const b = await open(browser, { phone: null });
  await b.page.goto('/micra/barista/perfil', { waitUntil: 'load' });
  await expect(b.page.getByTestId('wa-nudge')).toHaveCount(0);
  await b.page.getByTestId('tile-permisos').click();
  await expect(b.page.getByTestId('profile-wa')).toContainText('el equipo tiene que registrar tu celular');
  await expect(b.page.getByTestId('profile-wa-toggle')).toHaveCount(0);
  expect(b.errors).toEqual([]);
});

test('barista: sin la migración no sale nada de WhatsApp y la app sigue igual', async ({ browser }) => {
  const { page, errors } = await open(browser, { missing: true });
  await page.goto('/micra/barista', { waitUntil: 'load' });
  await expect(page.getByTestId('go-out').or(page.getByTestId('sellhead'))).toBeVisible();
  await expect(page.getByTestId('wa-nudge')).toHaveCount(0);
  expect(errors.filter((e) => !/micra_barista_(alerts|seen)|404/.test(e))).toEqual([]);
});
