// Micra Studio en escritorio: inspector acoplado, fondo de video, teclado, anchos intermedios y permisos.
import { test, expect } from '@playwright/test';
import { ONE_COFFEE, openPage, openMicraFromAdmin, openMicraFromHome, waitForCard, dropGeneratedClip } from './fixtures.js';

const DESK = { coffee: ONE_COFFEE, inventory: [{ variant_id: 'c0-250', stock_qty: 5, low_stock_threshold: 2 }] };
const NO_CAMERA = { coach: true, camera: 'none', prefs: null };

test.describe('1440×900 sin cámara: video y teclado', () => {
  test.describe.configure({ mode: 'serial' });
  let page;
  let errors;
  test.beforeAll(async ({ browser }) => {
    ({ page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } }, backend: DESK, session: NO_CAMERA }));
    await openMicraFromAdmin(page);
  });
  test.afterAll(() => page?.context().close());

  test('Micra desde la barra lateral: Plano con nota, inspector con la venta', async () => {
    const r = await page.evaluate(() => ({
      pos: getComputedStyle(document.querySelector('.mstudio')).position,
      side: !!document.querySelector('.ax-side')?.offsetParent,
      docked: document.querySelector('.msheet.is-docked .msheet-title')?.textContent,
      note: document.querySelector('.mc-note')?.textContent,
      mode: document.querySelector('.mc-seg .on')?.textContent,
    }));
    expect(r).toEqual({ pos: 'absolute', side: true, docked: 'Venta', note: 'Sin cámara aquí: usa Plano o elige una foto', mode: 'Plano' });
  });

  test('soltar un video sobre el estudio abre el editor con video nativo', async () => {
    await dropGeneratedClip(page, '.mstudio');
    await page.waitForSelector('.mstudio.is-edit video.mst-video');
    await page.waitForFunction(() => document.querySelector('.mst-video')?.readyState >= 2);
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      docked: document.querySelector('.msheet.is-docked .msheet-title')?.textContent,
      still: document.querySelector('.mstudio').dataset.still,
      playing: !document.querySelector('.mst-video').paused,
      blur: [...document.querySelectorAll('.mstudio *')].filter((el) => getComputedStyle(el).backdropFilter !== 'none').length,
    }));
    expect(r).toEqual({ docked: 'Capas', still: 'false', playing: true, blur: 0 });
    // Sin bucle de composición: los dibujos no suben mientras corre el video
    const d0 = await page.evaluate(() => window.__micraDraws || 0);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__micraDraws || 0), 'dibuja en bucle').toBe(d0);
  });

  test('pausar compone el cuadro fijo una vez', async () => {
    await page.click('.mst-play');
    await expect(page.locator('.mst-still')).toHaveClass(/is-on/);
    expect(await page.evaluate(() => document.querySelector('.mst-still').width)).toBe(540);
    await page.click('.mst-play');
  });

  test('Enviar a: sin Compartir en escritorio; Preparar video avanza y pide confirmación al salir', async () => {
    await page.click('.mst-send');
    await page.waitForSelector('.msheet.is-docked .msheet-dest-grid');
    expect(await page.$$eval('.msheet-dest b', (els) => els.map((e) => e.textContent))).not.toContain('Compartir');
    await page.click('.msheet-btn:has-text("Preparar video")');
    await expect(page.locator('.msheet-progress span')).toHaveText(/Preparando video \d+ % · no cierres Micra/);
    // Ir a otra herramienta mientras graba pide confirmación (y «Cancelar» se queda)
    let asked = '';
    const onDialog = (d) => { asked = d.message(); d.dismiss(); };
    page.on('dialog', onDialog);
    await page.click('.ax-side .ax-item:has-text("Pedidos")');
    await page.waitForTimeout(300);
    page.off('dialog', onDialog);
    expect(asked).toContain('Se está preparando el video');
    await expect(page.locator('.mstudio')).toHaveCount(1);
    await page.click('.msheet-progress .msheet-btn');
    await expect(page.locator('.msheet-progress')).toHaveCount(0);
    await expect(page.locator('.msheet-btn:has-text("Preparar video")')).toHaveCount(1);
  });

  test('Fondo: inicio del clip y volver a Plano', async () => {
    await page.keyboard.press('Escape');
    await page.click('.mst-rail-btn[aria-label="Fondo"]');
    await page.waitForSelector('#mst-trim');
    await page.click('.msheet-tile:has-text("Plano")');
    await expect(page.locator('video.mst-video')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.querySelector('.mst-card').__layout.map((b) => b.id))).toContain('drawing');
  });

  test('teclado: Tab selecciona piezas, Supr oculta, Ctrl+Z deshace', async () => {
    await page.keyboard.press('Escape');
    await page.focus('.mst-hit');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.waitForSelector('.mst-sel');
    const count = () => page.evaluate(() => document.querySelector('.mst-card').__layout.length);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(400);
    const n1 = await count();
    await page.keyboard.press('Control+z');
    await expect.poll(count).toBe(n1 + 1);
  });

  test('sin errores en la página', () => {
    expect(errors).toEqual([]);
  });
});

