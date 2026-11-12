// Celestra en Equipo › Hoy: el parte del día, las decisiones del dueño (su memoria),
// el tope del mes y las preguntas. /api/micra-agent va simulado aquí: el agente de
// verdad y su MCP se prueban en mcp/micra/micra.test.js y celestra.test.js.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const PARTE = {
  resumen: 'Hoy van 4 tazas y faltan 20 encuestas para 25.',
  propuestas: [
    { oficio: 'estudio', titulo: 'Encuestar en Usaquén', por_que: 'Usaquén tiene 3 fichas sin encuesta (n=6).', accion: 'Ir a las 10 con la ficha rápida' },
    { oficio: 'clientes', titulo: 'Avisar al barista que tarda', por_que: 'La entrega tarda 18 min de mediana (n=10).', accion: null },
    { oficio: 'mercado', titulo: 'Revisar el precio del tinto', por_que: 'La carga subió 1,4 %.', accion: 'Mirarlo el viernes' },
  ],
};

async function setup(browser, celestra) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  api.micra.baristas.forEach((b) => { delete b.mine; });
  if (celestra) api.micra.celestra = celestra;
  await signIn(page);
  return { page, api, errors };
}

test('con su memoria en la base: escribe el parte, el dueño decide y ve el gasto del mes', async ({ browser }) => {
  const { page, api, errors } = await setup(browser, { hoy: '2026-11-11', gastado_mes: 1.2345, corridas_mes: 7 });
  const asked = [];
  await page.route('**/api/micra-agent', async (route) => {
    const body = route.request().postDataJSON();
    asked.push({ body, auth: route.request().headers().authorization });
    // Como la API: guarda el parte en la base y devuelve el estado
    api.micra.celestra.parte = { day: '2026-11-11', resumen: PARTE.resumen, propuestas: PARTE.propuestas.map((p, i) => ({ ...p, id: `p${i + 1}`, pos: i + 1, estado: 'pendiente', nota: null })) };
    api.micra.celestra.gastado_mes = 1.3;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ parte: PARTE, saved: true, estado: { ...api.micra.celestra, decisiones: [] }, tools: ['encuestas_pendientes'], cost: 0.06 }) });
  });

  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const cel = page.getByTestId('owner-agent');
  await expect(cel.getByText('Celestra', { exact: true })).toBeVisible();
  await expect(cel.getByTestId('celestra-gasto')).toContainText('Este mes: US$1,23 de US$50,00');

  await cel.getByTestId('celestra-write').click();
  await expect(cel.getByTestId('celestra-prop')).toHaveCount(3);
  await expect(cel).toContainText(PARTE.resumen);
  await expect(cel).toContainText('Hoy: Ir a las 10 con la ficha rápida');
  expect(asked[0].body).toEqual({ action: 'parte' });
  expect(asked[0].auth).toMatch(/^Bearer /);
  await expect(cel.getByTestId('celestra-gasto')).toContainText('US$1,30');

  // Aprobar la primera; descartar la segunda con una nota (queda en su memoria)
  const props = cel.getByTestId('celestra-prop');
  await props.nth(0).getByRole('button', { name: 'Aprobar' }).click();
  await expect(props.nth(0)).toContainText('Aprobada');
  await props.nth(1).getByRole('button', { name: 'Descartar' }).click();
  await props.nth(1).getByLabel(/Por qué no/).fill('Ya hablé con él');
  await props.nth(1).getByRole('button', { name: 'Descartar' }).click();
  await expect(props.nth(1)).toContainText('Tu nota: Ya hablé con él');
  expect(api.micra.celestra.decisiones.map((d) => d.estado)).toEqual(['descartada', 'aprobada']);

  // Lo aprobado se marca como hecho después
  await props.nth(0).getByRole('button', { name: 'Ya la hice' }).click();
  await expect(props.nth(0)).toContainText('Hecha');

  // Al volver ese día, el parte sigue ahí y no se vuelve a pedir
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('celestra-prop')).toHaveCount(3);
  await expect(page.getByTestId('celestra-write')).toHaveCount(0);
  expect(asked).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('preguntas: ve la respuesta, qué leyó, sigue la conversación y el tope frena', async ({ browser }) => {
  const { page, errors } = await setup(browser, { hoy: '2026-11-11', gastado_mes: 2 });
  const asked = [];
  await page.route('**/api/micra-agent', async (route) => {
    const body = route.request().postDataJSON();
    asked.push(body);
    const answer = asked.length === 1 ? 'Hoy van 4 tazas: Marlene lleva 3.' : 'Wilson no ha salido.';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer, tools: ['dia_del_equipo', 'apartados'], model: 'm' }) });
  });

  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const cel = page.getByTestId('owner-agent');
  await cel.getByRole('button', { name: '¿Cómo vamos hoy?' }).click();
  await expect(cel.getByTestId('agent-turn')).toHaveCount(1);
  await expect(cel).toContainText('Hoy van 4 tazas: Marlene lleva 3.');
  await expect(cel).toContainText('Leyó: día del equipo, apartados');
  expect(asked[0]).toEqual({ question: '¿Cómo vamos hoy?', history: [] });

  await cel.getByTestId('agent-input').fill('¿Y quién no ha salido?');
  await cel.getByRole('button', { name: 'Preguntar' }).click();
  await expect(cel.getByTestId('agent-turn')).toHaveCount(2);
  expect(asked[1].history).toEqual([
    { role: 'user', content: '¿Cómo vamos hoy?' },
    { role: 'assistant', content: 'Hoy van 4 tazas: Marlene lleva 3.' },
  ]);

  // El tope del mes: la API lo dice y la tarjeta deja de pedir
  await page.unroute('**/api/micra-agent');
  await page.route('**/api/micra-agent', (route) => route.fulfill({ status: 429, contentType: 'application/json',
    body: JSON.stringify({ error: 'Celestra llegó al tope de US$50 de este mes. Vuelve el 1.º del mes que viene.', estado: { hoy: '2026-11-11', gastado_mes: 50.02, parte: null, decisiones: [] } }) }));
  await cel.getByTestId('agent-input').fill('hola');
  await cel.getByRole('button', { name: 'Preguntar' }).click();
  await expect(cel.getByRole('alert')).toContainText('llegó al tope de US$50');
  await expect(cel.getByTestId('celestra-gasto')).toContainText('llegó al tope');
  await expect(cel.getByTestId('celestra-write')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('sin la migración: el parte y lo decidido quedan en el celular y lo dice', async ({ browser }) => {
  const { page, errors } = await setup(browser, null);
  const asked = [];
  await page.route('**/api/micra-agent', async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ parte: PARTE, saved: false, estado: null, tools: [], cost: 0.05 }) });
  });

  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const cel = page.getByTestId('owner-agent');
  await expect(cel.getByTestId('celestra-gasto')).toContainText('solo en este celular');
  await cel.getByTestId('celestra-write').click();
  await expect(cel.getByTestId('celestra-prop')).toHaveCount(3);
  await cel.getByTestId('celestra-prop').nth(2).getByRole('button', { name: 'Ya la hice' }).click();
  await expect(cel.getByTestId('celestra-prop').nth(2)).toContainText('Hecha');
  expect(asked[0]).toEqual({ action: 'parte', decisions: [] });

  // Al recargar sigue el parte de hoy (del celular), sin volver a pagarlo
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('celestra-prop')).toHaveCount(3);
  await expect(page.getByTestId('celestra-prop').nth(2)).toContainText('Hecha');
  expect(asked).toHaveLength(1);

  // La API dice que es solo para el dueño
  await page.route('**/api/micra-agent', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Celestra es solo para el dueño.' }) }));
  await page.getByTestId('agent-input').fill('hola');
  await page.getByTestId('owner-agent').getByRole('button', { name: 'Preguntar' }).click();
  await expect(page.getByTestId('owner-agent').getByRole('alert')).toHaveText('Celestra es solo para el dueño.');
  expect(errors).toEqual([]);
});
