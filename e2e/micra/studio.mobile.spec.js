// Micra Studio de punta a punta en el celular (390×844) con cámara falsa y Supabase simulado.
import { test, expect } from '@playwright/test';
import { openPage, openMicraFromHome, layout, draws, center } from './fixtures.js';

test.describe.configure({ mode: 'serial' });

let page;
let api;
let errors;
test.beforeAll(async ({ browser }) => {
  ({ page, api, errors } = await openPage(browser));
  await openMicraFromHome(page);
});
test.afterAll(() => page?.context().close());

test('m. abre la cámara en vivo', async () => {
  await page.waitForSelector('.mstudio.is-camera .mc-video');
  await page.waitForFunction(() => document.querySelector('.mc-video')?.readyState >= 2);
  await expect(page.locator('.esp--console, .esp-console, .esp-panel, .esp-bar')).toHaveCount(0);
  await expect(page.locator('.mc-filter-name')).toHaveText(/Castillo · 250 g \$32\.000/);
  await expect(page.locator('.mst-ticket')).toContainText('$ 32k');
});

test('sin scroll horizontal (cámara)', async () => {
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    row: document.querySelector('.mc-modes-row').getBoundingClientRect().right,
  }));
  expect(r.sw).toBeLessThanOrEqual(390);
  expect(r.row).toBeLessThanOrEqual(390);
});

test('venta rápida en 2 toques + deshacer', async () => {
  api.clear();
  await page.click('.mst-ticket');
  await expect(page.locator('.msheet')).toContainText('quedan 3');
  await page.click('.msheet-btn.is-primary.is-big');
  await expect(page.locator('.mst-toast')).toContainText('✓ Venta registrada · $32.000');
  // Una sola llamada: la base pone precios, inventario y movimientos en una transacción
  const sale = api.find('/rpc/micra_record_sale');
  expect(sale.data).toMatchObject({ p_lines: [{ variant_id: 'c0-250', qty: 1 }], p_payment_method: 'cash', p_phone: null });
  expect(sale.data.p_client_ref).toMatch(/^[\w-]{8,64}$/);
  expect(api.find('/orders', 'POST')).toBeUndefined();
  expect(api.stock.get('c0-250').stock_qty).toBe(2);
  await expect(page.locator('.msheet')).toHaveCount(0);
  api.clear();
  await page.click('.mst-toast-action');
  await expect.poll(() => api.find('/rpc/micra_void_sale')?.data).toEqual({ p_order_id: 'order-1' });
  expect(api.stock.get('c0-250').stock_qty).toBe(3);
});

test('ticket con dos cafés', async () => {
  api.clear();
  await page.click('.mst-ticket');
  await page.waitForSelector('.msheet');
  await page.click('.msheet-add:has-text("Otro café")');
  await page.click('.msheet-line.is-open .msheet-chip:has-text("Geisha")');
  await expect(page.locator('.msheet-total')).toContainText('77.000');
  await page.click('.msheet-btn.is-primary.is-big');
  await expect(page.locator('.mst-toast')).toContainText('$77.000');
  expect(api.find('/rpc/micra_record_sale').data.p_lines).toEqual([{ variant_id: 'c0-250', qty: 1 }, { variant_id: 'c1-250', qty: 1 }]);
});

test('sin stock pide confirmación', async () => {
  await page.click('.mst-ticket');
  await page.waitForSelector('.msheet');
  await page.click('.msheet-line .msheet-chip:has-text("Geisha")');
  await page.click('.msheet-chip:has-text("500 g")');
  await expect(page.locator('.msheet')).toContainText('sin stock');
  await page.click('.msheet-btn.is-primary.is-big');
  await expect(page.locator('.msheet-notice.is-warn')).toContainText('No hay stock de 500 g');
  await page.click('.msheet-notice.is-warn .msheet-btn.is-ghost');
  await page.keyboard.press('Escape');
  await expect(page.locator('.msheet')).toHaveCount(0);
  await expect(page.locator('.mstudio')).toHaveCount(1);
});

test('secciones e invitación con texto', async () => {
  await page.click('.mc-kinds button:has-text("Invitación")');
  await page.waitForTimeout(300);
  await page.click('.mc-text');
  await page.waitForSelector('.mtext');
  await page.fill('.mtext-input', 'Ana');
  await page.keyboard.press('Enter');
  await expect(page.locator('.mc-text')).toContainText('Para: Ana');
  await page.click('.mc-kinds button:has-text("Receta")');
  await page.waitForTimeout(300);
});

