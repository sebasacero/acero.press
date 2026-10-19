// Elementos de la tarjeta de Micra y su lugar en el lienzo.
//
// Puro (sin DOM): el dibujante (espresaleCard.js) mide textos e imágenes y
// le pasa las medidas; aquí se decide dónde va cada pieza dentro de la zona
// segura del formato. Así la misma cuenta sirve para dibujar, para tocar las
// piezas en el editor y para las pruebas (cardLayout.test.js).
//
// Bandas, de arriba abajo dentro de la zona segura:
//   1. Encabezado: logo (+ logo aliado) y cota FIG., con la regla punteada.
//   2. Grupo del título (título + subtítulo) si va arriba, y las filas
//      "bajo el título" (texto libre y stickers).
//   3. Cuerpo: dibujo de la AeroPress y panel (receta o mensaje).
//   4. Filas "sobre el cajetín", el título si va abajo, y el cajetín.

export const SIZE_STEPS = { s: 0.75, m: 1, l: 1.35 };

export const LOGO_VARIANTS = [
  { id: 'acero-press', label: 'ACERO.press' },
  { id: 'acero', label: 'ACERO' },
  { id: 'tag', label: 'Etiqueta' },
  { id: 'type', label: 'Texto' },
];

// La tarjeta de siempre: con estos valores el dibujo es idéntico al de antes.
export const DEFAULT_ELEMENTS = {
  logo: { visible: true, variant: 'acero-press', size: 'm', slot: 'left' },
  cobrand: { visible: true },
  fig: { visible: true, showSize: true },
  title: { visible: true, size: 'm', slot: 'top', color: 'auto' },
  subtitle: { visible: true },
  free: { visible: false, style: 'marker', color: 'red', bg: false, align: 'left', size: 'm', slot: 'under-title' },
  price: { visible: false, slot: 'under-title' },
  handle: { visible: false, slot: 'under-title' },
  place: { visible: false, slot: 'under-title' },
  drawing: { visible: true },
  panel: { visible: true, compact: false, paperSlot: 'right', photoSlot: 'bottom' },
  block: { visible: true, cells: { weather: true, time: true, date: true, sign: true } },
  frame: { visible: true },
  grid: { visible: true },
  shade: { visible: true },
};
export const ELEMENT_IDS = Object.keys(DEFAULT_ELEMENTS);

// Valores permitidos (lo demás se descarta al leer preferencias guardadas)
const ENUMS = {
  variant: LOGO_VARIANTS.map((v) => v.id),
  size: ['s', 'm', 'l'],
  'logo.slot': ['left', 'center', 'right'],
  'title.slot': ['top', 'bottom'],
  'title.color': ['auto', 'red'],
  'free.style': ['marker', 'grotesk', 'mono'],
  'free.color': ['red', 'theme'],
  'free.align': ['left', 'center', 'right'],
  'row.slot': ['under-title', 'over-block'],
  paperSlot: ['right', 'left'],
  photoSlot: ['bottom', 'middle', 'top'],
};
const ROW_IDS = ['free', 'price', 'handle', 'place'];

function allowed(id, key, value) {
  if (typeof DEFAULT_ELEMENTS[id]?.[key] === 'boolean') return typeof value === 'boolean';
  const list = ENUMS[`${id}.${key}`] ?? (key === 'slot' && ROW_IDS.includes(id) ? ENUMS['row.slot'] : ENUMS[key]);
  return !!list && list.includes(value);
}

/** Limpia un diseño guardado: solo piezas, claves y valores conocidos. */
export function sanitizeLook(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, props] of Object.entries(raw)) {
    if (!DEFAULT_ELEMENTS[id] || !props || typeof props !== 'object') continue;
    const clean = {};
    for (const [key, value] of Object.entries(props)) {
      if (key === 'cells' && id === 'block' && value && typeof value === 'object') {
        const cells = {};
        for (const [c, on] of Object.entries(value)) if (c in DEFAULT_ELEMENTS.block.cells && typeof on === 'boolean') cells[c] = on;
        if (Object.keys(cells).length) clean.cells = cells;
      } else if (key in DEFAULT_ELEMENTS[id] && allowed(id, key, value)) {
        clean[key] = value;
      }
    }
    if (Object.keys(clean).length) out[id] = clean;
  }
  return out;
}

/** Une capas de diseño (la última manda). Dos niveles: pieza → propiedad (y celdas del cajetín). */
export function mergeLook(...layers) {
  const out = {};
  for (const id of ELEMENT_IDS) {
    const base = { ...DEFAULT_ELEMENTS[id], ...(id === 'block' ? { cells: { ...DEFAULT_ELEMENTS.block.cells } } : {}) };
    for (const layer of layers) {
      const p = layer?.[id];
      if (!p) continue;
      Object.assign(base, p, id === 'block' && p.cells ? { cells: { ...base.cells, ...p.cells } } : {});
    }
    out[id] = base;
  }
  return out;
}

