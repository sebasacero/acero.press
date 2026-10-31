import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { qrMatrix, logoHole, modulesPath, finderOrigins, isFinder, defaultLogo, qrFileName, shortUrl, QR_LOGOS } from './qr.js';

const URL = 'https://www.aceropress.com/micra/b/60000000-0000-0000-0000-000000000001';

/** Pinta la matriz como se dibuja (ojos llenos, hueco blanco) y la lee con jsQR. */
function decode(matrix, hole, scale = 6, quiet = 4) {
  const n = matrix.length;
  const side = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const inHole = hole && r >= hole.start && r < hole.end && c >= hole.start && c < hole.end;
      if (!matrix[r][c] || inHole) continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const i = (((r + quiet) * scale + y) * side + (c + quiet) * scale + x) * 4;
          px[i] = 31; px[i + 1] = 36; px[i + 2] = 82;
        }
      }
    }
  }
  return jsQR(px, side, side)?.data ?? null;
}

test('el QR lleva al enlace del barista y se lee con el hueco del dibujo', () => {
  const m = qrMatrix(URL);
  const hole = logoHole(m.length);
  assert.equal(decode(m, null), URL);
  assert.equal(decode(m, hole), URL);
});

test('el hueco es impar o par como el lado, centrado y pequeño', () => {
  for (const n of [25, 29, 33, 37, 41]) {
    const h = logoHole(n);
    assert.equal(h.start, n - h.end);
    assert.equal(Number.isInteger(h.start), true);
    assert.ok((h.size * h.size) / (n * n) < 0.09, `n=${n}`);
  }
});

test('los ojos y el hueco no van en el trazo de módulos', () => {
  const m = qrMatrix(URL);
  const n = m.length;
  const hole = logoHole(n);
  const d = modulesPath(m, { hole });
  assert.ok(!d.includes('M4 4h'));
  const mid = 4 + Math.floor(n / 2);
  assert.ok(!d.includes(`M${mid} ${mid}h`));
  assert.ok(isFinder(0, 0, n) && isFinder(0, n - 1, n) && isFinder(n - 1, 0, n) && !isFinder(n - 1, n - 1, n));
  assert.deepEqual(finderOrigins(n), [[4, 4], [n - 3, 4], [4, n - 3]]);
});

test('el dibujo de entrada sigue cómo sale, o el que guardó', () => {
  assert.equal(defaultLogo('caminando'), 'caminando');
  assert.equal(defaultLogo('fijo'), 'carrito');
  assert.equal(defaultLogo('sombrilla'), 'sombrilla');
  assert.equal(defaultLogo(null), 'termo');
  assert.equal(defaultLogo('caminando', 'vasito'), 'vasito');
  assert.equal(defaultLogo('fijo', 'otro'), 'carrito');
  assert.equal(QR_LOGOS.length, 5);
});

test('nombre de archivo y enlace corto', () => {
  assert.equal(qrFileName('Marlene Peña', 'sombrilla'), 'qr-micra-marlene-pena-sombrilla.png');
  assert.equal(qrFileName('', 'x'), 'qr-micra-barista-termo.png');
  assert.equal(shortUrl(URL), 'aceropress.com/micra/b/60000000-0000-0000-0000-000000000001');
});
