import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeLatteArt, scoreBand, judgeRecord, CRITERIA } from './arteLatte.js';

// Una taza dibujada: fondo claro, crema café y espuma blanca con la forma que se pida
const BG = [235, 235, 235]; const CREMA = [120, 70, 30]; const FOAM = [250, 246, 238];
function cup({ w = 160, h = 160, r = 60, shape, blur = 0, specks = [] }) {
  const data = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2; const cy = h / 2;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let c = BG;
      const inCup = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      if (inCup) {
        c = CREMA;
        const f = shape(x, y, cx, cy, r); // 1 espuma, 0 crema, o entre 0 y 1 para bordes suaves
        if (f > 0) c = [CREMA[0] + (FOAM[0] - CREMA[0]) * f, CREMA[1] + (FOAM[1] - CREMA[1]) * f, CREMA[2] + (FOAM[2] - CREMA[2]) * f];
        for (const [sx, sy, sr] of specks) if ((x - sx) ** 2 + (y - sy) ** 2 <= sr * sr) c = FOAM;
      }
      const i = (y * w + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  void blur;
  return { width: w, height: h, data };
}
// Un corazón: dos círculos y un triángulo, centrado en (ox, oy) con tamaño s
const heart = (ox = 0, oy = 0, s = 0.5, soft = 0) => (x, y, cx, cy, r) => {
  const hx = (x - cx - ox * r) / (r * s); const hy = (y - cy - oy * r) / (r * s);
  // La ecuación del corazón: (x² + y² − 1)³ − x²·y³ ≤ 0 (y hacia arriba)
  const yy = -hy + 0.15;
  const v = (hx * hx + yy * yy - 1) ** 3 - hx * hx * yy ** 3;
  if (!soft) return v <= 0 ? 1 : 0;
  return v <= 0 ? 1 : Math.max(0, 1 - v / soft);
};
const circle = (ox, oy, s) => (x, y, cx, cy, r) => ((x - cx - ox * r) ** 2 + (y - cy - oy * r) ** 2 <= (r * s) ** 2 ? 1 : 0);

test('un corazón limpio y centrado puntúa alto en todo', () => {
  const j = judgeLatteArt(cup({ shape: heart(0, 0, 0.55) }));
  assert.equal(j.ok, true);
  assert.ok(j.score >= 85, `score ${j.score}`);
  for (const c of CRITERIA) assert.ok(j.scores[c.id] >= 8, `${c.id} ${j.scores[c.id]}`);
  assert.ok(Math.abs(j.cup.cx - 80) <= 2 && Math.abs(j.cup.r - 60) <= 3);
  assert.deepEqual(j.notes, []);
  assert.deepEqual(judgeRecord(j), { v: 1, score: j.score, scores: j.scores });
});

test('corrido del centro baja el centrado; chueco baja la simetría; pequeño baja el tamaño', () => {
  const centered = judgeLatteArt(cup({ shape: heart(0, 0, 0.55) }));
  const shifted = judgeLatteArt(cup({ shape: heart(0.35, 0.1, 0.55) }));
  assert.ok(shifted.scores.centrado < centered.scores.centrado - 3, `${shifted.scores.centrado}`);
  assert.ok(shifted.notes.some((n) => /corrido/.test(n)));
  // Mitad de corazón: solo el lado derecho
  const half = judgeLatteArt(cup({ shape: (x, y, cx, cy, r) => (x >= cx ? heart(0, 0, 0.55)(x, y, cx, cy, r) : 0) }));
  assert.ok(half.scores.simetria < centered.scores.simetria - 4, `${half.scores.simetria}`);
  const small = judgeLatteArt(cup({ shape: circle(0, 0, 0.2) }));
  assert.ok(small.scores.tamano < 7, `${small.scores.tamano}`);
  assert.ok(small.notes.some((n) => /pequeño/.test(n)));
});

test('bordes suaves bajan la definición; burbujas sueltas bajan la limpieza; poco contraste se nota', () => {
  const crisp = judgeLatteArt(cup({ shape: heart(0, 0, 0.55) }));
  const soft = judgeLatteArt(cup({ shape: heart(0, 0, 0.55, 1.5) }));
  assert.ok(soft.scores.definicion < crisp.scores.definicion - 2, `${soft.scores.definicion} vs ${crisp.scores.definicion}`);
  const specks = judgeLatteArt(cup({ shape: heart(0, 0, 0.45), specks: [[40, 40, 5], [120, 45, 5], [45, 120, 6], [118, 118, 6]] }));
  assert.ok(specks.scores.limpieza < crisp.scores.limpieza - 2, `${specks.scores.limpieza}`);
  assert.ok(specks.notes.some((n) => /burbujas/.test(n)));
  assert.ok(crisp.score > soft.score && crisp.score > specks.score);
});

test('sin taza, sin espuma o sin imagen, lo dice en vez de inventar un puntaje', () => {
  const blank = { width: 40, height: 40, data: new Uint8ClampedArray(40 * 40 * 4).fill(235) };
  assert.equal(judgeLatteArt(blank).ok, false);
  assert.match(judgeLatteArt(blank).reason, /crema/);
  const noFoam = judgeLatteArt(cup({ shape: () => 0 }));
  assert.equal(noFoam.ok, false);
  assert.match(noFoam.reason, /espuma/);
  assert.equal(judgeLatteArt(null).ok, false);
  assert.equal(judgeRecord(noFoam), null);
  assert.equal(scoreBand(90), 'Nivel competencia');
  assert.equal(scoreBand(50), 'En camino');
});

test('el mismo puntaje para la misma foto', () => {
  const img = cup({ shape: heart(0.05, -0.05, 0.5) });
  assert.deepEqual(judgeLatteArt(img), judgeLatteArt(img));
});
