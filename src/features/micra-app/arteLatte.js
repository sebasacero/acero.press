// El juez de arte latte de Micra: análisis de imagen propio, sin modelo
// entrenado ni servidor. Recibe los píxeles de la foto cenital de la taza
// (ImageData: width, height, data RGBA) y califica lo que miden los jurados de
// las competencias internacionales de arte latte (World Latte Art
// Championship y afines): contraste, definición, simetría, centrado, tamaño y
// limpieza, cada uno de 0 a 10, y un puntaje de 0 a 100 con sus pesos.
//
// Cómo mira: separa el fondo de la bebida por color cálido y luz, toma la taza
// como el círculo que llena esa mancha, y dentro de la taza separa la espuma
// (clara) de la crema (oscura) con un umbral de Otsu. El dibujo es la espuma.
// Es explicable y determinista: la misma foto da el mismo puntaje. Cada
// puntaje queda con la entrada y, junto con el juicio del equipo y los granos
// de la gente, es la base para entrenar un modelo propio después.
// Lógica pura con tests (arteLatte.test.js); el canvas vive en Juez.jsx.

export const MAX_SIDE = 256; // la foto se reduce a esto antes de medir (Juez.jsx)

/** Los criterios y sus pesos, en el orden de la tarjeta de los jurados. */
export const CRITERIA = [
  { id: 'contraste', label: 'Contraste', weight: 20, hint: 'Blanco bien blanco sobre crema oscura.' },
  { id: 'definicion', label: 'Definición', weight: 20, hint: 'Bordes nítidos, sin desvanecerse.' },
  { id: 'simetria', label: 'Simetría', weight: 20, hint: 'La mitad izquierda igual a la derecha.' },
  { id: 'centrado', label: 'Centrado', weight: 15, hint: 'El dibujo en el centro de la taza.' },
  { id: 'tamano', label: 'Tamaño', weight: 15, hint: 'Que llene la taza sin tocar el borde.' },
  { id: 'limpieza', label: 'Limpieza', weight: 10, hint: 'Sin manchas ni burbujas sueltas.' },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round1 = (v) => Math.round(v * 10) / 10;

/** Luz (0–1) y «calidez» (cuánto más rojo/amarillo que azul, 0–1) de un píxel. */
function lightness(r, g, b) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function warmth(r, g, b) { return clamp(((r + g) / 2 - b) / 255, 0, 1); }

/** El umbral de Otsu sobre un histograma de 256 cajas. */
function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];
  let sumB = 0; let wB = 0; let best = 0; let thr = 128;
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB; const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = t; }
  }
  // La clase oscura llega hasta la caja t inclusive: lo claro empieza en la siguiente
  return (thr + 0.5) / 255;
}

/** Componentes conexas (4 vecinos) de una máscara; devuelve la etiqueta de cada píxel y el tamaño de cada componente. */
function components(mask, w, h) {
  const label = new Int32Array(w * h);
  const sizes = [0];
  const stack = [];
  let n = 0;
  for (let i = 0; i < w * h; i += 1) {
    if (!mask[i] || label[i]) continue;
    n += 1; sizes.push(0);
    stack.push(i); label[i] = n;
    while (stack.length) {
      const k = stack.pop();
      sizes[n] += 1;
      const x = k % w; const y = (k / w) | 0;
      if (x > 0 && mask[k - 1] && !label[k - 1]) { label[k - 1] = n; stack.push(k - 1); }
      if (x < w - 1 && mask[k + 1] && !label[k + 1]) { label[k + 1] = n; stack.push(k + 1); }
      if (y > 0 && mask[k - w] && !label[k - w]) { label[k - w] = n; stack.push(k - w); }
      if (y < h - 1 && mask[k + w] && !label[k + w]) { label[k + w] = n; stack.push(k + w); }
    }
  }
  return { label, sizes };
}

/** 0–10 por qué tan cerca está v de la franja [lo, hi]; fuera de ella baja con la distancia (span). */
function band(v, lo, hi, span) {
  if (v >= lo && v <= hi) return 10;
  const d = v < lo ? lo - v : v - hi;
  return clamp(10 * (1 - d / span), 0, 10);
}

