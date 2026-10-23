// Escuela: lógica pura del cronómetro de la receta base y de la cuenta de la taza.
// Sin React, para probarla con node --test.

/** Receta base de la Escuela: 15 g de café, 230 g de agua a 90 °C, dos minutos. */
export const BASE_RECIPE = { coffee: 15, water: 230, tempC: 90, total: 120 };

/** Momentos del cronómetro, en segundos desde que cae el agua. `key` va a los textos de cada idioma. */
export const BREW_STEPS = [
  { key: 'pour', at: 0 },
  { key: 'stir', at: 10 },
  { key: 'cap', at: 20 },
  { key: 'press', at: 90 },
  { key: 'done', at: 120 },
];

/** Índice del paso que toca en el segundo `sec` (el último queda fijo al terminar). */
export function brewStepAt(sec, steps = BREW_STEPS) {
  let i = 0;
  for (let k = 0; k < steps.length; k += 1) if (sec >= steps[k].at) i = k;
  return i;
}

/** Segundos que faltan para el siguiente paso (null en el último). */
export function untilNext(sec, steps = BREW_STEPS) {
  const i = brewStepAt(sec, steps);
  return i < steps.length - 1 ? Math.max(0, steps[i + 1].at - sec) : null;
}

/** 75 → "1:15". */
export function clock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "18.500", "$18.500" o "18500" → 18500; vacío o raro → null. Acepta coma decimal ("16,5"). */
export function parseAmount(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[$\s]/g, '').trim();
  if (!s) return null;
  // Con coma decimal: los puntos son de miles. Sin coma: un punto seguido de 3 cifras también.
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\.(?=\d{3}(\D|$))/g, '');
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const LIBRA_G = 500; // la libra de la tienda en Colombia

/**
 * Cuánto cuesta y cuánto deja una taza.
 * libra: precio de 500 g de café · grams: café por taza · extras: vaso, filtro, azúcar ·
 * price: a cuánto se vende. Lo que falte deja su resultado en null.
 */
export function cupMath({ libra, grams, extras = 0, price }) {
  const coffee = libra !== null && libra !== undefined && grams ? (libra / LIBRA_G) * grams : null;
  const cost = coffee === null ? null : coffee + (extras || 0);
  const profit = cost !== null && price ? price - cost : null;
  const margin = profit !== null && price ? profit / price : null;
  const cupsPerLibra = grams ? Math.floor(LIBRA_G / grams) : null;
  return { coffee, cost, profit, margin, cupsPerLibra };
}
