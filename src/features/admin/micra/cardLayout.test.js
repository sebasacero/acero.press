import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS } from '../espresaleCard.js';
import {
  DEFAULT_ELEMENTS, resolveElements, sanitizeLook, layoutBands, layoutBody, slotTargets,
  hitTest, hitCandidates, assertSafe, slotsOf, slotPatch,
} from './cardLayout.js';

// Medidas de prueba (las reales las toma el dibujante con canvas)
const measure = (F, el, { titleLines = 1 } = {}) => ({
  logo: el.logo.shown ? { w: 300 * (F.logoH / 72), h: F.logoH * { s: 0.75, m: 1, l: 1.35 }[el.logo.size] } : null,
  cobrand: el.cobrand.shown ? { w: 160, h: 60 } : null,
  fig: el.fig.shown ? { w1: 220, w2: el.fig.showSize ? 260 : null } : null,
  title: el.title.shown ? { size: 108, n: titleLines, w: 640 } : null,
  subtitle: el.subtitle.shown ? { w: 480 } : null,
  free: el.free.shown ? { w: 420, h: 140 } : null,
  pills: ['price', 'handle', 'place'].filter((id) => el[id].shown).map((id) => ({ id, w: 260, h: 52 })),
});
const body = (el, onPhoto) => (zone) => {
  const zoneH = zone.bottom - zone.top;
  return { panelW: 490, panelH: el.panel.shown ? Math.min(410, Math.max(0, zoneH)) : 0 };
};
const layout = (format, look = {}, { onPhoto = false, cobrand = false, titleLines = 1 } = {}) => {
  const F = FORMATS[format];
  const el = resolveElements([look], { onPhoto, hasCobrand: cobrand });
  const m = measure(F, el, { titleLines });
  const bands = layoutBands(F, el, m);
  const b = body(el, onPhoto)(bands.zone);
  const bodyBoxes = layoutBody(F, el, bands.zone, b, onPhoto).boxes;
  return { F, el, m, bands, boxes: { ...bands.boxes, ...bodyBoxes } };
};

test('la tarjeta por defecto conserva las cuentas de siempre (feed y story)', () => {
  const feed = layout('feed').bands;
  assert.equal(feed.ruleY, 192);
  assert.equal(Number(feed.title.baseline.toFixed(1)), 312.6);
  assert.equal(Number(feed.subtitle.baseline.toFixed(1)), 352.6);
  assert.equal(Number(feed.zone.top.toFixed(1)), 386.6);
  assert.equal(feed.blockY, 1158);
  assert.equal(feed.zone.bottom, 1130);
  const story = layout('story').bands;
  assert.equal(story.ruleY, 354);
  assert.equal(Number(story.zone.top.toFixed(1)), 548.6);
  assert.equal(story.blockY, 1574);
});

const HIDEABLE = ['logo', 'fig', 'title', 'subtitle', 'drawing', 'panel', 'block'];
const STICKERS = { free: { visible: true }, price: { visible: true }, handle: { visible: true }, place: { visible: true } };

