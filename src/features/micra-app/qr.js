import qrcode from 'qrcode-generator';

// El QR propio de Micra: lleva al enlace del barista (/micra/b/<id>) con un
// dibujo al centro (el termo, el vasito, el carrito, la sombrilla o el chico que
// camina). Corrección de errores alta (H, ~30 %): el dibujo tapa como mucho un
// 7 % de los módulos, así que se sigue leyendo aunque el vaso se manche.

export const QR_LOGOS = [
  { id: 'termo', label: 'Termo', src: '/image/micra-qr/termo.svg' },
  { id: 'vasito', label: 'Vasito', src: '/image/micra-qr/vasito.svg' },
  { id: 'carrito', label: 'Carrito', src: '/image/micra-qr/carrito.svg', mode: 'fijo' },
  { id: 'sombrilla', label: 'Sombrilla', src: '/image/micra-qr/sombrilla.svg', mode: 'sombrilla' },
  { id: 'caminando', label: 'Caminando', src: '/image/micra-qr/caminando.svg', mode: 'caminando' },
];

export const isLogo = (id) => QR_LOGOS.some((l) => l.id === id);
export const logoOf = (id) => QR_LOGOS.find((l) => l.id === id) ?? QR_LOGOS[0];

/** El dibujo que sale de entrada: el de cómo sale a vender, o el termo de Micra. */
export function defaultLogo(mode, saved = null) {
  if (isLogo(saved)) return saved;
  return QR_LOGOS.find((l) => l.mode && l.mode === mode)?.id ?? 'termo';
}

/** Matriz de módulos (true = oscuro) del texto, con corrección H. */
export function qrMatrix(text) {
  const q = qrcode(0, 'H');
  q.addData(String(text), 'Byte');
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (__, c) => q.isDark(r, c)));
}

/**
 * El hueco del centro para el dibujo, en módulos: un cuadrado impar centrado
 * de ~26 % del lado (≈7 % del área, muy por debajo del 30 % que aguanta H).
 */
export function logoHole(n, ratio = 0.26) {
  let size = Math.floor(n * ratio);
  if (size % 2 !== n % 2) size -= 1;
  const start = (n - size) / 2;
  return { start, end: start + size, size };
}

const inHole = (r, c, hole) => hole && r >= hole.start && r < hole.end && c >= hole.start && c < hole.end;

// Los tres ojos (7 × 7) se dibujan aparte, redondeados
export const isFinder = (r, c, n) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

/** El trazo SVG de los módulos oscuros, sin los ojos ni el hueco del centro (1 módulo = 1 unidad, con margen `quiet`). */
export function modulesPath(matrix, { quiet = 4, hole = null } = {}) {
  const n = matrix.length;
  let d = '';
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!matrix[r][c] || isFinder(r, c, n) || inHole(r, c, hole)) continue;
      d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return d;
}

/** Las esquinas de los tres ojos (en módulos, con el margen). */
export function finderOrigins(n, quiet = 4) {
  return [[quiet, quiet], [quiet + n - 7, quiet], [quiet, quiet + n - 7]];
}

/** El enlace corto que se escribe debajo del QR (sin https://). */
export const shortUrl = (url) => String(url ?? '').replace(/^https?:\/\//, '').replace(/^www\./, '');

/** Nombre del archivo: «qr-micra-marlene-termo.png». */
export function qrFileName(name, logo) {
  const slug = String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `qr-micra-${slug || 'barista'}-${isLogo(logo) ? logo : 'termo'}.png`;
}
