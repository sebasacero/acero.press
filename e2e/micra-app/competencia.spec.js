// Competencia, el reto de la semana (Competencia.jsx, ChallengePanel.jsx,
// competencia.js; 20261101120000_micra_competencia.sql): el equipo abre el
// reto, el barista entra con su foto (va a revisión), el cliente califica de 1
// a 5 granos y ve el podio; el barista no califica la suya.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBackend, signIn, watchErrors, PHONE } from '../micra/fixtures.js';

const SEED = JSON.parse(readFileSync(new URL('../data/micra.json', import.meta.url), 'utf8'));
const MARLENE = SEED.baristas[0].id;
const JAIRO = SEED.baristas[1].id;
const WILSON = SEED.baristas[2].id;
const DAY = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const plus = (n) => new Date(Date.parse(`${DAY}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGO8Jy3NAANMDEgANwcAN68BHH4VDQEAAAAASUVORK5CYII=', 'base64');
const RETO = { id: 'reto-1', title: 'Arte latte: tu mejor corazón', brief: 'Un perico con el corazón más limpio.', kind: 'arte_latte', prize: 'Un kilo de café', starts_on: plus(-2), ends_on: plus(4) };
const entry = (id, tintero_id, o = {}) => ({ id, tintero_id, kind: 'foto', media_path: `${tintero_id}/p-${id}.jpg`, caption: `Mi corazón ${id}`, status: 'approved', created_at: new Date().toISOString(), challenge_id: 'reto-1', ...o });

/** who: 'visitor' | 'barista' (Marlene) | 'team' */
async function open(browser, { who = 'visitor', challenges = [], posts = [], votes = {} } = {}) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  Object.assign(api.micra, structuredClone(SEED));
  Object.assign(api.micra, { challenges: structuredClone(challenges), posts: structuredClone(posts), votes: structuredClone(votes) });
  if (who === 'team') { api.micra.baristas.forEach((b) => { delete b.mine; }); await signIn(page); } else api.micra.admin = false;
  if (who === 'barista') { api.ruta.me = { id: MARLENE, name: 'Marlene Rojas', zone: 'Chapinero', consent_at: null }; await signIn(page); }
  return { page, api, errors };
}

test('equipo: abre el reto de la semana desde una idea y lo ve abierto con sus cifras', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'team' });
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  const panel = page.getByTestId('challenge-panel');
  await expect(panel).toContainText('sin reto abierto');
  await panel.getByTestId('challenge-new').click();
  const form = panel.getByTestId('challenge-form');
  // Las ideas son los retos básicos por sección: primero un espresso, luego la rosetta
  await form.getByRole('group', { name: 'Sección' }).getByRole('button', { name: /Espresso/ }).click();
  await form.getByRole('group', { name: 'Ideas' }).getByRole('button', { name: 'La crema avellana' }).click();
  await expect(form.getByLabel('Nombre del reto')).toHaveValue('Espresso: la crema avellana');
  await expect(form.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Foto del puesto' })).toHaveAttribute('aria-pressed', 'true');
  await form.getByRole('group', { name: 'Sección' }).getByRole('button', { name: /Arte latte/ }).click();
  await form.getByRole('group', { name: 'Ideas' }).getByRole('button', { name: 'La rosetta' }).click();
  await expect(form.getByLabel('Nombre del reto')).toHaveValue('Arte latte: la rosetta');
  await form.getByLabel(/Premio/).fill('Un kilo de café de origen');
  await form.getByRole('button', { name: 'Guardar' }).click();
  expect(api.find('/rpc/micra_challenge_save').data.p_ch).toMatchObject({ title: 'Arte latte: la rosetta', kind: 'arte_latte', prize: 'Un kilo de café de origen', starts_on: DAY, ends_on: plus(6) });
  await expect(panel).toContainText('reto abierto');
  await expect(panel.getByTestId('challenge-row')).toContainText('Abierto');
  expect(errors).toEqual([]);
});

test('barista: entra al reto con su foto, queda en revisión y no puede entrar dos veces', async ({ browser }) => {
  const { page, api, errors } = await open(browser, { who: 'barista', challenges: [RETO] });
  await page.goto('/micra/barista/hoy', { waitUntil: 'load' });
  // En Hoy, la tarjeta del reto lleva a la competencia
  await page.getByTestId('feed-reto').getByRole('button', { name: 'Participar' }).click();
  await expect(page).toHaveURL(/\/micra\/barista\/reto$/);
  const reto = page.getByTestId('competencia');
  await expect(reto).toContainText('Arte latte: tu mejor corazón');
  await expect(reto).toContainText('Quedan 4 días');
  await expect(reto).toContainText('🎁 Un kilo de café');
  await reto.getByTestId('reto-enter').click();
  const composer = page.getByTestId('post-composer');
  await expect(composer).toContainText('Tu entrada al reto');
  await composer.getByTestId('post-file').setInputFiles({ name: 'corazon.png', mimeType: 'image/png', buffer: PNG });
  await composer.getByLabel(/Tu texto/).fill('Mi corazón de hoy');
  await composer.getByTestId('post-consent').check();
  await composer.getByTestId('post-send').click();
  await expect(page.getByTestId('post-sent')).toContainText('entra al reto');
  expect(api.find('/rpc/micra_post_add').data).toMatchObject({ p_kind: 'foto', p_challenge_id: 'reto-1' });
  await composer.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByTestId('my-entry')).toContainText('Tu entrada · En revisión');
  await expect(page.getByTestId('reto-enter')).toHaveCount(0);
  // La revisión del equipo la marca como del reto
  api.micra.admin = true;
  await page.goto('/micra/equipo', { waitUntil: 'load' });
  await expect(page.getByTestId('post-review')).toContainText('🏆 Reto: Arte latte: tu mejor corazón');
  expect(errors).toEqual([]);
});

test('cliente: ve el podio, califica una entrada con granos (un voto por celular, se cambia) y los retos pasados', async ({ browser }) => {
  const { page, api, errors } = await open(browser, {
    challenges: [RETO, { id: 'reto-0', title: 'Calle: tu puesto al amanecer', kind: 'foto', starts_on: plus(-10), ends_on: plus(-3) }],
    posts: [entry('e1', MARLENE), entry('e2', JAIRO), entry('e3', WILSON), entry('e0', JAIRO, { challenge_id: 'reto-0' })],
    // e1: 4,7 con 3 votos · e2: 4,0 con 4 · e3: sin votos · e0 ganó el reto pasado
    votes: { e1: { a: 5, b: 5, c: 4 }, e2: { a: 4, b: 4, c: 4, d: 4 }, e0: { a: 5, b: 4, c: 5 } },
  });
  await page.goto('/micra', { waitUntil: 'load' });
  // La burbuja «Reto» en las historias y la tarjeta en el muro
  await page.getByTestId('stories').getByTestId('story-reto').click();
  await expect(page).toHaveURL(/\/micra\/reto$/);
  const reto = page.getByTestId('competencia');
  const podium = reto.getByTestId('podium');
  await expect(podium.locator('.mapp-podium-item.is-1')).toContainText('Marlene');
  await expect(podium.locator('.mapp-podium-item.is-1')).toContainText('4,7 · 3 votos');
  await expect(podium.locator('.mapp-podium-item.is-2')).toContainText('Jairo');
  await expect(podium.locator('.mapp-podium-item')).toHaveCount(2);
  await expect(reto.getByTestId('entries').getByRole('listitem')).toHaveCount(3);
  // Califica a Wilson con 4 granos, luego lo cambia a 5
  await reto.getByTestId('entries').getByRole('button', { name: /^Wilson/ }).click();
  const view = page.getByTestId('entry-view');
  await view.getByRole('radio', { name: '4 granos' }).click();
  await expect(view).toContainText('Tu nota');
  const sent = api.find('/rpc/micra_vote').data;
  expect(sent).toMatchObject({ p_post_id: 'e3', p_score: 4 });
  expect(sent.p_ref).toMatch(/^voto-/);
  expect(sent.p_ref).not.toMatch(/^cel-|^busco-/);
  await view.getByRole('radio', { name: '5 granos' }).click();
  await expect.poll(() => api.all('/rpc/micra_vote').length).toBe(2);
  expect(api.micra.votes.e3[`h:${sent.p_ref}:reto-1`]).toBe(5);
  await view.getByRole('button', { name: 'Listo' }).click();
  await expect(reto.getByTestId('entries')).toContainText('Tu nota: 5');
  // Los retos pasados con su ganador
  await expect(reto.getByTestId('past')).toContainText('Ganó Jairo · 4,7 con 3 votos');
  // El medallero de arriba: la medalla del reto que ya cerró se enciende; las otras siguen apagadas
  // («Tu puesto al amanecer» cae en Servicio en la calle por su nombre)
  const medals = reto.getByTestId('medals');
  await expect(medals.getByRole('listitem').filter({ hasText: 'Servicio' })).toHaveClass(/is-on/);
  await expect(medals.getByRole('listitem').filter({ hasText: 'Filtrados' })).not.toHaveClass(/is-on/);
  expect(errors).toEqual([]);
});

test('barista: no califica su propia entrada y ve sus retos ganados', async ({ browser }) => {
  const { page, errors } = await open(browser, {
    who: 'barista',
    challenges: [RETO, { id: 'reto-0', title: 'Tu puesto al amanecer', kind: 'foto', starts_on: plus(-10), ends_on: plus(-3) }],
    posts: [entry('e1', MARLENE), entry('e2', JAIRO), entry('e0', MARLENE, { challenge_id: 'reto-0' })],
    votes: { e0: { a: 5, b: 4, c: 5 } },
  });
  await page.goto('/micra/barista/reto', { waitUntil: 'load' });
  const reto = page.getByTestId('competencia');
  await expect(page.getByTestId('my-entry')).toContainText('Tu entrada · En el reto');
  await expect(page.getByTestId('my-wins')).toContainText('Has ganado 1 reto');
  await reto.getByTestId('entries').getByRole('button', { name: /^Marlene/ }).click();
  await expect(page.getByTestId('entry-mine')).toContainText('Esta es tu entrada');
  await expect(page.getByTestId('entry-view').getByRole('radio')).toHaveCount(0);
  await page.getByTestId('entry-view').getByRole('button', { name: 'Listo' }).click();
  // Los retos básicos por sección: abre en la del reto abierto, marcado como el de esta semana
  const basics = page.getByTestId('basics');
  await expect(basics.getByRole('tab', { name: /Arte latte/ })).toHaveAttribute('aria-selected', 'true');
  await expect(basics.getByRole('listitem').filter({ hasText: 'Reto de esta semana' })).toContainText('Tu mejor corazón');
  await basics.getByTestId('basics-filtrados').click();
  await expect(basics.getByRole('tabpanel')).toContainText('Tu receta de AeroPress');
  await basics.getByTestId('basics-espresso').click();
  await expect(basics.getByRole('tabpanel')).toContainText('18 g en 28 segundos');
  expect(errors).toEqual([]);
});

test('sin reto abierto ni migración, la competencia lo dice y la app sigue', async ({ browser }) => {
  const a = await open(browser);
  await a.page.goto('/micra/reto', { waitUntil: 'load' });
  await expect(a.page.getByTestId('competencia')).toContainText('Sin reto abierto');
  await a.page.goto('/micra', { waitUntil: 'load' });
  await expect(a.page.getByTestId('stories').getByTestId('story-reto')).toHaveCount(0);
  expect(a.errors).toEqual([]);
  const b = await open(browser);
  b.api.micra.challengesMissing = true;
  await b.page.goto('/micra/reto', { waitUntil: 'load' });
  await expect(b.page.getByTestId('competencia')).toContainText('abre muy pronto');
  expect(b.errors.filter((e) => !/micra_challenge|404/.test(e))).toEqual([]);
});

test('reto básico: la tarjeta abre la hoja con la descripción y el video', async ({ browser }) => {
  const { page, errors } = await open(browser);
  await page.goto('/micra/reto', { waitUntil: 'load' });
  const basics = page.getByTestId('basics');
  await basics.getByTestId('basics-filtrados').click();
  await expect(basics.getByRole('tabpanel')).not.toContainText('gramos, agua, temperatura');
  await basics.getByTestId('basic-0').click();
  const sheet = page.getByTestId('basic-sheet');
  await expect(sheet).toContainText('Tu receta de AeroPress');
  await expect(sheet).toContainText('gramos, agua, temperatura y tiempo');
  await expect(sheet).toContainText('la receta está completa');
  await expect(sheet.locator('video')).toHaveAttribute('src', '/image/metodo/aeropress-metodo.mp4');
  await sheet.getByRole('button', { name: 'Listo' }).click();
  await expect(sheet).toHaveCount(0);
  expect(errors).toEqual([]);
});