test.describe('1440×900: inspector acoplado y publicación', () => {
  test.describe.configure({ mode: 'serial' });
  let page;
  let api;
  let errors;
  test.beforeAll(async ({ browser }) => {
    ({ page, api, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 900 } }, backend: DESK, session: NO_CAMERA }));
    await openMicraFromAdmin(page);
  });
  test.afterAll(() => page?.context().close());

  test('el inspector de Venta carga el stock (quedan 5)', async () => {
    await expect(page.locator('.msheet.is-docked')).toContainText('quedan 5');
  });

  test('Esc en el WhatsApp del inspector no saca de Micra', async () => {
    await page.click('.msheet.is-docked .msheet-add:has-text("WhatsApp")');
    await page.fill('.msheet.is-docked input[type=tel]', '300 123 4567');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('.mstudio')).toHaveCount(1);
    await expect(page.locator('.msheet.is-docked input[type=tel]')).toHaveValue('300 123 4567');
  });

  test('venta + Enviar a › WhatsApp usa el número de la venta', async () => {
    await page.click('.msheet.is-docked .msheet-btn.is-primary.is-big');
    await page.waitForSelector('.mst-toast');
    await page.click('.msheet-btn:has-text("Nueva venta")');
    await page.click('.mc-filter.on'); // Plano → editor
    await waitForCard(page);
    await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
    await page.click('.mst-send');
    await page.waitForSelector('.msheet.is-docked .msheet-dest-grid');
    await page.click('.msheet-dest:has-text("WhatsApp")');
    await expect.poll(() => page.evaluate(() => window.__opened[0] || '')).toMatch(/^https:\/\/wa\.me\/573001234567/);
  });

  test('publicar desde «Enviar a» bloquea el botón rápido y publica una sola vez', async () => {
    api.opts.slowPublish = true;
    api.clear();
    await page.click('.msheet-dest:has-text("Instagram")');
    await page.waitForTimeout(400);
    await expect(page.locator('.mst-quick')).toBeDisabled();
    await page.waitForSelector('.msheet-success', { timeout: 10000 });
    expect(api.calls.filter((c) => c.p.includes('publish-content'))).toHaveLength(1);
    await expect(page.locator('.mst-salepill')).toContainText('Vendido');
    api.opts.slowPublish = false;
  });

  test('«Publicaciones» queda desactivado una vez guardada', async () => {
    await page.click('.mst-rail-btn[aria-label="Capas"]');
    await page.click('.mst-send');
    await page.waitForSelector('.msheet.is-docked .msheet-dest-grid');
    const tile = page.locator('.msheet-dest:has-text("Publicaciones")');
    await expect(tile).toContainText('✓ Guardada');
    await expect(tile).toBeDisabled();
  });

  test('cuenta regresiva + «Enviar a › Instagram» publica una sola vez', async () => {
    await page.keyboard.press('Escape');
    api.clear();
    await page.click('.mst-quick');
    await page.waitForSelector('.mst-job.is-countdown');
    await page.click('.mst-send');
    await page.waitForSelector('.msheet.is-docked .msheet-dest-grid');
    await expect(page.locator('.msheet-dest:has-text("Instagram")')).toBeDisabled();
    await page.waitForSelector('.mst-job.is-done', { timeout: 12000 });
    await page.waitForTimeout(500);
    expect(api.calls.filter((c) => c.p.includes('publish-content'))).toHaveLength(1);
    await page.click('.mst-job .mst-toast-action[aria-label="Cerrar aviso"]');
  });

  test('Esc con el foco en el inspector cancela la cuenta regresiva', async () => {
    await page.click('.mst-rail-btn[aria-label="Capas"]');
    api.clear();
    await page.click('.mst-quick');
    await page.waitForSelector('.mst-job.is-countdown');
    await page.focus('.msheet.is-docked .msheet-eye');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3600);
    expect(api.calls.some((c) => c.p.includes('publish-content'))).toBe(false);
  });

  test('tras publicar y volver a la cámara, la tarjeta siguiente no hereda la venta', async () => {
    await page.click('.mst-top .mc-round[aria-label="Volver a la cámara"]');
    await page.waitForSelector('.mstudio.is-camera');
    await page.click('.mc-filter.on');
    await page.waitForSelector('.mstudio.is-edit');
    await page.waitForTimeout(500);
    await expect(page.locator('.mst-salepill')).not.toContainText('Vendido');
  });

  test('una publicación que termina tarde no pega su venta a la tarjeta en pantalla', async () => {
    // Venta pegada a esta tarjeta, publicar lento y volver a la cámara mientras sube
    await page.click('.mst-salepill');
    await page.waitForSelector('.msheet.is-docked .msheet-btn.is-primary.is-big');
    await page.click('.msheet.is-docked .msheet-btn.is-primary.is-big');
    await page.waitForTimeout(500);
    api.opts.slowPublish = true;
    await page.click('.mst-quick');
    await page.waitForSelector('.mst-job.is-run', { timeout: 6000 });
    await page.click('.mst-top .mc-round[aria-label="Volver a la cámara"]');
    await page.waitForSelector('.mstudio.is-camera');
    await page.click('.mc-filter.on');
    await page.waitForSelector('.mstudio.is-edit');
    await page.waitForSelector('.mst-job.is-done', { timeout: 12000 });
    await page.waitForTimeout(400);
    await expect(page.locator('.mst-salepill')).not.toContainText('Vendido');
    api.opts.slowPublish = false;
  });

  test('sin errores en la página', () => {
    expect(errors).toEqual([]);
  });
});

