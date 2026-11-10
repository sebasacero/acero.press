import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOMENTS, bogotaHour, momentAt, clockOf, paletteAt, orbsAt, hourLerp, layoutOf, mix, rng, runHour, DAY_SECONDS } from './dayBanner.js';

test('bogotaHour: UTC menos cinco, sin horario de verano', () => {
  assert.equal(bogotaHour(new Date('2026-11-09T10:30:00Z')), 5.5);
  assert.equal(bogotaHour(new Date('2026-07-01T03:00:00Z')), 22);
  assert.equal(bogotaHour(new Date('2026-11-09T05:00:00Z')), 0);
});

test('momentAt: el último momento que ya empezó; de madrugada sigue el descanso', () => {
  assert.equal(MOMENTS[momentAt(5.5)].key, 'salir');
  assert.equal(MOMENTS[momentAt(7.2)].key, 'salir');
  assert.equal(MOMENTS[momentAt(7.25)].key, 'pico');
  assert.equal(MOMENTS[momentAt(16.9)].key, 'meta');
  assert.equal(MOMENTS[momentAt(23.9)].key, 'descanso');
  assert.equal(MOMENTS[momentAt(0.5)].key, 'descanso');
  assert.equal(MOMENTS[momentAt(4.7)].key, 'precio');
});

test('clockOf: doce horas sin cero adelante', () => {
  assert.deepEqual(clockOf(5.5), { text: '5:30', am: true });
  assert.deepEqual(clockOf(0.1), { text: '12:06', am: true });
  assert.deepEqual(clockOf(12), { text: '12:00', am: false });
  assert.deepEqual(clockOf(16 + 40 / 60), { text: '4:40', am: false });
  assert.deepEqual(clockOf(23.99), { text: '11:59', am: false });
});

test('paletteAt: de noche texto claro y ventanas encendidas; a mediodía tinta y nubes', () => {
  const night = paletteAt(23.5), noon = paletteAt(13);
  assert.equal(night.day, false);
  assert.equal(Number(night.vars['--db-lit']), 1);
  assert.equal(Number(night.vars['--db-night']), 1);
  assert.equal(Number(night.vars['--db-cloud']), 0);
  assert.equal(noon.day, true);
  assert.equal(Number(noon.vars['--db-lit']), 0);
  assert.ok(Number(noon.vars['--db-cloud']) > 0.9);
  // la medianoche cierra: 24 es 0
  assert.deepEqual(paletteAt(24).vars, paletteAt(0).vars);
  for (let h = 0; h < 24; h += 0.25) for (const v of Object.values(paletteAt(h).vars)) assert.ok(!/NaN/.test(v), `${h}: ${v}`);
});

test('orbsAt: sol de día, luna de noche, destello solo cerca del horizonte', () => {
  assert.equal(orbsAt(13).moon, null);
  assert.ok(orbsAt(12).sun > 0.45 && orbsAt(12).sun < 0.55);
  assert.ok(orbsAt(12).low < 0.01);
  assert.ok(orbsAt(6.2).low > 0.9);
  assert.equal(orbsAt(23).sun, null);
  assert.ok(orbsAt(23).moon > 0 && orbsAt(2).moon < 1);
  assert.equal(orbsAt(5).sun, null);
});

test('hourLerp: pasa por la medianoche si es más corto', () => {
  assert.equal(hourLerp(23, 1, 0.5), 0);
  assert.equal(hourLerp(1, 23, 0.5), 0);
  assert.equal(hourLerp(6, 10, 0.25), 7);
  assert.equal(hourLerp(6, 10, 1), 10);
});

test('layoutOf: los sectores dibujados cubren la pantalla y cierran la vuelta', () => {
  for (const [W, H] of [[390, 844], [820, 700], [1440, 820], [2560, 900]]) {
    const g = layoutOf(W, H);
    assert.ok(Math.abs(g.N * g.th - 360) < 1e-9);
    const reach = Math.sin((g.span - 1) * g.th * Math.PI / 180) * g.R;   // con un sector ya gastado en el giro
    assert.ok(reach >= Math.max(g.cx, W - g.cx), `${W}: ${reach}`);
    assert.ok(g.wx > 0 && g.wx < W);
  }
  assert.equal(layoutOf(390, 844).small, true);
  assert.equal(layoutOf(1440, 820).small, false);
});

test('mix y rng: deterministas', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), 'rgba(128,128,128,1)');
  assert.equal(mix('rgba(0,0,0,0)', '#ffffff', 1), 'rgba(255,255,255,1)');
  const a = rng(5), b = rng(5);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('runHour: el día corre desde la hora de la visita y da la vuelta', () => {
  assert.equal(runHour(6.5, 0), 6.5);
  assert.equal(runHour(6, DAY_SECONDS / 4), 12);
  assert.equal(runHour(23, DAY_SECONDS / 12), 1);
  assert.ok(Math.abs(runHour(13.25, DAY_SECONDS) - 13.25) < 1e-9);
});

test('clockOf: nunca marca el minuto 60', () => {
  assert.equal(clockOf(9.99999999).text, '10:00');
  assert.equal(clockOf(23.99999999).text, '12:00');
  assert.equal(clockOf(23.99999999).am, true);
});