/**
 * Diseño final para dibujar: une las capas (predeterminado → preset → cambios
 * del usuario) y marca qué se puede mostrar con este fondo. `shown` es lo que
 * se dibuja; `visible` es lo que el usuario eligió (cambiar de fondo no lo toca).
 */
export function resolveElements(layers = [], { onPhoto = false, hasCobrand = false } = {}) {
  const el = mergeLook(...layers.map(sanitizeLook));
  const available = {
    drawing: !onPhoto,
    shade: onPhoto,
    cobrand: hasCobrand,
    block: Object.values(el.block.cells).some(Boolean),
  };
  for (const id of ELEMENT_IDS) {
    const av = available[id] ?? true;
    el[id] = { ...el[id], available: av, shown: !!el[id].visible && av };
  }
  return el;
}

// ── Distribución ─────────────────────────────────────────────────────────
const FIG_H2 = 60; // cota de dos líneas (FIG. + formato)
const FIG_H1 = 32;
const FIG_MIN_HEADER = 56;
const RULE_GAP = 24;
const COBRAND_GAP = 28;
const ROW_GAP = 20;
const PILL_GAP = 14;
export const BLOCK_H = 96;
const BLOCK_GAP = 28;

/**
 * Bandas de arriba y de abajo. `m` son las medidas que toma el dibujante:
 *   logo {w,h} · cobrand {w,h} · fig {w1, w2|null} · title {size, n, w}
 *   subtitle {w} · free {w,h} · pills [{id,w,h}]
 * Devuelve las cajas (en px del lienzo), las líneas base del título y del
 * subtítulo, la zona libre para el cuerpo y avisos de ajuste.
 */
