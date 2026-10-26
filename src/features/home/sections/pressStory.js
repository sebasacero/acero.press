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

// ── Receta guiada: lo narrado son los cinco pasos ───────────────────────────
// (Antes la pista empezaba con un inicio de sesión de Google de una app que aún
// no existe: era la mitad del alto de la portada.)

export const ITEM_COUNT = STEPS.length;

/** Índice (0–4) del paso que se narra en un avance del scroll. */
export const itemAt = (progress) => stepAt(timeAt(progress));

/** Avance del scroll al que hay que ir para ver un paso. */
export const progressForItem = (i) => progressForStep(i) + 0.001;