test('a 1000 px el estudio va a pantalla completa y la fila de abajo cabe', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1000, height: 800 } }, backend: DESK, session: NO_CAMERA });
  await openMicraFromHome(page);
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const st = document.querySelector('.mstudio');
    const rr = (s) => document.querySelector(s)?.getBoundingClientRect();
    const tabs = rr('.mc-kinds'); const gal = rr('.mc-gallery'); const tick = rr('.mst-ticket'); const seg = rr('.mc-seg'); const flip = rr('.mc-top .mc-round:last-child');
    return { pos: getComputedStyle(st).position, w: st.getBoundingClientRect().width, dock: !!document.querySelector('.msheet.is-docked'), overlap: tabs.left < gal.right || tabs.right > tick.left || seg.right > flip.left };
  });
  expect(r).toEqual({ pos: 'fixed', w: 1000, dock: false, overlap: false });
  expect(errors).toEqual([]);
  await page.context().close();
});

test('/admin a 1440×760: Registrar venta y las secciones se ven sin scroll', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 1440, height: 760 } }, backend: DESK, session: NO_CAMERA });
  await openMicraFromAdmin(page);
  const r = await page.evaluate(() => ({
    reg: document.querySelector('.msheet.is-docked .msheet-btn.is-primary.is-big').getBoundingClientRect().bottom,
    tabs: document.querySelector('.mc-kinds').getBoundingClientRect().bottom,
    h: innerHeight,
    sy: document.scrollingElement.scrollHeight,
  }));
  expect(r.reg).toBeLessThanOrEqual(r.h);
  expect(r.tabs).toBeLessThanOrEqual(r.h);
  expect(r.sy).toBeLessThanOrEqual(r.h + 1);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('permiso bloqueado en Historia: el aviso y sus botones se ven completos', async ({ browser }) => {
  const { page, errors } = await openPage(browser, {
    context: { viewport: { width: 390, height: 844 } },
    backend: DESK,
    session: { coach: true, camera: 'denied', prefs: { v: 1, format: 'story', camMode: 'photo' } },
  });
  await openMicraFromHome(page);
  await page.waitForSelector('.mc-perm');
  // El marco es el angosto de Historia (9:16)
  const ratio = await page.evaluate(() => { const b = document.querySelector('.mc-frame').getBoundingClientRect(); return b.height / b.width; });
  expect(ratio).toBeGreaterThan(1.6);
  const r = await page.evaluate(() => {
    const b = document.querySelector('.mc-perm').getBoundingClientRect();
    const clickable = [...document.querySelectorAll('.mc-perm button')].map((x) => {
      const q = x.getBoundingClientRect();
      return x.contains(document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2));
    });
    return { top: b.top, bottom: b.bottom, h: innerHeight, clickable };
  });
  expect(r.top).toBeGreaterThanOrEqual(0);
  expect(r.bottom).toBeLessThanOrEqual(r.h);
  expect(r.clickable.length).toBeGreaterThan(0);
  expect(r.clickable.every(Boolean)).toBe(true);
  expect(errors).toEqual([]);
  await page.context().close();
});