test('Plano: la cámara se apaga y «Usar» abre el editor en papel', async () => {
  await page.click('.mc-seg button:has-text("Plano")');
  await expect(page.locator('.mc-video')).toHaveCount(0);
  await expect(page.locator('.mc-shutter-ring')).toContainText('Usar');
  await page.click('.mc-filter.on');
  await page.waitForSelector('.mstudio.is-edit');
  await page.waitForFunction(() => (document.querySelector('.mst-card')?.__layout || []).length > 3);
  // (10,10) lleva la viñeta del papel: ≈ #EDE6D3 oscurecido
  const px = await page.evaluate(() => [...document.querySelector('.mst-card').getContext('2d').getImageData(10, 10, 1, 1).data]);
  expect(Math.abs(px[0] - 0xED) < 24 && Math.abs(px[1] - 0xE6) < 24 && px[0] > px[2], `papel ${px}`).toBe(true);
});

test('tocar el logo → barra de la pieza', async () => {
  const a = await center(page, 'logo');
  await page.mouse.click(a.x, a.y);
  await expect(page.locator('.mst-sel-tag')).toHaveText('LOGO');
  await expect(page.locator('.mst-rail')).toHaveCount(0);
  await expect(page.locator('.mst-ctx .mst-ctx-btn span')).toHaveText(['Estilo', 'Tamaño', 'Mover', 'Ocultar', 'Listo']);
});

test('ocultar el logo: 1 dibujo, aviso y Deshacer', async () => {
  const d0 = await draws(page);
  await page.click('.mst-ctx-btn:has-text("Ocultar")');
  await page.waitForFunction((d) => (window.__micraDraws || 0) > d, d0);
  await page.waitForTimeout(300);
  expect(await draws(page)).toBe(d0 + 1);
  await expect(page.locator('.mst-toast')).toContainText('Se ocultó: Logo');
  expect(await layout(page)).not.toContain('logo');
  await page.click('.mst-toast-action');
  await expect.poll(() => layout(page)).toContain('logo');
});

test('arrastrar el logo a la derecha (sin dibujos al mover)', async () => {
  const a = await center(page, 'logo');
  const d0 = await draws(page);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + (a.r.w * 0.55 * i) / 12, a.y, { steps: 1 });
  await page.waitForTimeout(100);
  expect(await page.locator('.mst-slot').count()).toBeGreaterThanOrEqual(2);
  expect(await draws(page), 'dibujó durante el arrastre').toBe(d0);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => { const c = document.querySelector('.mst-card'); const l = c.__layout.find((x) => x.id === 'logo'); return { x: l.x, w: l.w, W: c.width }; });
  expect(b.x).toBeGreaterThan(b.W / 2 - b.w);
  expect(await draws(page), 'un dibujo al soltar').toBe(d0 + 1);
});

test('arrastrar el título a la papelera lo oculta', async () => {
  await page.click('.mst-ctx-btn.is-done').catch(() => {});
  const a = await center(page, 'title');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const tx = a.r.l + a.r.w / 2;
  const ty = a.r.t + a.r.h - 48;
  for (let i = 1; i <= 15; i++) await page.mouse.move(a.x + ((tx - a.x) * i) / 15, a.y + ((ty - a.y) * i) / 15);
  await page.waitForTimeout(100);
  await expect(page.locator('.mst-trash.is-hot')).toHaveCount(1);
  await page.mouse.up();
  await expect.poll(() => layout(page)).not.toContain('title');
  await page.click('.mst-toast-action');
  await expect.poll(() => layout(page)).toContain('title');
});

test('doble toque en el título abre el editor de texto', async () => {
  const a = await center(page, 'title');
  await page.mouse.click(a.x, a.y);
  await page.waitForTimeout(60);
  await page.mouse.click(a.x, a.y);
  await page.waitForSelector('.mtext');
  await expect(page.locator('.mtext-chip.on')).toHaveText('Título');
  const ph = await page.getAttribute('.mtext-input', 'placeholder');
  expect((await page.textContent('.mst-filterchip span')).endsWith(ph), `placeholder ${ph}`).toBe(true);
  await expect(page.locator('.mtext-count')).toContainText('/40');
  const d0 = await draws(page);
  await page.fill('.mtext-input', 'Lote 7');
  await page.waitForTimeout(200);
  expect(await draws(page), 'dibujó mientras escribía').toBe(d0);
  await page.click('.mtext-top .mc-pill-on');
  await page.waitForFunction((d) => (window.__micraDraws || 0) > d, d0);
  await page.waitForTimeout(300);
  expect(await draws(page), 'un dibujo al confirmar').toBe(d0 + 1);
});