test('ninguna pieza se sale de la zona segura (formatos × fondos × posiciones × piezas ocultas)', () => {
  const failures = [];
  for (const format of Object.keys(FORMATS)) {
    for (const onPhoto of [false, true]) {
      const variants = [{}, STICKERS, { ...STICKERS, free: { visible: true, slot: 'over-block' }, price: { visible: true, slot: 'over-block' } }];
      for (const id of ['logo', 'title', 'panel']) {
        for (const slot of slotsOf(id, onPhoto)) variants.push({ ...STICKERS, [id]: slotPatch(id, slot, onPhoto) });
      }
      for (const id of HIDEABLE) variants.push({ ...STICKERS, [id]: { visible: false } });
      variants.push({ logo: { size: 'l', slot: 'center' }, title: { size: 'l', slot: 'bottom' }, cobrand: { visible: true } });
      for (const look of variants) {
        const { F, boxes } = layout(format, look, { onPhoto, cobrand: true, titleLines: 2 });
        const out = assertSafe(boxes, F);
        if (out.length) failures.push(`${format}/${onPhoto ? 'foto' : 'papel'}/${JSON.stringify(look)} → ${out.join(',')}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('las bandas no se pisan: encabezado < título < cuerpo < cajetín', () => {
  for (const format of Object.keys(FORMATS)) {
    const { bands, boxes } = layout(format, STICKERS);
    assert.ok(bands.ruleY < boxes.title.y, `${format}: título bajo la regla`);
    assert.ok(boxes.subtitle.y + boxes.subtitle.h <= bands.zone.top + 1, `${format}: subtítulo sobre el cuerpo`);
    assert.ok(boxes.panel.y + boxes.panel.h <= bands.blockY, `${format}: panel sobre el cajetín`);
  }
});

test('el título abajo queda sobre el cajetín y libera el espacio de arriba', () => {
  const { bands, boxes } = layout('feed', { title: { slot: 'bottom' } });
  assert.ok(boxes.title.y > bands.zone.bottom);
  assert.ok(boxes.title.y + boxes.title.h <= bands.blockY);
  assert.ok(bands.zone.top < 260);
});

test('la cota se acorta o se esconde si el logo grande va al centro', () => {
  const F = FORMATS.square;
  const el = resolveElements([{ logo: { slot: 'center', size: 'l' } }]);
  const m = { ...measure(F, el), logo: { w: 560, h: 81 } };
  const bands = layoutBands(F, el, m);
  assert.ok(['short', 'hidden'].includes(bands.fit.fig));
  assert.ok(bands.notes.fig);
});

test('logo a la derecha → cota a la izquierda', () => {
  const { boxes, F } = layout('feed', { logo: { slot: 'right' } });
  assert.equal(boxes.fig.align, 'left');
  assert.equal(boxes.fig.x, F.safe.x0);
  assert.equal(Math.round(boxes.logo.x + boxes.logo.w), F.safe.x1);
});

test('sin dibujo, el panel se centra; sin panel, el dibujo se centra (papel)', () => {
  const { boxes, F } = layout('feed', { drawing: { visible: false } });
  const mid = (F.safe.x0 + F.safe.x1) / 2;
  assert.ok(Math.abs(boxes.panel.x + boxes.panel.w / 2 - mid) < 1);
  const b2 = layout('feed', { panel: { visible: false } }).boxes;
  assert.ok(Math.abs(b2.drawing.x + b2.drawing.w / 2 - mid) < 1);
});

test('con foto no hay dibujo y el panel va abajo, al centro o arriba', () => {
  const bottom = layout('story', {}, { onPhoto: true });
  assert.equal(bottom.boxes.drawing, undefined);
  const top = layout('story', { panel: { photoSlot: 'top' } }, { onPhoto: true });
  assert.ok(top.boxes.panel.y < bottom.boxes.panel.y);
});

test('slotTargets da un destino por posición de cada pieza móvil', () => {
  const F = FORMATS.feed;
  const el = resolveElements([STICKERS]);
  const m = measure(F, el);
  const t = slotTargets(F, el, m, (bands) => body(el, false)(bands.zone), false);
  assert.deepEqual(t.logo.map((s) => s.slot), ['left', 'center', 'right']);
  assert.deepEqual(t.title.map((s) => s.slot), ['top', 'bottom']);
  assert.deepEqual(t.panel.map((s) => s.slot), ['left', 'right']);
  const noDrawing = resolveElements([{ ...STICKERS, drawing: { visible: false } }]);
  const t2 = slotTargets(F, noDrawing, measure(F, noDrawing), (bands) => body(noDrawing, false)(bands.zone), false);
  assert.equal(t2.panel, undefined);
  assert.ok(t.logo[2].x > t.logo[0].x);
});

test('tocar: lo pequeño gana sobre lo grande y hay margen para dedos', () => {
  const lay = [
    { id: 'title', x: 100, y: 100, w: 800, h: 200 },
    { id: 'free', x: 150, y: 150, w: 100, h: 50 },
    { id: 'logo', x: 100, y: 20, w: 200, h: 40 },
  ];
  assert.equal(hitTest(lay, 160, 160), 'free');
  assert.equal(hitTest(lay, 400, 250), 'title');
  assert.equal(hitTest(lay, 200, 70), null);
  assert.equal(hitTest(lay, 200, 70, 12), 'logo');
  assert.deepEqual(hitCandidates(lay, 160, 160), ['free', 'title']);
});

test('sanitizeLook descarta piezas, claves y valores desconocidos', () => {
  const clean = sanitizeLook({ logo: { visible: 'si', variant: 'x', slot: 'center' }, hack: { a: 1 }, block: { cells: { time: false, x: true } }, title: { size: 'xl', color: 'red' } });
  assert.deepEqual(clean, { logo: { slot: 'center' }, block: { cells: { time: false } }, title: { color: 'red' } });
  assert.deepEqual(sanitizeLook(null), {});
});

test('resolveElements: disponibilidad según el fondo y lo elegido se conserva', () => {
  const paper = resolveElements([{ shade: { visible: true } }]);
  assert.equal(paper.drawing.shown, true);
  assert.equal(paper.shade.shown, false);
  assert.equal(paper.shade.visible, true);
  const photo = resolveElements([{}], { onPhoto: true });
  assert.equal(photo.drawing.shown, false);
  assert.equal(photo.drawing.visible, DEFAULT_ELEMENTS.drawing.visible);
  const noCells = resolveElements([{ block: { cells: { weather: false, time: false, date: false, sign: false } } }]);
  assert.equal(noCells.block.shown, false);
});
