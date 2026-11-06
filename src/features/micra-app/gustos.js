// Los gustos del cliente (6 nov 2026, pedido del usuario): unas preguntas cortas y didácticas
// (qué café compra, cómo lo toma, qué tan fuerte, dulce, a qué hora) para armar su perfil de
// café. Nada invasivo: todo es opcional, se puede saltar, no pide datos personales y se guarda
// solo en su celular (se borra con «Borrar mis datos de este celular»). Las marcas van como
// nombre, sin logos.

export const GUSTOS_KEY = 'micra_gustos_v1';

export const QUESTIONS = [
  {
    id: 'bebida', multi: true, title: '¿Cómo te tomas el café?',
    fact: 'El perico es tinto con un chorrito de leche; el café con leche lleva mitad y mitad.',
    options: [
      { id: 'tinto', label: 'Tinto', icon: '☕' },
      { id: 'perico', label: 'Perico', icon: '🥛' },
      { id: 'leche', label: 'Con leche', icon: '🍼' },
      { id: 'capuchino', label: 'Capuchino', icon: '☁️' },
      { id: 'frio', label: 'Frío', icon: '🧊' },
      { id: 'aromatica', label: 'Prefiero aromática', icon: '🌿' },
    ],
  },
  {
    id: 'marcas', multi: true, title: '¿Qué café compras para la casa?',
    fact: 'El café de supermercado suele tostarse oscuro para que sepa parejo; el de especialidad se tuesta más claro y se sienten la fruta y el dulce.',
    options: [
      { id: 'sello-rojo', label: 'Sello Rojo', brand: true },
      { id: 'aguila-roja', label: 'Águila Roja', brand: true },
      { id: 'juan-valdez', label: 'Juan Valdez', brand: true },
      { id: 'amor-perfecto', label: 'Amor Perfecto', brand: true },
      { id: 'libertario', label: 'Libertario', brand: true },
      { id: 'colcafe', label: 'Colcafé (instantáneo)', brand: true },
      { id: 'finca', label: 'De una finca o de mi región', icon: '🌱' },
      { id: 'ninguno', label: 'No compro café', icon: '🙅', only: true },
    ],
  },
  {
    id: 'fuerza', title: '¿Cómo te gusta de fuerte?',
    fact: 'Más fuerte no es más cafeína: depende de cuánto café lleva la taza, no de qué tan oscuro es.',
    options: [
      { id: 'suave', label: 'Suave', icon: '🌤️' },
      { id: 'medio', label: 'En el medio', icon: '⛅' },
      { id: 'fuerte', label: 'Bien cargado', icon: '🌑' },
    ],
  },
  {
    id: 'dulce', title: '¿Con qué lo endulzas?',
    fact: 'Un buen café recién hecho tiene su propio dulce: pruébalo una vez sin nada.',
    options: [
      { id: 'nada', label: 'Sin nada', icon: '⚪' },
      { id: 'poca', label: 'Poquita azúcar', icon: '🤏' },
      { id: 'azucar', label: 'Con azúcar', icon: '🍬' },
      { id: 'panela', label: 'Con panela', icon: '🟫' },
    ],
  },
  {
    id: 'hora', multi: true, title: '¿A qué hora te provoca?',
    fact: 'Así sabemos a qué hora avisarte cuando tu barista pasa cerca.',
    options: [
      { id: 'manana', label: 'Temprano', icon: '🌅' },
      { id: 'media', label: 'Media mañana', icon: '☀️' },
      { id: 'tarde', label: 'Tarde', icon: '🌇' },
      { id: 'noche', label: 'Noche', icon: '🌙' },
    ],
  },
];

const SPECIALTY = new Set(['juan-valdez', 'amor-perfecto', 'libertario', 'finca']);
const CLASSIC = new Set(['sello-rojo', 'aguila-roja', 'colcafe']);

const questionOf = (id) => QUESTIONS.find((q) => q.id === id) ?? null;
const optionOf = (qid, oid) => questionOf(qid)?.options.find((o) => o.id === oid) ?? null;

