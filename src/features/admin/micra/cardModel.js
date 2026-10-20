// Modelo de edición de la tarjeta (puro, sin DOM): qué es cada pieza, cómo se
// guardan los cambios del usuario (solo lo que difiere del diseño base),
// estilos de un toque, deshacer, textos editables y preferencias del celular.

import { DEFAULT_ELEMENTS, ELEMENT_IDS, sanitizeLook } from './cardLayout.js';

export const ELEMENT_META = {
  logo: { label: 'Logo', tag: 'LOGO', hit: true },
  cobrand: { label: 'Logo aliado', tag: 'LOGO ALIADO', hit: true },
  fig: { label: 'Cota', tag: 'COTA', hit: true },
  title: { label: 'Título', tag: 'TÍTULO', hit: true },
  subtitle: { label: 'Subtítulo', tag: 'SUBTÍTULO', hit: true },
  free: { label: 'Texto libre', tag: 'TEXTO', hit: true },
  price: { label: 'Precio', tag: 'PRECIO', hit: true },
  handle: { label: 'Mención', tag: 'MENCIÓN', hit: true },
  place: { label: 'Ubicación', tag: 'UBICACIÓN', hit: true },
  drawing: { label: 'Dibujo AeroPress', tag: 'DIBUJO', hit: true, only: 'paper' },
  panel: { label: 'Panel', tag: 'PANEL', hit: true },
  block: { label: 'Cajetín', tag: 'CAJETÍN', hit: true },
  frame: { label: 'Marco', hit: false },
  grid: { label: 'Cuadrícula', hit: false },
  shade: { label: 'Degradado', hit: false, only: 'photo' },
};
// Orden de la lista de capas (el de la tarjeta, de arriba abajo)
export const LAYER_ORDER = ['logo', 'cobrand', 'fig', 'title', 'subtitle', 'free', 'price', 'handle', 'place', 'drawing', 'panel', 'block', 'frame', 'grid', 'shade'];
export const STICKER_IDS = ['free', 'price', 'handle', 'place'];

// Textos: null = automático (sale de la variedad o del modelo); '' = vacío
export const DEFAULT_TEXTS = {
  title: null, subtitle: null, fig: null, note: null, sign: null,
  free: '', handle: '@aceropress', place: 'Chapinero, Bogotá', invite: '', announce: '',
};
export const CARD_TEXT_KEYS = ['title', 'subtitle', 'note', 'invite', 'announce', 'free']; // se borran con «Nueva tarjeta»
export const FILTER_TEXT_KEYS = ['title', 'subtitle', 'note']; // se borran al cambiar de filtro
const KEPT_TEXT_KEYS = ['fig', 'sign', 'handle', 'place']; // se recuerdan en el celular

/** Texto que edita cada pieza. */
export function elementTextKey(id, kind, texts) {
  switch (id) {
    case 'title': return 'title';
    case 'subtitle': return kind === 'invite' && texts?.subtitle == null ? 'invite' : 'subtitle';
    case 'panel': return kind === 'announce' ? 'announce' : 'note';
    case 'fig': return 'fig';
    case 'block': return 'sign';
    case 'free': case 'handle': case 'place': return id;
    default: return null;
  }
}

/** Textos que se pueden escribir en la tarjeta, como fichas del editor de texto. */
export function textTargets(kind, preset, el) {
  const list = [];
  if (kind === 'invite') list.push({ key: 'invite', label: preset?.textLabel || 'Para', max: 40, font: 'body' });
  if (kind === 'announce') list.push({ key: 'announce', label: 'Anuncio', max: 140, multiline: true, font: 'body' });
  list.push({ key: 'title', label: 'Título', max: 40, font: 'title' });
  list.push({ key: 'subtitle', label: 'Subtítulo', max: 48, font: 'mono' });
  if (kind !== 'announce') list.push({ key: 'note', label: kind === 'recipe' ? 'Nota del barista' : 'Mensaje', max: kind === 'recipe' ? 140 : 120, multiline: true, font: kind === 'recipe' ? 'mono' : 'body' });
  list.push({ key: 'free', label: 'Texto libre', max: 80, multiline: true, breaks: true, font: 'free' });
  if (el?.fig?.shown) list.push({ key: 'fig', label: 'Cota', max: 32, font: 'mono' });
  if (el?.block?.shown && el.block.cells.sign) list.push({ key: 'sign', label: 'Firma', max: 16, font: 'title' });
  if (el?.handle?.shown) list.push({ key: 'handle', label: 'Mención', max: 30, font: 'mono' });
  if (el?.place?.shown) list.push({ key: 'place', label: 'Ubicación', max: 30, font: 'mono' });
  return list;
}

