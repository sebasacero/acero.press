// El video de cada lección (6 nov 2026, pedido del usuario: «la gente aprende más con videos»):
// no es un archivo, se arma con los pasos de la lección. Una escena por paso con un dibujo a trazo
// que se anima, el texto grande y una barra arriba como las historias. Pesa nada, sirve sin señal
// y cambia solo si cambia la lección. Aquí lo puro: las escenas, su duración y qué dibujo va.

/** Qué dibujo va con cada paso, por las palabras del texto (el primero que calce). */
const ICONS = [
  ['termo', /\btermo/],
  ['leche', /\bleche|espuma|vapor|lanceta|jarra/],
  ['tiempo', /\bseg(undo)?s?\b|\bmin(uto)?s?\b|espera|cronómetro|tiempo|\bhoras?\b|\d+:\d\d/],
  ['balanza', /\bpes[ae]|balanza|\bg\b|gramos|\d+\s?g\b/],
  ['limpiar', /\blava|limpi|enjuaga|bicarbonato|purga/],
  ['molino', /mol(ienda|ino|er|ido)|\bmuele|\bfino\b|grueso/],
  ['agua', /\bagua\b|tetera|vierte|verter|florecido|chorro|°c/],
  ['presion', /apison|presion|prensa|empuja|émbolo|portafiltro/],
  ['taza', /taza|sirve|prueba|sabor|bebe|vende/],
];

export function iconFor(text) {
  const t = String(text ?? '').toLowerCase();
  return ICONS.find(([, re]) => re.test(t))?.[0] ?? 'cafe';
}

/** Cuánto dura una escena: lo que tarda en leerse, entre 3 y 7 segundos. */
export const sceneMs = (text) => Math.max(3000, Math.min(7000, 1800 + String(text ?? '').length * 55));

/**
 * Las escenas de una lección: el título, un paso por escena (máximo 6) y el truco al final.
 * `school` da el dibujo de la portada (aeropress, termo, v60, espresso).
 */
export function videoScenes(lesson, school = 'aeropress') {
  if (!lesson) return [];
  const steps = (lesson.points ?? []).filter(Boolean).slice(0, 6);
  const scenes = [{ kind: 'title', icon: school, text: lesson.title, sub: lesson.lead ? String(lesson.lead).split(/(?<=\.)\s/)[0] : '', ms: 3500 }];
  steps.forEach((text, i) => scenes.push({ kind: 'step', n: i + 1, total: steps.length, numbered: !!lesson.numbered, icon: iconFor(text), text, ms: sceneMs(text) }));
  if (lesson.tip) scenes.push({ kind: 'tip', icon: 'idea', text: lesson.tip, ms: sceneMs(lesson.tip) });
  return scenes;
}

export const totalMs = (scenes) => scenes.reduce((s, x) => s + x.ms, 0);

/** En qué escena va un reloj de `t` ms y cuánto lleva de ella (0–1). */
export function sceneAt(scenes, t) {
  let acc = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    if (t < acc + scenes[i].ms) return { i, p: Math.max(0, (t - acc) / scenes[i].ms) };
    acc += scenes[i].ms;
  }
  return { i: Math.max(0, scenes.length - 1), p: 1, done: true };
}

/** El reloj donde empieza la escena i (para saltar con un toque). */
export const startOf = (scenes, i) => scenes.slice(0, Math.max(0, i)).reduce((s, x) => s + x.ms, 0);
