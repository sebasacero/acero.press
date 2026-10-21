// «Así funciona»: cómo el scroll mueve la animación del AeroPress.
// Lógica pura (sin React) para poder probarla con node --test.

/** Duración del clip (public/image/metodo/aeropress-metodo.mp4), en segundos. */
export const DURATION = 16.5;

/** Los cinco pasos y en qué segundo del clip termina cada uno. */
export const STEPS = [
  { key: 'filter', end: 4.7 },
  { key: 'coffee', end: 7.3 },
  { key: 'water', end: 11.9 }, // incluye el corte de cámara al meter el émbolo (11,4–11,8 s)
  { key: 'press', end: 13.8 },
  { key: 'puck', end: 16.5 },
];

// Al entrar el primer paso se lee quieto un momento, y el último cuadro se
// queda antes de soltar la sección
const HOLD_IN = 0.04;
const HOLD_OUT = 0.08;
const RUN = 1 - HOLD_IN - HOLD_OUT;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Avance 0–1 dentro de la pista: 0 cuando su borde de arriba toca el de la
 * ventana, 1 cuando su borde de abajo toca el de abajo.
 */
export function trackProgress(top, height, viewport) {
  const run = height - viewport;
  if (run <= 0) return top <= 0 ? 1 : 0;
  return clamp(-top / run, 0, 1);
}

/** Segundo del clip para un avance del scroll. */
export function timeAt(progress) {
  return clamp((progress - HOLD_IN) / RUN, 0, 1) * DURATION;
}

/** Paso que se está viendo en un segundo del clip. */
export function stepAt(time) {
  const i = STEPS.findIndex((s) => time < s.end);
  return i === -1 ? STEPS.length - 1 : i;
}

/** Segundo en que empieza un paso. */
export const stepStart = (i) => (i <= 0 ? 0 : STEPS[i - 1].end);

/** Avance del scroll al que hay que ir para ver un paso (un poco adentro de su inicio). */
export function progressForStep(i) {
  if (i <= 0) return 0;
  return HOLD_IN + ((stepStart(i) + 0.25) / DURATION) * RUN;
}

// ── Banner de la app: primero el inicio de sesión, luego la receta ─────────

/** Parte de la pista que ocupa el inicio de sesión (el resto es la receta). */
export const LOGIN_SHARE = 0.28;

/** Momentos del inicio de sesión, como fracción de su parte de la pista. */
export const LOGIN_BEATS = [
  { key: 'screen', at: 0 }, // pantalla de entrada de Micra
  { key: 'tap', at: 0.2 }, // toque en «Continuar con Google»
  { key: 'chooser', at: 0.32 }, // Google pide elegir la cuenta
  { key: 'pick', at: 0.56 }, // toque en la cuenta
  { key: 'welcome', at: 0.66 }, // «Hola, Laura»
  { key: 'open', at: 0.88 }, // se abre la receta
];

/** Lo que muestra el celular en un avance del scroll. */
export function sceneAt(progress) {
  if (progress < LOGIN_SHARE) {
    const f = progress / LOGIN_SHARE;
    let beat = LOGIN_BEATS[0].key;
    for (const b of LOGIN_BEATS) if (f >= b.at) beat = b.key;
    return { scene: 'login', beat, time: 0 };
  }
  return { scene: 'brew', beat: 'open', time: timeAt((progress - LOGIN_SHARE) / (1 - LOGIN_SHARE)) };
}

/** Lo que se narra al lado: 3 pasos de entrada y los 5 de la receta. */
export const LOGIN_ITEMS = [
  { key: 'google', beats: ['screen', 'tap'], at: 0.08 },
  { key: 'account', beats: ['chooser', 'pick'], at: 0.42 },
  { key: 'ready', beats: ['welcome', 'open'], at: 0.74 },
];
export const ITEM_COUNT = LOGIN_ITEMS.length + STEPS.length;

/** Índice (0–7) de lo que se narra en un avance del scroll. */
export function itemAt(progress) {
  const s = sceneAt(progress);
  if (s.scene === 'login') return LOGIN_ITEMS.findIndex((it) => it.beats.includes(s.beat));
  return LOGIN_ITEMS.length + stepAt(s.time);
}

/** Avance del scroll al que hay que ir para ver un ítem. */
export function progressForItem(i) {
  if (i < LOGIN_ITEMS.length) return LOGIN_ITEMS[i].at * LOGIN_SHARE;
  return LOGIN_SHARE + progressForStep(i - LOGIN_ITEMS.length) * (1 - LOGIN_SHARE) + 0.001;
}
