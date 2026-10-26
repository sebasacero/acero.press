// Recetas de la casa (los carteles de la vitrina del local): lógica pura, sin React.

/** "MATCHA MAMBÉ." → "matcha mambe": la llave de la frase de la casa de cada bebida. */
export function recipeKey(title = '') {
  return String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Lo que transmite el cartel: la frase guardada con el lápiz (en el idioma o en español) y, si no
 * hay, la de la casa para esa bebida según su nombre en español. Una bebida nueva sin frase: ''.
 */
export function storyFor(slide, lang, stories = {}) {
  const own = slide?.story?.[lang] || slide?.story?.es;
  if (own && own.trim()) return own.trim();
  return stories[recipeKey(slide?.title1?.es)] ?? '';
}

/** ['0', '2', '4', 'g'] → "24 g" (el odómetro guarda la dosis con ceros a la izquierda). */
export function doseText(dose) {
  const digits = (Array.isArray(dose) ? dose : String(dose ?? '').split('')).join('');
  const m = /^0*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]*)$/.exec(digits.trim());
  if (!m) return digits;
  return `${m[1]} ${m[2] || 'g'}`;
}

/** Índice dentro de la lista, dando la vuelta en los dos sentidos. */
export const wrapIndex = (i, n) => (n > 0 ? ((i % n) + n) % n : 0);