test('Aa: texto libre con estilos', async () => {
  await page.click('.mst-ctx-btn.is-done').catch(() => {});
  await page.click('.mst-rail-btn[aria-label="Texto"]');
  await page.waitForSelector('.mtext');
  await expect(page.locator('.mtext-chip.on')).toHaveText('Texto libre');
  await expect(page.locator('.mtext-font')).toHaveText(['Marcador', 'Plano', 'Titular']);
  await page.fill('.mtext-input', '¡Recién tostado!');
  await page.click('.mtext-tool:has-text("Fondo")');
  await page.click('.mtext-top .mc-pill-on');
  await expect.poll(() => layout(page)).toContain('free');
});

test('formato Reel: 1080×1920 y todo dentro de la zona segura', async () => {
  await page.click('.mst-ctx-btn.is-done').catch(() => {});
  await page.click('.mst-top .mc-pill');
  await page.click('.mc-formats button:has-text("Reel")');
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const c = document.querySelector('.mst-card'); return { w: c.width, h: c.height, boxes: c.__layout }; });
  expect([r.w, r.h]).toEqual([1080, 1920]);
  const safe = { x0: 64, y0: 270, x1: 900, y1: 1480 };
  const out = r.boxes.filter((b) => b.x < safe.x0 - 1 || b.y < safe.y0 - 1 || b.x + b.w > safe.x1 + 1 || b.y + b.h > safe.y1 + 1).map((b) => b.id);
  expect(out).toEqual([]);
});

test('zonas: zonas → app → apagado', async () => {
  await page.click('.mst-rail-btn[aria-label="Ver zonas seguras"]');
  await expect(page.locator('.mst-zones')).toHaveCount(1);
  await page.click('.mst-rail-btn[aria-pressed="true"]');
  await expect(page.locator('.mst-ghost[data-ghost="reel"]')).toHaveCount(1);
  await page.click('.mst-rail-btn[aria-pressed="true"]');
  await expect(page.locator('.mst-zones, .mst-ghost')).toHaveCount(0);
});

test('Capas: ojos, estilos y restablecer', async () => {
  await page.click('.mst-rail-btn[aria-label="Capas"]');
  await page.waitForSelector('.msheet-layers');
  expect(await page.locator('.msheet-layer').count()).toBeGreaterThanOrEqual(12);
  await page.click('.msheet-chip:has-text("Limpia")');
  await page.waitForTimeout(400);
  const l = await layout(page);
  expect(l).not.toContain('panel');
  expect(l).toContain('title');
  await page.click('.msheet-foot .msheet-btn');
  await expect.poll(() => layout(page)).toContain('panel');
  await page.keyboard.press('Escape');
});

test('botón rápido en 4:5 = Feed; publicar con cuenta regresiva', async () => {
  await page.click('.mst-top .mc-pill');
  await page.click('.mc-formats button:has-text("4:5")');
  await expect(page.locator('.mst-quick')).toContainText('Feed');
  api.clear();
  await page.click('.mst-quick');
  await expect(page.locator('.mst-job.is-countdown')).toContainText('Publicando en Instagram · Feed… 3');
  await expect(page.locator('.mst-job.is-done')).toContainText('Post publicado en el feed', { timeout: 8000 });
  expect(api.calls.some((c) => c.p.includes('/storage/v1/object/marketing/esspresale/') && c.p.endsWith('.jpg')), 'subió JPG').toBe(true);
  expect(api.find('/publications', 'POST')?.data?.media_kind).toBe('image');
  expect(api.calls.find((c) => c.p.includes('publish-content'))?.data?.platforms?.ig).toBe(true);
});

test('cancelar la cuenta regresiva no sube nada', async () => {
  await page.click('.mst-job .mst-toast-action[aria-label="Cerrar aviso"]');
  api.clear();
  await page.click('.mst-quick');
  await page.waitForSelector('.mst-job.is-countdown');
  await page.click('.mst-job .mst-toast-action');
  await page.waitForTimeout(3600);
  expect(api.calls.some((c) => c.p.includes('storage') || c.p.includes('publish-content'))).toBe(false);
});

test('TikTok → Compartir/Descargar, nunca publish-content', async () => {
  await page.click('.mst-top .mc-pill');
  await page.click('.mc-formats button:has-text("TikTok")');
  await expect(page.locator('.mst-quick')).toHaveText(/Compartir|Descargar/);
});