// Estilos de un toque: solo cambian qué se ve
const vis = (on, ids) => Object.fromEntries(ids.map((id) => [id, { visible: on }]));
export const STYLES = [
  { id: 'completa', label: 'Completa', patch: null }, // vuelve al diseño base
  {
    id: 'limpia', label: 'Limpia',
    patch: { ...vis(true, ['logo', 'title', 'subtitle', 'shade']), ...vis(false, ['fig', 'free', 'price', 'handle', 'place', 'drawing', 'panel', 'block', 'frame', 'grid']) },
  },
  {
    id: 'solo-logo', label: 'Solo logo',
    patch: { ...vis(true, ['logo', 'shade']), ...vis(false, ['fig', 'title', 'subtitle', 'free', 'price', 'handle', 'place', 'drawing', 'panel', 'block', 'frame', 'grid']) },
  },
  {
    id: 'detalle', label: 'Receta', labelMessage: 'Mensaje',
    patch: { ...vis(true, ['logo', 'panel', 'block', 'frame', 'shade']), ...vis(false, ['fig', 'title', 'subtitle', 'free', 'price', 'handle', 'place']) },
  },
];

/**
 * Guarda en `overrides[kind]` solo lo que difiere del diseño base (`base` =
 * diseño ya resuelto sin los cambios del usuario). Así «Restablecer» es borrar.
 */
export function patchOverride(overrides, kind, id, patch, base) {
  const cur = { ...(overrides?.[kind]?.[id] || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'cells') {
      const cells = { ...(cur.cells || {}) };
      for (const [c, on] of Object.entries(v)) {
        if (base[id].cells[c] === on) delete cells[c];
        else cells[c] = on;
      }
      if (Object.keys(cells).length) cur.cells = cells;
      else delete cur.cells;
    } else if (base[id][k] === v) delete cur[k];
    else cur[k] = v;
  }
  const kindOv = { ...(overrides?.[kind] || {}) };
  if (Object.keys(cur).length) kindOv[id] = cur;
  else delete kindOv[id];
  return { ...overrides, [kind]: kindOv };
}

export function resetOverride(overrides, kind, id = null) {
  if (!id) return { ...overrides, [kind]: {} };
  const kindOv = { ...(overrides?.[kind] || {}) };
  delete kindOv[id];
  return { ...overrides, [kind]: kindOv };
}

export function applyStyle(overrides, kind, styleId, base) {
  const style = STYLES.find((s) => s.id === styleId);
  if (!style?.patch) return resetOverride(overrides, kind);
  let out = resetOverride(overrides, kind);
  for (const [id, p] of Object.entries(style.patch)) out = patchOverride(out, kind, id, p, base);
  return out;
}

const KINDS = ['recipe', 'invite', 'announce'];
export const emptyOverrides = () => ({ recipe: {}, invite: {}, announce: {} });
export const initialLook = (saved = {}) => ({
  overrides: { ...emptyOverrides(), ...(saved.overrides || {}) },
  texts: { ...DEFAULT_TEXTS, ...(saved.texts || {}) },
  undo: [],
  seq: 0, // sube con cada edición (los avisos con «Deshacer» se cierran si hubo otra)
});

const UNDO_MAX = 20;
const snapshot = (s) => ({ overrides: s.overrides, texts: s.texts });
const withUndo = (s, next) => ({ ...next, undo: [...s.undo, snapshot(s)].slice(-UNDO_MAX), seq: (s.seq || 0) + 1 });

/**
 * Reductor del diseño. Las acciones que editan llevan `kind` y `base`
 * (el diseño base de esa sección) y dejan un paso para deshacer.
 */
