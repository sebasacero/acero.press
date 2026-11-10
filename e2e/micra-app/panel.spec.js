// El panel del mapa del equipo (/micra/mapa): personas conectadas, rutas y
// estudio de calle en un mapa. Supabase y la API de BI simulados
// (e2e/micra/fixtures.js); datos en e2e/data/panel-mapa.json con horas
// relativas («now-90m»).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const VIVO = JSON.parse(readFileSync(new URL('../data/micra-vivo.json', import.meta.url), 'utf8'));
const PANEL = JSON.parse(readFileSync(new URL('../data/panel-mapa.json', import.meta.url), 'utf8'));

async function open(browser, { team = true, viewport } = {}) {
  const page = await (await browser.newContext(viewport ? { viewport } : PHONE)).newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(VIVO));
  api.micra.baristas.forEach((b) => { delete b.mine; });
  api.opts.piloto = structuredClone(PANEL);
  if (!team) api.micra.admin = false;
  await page.addInitScript(() => { window.__micraPanelPollMs = 500; });
  await signIn(page);
  return { page, api, errors };
}

test('equipo: el panel muestra a todos, sus rutas y el estudio, y se refresca solo', async ({ browser }) => {
  const { page, api, errors } = await open(browser);
  await page.goto('/micra/mapa', { waitUntil: 'load' });
  const kpis = page.getByTestId('panel-kpis');
  // Marlene, Wilson y Jairo en la calle (mapa en vivo); Ana con Micra abierta
  await expect(kpis.getByText('En la calle').locator('..')).toContainText('3');
  await expect(kpis).toContainText('4 conectados');
  // Hoy: la ruta en curso de Marlene y la de Jairo de esta mañana
  await expect(kpis.getByText('Rutas', { exact: true }).locator('..')).toContainText('2');
  await expect(kpis).toContainText('32');
  await expect(kpis).toContainText('8 con encuesta');

  const people = page.getByTestId('panel-people');
  await expect(people.getByRole('listitem')).toHaveCount(5);
  await expect(people.getByRole('listitem').first()).toContainText('Marlene Rojas');
  // «grabando ruta» sale de los puntos de su ruta abierta (tintero_route_points)
  await expect(people.getByRole('listitem').first()).toContainText('grabando ruta');

  // Se refresca solo (el piloto y el mapa en vivo vuelven a pedirse)
  const n = api.all('/rest/v1/rpc/micra_live_map', 'POST').length;
  await expect.poll(() => api.all('/rest/v1/rpc/micra_live_map', 'POST').length).toBeGreaterThan(n);

  // Escoger a alguien: su detalle con la ruta en curso
  await people.getByRole('button', { name: /Marlene Rojas/ }).click();
  const detail = page.getByTestId('panel-detail');
  await expect(detail).toContainText('En la calle');
  await expect(detail).toContainText('su último punto de GPS');
  await expect(detail.getByRole('list', { name: 'Sus rutas' })).toContainText('En curso');
  await detail.getByRole('button', { name: 'Cerrar el detalle' }).click();
  await expect(detail).toHaveCount(0);

  // Buscar sin tildes y por estado
  await page.getByRole('searchbox', { name: /Personas/ }).fill('lucia');
  await expect(people.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('searchbox', { name: /Personas/ }).fill('sin conexion');
  await expect(people.getByRole('listitem')).toHaveCount(1);
  await expect(people).toContainText('Doña Rosa');
  await page.getByRole('searchbox', { name: /Personas/ }).fill('');

  // 30 días: aparecen las rutas viejas, también la que levantó el equipo
  await page.getByRole('button', { name: '30 días' }).click();
  await expect(kpis.getByText('Rutas', { exact: true }).locator('..')).toContainText('5');
  await expect(people.getByRole('listitem')).toHaveCount(6);
  await people.getByRole('button', { name: /Don Luis/ }).click();
  await expect(page.getByTestId('panel-detail')).toContainText('la levantó el equipo');

  // Las capas se prenden y apagan
  const layer = page.getByTestId('layer-estudio');
  await expect(layer).toHaveAttribute('aria-pressed', 'true');
  await layer.click();
  await expect(layer).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('equipo: en el computador, mapa y lista lado a lado', async ({ browser }) => {
  const { page, errors } = await open(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto('/micra/mapa', { waitUntil: 'load' });
  await expect(page.getByTestId('panel-people')).toBeVisible();
  const map = await page.getByTestId('panel-map').boundingBox();
  const list = await page.getByTestId('panel-people').boundingBox();
  expect(list.x).toBeGreaterThan(map.x + map.width - 1);
  expect(errors).toEqual([]);
});

test('un barista sin ser del equipo no ve el panel', async ({ browser }) => {
  const { page } = await open(browser, { team: false });
  await page.goto('/micra/mapa', { waitUntil: 'load' });
  await expect(page.getByTestId('map-panel')).toHaveCount(0);
});