test('sin logo pide confirmación', async () => {
  await page.click('.mst-top .mc-pill');
  await page.click('.mc-formats button:has-text("4:5")');
  await page.waitForTimeout(300);
  const a = await center(page, 'logo');
  await page.mouse.click(a.x, a.y);
  await page.click('.mst-ctx-btn:has-text("Ocultar")');
  await page.waitForTimeout(300);
  await page.click('.mst-quick');
  await expect(page.locator('.mst-confirm')).toContainText('La tarjeta sale sin logo');
  await page.click('.mst-confirm .msheet-btn.is-ghost');
  await expect.poll(() => layout(page)).toContain('logo');
});

test('Enviar a: destinos, pie de foto y WhatsApp', async () => {
  await page.click('.mst-send');
  await page.waitForSelector('.msheet-dest-grid');
  const dests = await page.$$eval('.msheet-dest b', (els) => els.map((e) => e.textContent));
  expect(dests).toEqual(expect.arrayContaining(['Instagram', 'WhatsApp', 'Descargar', 'Publicaciones']));
  expect(await page.inputValue('#mst-caption')).toMatch(/^☕ (Castillo|Geisha) — AceroPress/);
  await expect(page.locator('.msheet-switch.is-sale input:checked')).toHaveCount(0);
  await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  await page.click('.msheet-dest:has-text("WhatsApp")');
  await page.fill('.msheet-row.is-phone input', '300 123 4567');
  await page.click('.msheet-row.is-phone .msheet-btn');
  await expect.poll(() => page.evaluate(() => window.__opened[0] || '')).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/);
  const url = await page.evaluate(() => window.__opened[0]);
  const text = decodeURIComponent(url.split('text=')[1] || '');
  expect(text).not.toContain('#');
  expect(text.endsWith('Te compartimos la tarjeta de tu preparación 👇')).toBe(true);
  api.clear();
  await page.click('.msheet-dest:has-text("Publicaciones")');
  await expect(page.locator('.msheet-dest.on')).toContainText('✓ Guardada');
  await page.keyboard.press('Escape');
});

test('Esc: selección → cámara (con confirmación si hay toma) → inicio', async () => {
  const a = await center(page, 'panel');
  await page.mouse.click(a.x, a.y);
  await page.waitForSelector('.mst-sel');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mst-sel')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.mstudio.is-camera');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mstudio')).toHaveCount(0);
  await expect(page.locator('.mh-screen')).toHaveCount(1);
  await expect(page.locator('.admin-overlay-shell')).toHaveCount(1);
});

test('foto con la cámara → editor; la cámara se apaga', async () => {
  await page.click('.mh-dock .mh-app[aria-label="Micra"]');
  await page.waitForSelector('.mstudio.is-camera');
  await page.click('.mc-seg button:has-text("Foto")');
  await page.waitForFunction(() => document.querySelector('.mc-video')?.readyState >= 2);
  await page.evaluate(() => { window.__tracks = document.querySelector('.mc-video').srcObject.getTracks(); });
  await page.click('.mc-filter.on');
  await page.waitForSelector('.mstudio.is-edit');
  await page.waitForFunction(() => (document.querySelector('.mst-card')?.__layout || []).length > 3);
  const st = await page.evaluate(() => ({ video: !!document.querySelector('.mc-video'), tracks: window.__tracks.map((t) => t.readyState) }));
  expect(st.video).toBe(false);
  expect(st.tracks.every((t) => t === 'ended'), JSON.stringify(st)).toBe(true);
  expect(await layout(page), 'sin dibujo sobre foto').not.toContain('drawing');
  await page.click('.mst-top .mc-round[aria-label="Volver a la cámara"]');
  await expect(page.locator('.mst-confirm')).toContainText('¿Descartar la toma?');
  await page.click('.mst-confirm .msheet-btn.is-primary');
  await page.waitForSelector('.mstudio.is-camera');
});

test('sin backdrop-filter con la cámara en vivo', async () => {
  await page.click('.mst-ticket');
  await page.waitForSelector('.msheet');
  const n = await page.evaluate(() => [...document.querySelectorAll('.mstudio *')].filter((el) => { const f = getComputedStyle(el).backdropFilter; return f && f !== 'none'; }).length);
  expect(n).toBe(0);
  await page.keyboard.press('Escape');
});

test('sin errores en la página', () => {
  expect(errors).toEqual([]);
});
