// El banner de 24 horas: lo que se puede probar sin navegador. La hora es la de
// Bogotá (decimal, 0–24): de ella salen el cielo, la tierra, el momento del
// barista y dónde van el sol y la luna.

/** Los nueve momentos del día del barista: hora y la pantalla de Micra que le toca. */
export const MOMENTS = [
  { key: 'precio', h: 4 + 40 / 60, img: '0440' },
  { key: 'salir', h: 5.5, img: '0530' },
  { key: 'pico', h: 7.25, img: '0715' },
  { key: 'qr', h: 10, img: '1000' },
  { key: 'leccion', h: 13, img: '1300' },
  { key: 'meta', h: 16 + 40 / 60, img: '1640' },
  { key: 'dia', h: 18.5, img: '1830' },
  { key: 'publicar', h: 21, img: '2100' },
  { key: 'descanso', h: 23.5, img: '2330' },
];

/** La hora de Bogotá (UTC−5, sin horario de verano) en decimal. */
export function bogotaHour(date = new Date()) {
  const ms = date.getTime() - 5 * 3600e3;
  return (((ms % 864e5) + 864e5) % 864e5) / 3600e3;
}

/** El momento que corre a esa hora: el último que ya empezó; de madrugada sigue el descanso. */
// Apenas se abre la página el reloj corre: el día entero pasa en un minuto, de hora en hora (pedido del usuario,
// 10 nov 2026: «la idea es mostrar que es 24 horas»). Arranca en la hora real de Bogotá.
export const DAY_SECONDS = 60;
/** Segundos que se queda cada hora antes de saltar a la siguiente (pedido del usuario, 10 nov 2026). */
export const HOUR_SECONDS = DAY_SECONDS / 24;
/** El reloj de hora en hora: arranca en la hora en punto de la visita y salta una hora entera cada HOUR_SECONDS. */
export const stepHour = (start, seconds, day = DAY_SECONDS) => (Math.floor(start) + Math.floor((seconds * 24) / day)) % 24;
/** La hora que marca el reloj `seconds` segundos después de abrir en `start`. */
export const runHour = (start, seconds, day = DAY_SECONDS) => (((start + (seconds * 24) / day) % 24) + 24) % 24;

export function momentAt(h) {
  let i = MOMENTS.length - 1;
  MOMENTS.forEach((m, j) => { if (m.h <= h) i = j; });
  return i;
}

/** «6:05» y si es antes del mediodía, para el reloj grande. */
export function clockOf(h) {
  const x = ((h % 24) + 24) % 24;
  // en minutos enteros primero: con el reloj corriendo, 9,99999 daba «9:60»
  const min = Math.floor(x * 60 + 1e-6) % 1440, H = Math.floor(min / 60), m = min % 60;
  return { text: `${((H + 11) % 12) + 1}:${String(m).padStart(2, '0')}`, am: H < 12 };
}

// Cielo: [hora, arriba, abajo]
const SKY = [[0, '#0D0820', '#1A0F45'], [4.4, '#0D0820', '#22125A'], [5.4, '#22125A', '#B0127A'], [6.3, '#5A1E9E', '#F2542D'], [7.3, '#C2337A', '#FFC23C'],
  [9, '#FFDFA6', '#F7EFE0'], [13, '#F3EEE6', '#F5EFE4'], [16.2, '#FFE7B8', '#FFC873'], [17.6, '#FF9A4A', '#F2542D'], [18.6, '#7A1A9A', '#F2542D'], [20, '#22125A', '#5A1E9E'], [22, '#0D0820', '#22125A'], [24, '#0D0820', '#1A0F45']];
// La tierra: [hora, lomo, fondo, borde, resplandor]
const EARTH = [[0, '#1A0F45', '#0D0820', '#5A1E9E', 'rgba(90,30,158,.5)'], [5, '#22125A', '#0D0820', '#B0127A', 'rgba(176,18,122,.6)'], [6.4, '#3A1470', '#150B3A', '#FF8A3D', 'rgba(242,84,45,.75)'],
  [8.5, '#2A2F66', '#1A1F48', '#FFC23C', 'rgba(255,194,60,.5)'], [13, '#26304E', '#1E2742', '#1E2742', 'rgba(30,39,66,.16)'], [16.6, '#2A2F66', '#1A1F48', '#FFC23C', 'rgba(255,194,60,.5)'],
  [18.2, '#3A1470', '#150B3A', '#FF8A3D', 'rgba(242,84,45,.75)'], [19.6, '#22125A', '#0D0820', '#B0127A', 'rgba(176,18,122,.6)'], [24, '#1A0F45', '#0D0820', '#5A1E9E', 'rgba(90,30,158,.5)']];

