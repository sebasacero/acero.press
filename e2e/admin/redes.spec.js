// Redes: analizar lo publicado (Instagram o CSV de Meta) y crear la semana de contenido.
import { test, expect } from '@playwright/test';
import { openPage } from '../micra/fixtures.js';

const desk = { context: { viewport: { width: 1440, height: 900 } }, session: { coach: true } };
const ago = (d, h = 23) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10) + `T${String(h).padStart(2, '0')}:30:00Z`;
const reel = (i, extra = {}) => ({ id: `r${i}`, media_product: 'REELS', media_type: 'VIDEO', caption: 'Receta: molienda media, agua a 85', posted_at: ago(i + 1), reach: 400, like_count: 30, comments_count: 2, saved: 12, shares: 20, permalink: `https://instagram.com/p/r${i}`, ...extra });
const foto = (i) => ({ id: `f${i}`, media_product: 'FEED', media_type: 'IMAGE', caption: 'La lata de cold brew en la tienda', posted_at: ago(i + 8, 15), reach: 300, like_count: 20, comments_count: 0, saved: 1, shares: 0 });

async function openRedes(page) {
  await page.goto('/admin', { waitUntil: 'load' });
  await page.click('.ax-side .ax-item:has-text("Redes")');
  await expect(page.locator('.social .esp-title')).toHaveText('Redes.');
}

test('sin métricas lo dice, y con Instagram sincronizado compara formatos con su n', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, desk);
  await openRedes(page);
  await expect(page.getByText('Aún no hay métricas')).toBeVisible();
  await expect(page.locator('.social-findings')).toContainText('Todavía no hay posts para analizar');
  await page.context().close();

  const second = await openPage(browser, desk);
  second.api.opts.igMedia = [0, 1, 2].map((i) => reel(i)).concat([0, 1, 2].map(foto));
  second.api.opts.igDaily = [{ day: ago(40).slice(0, 10), followers_count: 400 }, { day: ago(1).slice(0, 10), followers_count: 437 }];
  await openRedes(second.page);
  await expect(second.page.locator('.esp-badge').first()).toHaveText('INSTAGRAM');
  const kpis = second.page.locator('.dash-kpis');
  await expect(kpis).toContainText('6');
  await expect(kpis).toContainText('▲ 37 en 90 días');
  const findings = second.page.locator('.social-findings');
  await expect(findings).toContainText('El formato que mejor funciona: Reel');
  await expect(findings).toContainText('n=3');
  await expect(findings).toContainText('El pilar que mejor funciona: Receta en un minuto');
  await expect(second.page.locator('.dash-table tbody tr').first()).toContainText('Receta: molienda media');
  expect(errors).toEqual([]);
  expect(second.errors).toEqual([]);
  void api;
});

test('el CSV de Meta se lee en el navegador y alimenta el análisis', async ({ browser }) => {
  const { page, errors } = await openPage(browser, desk);
  await openRedes(page);
  const day = (d) => { const x = new Date(Date.now() - d * 86_400_000); return `${x.getUTCMonth() + 1}/${x.getUTCDate()}/${x.getUTCFullYear()} 18:30`; };
  const csv = [
    'Descripción,Hora de publicación,Tipo de publicación,Alcance,Me gusta,Comentarios,Veces que se compartió,Veces que se guardó',
    `"Un día con un barista en la calle, Kennedy",${day(2)},Reel de IG,1.200,90,5,40,10`,
    `Receta campeona del WAC,${day(3)},Reel de IG,800,50,2,10,30`,
  ].join('\n');
  await page.locator('.social-file input[type=file]').setInputFiles({ name: 'meta.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('status')).toContainText('Leídos 2 posts del CSV');
  await expect(page.locator('.esp-badge').first()).toHaveText('CSV DE META');
  await expect(page.locator('.dash-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.dash-table tbody tr').first()).toContainText('Un día con un barista');
  // Se queda al volver a abrir (solo en este navegador)
  await page.reload();
  await page.click('.ax-side .ax-item:has-text("Redes")');
  await expect(page.locator('.esp-badge').first()).toHaveText('CSV DE META');
  await page.getByRole('button', { name: 'Quitar CSV' }).click();
  await expect(page.locator('.esp-badge').first()).toHaveText('SIN MÉTRICAS');
  expect(errors).toEqual([]);
});

test('crear: idea por pilar, escribir con IA, agregar a la semana y marcarla publicada', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, desk);
  await openRedes(page);
  await page.getByRole('tab', { name: 'Crear' }).click();
  await page.getByRole('button', { name: /Campeones WAC/ }).click();
  await expect(page.locator('.esp-preview .esp-badge')).toHaveText('Campeones WAC');
  await expect(page.getByLabel('Tema')).toHaveValue(/\(\d{4}\)/);
  await expect(page.locator('.social-hook')).toHaveValue(/\(\d{4}\)/);

  await page.getByRole('button', { name: /Receta en un minuto/ }).click();
  await page.getByRole('button', { name: 'Escribir con IA' }).click();
  await expect(page.locator('.social-hook')).toHaveValue('La molienda lo cambia todo');
  await expect(page.locator('.social-shots li')).toHaveCount(3);
  await expect(page.locator('.social-why')).toContainText('Los Reels de receta');
  const sent = api.find('/api/growth-agent', 'POST').data;
  expect(sent.action).toBe('social');
  expect(sent.idea.pillar).toBe('receta');
  expect(Array.isArray(sent.findings)).toBe(true);

  await page.getByRole('button', { name: 'Agregar a la semana' }).click();
  await expect(page.getByRole('status')).toContainText('Agregada al lunes');
  await page.getByRole('tab', { name: 'Semana' }).click();
  const days = page.locator('.social-week > li');
  await expect(days).toHaveCount(7);
  await expect(days.first()).toContainText('La molienda lo cambia todo');
  await expect(days.first()).toContainText('Receta del lunes');
  await expect(days.nth(2)).toContainText('Campeón del miércoles');
  await expect(days.nth(4)).toContainText('Viernes de calle');
  await days.first().getByRole('checkbox', { name: 'Publicado' }).check();
  await expect(page.locator('.social-stack')).toContainText('1/7 publicadas');
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/\?text=.*molienda/);

  // Abrir un día lo lleva a Crear con esa idea
  await days.nth(2).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('.esp-preview .esp-badge')).toHaveText('Campeones WAC');
  await expect(page.locator('.social-shots')).not.toContainText('tintero');
  expect(errors).toEqual([]);
});