export function layoutBands(F, el, m) {
  const { x0: X0, x1: X1, y0: Y0, y1: Y1 } = F.safe;
  const W = X1 - X0;
  const boxes = {};
  const fit = {};
  const notes = {};
  const out = { boxes, fit, notes, ruleY: null, title: null, subtitle: null, rows: [], blockY: null, zone: null };

  // 1 · Encabezado
  const logo = el.logo.shown && m.logo;
  const cob = el.cobrand.shown && m.cobrand;
  const fig = el.fig.shown && m.fig;
  if (logo || cob || fig) {
    const lh = logo ? m.logo.h : cob ? m.cobrand.h : 0;
    const groupW = (logo ? m.logo.w : 0) + (logo && cob ? COBRAND_GAP : 0) + (cob ? m.cobrand.w : 0);
    const slot = el.logo.slot;
    const gx = slot === 'center' ? X0 + (W - groupW) / 2 : slot === 'right' ? X1 - groupW : X0;
    if (logo) boxes.logo = { x: gx, y: Y0, w: m.logo.w, h: m.logo.h };
    if (cob) {
      const cx = gx + (logo ? m.logo.w + COBRAND_GAP : 0);
      boxes.cobrand = { x: cx, y: Y0 + (lh - m.cobrand.h) / 2, w: m.cobrand.w, h: m.cobrand.h };
    }
    let figH = 0;
    if (fig) {
      // La cota va al lado contrario del logo (con el logo al centro, a la derecha)
      const align = slot === 'right' ? 'left' : 'right';
      const place = (w) => (align === 'right' ? X1 - w : X0);
      const clash = (x, w) => groupW > 0 && x < gx + groupW + RULE_GAP && x + w > gx - RULE_GAP;
      let lines = m.fig.w2 ? 2 : 1;
      let w = lines === 2 ? Math.max(m.fig.w1, m.fig.w2) : m.fig.w1;
      if (clash(place(w), w) && lines === 2) {
        lines = 1;
        w = m.fig.w1;
        fit.fig = 'short';
        notes.fig = 'La cota se acortó para caber junto al logo';
      }
      if (clash(place(w), w)) {
        fit.fig = 'hidden';
        notes.fig = 'La cota no cabe junto al logo';
      } else {
        figH = lines === 2 ? FIG_H2 : FIG_H1;
        boxes.fig = { x: place(w), y: Y0, w, h: figH, align, lines };
      }
    }
    const headerH = Math.max(lh, boxes.fig ? FIG_MIN_HEADER : 0);
    out.ruleY = Y0 + headerH + RULE_GAP;
  }

  // Grupo del título (título + subtítulo): alto desde `y` hasta el final
  const t = el.title.shown && m.title;
  const s = el.subtitle.shown && m.subtitle;
  const placeTitleGroup = (y) => {
    if (t) {
      const base = y + t.size * 0.95 + 18;
      const last = base + (t.n - 1) * t.size * 0.98;
      out.title = { baseline: base, lineStep: t.size * 0.98, size: t.size };
      boxes.title = { x: X0, y: base - t.size * 0.8, w: t.w, h: last - base + t.size * 0.88 };
      y = last;
    }
    if (s) {
      const base = y + (t ? 40 : 34);
      out.subtitle = { baseline: base };
      boxes.subtitle = { x: X0, y: base - 20, w: 22 + s.w, h: 28 };
      return base + 34;
    }
    return t ? y + 34 : y;
  };
  const groupHeight = () => {
    let h = 0;
    if (t) h += t.size * 0.95 + 18 + (t.n - 1) * t.size * 0.98;
    if (s) h += (t ? 40 : 34) + 34;
    else if (t) h += 34;
    return h;
  };

  // Filas de texto libre y stickers por posición
  const rowsFor = (slot) => {
    const rows = [];
    if (el.free.shown && m.free && el.free.slot === slot) rows.push([{ id: 'free', w: m.free.w, h: m.free.h, align: el.free.align }]);
    const pills = (m.pills || []).filter((p) => el[p.id]?.shown && el[p.id].slot === slot);
    let row = [];
    let used = 0;
    for (const p of pills) {
      if (row.length && used + PILL_GAP + p.w > W) { rows.push(row); row = []; used = 0; }
      used += (row.length ? PILL_GAP : 0) + p.w;
      row.push({ ...p, align: 'left' });
    }
    if (row.length) rows.push(row);
    return rows;
  };
  const placeRow = (row, y) => {
    const h = Math.max(...row.map((r) => r.h));
    if (row.length === 1 && row[0].id === 'free') {
      const r = row[0];
      const x = r.align === 'center' ? X0 + (W - r.w) / 2 : r.align === 'right' ? X1 - r.w : X0;
      boxes.free = { x, y, w: r.w, h: r.h };
    } else {
      let x = X0;
      for (const p of row) {
        boxes[p.id] = { x, y: y + (h - p.h) / 2, w: p.w, h: p.h };
        x += p.w + PILL_GAP;
      }
    }
    out.rows.push(row.map((r) => r.id));
    return h;
  };

  // 2 · Arriba
  let y = out.ruleY ?? Y0;
  if (el.title.slot === 'top') y = placeTitleGroup(y);
  else if (out.ruleY != null) y += RULE_GAP;
  for (const row of rowsFor('under-title')) y += placeRow(row, y) + ROW_GAP;

  // 4 · Abajo (de abajo hacia arriba)
  let bottom = Y1;
  if (el.block.shown) {
    out.blockY = Y1 - BLOCK_H;
    boxes.block = { x: X0, y: out.blockY, w: W, h: BLOCK_H };
    bottom = out.blockY - BLOCK_GAP;
  }
  for (const row of rowsFor('over-block').reverse()) {
    const h = Math.max(...row.map((r) => r.h));
    placeRow(row, bottom - h);
    bottom -= h + ROW_GAP;
  }
  if (el.title.slot === 'bottom' && (t || s)) {
    const top = bottom - groupHeight();
    placeTitleGroup(top);
    bottom = top - BLOCK_GAP;
  }

  out.zone = { top: y, bottom: Math.max(y, bottom) };
  return out;
}

/**
 * Cuerpo: dibujo (solo en papel) y panel. `body` = { panelW, panelH } con el
 * panel ya ajustado a la zona (panelH 0 si no va).
 */
export function layoutBody(F, el, zone, body, onPhoto) {
  const { x0: X0, x1: X1 } = F.safe;
  const W = X1 - X0;
  const zoneH = Math.max(0, zone.bottom - zone.top);
  const boxes = {};
  const panel = el.panel.shown && body.panelH > 0;
  const { panelW, panelH } = body;
  const lift = F.lowPanel ? 0.85 : 0.5;

  if (onPhoto) {
    if (panel) {
      const slot = el.panel.photoSlot;
      const y = slot === 'top' ? zone.top : slot === 'middle' ? zone.top + Math.max(0, (zoneH - panelH) / 2) : Math.max(zone.top, zone.bottom - panelH);
      boxes.panel = { x: X1 - panelW, y, w: panelW, h: panelH };
    }
    return { boxes };
  }

  const drawing = el.drawing.shown;
  if (panel && drawing) {
    const right = el.panel.paperSlot !== 'left';
    const panelX = right ? X1 - panelW : X0;
    const drawW = W - panelW - 20;
    const scale = Math.min(0.92, zoneH / 560, drawW / 430);
    const drawH = 560 * scale;
    const groupH = Math.max(drawH, panelH);
    const groupTop = zone.top + Math.max(0, (zoneH - groupH) * lift);
    // Con el panel a la derecha, el dibujo lleva 10 px de margen (el de siempre); a la izquierda, 20 de separación
    const drawX = right ? X0 + 10 : X0 + panelW + 20;
    boxes.drawing = { x: drawX, y: groupTop + (groupH - drawH) / 2, w: 430 * scale, h: drawH, scale };
    boxes.panel = { x: panelX, y: groupTop + (groupH - panelH) / 2, w: panelW, h: panelH };
  } else if (panel) {
    boxes.panel = { x: X0 + (W - panelW) / 2, y: zone.top + Math.max(0, (zoneH - panelH) * lift), w: panelW, h: panelH };
  } else if (drawing) {
    const scale = Math.min(0.92, zoneH / 560, W / 430);
    const drawH = 560 * scale;
    boxes.drawing = { x: X0 + (W - 430 * scale) / 2, y: zone.top + Math.max(0, (zoneH - drawH) * lift), w: 430 * scale, h: drawH, scale };
  }
  return { boxes };
}

