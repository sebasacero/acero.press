// Escuela: lógica pura del cronómetro de la receta base y de la cuenta de la taza.
// Sin React, para probarla con node --test.

/**
 * Receta base de la Escuela = la oficial de AeroPress (aeropress.com): 16–18 g de café de molienda
 * media, agua a 85 °C hasta el n.º 4, 3 s de remover, 1 min de espera y presionar hasta que sisee.
 * `water` es lo que se pesa en la lección de medir (≈ 1:15).
 */
export const BASE_RECIPE = { coffee: 17, water: 250, tempC: 85, total: 105 };

/** Momentos del cronómetro, en segundos desde que cae el agua. `key` va a los textos de cada idioma. */
export const BREW_STEPS = [
  { key: 'pour', at: 0 },
  { key: 'stir', at: 10 },
  { key: 'cap', at: 15 },
  { key: 'press', at: 75 },
  { key: 'done', at: 105 },
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

/** Lección por la que seguir: la primera sin ver (0 si no hay ninguna vista; -1 si ya vio todas). */
export const resumeIndex = (lessons, seen) => lessons.findIndex((l) => !seen.includes(l.key));

/** Minutos de todo el temario. */
export const totalMinutes = (lessons) => lessons.reduce((n, l) => n + (l.mins || 0), 0);

/** Enlace a una lección: /escuela#leccion-3 (se puede mandar por WhatsApp). */
export const lessonHash = (i) => `#leccion-${i + 1}`;

/** "#leccion-3" → 2; cualquier otra cosa o fuera de rango → null. */
export function lessonFromHash(hash, count) {
  const m = /^#leccion-(\d{1,2})$/.exec(hash || '');
  if (!m) return null;
  const i = Number(m[1]) - 1;
  return i >= 0 && i < count ? i : null;
}

/** Partes de la meta de tiempo de la barra como fracción del total (para la barra apilada). */
export function shares(parts) {
  const total = parts.reduce((n, p) => n + p.s, 0);
  return { total, parts: parts.map((p) => ({ ...p, share: total ? p.s / total : 0 })) };
}