/**
 * Califica la foto. Devuelve { ok, score, scores: {criterio: 0–10}, notes,
 * cup: {cx, cy, r}, pattern: {cx, cy, area}, w, h } o { ok: false, reason }.
 */
export function judgeLatteArt(img) {
  const { width: w, height: h, data } = img ?? {};
  if (!w || !h || !data || data.length < w * h * 4) return { ok: false, reason: 'No hay imagen.' };
  const n = w * h;
  const L = new Float32Array(n);
  const W = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    L[i] = lightness(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    W[i] = warmth(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }

  // 1. La bebida: lo cálido (crema) y lo claro dentro de ella. Primero la crema por calidez.
  const cremaMask = new Uint8Array(n);
  let cremaCount = 0;
  for (let i = 0; i < n; i += 1) if (W[i] > 0.12 && L[i] < 0.75) { cremaMask[i] = 1; cremaCount += 1; }
  if (cremaCount < n * 0.03) return { ok: false, reason: 'No vi la crema del café. Toma la foto desde arriba, con la taza llena.' };
  const cc = components(cremaMask, w, h);
  let big = 1;
  for (let k = 2; k < cc.sizes.length; k += 1) if (cc.sizes[k] > cc.sizes[big]) big = k;
  // El círculo de la taza: el centro y el radio que salen de la crema principal (la espuma queda adentro)
  let sx = 0; let sy = 0; let cnt = 0;
  let minX = w; let maxX = 0; let minY = h; let maxY = 0;
  for (let i = 0; i < n; i += 1) {
    if (cc.label[i] !== big) continue;
    const x = i % w; const y = (i / w) | 0;
    sx += x; sy += y; cnt += 1;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  const r = Math.max(maxX - minX, maxY - minY) / 2;
  if (r < Math.min(w, h) * 0.12) return { ok: false, reason: 'La taza se ve muy pequeña. Acércate más.' };
  const inCup = new Uint8Array(n);
  let cupArea = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i % w; const y = (i / w) | 0;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= (r * 0.96) ** 2) { inCup[i] = 1; cupArea += 1; }
  }

  // 2. Dentro de la taza: espuma (clara) vs crema (oscura), con Otsu sobre la luz
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i += 1) if (inCup[i]) hist[Math.round(L[i] * 255)] += 1;
  const thr = otsu(hist, cupArea);
  const foam = new Uint8Array(n);
  let foamArea = 0; let foamL = 0; let cremaL = 0; let cremaN = 0;
  for (let i = 0; i < n; i += 1) {
    if (!inCup[i]) continue;
    if (L[i] >= thr) { foam[i] = 1; foamArea += 1; foamL += L[i]; } else { cremaL += L[i]; cremaN += 1; }
  }
  if (foamArea < cupArea * 0.02) return { ok: false, reason: 'No vi espuma blanca: ¿es un perico con arte latte?' };
  if (cremaN < cupArea * 0.05) return { ok: false, reason: 'La taza se ve toda clara: falta la crema oscura alrededor del dibujo.' };
  foamL /= foamArea; cremaL /= cremaN;

  // 3. El dibujo: la espuma principal (lo demás son manchas) y su centro
  const fc = components(foam, w, h);
  let main = 1;
  for (let k = 2; k < fc.sizes.length; k += 1) if (fc.sizes[k] > fc.sizes[main]) main = k;
  const mainArea = fc.sizes[main] ?? 0;
  let px = 0; let py = 0;
  for (let i = 0; i < n; i += 1) if (fc.label[i] === main) { px += i % w; py += (i / w) | 0; }
  px /= mainArea; py /= mainArea;

  // ── Criterios ──
  // Contraste: cuánta luz separa la espuma de la crema (0,45 o más es blanco sobre café oscuro)
  const contraste = clamp(((foamL - cremaL) / 0.45) * 10, 0, 10);
  // Definición: en el borde del dibujo, qué tan brusco es el salto de luz entre vecinos
  let edgeJump = 0; let edgeN = 0;
  for (let i = 0; i < n; i += 1) {
    if (fc.label[i] !== main) continue;
    const x = i % w; const y = (i / w) | 0;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) continue;
    const nb = [i - 1, i + 1, i - w, i + w];
    for (const k of nb) if (inCup[k] && !foam[k]) { edgeJump += L[i] - L[k]; edgeN += 1; }
  }
  const definicion = edgeN ? clamp(((edgeJump / edgeN) / Math.max(0.08, foamL - cremaL)) * 10, 0, 10) : 0;
  // Simetría: el dibujo contra su reflejo en el eje vertical que pasa por el centro de la taza (IoU)
  let inter = 0; let union = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i % w; const y = (i / w) | 0;
    const mx = Math.round(2 * cx - x);
    const a = fc.label[i] === main;
    const b = mx >= 0 && mx < w && fc.label[y * w + mx] === main;
    if (a || b) union += 1;
    if (a && b) inter += 1;
  }
  const simetria = union ? clamp(((inter / union - 0.4) / 0.55) * 10, 0, 10) : 0;
  // Centrado: cuánto se corre el centro del dibujo del centro de la taza, en radios
  const off = Math.hypot(px - cx, py - cy) / r;
  const centrado = clamp(10 * (1 - off / 0.45), 0, 10);
  // Tamaño: el dibujo entre el 30 % y el 65 % de la taza, sin pegarse al borde
  const ratio = mainArea / cupArea;
  let touches = 0;
  for (let i = 0; i < n; i += 1) {
    if (fc.label[i] !== main) continue;
    const x = i % w; const y = (i / w) | 0;
    if ((x - cx) ** 2 + (y - cy) ** 2 >= (r * 0.9) ** 2) touches += 1;
  }
  const tamano = clamp(band(ratio, 0.3, 0.65, 0.3) - (touches / mainArea > 0.02 ? 3 : 0), 0, 10);
  // Limpieza: espuma suelta fuera del dibujo principal (manchas y burbujas)
  const loose = foamArea - mainArea;
  const limpieza = clamp(10 - (loose / foamArea) * 40, 0, 10);

  const scores = { contraste, definicion, simetria, centrado, tamano, limpieza };
  const total = CRITERIA.reduce((a, c) => a + scores[c.id] * c.weight, 0) / 10;
  const notes = [];
  if (contraste < 6) notes.push('Más contraste: leche más blanca y crema más oscura, o más luz.');
  if (definicion < 6) notes.push('Bordes borrosos: vierte más cerca de la taza y termina con un corte limpio.');
  if (simetria < 6) notes.push('Le falta simetría: mantén la jarra centrada al vaciar.');
  if (centrado < 6) notes.push('El dibujo quedó corrido: empieza el vertido más al centro.');
  if (ratio < 0.3) notes.push('El dibujo es pequeño: acerca la jarra y vierte más rápido al final.');
  if (ratio > 0.65 || touches / mainArea > 0.02) notes.push('El dibujo se pasa de la taza: deja un aro de crema alrededor.');
  if (limpieza < 7) notes.push('Hay manchas o burbujas sueltas: golpea la jarra antes de verter.');

  return {
    ok: true,
    score: Math.round(total),
    scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, round1(v)])),
    notes,
    cup: { cx: Math.round(cx), cy: Math.round(cy), r: Math.round(r) },
    pattern: { cx: Math.round(px), cy: Math.round(py), area: mainArea, ratio: round1(ratio * 100) / 100 },
    w, h,
  };
}

/** «Muy bueno», «Bueno»…, para el puntaje. */
export function scoreBand(score) {
  if (score >= 85) return 'Nivel competencia';
  if (score >= 70) return 'Muy bueno';
  if (score >= 55) return 'Bueno';
  if (score >= 40) return 'En camino';
  return 'A practicar';
}

/** Lo que se guarda con la entrada (sin los píxeles). */
export const judgeRecord = (j) => (j?.ok ? { v: 1, score: j.score, scores: j.scores } : null);
