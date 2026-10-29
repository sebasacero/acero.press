import test from 'node:test';
import assert from 'node:assert/strict';
import { toBitmap, printJob, chunks, isPrintDone, loadPrinter, savePrinter, MAX_BLOCK_ROWS } from './phomemo.js';

// Una imagen RGBA de w×h con una función (x, y) → [r, g, b, a]
const image = (width, height, px) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set(px(x, y), (y * width + x) * 4);
  return { data, width, height };
};
const black = () => [0, 0, 0, 255];
const white = () => [255, 255, 255, 255];

test('toBitmap: el píxel de la izquierda es el bit más alto y el negro es 1', () => {
  const bm = toBitmap(image(16, 1, (x) => (x === 0 || x === 9 ? black() : white())), 384);
  assert.equal(bm.bytesPerRow, 48);
  assert.equal(bm.rows[0], 0b10000000);
  assert.equal(bm.rows[1], 0b01000000);
  assert.equal(bm.rows[2], 0);
});

test('toBitmap: lo transparente y lo claro quedan en blanco; lo gris oscuro se imprime', () => {
  const bm = toBitmap(image(3, 1, (x) => ([[0, 0, 0, 0], [200, 200, 200, 255], [90, 90, 90, 255]][x])), 384);
  assert.equal(bm.rows[0], 0b00100000);
});

test('toBitmap: una imagen más ancha que la impresora se recorta a la derecha', () => {
  const bm = toBitmap(image(400, 1, black), 384);
  assert.equal(bm.rows.length, 48);
  assert.ok(bm.rows.every((b) => b === 0xff));
});

test('printJob: inicializa, densidad, alinea, un bloque GS v 0 con el alto exacto y avanza el papel', () => {
  const job = printJob(toBitmap(image(384, 2, black), 384));
  const bytes = [...job];
  assert.deepEqual(bytes.slice(0, 2), [0x1b, 0x40]);
  assert.deepEqual(bytes.slice(2, 6), [0x1f, 0x11, 0x02, 0x04]);
  assert.deepEqual(bytes.slice(6, 9), [0x1b, 0x61, 0x00]);
  // GS v 0, m=0, xL=48 xH=0, yL=2 yH=0
  assert.deepEqual(bytes.slice(9, 17), [0x1d, 0x76, 0x30, 0x00, 48, 0, 2, 0]);
  assert.equal(job.length, 9 + 8 + 48 * 2 + 3);
  assert.deepEqual(bytes.slice(-3), [0x1b, 0x64, 3]);
});

test('printJob: más de 255 filas van en varios bloques, el último con las que sobran', () => {
  const h = MAX_BLOCK_ROWS + 10;
  const job = printJob(toBitmap(image(8, h, white), 384), { density: 2, feedLines: 1 });
  const bytes = [...job];
  assert.deepEqual(bytes.slice(2, 6), [0x1f, 0x11, 0x02, 0x02]);
  const first = 9;
  assert.deepEqual(bytes.slice(first, first + 8), [0x1d, 0x76, 0x30, 0x00, 48, 0, 255, 0]);
  const second = first + 8 + 48 * 255;
  assert.deepEqual(bytes.slice(second, second + 8), [0x1d, 0x76, 0x30, 0x00, 48, 0, 10, 0]);
  assert.deepEqual(bytes.slice(-3), [0x1b, 0x64, 1]);
});

test('printJob: 576 puntos (M02 Pro) son 72 bytes por fila', () => {
  const bytes = [...printJob(toBitmap(image(576, 1, white), 576))];
  assert.deepEqual(bytes.slice(9, 17), [0x1d, 0x76, 0x30, 0x00, 72, 0, 1, 0]);
});

test('chunks: trozos de 128 y el último más corto, sin perder bytes', () => {
  const bytes = new Uint8Array(300).map((_, i) => i & 0xff);
  const c = chunks(bytes);
  assert.deepEqual(c.map((x) => x.length), [128, 128, 44]);
  assert.equal(c[2][43], 299 & 0xff);
});

test('isPrintDone reconoce 1A 0F 0C', () => {
  assert.equal(isPrintDone(new Uint8Array([0x1a, 0x0f, 0x0c])), true);
  assert.equal(isPrintDone(new Uint8Array([0x1a, 0x0f])), false);
  assert.equal(isPrintDone(null), false);
});

test('la impresora recordada: sin memoria o con un ancho desconocido, la de fábrica', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(loadPrinter(storage), { id: null, name: null, dots: 384 });
  savePrinter(storage, { id: 'ab12', name: 'M02 Pro', dots: 576 });
  assert.deepEqual(loadPrinter(storage), { id: 'ab12', name: 'M02 Pro', dots: 576 });
  storage.setItem('micra_printer_v1', '{"dots":100}');
  assert.equal(loadPrinter(storage).dots, 384);
  assert.equal(loadPrinter(null).dots, 384);
});