const rgba = (c) => (c.startsWith('#') ? [...[1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)), 1] : c.match(/[\d.]+/g).map(Number));
/** Mezcla dos colores (#hex o rgba()) y devuelve rgba(). */
export function mix(a, b, k) {
  const x = rgba(a), y = rgba(b), v = x.map((n, i) => n + (y[i] - n) * k);
  return `rgba(${Math.round(v[0])},${Math.round(v[1])},${Math.round(v[2])},${Number(v[3].toFixed(3))})`;
}
const lum = (c) => { const [r, g, b] = rgba(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const at = (T, h) => { let s = 0; while (s < T.length - 2 && T[s + 1][0] <= h) s += 1; return [T[s], T[s + 1], (h - T[s][0]) / (T[s + 1][0] - T[s][0])]; };

/**
 * Todo el color de una hora, como variables CSS del banner: cielo, tierra,
 * la cuadra (papel con tinta de día, añil con ventanas encendidas de noche)
 * y cuánto se ven estrellas y nubes. `day` dice si el texto va en tinta.
 */
export function paletteAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  const [a, b, k] = at(SKY, h), top = mix(a[1], b[1], k), bot = mix(a[2], b[2], k), L = lum(top), dayK = smooth(0.3, 0.72, L);
  const [ea, eb, ek] = at(EARTH, h), e1 = mix(ea[1], eb[1], ek);
  return {
    day: L > 0.52,
    vars: {
      '--db-top': top, '--db-bot': bot,
      '--db-e1': e1, '--db-e2': mix(ea[2], eb[2], ek), '--db-rim': mix(ea[3], eb[3], ek), '--db-glow': mix(ea[4], eb[4], ek),
      '--db-bfill': mix(mix(e1, '#3A2488', 0.35), '#FFFDF8', dayK), '--db-ink': mix('rgba(255,255,255,.86)', '#1E2742', dayK),
      '--db-walk': mix(mix(e1, '#7A5FD0', 0.34), '#BDB5A6', dayK), '--db-street': mix(mix(e1, '#5A3FB0', 0.16), '#DDD6C8', dayK),
      '--db-far': mix(mix(bot, e1, 0.55), mix(bot, '#1E2742', 0.16), dayK), '--db-far2': mix(mix(bot, e1, 0.72), mix(bot, '#1E2742', 0.3), dayK),
      '--db-lit': clamp((0.5 - L) * 3).toFixed(2), '--db-night': clamp((0.2 - L) * 8).toFixed(2), '--db-cloud': (smooth(0.55, 0.85, L) * 0.95).toFixed(2),
      '--db-edge': (0.75 * (1 - dayK)).toFixed(2), '--db-wb': (0.9 + 0.1 * dayK).toFixed(3), '--db-shade': (0.55 + 0.45 * dayK).toFixed(2),
    },
  };
}

/**
 * Por dónde van el sol y la luna: u de 0 (sale) a 1 (se mete), o null si no
 * están; `low` crece cerca del horizonte (el destello del amanecer).
 */
export function orbsAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  const su = (h - 5.75) / 12.5, mu = (((h - 18.7) + 24) % 24) / 10.6;
  const in01 = (u) => u > 0 && u < 1;
  return {
    sun: in01(su) ? su : null, moon: in01(mu) ? mu : null,
    low: in01(su) ? Math.min(1, (1 - Math.sin(su * Math.PI)) ** 3 * 1.7) : 0,
  };
}

/** El camino más corto entre dos horas del reloj (para pasar de una a otra sin dar la vuelta larga). */
export function hourLerp(from, to, k) {
  let d = (((to - from) % 24) + 36) % 24 - 12;
  if (d === -12) d = 12;
  return (((from + d * k) % 24) + 24) % 24;
}

/** Generador con semilla: la misma cuadra en cada visita. */
export const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/**
 * La geometría del banner para un ancho y alto: radio de la tierra, horizonte,
 * dónde pisa el barista y el sector que se repite. La cuadra gira de a
 * sectores iguales: basta dibujar los que se ven y girar módulo un sector.
 */
export function layoutOf(W, H) {
  const small = W <= 820;
  const R = small ? 1150 : Math.max(2300, W * 1.75);
  const hy = small ? H * 0.735 : H * 0.69;
  const cx = small ? W * 0.42 : W * 0.6;
  const wx = small ? W * 0.29 : W * 0.56;
  const wh = small ? 190 : Math.min(330, H * 0.4), z = small ? 0.62 : 1;
  const stride = wh * 0.4;
  const N = Math.max(6, Math.round((2 * Math.PI * R * 3) / (36 * stride))), th = 360 / N;
  // sectores a cada lado del barista para cubrir la pantalla (más uno de margen por el giro)
  const half = (Math.asin(Math.min(0.99, (Math.max(cx, W - cx) + 80) / R)) * 180) / Math.PI;
  const span = Math.ceil(half / th) + 1;
  return { W, H, R, hy, cx, cy: hy + R, wx, wh, z, small, stride, N, th, span, lane: 30 * z };
}