export function lookReducer(state, a) {
  switch (a.type) {
    case 'set':
      return withUndo(state, { ...state, overrides: patchOverride(state.overrides, a.kind, a.id, a.patch, a.base) });
    case 'show':
    case 'hide':
      return withUndo(state, { ...state, overrides: patchOverride(state.overrides, a.kind, a.id, { visible: a.type === 'show' }, a.base) });
    case 'resetElement':
      // «Restablecer» de una pieza: su diseño y (si se pasa) su texto, en un solo paso
      return withUndo(state, { ...state, overrides: resetOverride(state.overrides, a.kind, a.id), texts: a.texts ? { ...state.texts, ...a.texts } : state.texts });
    case 'resetKind':
      return withUndo(state, { ...state, overrides: resetOverride(state.overrides, a.kind) });
    case 'style':
      return withUndo(state, { ...state, overrides: applyStyle(state.overrides, a.kind, a.styleId, a.base) });
    case 'texts':
      return withUndo(state, { ...state, texts: { ...state.texts, ...a.patch } });
    case 'textsAndSet': {
      // «Listo» del editor de texto: textos y estilo del texto libre en un solo paso
      let overrides = state.overrides;
      for (const [id, p] of Object.entries(a.patches || {})) overrides = patchOverride(overrides, a.kind, id, p, a.base);
      return withUndo(state, { ...state, overrides, texts: { ...state.texts, ...a.texts } });
    }
    case 'filterChanged': {
      // El texto libre con el que arranca un modelo (p. ej. «Promo») solo si no hay otro
      const texts = { ...state.texts, ...Object.fromEntries(FILTER_TEXT_KEYS.map((k) => [k, null])) };
      if (a.freeText && !texts.free) texts.free = a.freeText;
      // Deshacer no cruza filtros: devolvería los textos del filtro anterior
      return { ...state, texts, undo: [], seq: (state.seq || 0) + 1 };
    }
    case 'newCard':
      return {
        ...state,
        texts: { ...state.texts, ...Object.fromEntries(CARD_TEXT_KEYS.map((k) => [k, DEFAULT_TEXTS[k]])) },
        undo: [],
        seq: (state.seq || 0) + 1,
      };
    case 'undo': {
      if (!state.undo.length) return state;
      const prev = state.undo[state.undo.length - 1];
      return { ...state, ...prev, undo: state.undo.slice(0, -1), seq: (state.seq || 0) + 1 };
    }
    default:
      return state;
  }
}

// ── Preferencias del celular ─────────────────────────────────────────────
const PREFS_KEY = 'micra_prefs_v1';
const FORMAT_IDS = ['feed', 'portrait', 'square', 'story', 'reel', 'tiktok', 'shorts', 'landscape'];
const CAM_MODES = ['plain', 'photo', 'video'];
const PAY_IDS = ['cash', 'nequi', 'daviplata', 'card'];
export const DEFAULT_PREFS = { v: 1, format: 'feed', camMode: 'photo', pay: 'cash', hashtags: true, overrides: emptyOverrides(), texts: {} };

/** Lee las preferencias (formato, modo de cámara, pago, diseño) y descarta lo desconocido. */
export function parsePrefs(raw) {
  let p = raw;
  if (typeof raw === 'string') {
    try { p = JSON.parse(raw); } catch { p = null; }
  }
  if (!p || typeof p !== 'object' || p.v !== 1) return { ...DEFAULT_PREFS, overrides: emptyOverrides() };
  const overrides = emptyOverrides();
  for (const k of KINDS) overrides[k] = sanitizeLook(p.overrides?.[k]);
  const texts = {};
  for (const k of KEPT_TEXT_KEYS) {
    const v = p.texts?.[k];
    if (v === null || (typeof v === 'string' && v.length <= 40)) texts[k] = v;
  }
  return {
    v: 1,
    format: FORMAT_IDS.includes(p.format) ? p.format : DEFAULT_PREFS.format,
    camMode: CAM_MODES.includes(p.camMode) ? p.camMode : DEFAULT_PREFS.camMode,
    pay: PAY_IDS.includes(p.pay) ? p.pay : DEFAULT_PREFS.pay,
    hashtags: typeof p.hashtags === 'boolean' ? p.hashtags : DEFAULT_PREFS.hashtags,
    overrides,
    texts,
  };
}

export function loadPrefs() {
  try { return parsePrefs(localStorage.getItem(PREFS_KEY)); } catch { return parsePrefs(null); }
}

export function savePrefs({ format, camMode, pay, hashtags = true, overrides, texts }) {
  const keep = Object.fromEntries(KEPT_TEXT_KEYS.map((k) => [k, texts?.[k] ?? DEFAULT_TEXTS[k]]));
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ v: 1, format, camMode, pay, hashtags, overrides, texts: keep }));
  } catch { /* sin almacenamiento: solo dura esta visita */ }
}

export const isDefaultLook = (overrides, kind) => !Object.keys(overrides?.[kind] || {}).length;
export { DEFAULT_ELEMENTS, ELEMENT_IDS };
