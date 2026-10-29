// Impresoras térmicas Phomemo (M02, T02, M02 Pro) por Bluetooth LE: lo que se
// manda por el aire para que impriman una imagen. Puro, sin Bluetooth ni canvas:
// recibe píxeles y devuelve bytes. Protocolo ESC/POS (ráster GS v 0), el mismo
// que usan los drivers libres de Linux y de Chrome para estas impresoras.

// Servicio y características GATT que anuncian todas las Phomemo de este tipo
export const SERVICE = '0000ff00-0000-1000-8000-00805f9b34fb';
export const WRITE = '0000ff02-0000-1000-8000-00805f9b34fb';
export const NOTIFY = '0000ff03-0000-1000-8000-00805f9b34fb';

// Puntos por línea según el modelo: 53 mm a 203 dpi (M02, T02) o a 300 dpi (M02 Pro)
export const MODELS = [
  { id: 'm02', name: 'M02 · T02 (53 mm, 203 dpi)', dots: 384 },
  { id: 'm02pro', name: 'M02 Pro · M02S (53 mm, 300 dpi)', dots: 576 },
];
export const DEFAULT_DOTS = 384;

// Cada bloque GS v 0 lleva como mucho 255 filas; los bytes van en trozos cortos,
// con una pausa, porque la impresora no tiene memoria para recibirlo todo de golpe
export const MAX_BLOCK_ROWS = 255;
export const CHUNK_BYTES = 128;
export const CHUNK_PAUSE_MS = 20;

/**
 * Píxeles RGBA (ImageData) → mapa de bits de la impresora: una fila por línea,
 * `dots / 8` bytes por fila, el bit más alto es el píxel de la izquierda y 1 es negro.
 * `threshold`: de 0 a 255, lo más claro que todavía se imprime (luminancia).
 */
export function toBitmap({ data, width, height }, dots = DEFAULT_DOTS, threshold = 160) {
  const bytesPerRow = dots / 8;
  const rows = new Uint8Array(bytesPerRow * height);
  const w = Math.min(width, dots);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] / 255;
      // Lo transparente se imprime blanco
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * a + 255 * (1 - a);
      if (lum < threshold) rows[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { rows, bytesPerRow, height };
}

/** Un bloque ráster: GS v 0 m xL xH yL yH + filas. */
function rasterBlock(rows, bytesPerRow, from, count) {
  const head = [0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, count & 0xff, count >> 8];
  const body = rows.subarray(from * bytesPerRow, (from + count) * bytesPerRow);
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, head.length);
  return out;
}

/**
 * El trabajo completo: inicializar, densidad, alinear a la izquierda, la imagen
 * en bloques de hasta 255 filas y avanzar el papel para poder cortar.
 * `density`: 1 (clara), 2 o 4 (la de fábrica).
 */
export function printJob({ rows, bytesPerRow, height }, { density = 4, feedLines = 3 } = {}) {
  const parts = [
    new Uint8Array([0x1b, 0x40]), // ESC @
    new Uint8Array([0x1f, 0x11, 0x02, density]),
    new Uint8Array([0x1b, 0x61, 0x00]), // ESC a 0
  ];
  for (let from = 0; from < height; from += MAX_BLOCK_ROWS) {
    parts.push(rasterBlock(rows, bytesPerRow, from, Math.min(MAX_BLOCK_ROWS, height - from)));
  }
  parts.push(new Uint8Array([0x1b, 0x64, feedLines])); // ESC d n
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Trozos del tamaño que acepta la conexión. */
export function chunks(bytes, size = CHUNK_BYTES) {
  const out = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.subarray(i, Math.min(i + size, bytes.length)));
  return out;
}

/** ¿Es el aviso de «ya imprimí»? (1A 0F 0C) */
export const isPrintDone = (bytes) => bytes?.length >= 3 && bytes[0] === 0x1a && bytes[1] === 0x0f && bytes[2] === 0x0c;

/** Lo que se recuerda de la impresora elegida, para conectar sin volver a buscar. */
const KEY = 'micra_printer_v1';
export function loadPrinter(storage) {
  try {
    const p = JSON.parse(storage?.getItem(KEY) || 'null');
    if (!p || !MODELS.some((m) => m.dots === p.dots)) return { id: null, name: null, dots: DEFAULT_DOTS };
    return { id: p.id ?? null, name: p.name ?? null, dots: p.dots };
  } catch { return { id: null, name: null, dots: DEFAULT_DOTS }; }
}
export function savePrinter(storage, printer) {
  try { storage?.setItem(KEY, JSON.stringify({ id: printer.id ?? null, name: printer.name ?? null, dots: printer.dots ?? DEFAULT_DOTS })); } catch { /* sin memoria */ }
}
