// Scrollytelling de Aprende: la sección queda fija en pantalla mientras se baja y el
// avance del scroll elige el paso. Lógica pura para probarla sin navegador.

/** Avance (0–1) de una sección alta que se recorre con su panel fijo. */
export function scrollProgress(top, height, viewport) {
  const run = height - viewport;
  if (!(run > 0)) return 0;
  return Math.min(Math.max(-top / run, 0), 1);
}

/** Paso activo para un avance dado: n tramos iguales; el último incluye el final. */
export function stepAt(progress, n) {
  if (!(n > 0)) return 0;
  const p = Math.min(Math.max(Number(progress) || 0, 0), 1);
  return Math.min(n - 1, Math.floor(p * n));
}

/** Avance que deja un paso en el centro de su tramo (para los puntos que saltan a un paso). */
export function progressFor(index, n) {
  if (!(n > 0)) return 0;
  return (Math.min(Math.max(index, 0), n - 1) + 0.5) / n;
}
