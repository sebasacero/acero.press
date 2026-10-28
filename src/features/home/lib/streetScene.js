// La calle de Chapinero a trazo, como en el guion del lanzamiento de Micra: sol, cerros,
// fachadas con ventanas, andén con su raya. Aquí solo se calcula qué dibujar (números);
// StreetScene.jsx lo pinta en SVG. Sin azar: la misma semilla da siempre la misma calle,
// así las capturas y las pruebas no cambian solas.

/** Generador determinista (Park–Miller), el mismo del guion. */
export function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Arma la calle para un lienzo de `width` × `height`. `ground` es la línea del andén
 * (desde arriba); por debajo quedan `height - ground` px de acera.
 * `noon` pone el sol en el centro (mediodía); si no, a la izquierda (amanecer).
 */
export function buildStreet({ width = 1400, height = 420, ground = 340, seed = 7, noon = false } = {}) {
  const rnd = rng(seed);
  const sun = noon ? { cx: width / 2, cy: 54, r: 30 } : { cx: 110, cy: 86, r: 30 };
  // Cerros: una línea quebrada de lado a lado, suave
  const n = Math.max(6, Math.round(width / 100));
  const hills = Array.from({ length: n + 1 }, (_, i) => ({
    x: Math.round((i / n) * width),
    y: Math.round(ground - 200 - Math.abs(Math.sin(i * 1.1 + seed)) * 70 - rnd() * 24),
  }));
  // Fachadas: una tras otra hasta cubrir el ancho, con ventanas en rejilla y a veces una puerta
  const facades = [];
  let x = -20 - Math.round(rnd() * 40);
  while (x < width + 40) {
    const w = Math.round(90 + rnd() * 90);
    const h = Math.round(140 + rnd() * 150);
    const cols = Math.floor(w / 36);
    const rows = Math.floor(h / 50);
    const windows = [];
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (rnd() < 0.18) continue;
        windows.push({ x: x + 12 + c * 36, y: ground - h + 18 + r * 50, lit: rnd() < 0.3 });
      }
    }
    facades.push({ x, w, h, sand: rnd() < 0.5, door: rnd() < 0.6, windows });
    x += w + 3 + Math.round(rnd() * 14);
  }
  // Farol a la derecha y árbol a la izquierda
  const lamp = { x: Math.round(width * 0.9), top: ground - 300 };
  const tree = {
    x: 24,
    top: ground - 160,
    crowns: Array.from({ length: 4 }, () => ({ dx: Math.round((rnd() - 0.5) * 70), dy: Math.round(-200 - rnd() * 60), r: Math.round(34 + rnd() * 20) })),
  };
  return { width, height, ground, sun, hills, facades, lamp, tree };
}

/** Las marcas del andén: las rayas oblicuas de las baldosas, cada `step` px. */
export function pavingLines(width, step = 54) {
  const lines = [];
  for (let x = -20; x < width + step; x += step) lines.push(x);
  return lines;
}
