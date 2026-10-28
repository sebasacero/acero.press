import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';

// Los videos los genera scripts/animar-personajes: aquí se cuida que estén los
// cinco con su póster y que sigan livianos para un celular con mala red.
const dir = new URL('./', import.meta.url);
const files = readdirSync(dir);
const NOMBRES = ['aeropress', 'caminando', 'carrito', 'ruana', 'servir'];

test('están los cinco personajes con su póster', () => {
  for (const n of NOMBRES) {
    assert.ok(files.includes(`${n}.mp4`), `${n}.mp4`);
    assert.ok(files.includes(`${n}-poster.webp`), `${n}-poster.webp`);
  }
});

for (const n of NOMBRES) {
  test(`${n}: el video pesa menos de 80 KB y el póster menos de 16 KB`, () => {
    assert.ok(statSync(new URL(`${n}.mp4`, dir)).size < 80 * 1024);
    assert.ok(statSync(new URL(`${n}-poster.webp`, dir)).size < 16 * 1024);
  });
}