/** Marca o desmarca una opción; las de una sola respuesta reemplazan y «No compro café» va sola. */
export function pick(answers = {}, qid, oid) {
  const q = questionOf(qid);
  const o = optionOf(qid, oid);
  if (!q || !o) return answers;
  if (!q.multi) return { ...answers, [qid]: answers[qid] === oid ? undefined : oid };
  const prev = Array.isArray(answers[qid]) ? answers[qid] : [];
  if (prev.includes(oid)) return { ...answers, [qid]: prev.filter((x) => x !== oid) };
  const only = (x) => optionOf(qid, x)?.only;
  return { ...answers, [qid]: o.only ? [oid] : [...prev.filter((x) => !only(x)), oid] };
}

export const isPicked = (answers, qid, oid) => (Array.isArray(answers?.[qid]) ? answers[qid].includes(oid) : answers?.[qid] === oid);

/** Solo lo que existe en las preguntas (lo guardado viejo o dañado no rompe nada). */
export function cleanAnswers(raw) {
  const out = {};
  for (const q of QUESTIONS) {
    const v = raw?.[q.id];
    if (q.multi) {
      const list = (Array.isArray(v) ? v : []).filter((x) => optionOf(q.id, x));
      if (list.length) out[q.id] = [...new Set(list)];
    } else if (optionOf(q.id, v)) out[q.id] = v;
  }
  return out;
}

export const answeredCount = (answers) => QUESTIONS.filter((q) => (q.multi ? (answers?.[q.id]?.length ?? 0) > 0 : !!answers?.[q.id])).length;

/**
 * El perfil de café: un nombre corto, lo que lo define en fichas y qué pedirle a su barista.
 * Con menos de dos respuestas no hay perfil (no se inventa).
 */
export function tasteProfile(raw) {
  const a = cleanAnswers(raw);
  if (answeredCount(a) < 2) return null;
  const drinks = a.bebida ?? [];
  const brands = (a.marcas ?? []).filter((b) => b !== 'ninguno');
  const specialty = brands.some((b) => SPECIALTY.has(b));
  const classic = brands.some((b) => CLASSIC.has(b));
  let type;
  if (drinks.includes('frio')) type = { id: 'frio', name: 'Del café frío', tip: 'Pregúntale a tu barista por un cold brew o un tinto con hielo.' };
  else if (drinks.includes('aromatica') && drinks.length === 1) type = { id: 'aromatica', name: 'De aromática', tip: 'Aparta una aromática y prueba un día un tinto suave.' };
  else if (drinks.some((d) => ['perico', 'leche', 'capuchino'].includes(d)) && !drinks.includes('tinto')) type = { id: 'leche', name: 'De café con leche', tip: 'Aparta un perico: es tinto recién hecho con un toque de leche.' };
  else if (specialty || a.fuerza === 'suave' || a.dulce === 'nada') type = { id: 'explorador', name: 'Explorador de especialidad', tip: 'Prueba el tinto de AeroPress sin azúcar: se sienten la fruta y el dulce.' };
  else if (classic || a.fuerza === 'fuerte') type = { id: 'clasico', name: 'Tinto clásico', tip: 'Pídelo cargado; si quieres algo nuevo, pruébalo con poquita azúcar.' };
  else type = { id: 'tintero', name: 'De tinto en la calle', tip: 'Aparta tu tinto y recógelo cuando tu barista pase.' };
  const chips = [
    ...drinks.map((d) => optionOf('bebida', d)),
    a.fuerza ? optionOf('fuerza', a.fuerza) : null,
    a.dulce ? optionOf('dulce', a.dulce) : null,
    ...(a.hora ?? []).map((h) => optionOf('hora', h)),
  ].filter(Boolean).map((o) => o.label);
  return { ...type, chips, brands: brands.map((b) => optionOf('marcas', b).label), drink: drinks.find((d) => d !== 'aromatica') ?? drinks[0] ?? null };
}

export function readGustos(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(GUSTOS_KEY) ?? 'null'); } catch { return null; }
}

export function writeGustos(value, storage = globalThis.localStorage) {
  try { storage?.setItem(GUSTOS_KEY, JSON.stringify(value)); } catch { /* sin memoria: vale por ahora */ }
}
