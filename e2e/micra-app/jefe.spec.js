// «Jefe de turno» en Equipo › Hoy: el dueño pregunta y /api/micra-agent responde
// (aquí simulado: el agente de verdad y su MCP se prueban en mcp/micra/micra.test.js).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));

test('equipo: le pregunta al Jefe de turno, ve la respuesta, qué leyó y sigue la conversación', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.baristas.forEach((b) => { delete b.mine; });
  await signIn(page);

  const asked = [];
  await page.route('**/api/micra-agent', async (route) => {
    const body = route.request().postDataJSON();
    asked.push({ body, auth: route.request().headers().authorization });
    const answer = asked.length === 1 ? 'Hoy van 4 tazas: Marlene lleva 3.' : 'Wilson no ha salido.';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer, tools: ['dia_del_equipo'], model: 'm' }) });
  });

  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const jefe = page.getByTestId('owner-agent');
  await jefe.getByRole('button', { name: '¿Cómo vamos hoy?' }).click();
  await expect(jefe.getByTestId('agent-turn')).toHaveCount(1);
  await expect(jefe).toContainText('Hoy van 4 tazas: Marlene lleva 3.');
  await expect(jefe).toContainText('Leyó: día del equipo');
  expect(asked[0].body).toEqual({ question: '¿Cómo vamos hoy?', history: [] });
  expect(asked[0].auth).toMatch(/^Bearer /);

  // La segunda pregunta lleva la primera como historial
  await jefe.getByTestId('agent-input').fill('¿Y quién no ha salido?');
  await jefe.getByRole('button', { name: 'Preguntar' }).click();
  await expect(jefe.getByTestId('agent-turn')).toHaveCount(2);
  expect(asked[1].body.history).toEqual([
    { role: 'user', content: '¿Cómo vamos hoy?' },
    { role: 'assistant', content: 'Hoy van 4 tazas: Marlene lleva 3.' },
  ]);

  // Un error del servidor se dice en la tarjeta
  await page.unroute('**/api/micra-agent');
  await page.route('**/api/micra-agent', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'El Jefe de turno es solo para el dueño.' }) }));
  await jefe.getByTestId('agent-input').fill('hola');
  await jefe.getByRole('button', { name: 'Preguntar' }).click();
  await expect(jefe.getByRole('alert')).toHaveText('El Jefe de turno es solo para el dueño.');
  expect(errors).toEqual([]);
});
