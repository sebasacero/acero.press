// Micra en un celular chico (360×740) y las tarjetas dentro de su zona segura en todos los formatos.
import { test, expect } from '@playwright/test';
import { openPage, openMicraFromHome, center } from './fixtures.js';

test('360×740: nada se sale de la pantalla y todo botón tiene nombre', async ({ browser }) => {
  const { page, errors } = await openPage(browser, { context: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, permissions: ['camera', 'microphone'] } });
  await openMicraFromHome(page);
  await page.waitForTimeout(1500);
  const audit = async (screen) => {
    const r = await page.evaluate(() => {
      const vw = innerWidth;
      const vh = innerHeight;
      const vis = (el) => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0; };
      const name = (b) => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24);
      const btns = [...document.querySelectorAll('.mstudio button')].filter((b) => vis(b) && !b.classList.contains('mst-hit') && !b.closest('.mc-carousel'));
      // Una fila que se desplaza a lo ancho (fichas, pestañas) asoma la siguiente a propósito
      const inRow = (b) => {
        for (let el = b.parentElement; el && el !== document.body; el = el.parentElement) {
          if (/auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1) return true;
        }
        return false;
      };
      return {
        sw: document.documentElement.scrollWidth,
        offscreen: btns.filter((b) => {
          const q = b.getBoundingClientRect();
          return q.bottom > vh + 1 || q.top < -1 || ((q.right > vw + 1 || q.left < -1) && !inRow(b));
        }).map(name),
        unlabeled: btns.filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
      };
    });
    expect(r, screen).toEqual({ sw: 360, offscreen: [], unlabeled: 0 });
  };
  await audit('cámara');
  await page.click('.mst-ticket');
  await page.waitForSelector('.msheet');
  await page.waitForTimeout(300);
  await audit('venta');
  await page.keyboard.press('Escape');
  await page.click('.mc-seg button:has-text("Plano")');
  await page.waitForTimeout(400);
  await page.click('.mc-filter.on');
  await page.waitForSelector('.mstudio.is-edit');
  await page.waitForTimeout(800);
  await audit('editor');
  const a = await center(page, 'logo');
  await page.mouse.click(a.x, a.y);
  await page.click('.mst-ctx-btn:has-text("Estilo")');
  await page.waitForTimeout(200);
  await audit('barra de la pieza');
  await page.click('.mst-ctx-btn.is-done');
  await page.click('.mst-send');
  await page.waitForSelector('.msheet-dest-grid');
  await page.waitForTimeout(300);
  await audit('Enviar a');
  await page.keyboard.press('Escape');
  await page.click('.mst-rail-btn[aria-label="Texto"]');
  await page.waitForSelector('.mtext');
  await page.waitForTimeout(300);
  await audit('texto');
  expect(errors).toEqual([]);
  await page.context().close();
});

test('todas las tarjetas (formato × sección × fondo × estilo) quedan dentro de su zona segura', async ({ browser }) => {
  const { page } = await openPage(browser, { context: {} });
  await page.goto('/', { waitUntil: 'load' });
  const res = await page.evaluate(async () => {
    const R = await import('/src/features/admin/espresaleCard.js');
    const L = await import('/src/features/admin/micra/cardLayout.js');
    const F = await import('/src/features/admin/micraFilters.js');
    const variety = { name: 'Maracaturra Honey', recipe_text: 'Dosis 18 g · Agua 220 ml · 92°C · 2:00.' };
    const weather = { tempC: 14, icon: '🌧️' };
    const stickers = { free: { visible: true }, handle: { visible: true }, place: { visible: true }, price: { visible: true } };
    const looks = [
      stickers,
      { ...stickers, title: { size: 'l' } },
      { ...stickers, title: { size: 'l', slot: 'bottom' } },
      { ...stickers, title: { size: 'l' }, free: { visible: true, size: 'l', style: 'grotesk' } },
    ];
    const kinds = [
      ['recipe', {}],
      ['invite', { kind: 'invite', preset: F.presetOf('invite', 'bienvenida'), text: 'Ana' }],
      ['announce', { kind: 'announce', preset: F.presetOf('announce', 'promo'), text: '2×1 en sachets hasta el viernes, solo en la barra de la 72' }],
    ];
    const fails = [];
    let n = 0;
    for (const format of Object.keys(R.FORMATS)) for (const [kn, ko] of kinds) for (const bg of ['paper', 'overlay']) for (const look of looks) {
      const c = document.createElement('canvas');
      const onPhoto = bg !== 'paper';
      const elements = L.resolveElements([ko.preset?.layout, look], { onPhoto });
      const texts = { free: 'SUPERCALIFRAGILÍSTICO\nsegunda línea', handle: '@aceropress', place: 'Chapinero, Bogotá', title: kn === 'recipe' ? 'MARACATURRA' : null };
      const r = await R.drawEspresaleCard(c, { variety, weather, format, videoOverlay: onPhoto, elements, texts, priceText: '250 G · $32.000', ...ko });
      n++;
      const boxes = Object.fromEntries(r.layout.map((b) => [b.id, b]));
      const out = L.assertSafe(boxes, R.FORMATS[format]);
      // El panel no se monta sobre el cajetín
      const overlap = boxes.panel && boxes.block && boxes.panel.y + boxes.panel.h > boxes.block.y + 1;
      if (out.length || overlap) fails.push(`${format}/${kn}/${bg}/${JSON.stringify(look).slice(0, 60)} → ${out.join(',')}${overlap ? ' panel∩cajetín' : ''}`);
    }
    return { n, fails };
  });
  expect(res.n).toBe(192);
  expect(res.fails).toEqual([]);
  await page.context().close();
});
