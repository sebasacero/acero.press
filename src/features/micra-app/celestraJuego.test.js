import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XP, avance, camino, ganado, juego, nivel, puntos, racha, statsFromEstado } from './celestraJuego.js';

test('puntos y niveles: premian decidir y hacer; el último nivel es World of Coffee', () => {
  assert.equal(puntos({ partes: 2, decididas: 6, hechas: 3, plenos: 2 }), 2 * 10 + 6 * 5 + 3 * 30 + 2 * 15);
  assert.equal(puntos({ partes: -1, decididas: 'x' }), 0);
  assert.deepEqual(nivel(0), { n: 1, nombre: 'Semilla', xp: 0, siguiente: 'Almácigo', faltan: 100, pct: 0 });
  assert.equal(nivel(150).nombre, 'Almácigo');
  assert.equal(nivel(150).pct, 25);
  const top = nivel(9999);
  assert.equal(top.nombre, 'World of Coffee');
  assert.equal(top.siguiente, null);
  assert.equal(top.pct, 100);
});

test('racha: días seguidos con parte; sin parte hoy, la de ayer sigue viva', () => {
  assert.equal(racha(['2026-11-12', '2026-11-11', '2026-11-10'], '2026-11-12'), 3);
  assert.equal(racha(['2026-11-11', '2026-11-10'], '2026-11-12'), 2);
  assert.equal(racha(['2026-11-10'], '2026-11-12'), 0);
  assert.equal(racha(['2026-11-12', '2026-11-10'], '2026-11-12'), 1);
  assert.equal(racha([], '2026-11-12'), 0);
});

test('sin la función de la base: cuenta con el estado de la tarjeta y avisa que es parcial', () => {
  const estado = {
    parte: { day: '2026-11-12', propuestas: [{ estado: 'hecha' }, { estado: 'pendiente' }, { estado: 'pendiente' }] },
    decisiones: [
      { dia: '2026-11-12', estado: 'hecha' },
      { dia: '2026-11-11', estado: 'aprobada' }, { dia: '2026-11-11', estado: 'descartada' }, { dia: '2026-11-11', estado: 'hecha' },
    ],
  };
  const s = statsFromEstado(estado);
  assert.equal(s.partes, 2);
  assert.equal(s.decididas, 4);
  assert.equal(s.hechas, 2);
  assert.equal(s.plenos, 1);
  const j = juego(s, '2026-11-12');
  assert.equal(j.xp, 20 + 20 + 60 + 15);
  assert.equal(j.racha, 2);
  assert.equal(j.parcial, true);
  assert.equal(juego({}, '2026-11-12').xp, 0);
});

test('ganado: hecha vale más y la última del día suma el pleno', () => {
  assert.equal(ganado('aprobada'), XP.decidir);
  assert.equal(ganado('hecha'), XP.decidir + XP.hecha);
  assert.equal(ganado('descartada', { ultima: true }), XP.decidir + XP.pleno);
});

test('camino: cada tramo con su dato real; lo que no se mide lo dice y no cuenta en el avance', () => {
  const l = { encuestas: { encuestas: 5, meta: 25 }, dia: { semana: [{ tazas: 20 }, { tazas: 30 }] } };
  const c = camino(l, { redes: { posts: 0 }, tienda: { pedidos_30d: 4 } });
  assert.deepEqual(c.map((t) => [t.id, t.valor, t.pct]), [['estudio', 5, 20], ['ventas', 50, 50], ['redes', null, 0], ['tienda', 4, 40], ['descargas', null, 0]]);
  assert.match(c[2].texto, /Conecta Instagram/);
  assert.equal(avance(c), Math.round((20 + 50 + 40) / 3));
  assert.equal(avance(camino({})), null);
  assert.equal(camino({ encuestas: { encuestas: 40, meta: 25 } })[0].pct, 100);
});
