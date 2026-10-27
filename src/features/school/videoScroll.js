// Banner del video de la Escuela: el clip de la AeroPress avanza con el scroll mientras el
// banner cruza la pantalla (sin fijar nada). Lógica pura para probarla sin navegador.

/** Duración del clip (public/image/metodo/aeropress-metodo.mp4), en segundos. */
export const DURATION = 16.5;

/** Los cinco momentos del clip y en qué segundo termina cada uno. */
export const CLIP_STEPS = [
  { key: 'filter', end: 4.7 },
  { key: 'coffee', end: 7.3 },
  { key: 'water', end: 11.9 }, // incluye el corte de cámara al meter el émbolo (11,4–11,8 s)
  { key: 'press', end: 13.8 },
  { key: 'puck', end: 16.5 },
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Avance 0–1 del banner por la pantalla: 0 cuando su centro está en el 80 % de la altura
 * (recién entra), 1 cuando llega al 20 % (ya casi sale). Así el clip entero se ve con el
 * banner a la vista, también en un celular donde el banner es más alto que la pantalla.
 */
export function passProgress(top, height, viewport) {
  if (!(viewport > 0)) return 0;
  const center = top + height / 2;
  const from = viewport * 0.8;
  const to = viewport * 0.2;
  return clamp((from - center) / (from - to), 0, 1);
}

/** Segundo del clip para un avance. */
export const timeAt = (progress) => clamp(Number(progress) || 0, 0, 1) * DURATION;

/** Momento del clip que se está viendo en un segundo dado. */
export function clipStepAt(time) {
  const i = CLIP_STEPS.findIndex((s) => time < s.end);
  return i === -1 ? CLIP_STEPS.length - 1 : i;
}
