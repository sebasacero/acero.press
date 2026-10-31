// El flujo del barista al salir: cómo sale (puesto fijo, sombrilla o
// caminando), qué permisos faltan, cómo le pagan (solo el medio, sin número) y
// sus productos propios junto a tinto, perico y aromática. Lógica pura.
import { menuOf } from './micraApp.js';

// Los iconos son los del logo de Micra (ronda 3): carrito, sombrilla y vasito que camina
export const OUT_MODES = [
  { id: 'fijo', label: 'Puesto fijo', hint: 'Siempre en el mismo punto', icon: '/image/micra-modo/fijo.svg' },
  { id: 'sombrilla', label: 'Sombrilla', hint: 'Armo mi puesto donde hay gente', icon: '/image/micra-modo/sombrilla.svg' },
  { id: 'caminando', label: 'Caminando', hint: 'Recorro mi ruta con el termo', icon: '/image/micra-modo/caminando.svg' },
];
export const isMode = (m) => OUT_MODES.some((x) => x.id === m);
export const modeOf = (id) => OUT_MODES.find((x) => x.id === id) ?? null;
/** Caminando se graba el recorrido; en un punto basta con dónde está. */
export const recordsTrip = (mode) => mode === 'caminando';

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
