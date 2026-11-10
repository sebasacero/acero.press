// El flujo del barista al salir: cómo sale (puesto fijo, sombrilla o
// caminando), qué permisos faltan, cómo le pagan (solo el medio, sin número) y
// sus productos propios junto a tinto, perico y aromática. Lógica pura.
import { menuOf } from './micraApp.js';
import { meters } from '../../shared/lib/bogotaGeo.js';

// Puesto fijo: el carrito del logo (ronda 3); sombrilla: solo la sombrilla;
// caminando: el chico animado que camina su ruta (animado/caminando.mp4)
export const OUT_MODES = [
  { id: 'fijo', label: 'Puesto fijo', hint: 'Siempre en el mismo punto', icon: '/image/micra-modo/fijo.svg', gps: 'Al salir se guarda el punto de tu puesto y se queda ahí.' },
  { id: 'sombrilla', label: 'Sombrilla', hint: 'Armo mi puesto donde hay gente', icon: '/image/micra-modo/sombrilla.svg', gps: 'Solo se toma el punto donde armes la sombrilla hoy.' },
  { id: 'caminando', label: 'Caminando', hint: 'Recorro mi ruta con el termo', anim: 'caminando', gps: 'Se graba tu ruta y las paradas donde vendes.' },
];
export const isMode = (m) => OUT_MODES.some((x) => x.id === m);
export const modeOf = (id) => OUT_MODES.find((x) => x.id === id) ?? null;
/** Caminando se graba el recorrido; en un punto basta con dónde está. */
export const recordsTrip = (mode) => mode === 'caminando';

// El puesto fijo (6 nov 2026, pedido del usuario): su punto es el lugar donde está el puesto. Se
// guarda en el celular la primera vez y se reusa, así el GPS que baila no lo mueve de cuadra;
// si sale a más de FIXED_MOVE_M del punto guardado, el puesto se movió y se guarda el nuevo.
export const FIXED_KEY = 'micra_puesto_v1';
export const FIXED_MOVE_M = 150;

/** El punto con que sale: { pos, save } (save: lo que hay que guardar como puesto, o null). */
export function outPoint(mode, gps, saved) {
  const ok = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
  if (mode !== 'fijo') return { pos: ok(gps) ? gps : null, save: null };
  if (!ok(gps)) return { pos: ok(saved) ? { lat: saved.lat, lng: saved.lng } : null, save: null };
  if (ok(saved) && meters([gps.lng, gps.lat], [saved.lng, saved.lat]) <= FIXED_MOVE_M) return { pos: { lat: saved.lat, lng: saved.lng }, save: null };
  const spot = { lat: gps.lat, lng: gps.lng };
  return { pos: spot, save: spot };
}

/**
 * Lo que hay que pedir antes de salir. Salir siempre se puede: si falta algo,
 * se pide en la misma hoja (salir en el mapa y usar la ubicación).
 */
export function consentNeeds({ isPublic, consented, own = true }) {
  // El equipo «actuando como» no acepta por el barista
  if (!own) return { ask: false, public: false, location: false };
  const pub = !isPublic;
  const loc = !consented;
  return { ask: pub || loc, public: pub, location: loc };
}

export const PAY_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  { id: 'bre_b', label: 'Bre-B' },
];
/** Los medios en el orden de la lista, sin repetidos ni desconocidos. */
export const cleanMethods = (list) => PAY_METHODS.map((m) => m.id).filter((id) => (list ?? []).includes(id));
export const methodsLabel = (list) => cleanMethods(list).map((id) => PAY_METHODS.find((m) => m.id === id).label).join(', ');
export const toggleMethod = (list, id) => {
  const now = cleanMethods(list);
  return cleanMethods(now.includes(id) ? now.filter((x) => x !== id) : [...now, id]);
};

export const MAX_EXTRAS = 6;
/** Un producto nuevo: nombre de 2 a 24 letras y precio de $0 a $50.000 (null si no sirve). */
export function newProduct(label, price) {
  const name = String(label ?? '').replace(/\s+/g, ' ').trim();
  const p = Number(String(price ?? '').replace(/\D/g, ''));
  if (name.length < 2 || name.length > 24) return { error: 'El nombre lleva de 2 a 24 letras.' };
  if (String(price ?? '').replace(/\D/g, '') === '' || !(p >= 0 && p <= 50000)) return { error: 'El precio va de $0 a $50.000.' };
  return { label: name, price: p };
}

/** El menú de Vender: tinto, perico y aromática con precio, y luego lo propio. */
export function menuWith(day, extras = []) {
  const own = (extras ?? []).filter((x) => x && x.id && x.label && Number.isFinite(Number(x.price)))
    .map((x) => ({ id: x.id, label: x.label, one: x.label.toLowerCase(), many: x.label.toLowerCase(), price: Number(x.price), custom: true }));
  return [...menuOf(day), ...own];
}

/**
 * «Hasta las»: a qué hora se apaga sola la salida (maqueta del 10 nov 2026).
 * Las opciones son 4 horas (lo de siempre) y las horas en punto 12 m., 3 p. m. y
 * 7 p. m. que quedan a más de 30 min y a no más de 6 h (el tope de la base).
 * `hour` y `minute` son la hora de Bogotá.
 */
export function untilChoices(hour, minute = 0) {
  const nowMin = hour * 60 + minute;
  const fixed = [[12, '12 m.'], [15, '3 p. m.'], [19, '7 p. m.']]
    .map(([h, label]) => ({ id: `h${h}`, label, minutes: h * 60 - nowMin }))
    .filter((c) => c.minutes > 30 && c.minutes <= 360);
  return [{ id: 'd', label: '4 horas', minutes: 240 }, ...fixed];
}