// Piezas que se pueden mover y a dónde
export const ELEMENT_SLOTS = {
  logo: ['left', 'center', 'right'],
  title: ['top', 'bottom'],
  free: ['under-title', 'over-block'],
  price: ['under-title', 'over-block'],
  handle: ['under-title', 'over-block'],
  place: ['under-title', 'over-block'],
  panel: { paper: ['right', 'left'], photo: ['bottom', 'middle', 'top'] },
};
const slotKey = (id, onPhoto) => (id === 'panel' ? (onPhoto ? 'photoSlot' : 'paperSlot') : 'slot');
export const slotsOf = (id, onPhoto) => {
  const s = ELEMENT_SLOTS[id];
  return Array.isArray(s) ? s : s ? s[onPhoto ? 'photo' : 'paper'] : [];
};
export const currentSlot = (el, id, onPhoto) => el[id]?.[slotKey(id, onPhoto)];
export const slotPatch = (id, slot, onPhoto) => ({ [slotKey(id, onPhoto)]: slot });

/**
 * Dónde quedaría cada pieza móvil en cada una de sus posiciones (para los
 * destinos al arrastrar). Se recalcula la distribución con la posición cambiada.
 * `bodyFor(bands)` devuelve { panelW, panelH } para una zona dada.
 */
export function slotTargets(F, el, m, bodyFor, onPhoto) {
  const targets = {};
  for (const id of Object.keys(ELEMENT_SLOTS)) {
    if (!el[id]?.shown) continue;
    const list = [];
    for (const slot of slotsOf(id, onPhoto)) {
      const el2 = { ...el, [id]: { ...el[id], ...slotPatch(id, slot, onPhoto) } };
      const bands = layoutBands(F, el2, m);
      const box = id === 'panel' ? layoutBody(F, el2, bands.zone, bodyFor(bands), onPhoto).boxes.panel : bands.boxes[id];
      if (box) list.push({ slot, ...box });
    }
    if (list.length > 1) targets[id] = list;
  }
  return targets;
}

// Prioridad al tocar: lo pequeño y lo que va encima primero
export const HIT_ORDER = ['free', 'price', 'handle', 'place', 'cobrand', 'logo', 'fig', 'subtitle', 'title', 'block', 'panel', 'drawing'];
const rank = (id) => {
  const i = HIT_ORDER.indexOf(id);
  return i < 0 ? HIT_ORDER.length : i;
};
const inside = (b, x, y, pad = 0) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;

/** Piezas bajo el punto, en orden de prioridad (`pad` agranda las cajas pequeñas). */
export function hitCandidates(layout, x, y, pad = 0) {
  const direct = layout.filter((b) => inside(b, x, y)).sort((a, b) => rank(a.id) - rank(b.id));
  if (direct.length || !pad) return direct.map((b) => b.id);
  const near = layout
    .filter((b) => inside(b, x, y, pad))
    .map((b) => ({ id: b.id, d: Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) }))
    .sort((a, b) => a.d - b.d);
  return near.map((n) => n.id);
}
export const hitTest = (layout, x, y, pad = 0) => hitCandidates(layout, x, y, pad)[0] ?? null;

/** Piezas que se salen de la zona segura (1 px de tolerancia). */
export function assertSafe(boxes, F) {
  const { x0, y0, x1, y1 } = F.safe;
  return Object.entries(boxes)
    .filter(([, b]) => b && (b.x < x0 - 1 || b.y < y0 - 1 || b.x + b.w > x1 + 1 || b.y + b.h > y1 + 1))
    .map(([id]) => id);
}

/** Caja en % del lienzo, para posicionar botones del DOM encima. */
export const toPct = (b, W, H) => ({ left: `${(b.x / W) * 100}%`, top: `${(b.y / H) * 100}%`, width: `${(b.w / W) * 100}%`, height: `${(b.h / H) * 100}%` });
