import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bogota, isNight, money, hourLabel, windowLabel, status, menuOf, cartTotal, bump, cartItems, itemsLabel,
  meters, distanceLabel, sortBaristas, filterBaristas, pickBaristas, daySummary, weekBars, weekdayLetter, fiadoMessage,
  parseRoute, redTop, landingAfterLogin, newRef, initials, paymentsOf, extrasOf, recentFiados, MAX_CUPS, holdStage, outProgress,
} from './micraApp.js';

// 26 oct 2026, 7:30 a. m. en Bogotá (UTC−5)
const MORNING = new Date('2026-10-26T12:30:00Z');
const NIGHT = new Date('2026-10-27T00:30:00Z'); // 7:30 p. m.

test('la hora y el día son los de Bogotá, no los del celular', () => {
  assert.deepEqual(bogota(MORNING), { day: '2026-10-26', hour: 7, minute: 30 });
  assert.equal(bogota(new Date('2026-10-27T03:00:00Z')).day, '2026-10-26'); // 10 p. m. del 26
  assert.equal(isNight(MORNING), false);
  assert.equal(isNight(NIGHT), true);
});

test('plata y horas como se dicen aquí', () => {
  assert.equal(money(1500), '$1.500');
  assert.equal(money('96000.0'), '$96.000');
  assert.equal(hourLabel(6), '6 a. m.');
  assert.equal(hourLabel(12), '12 m.');
  assert.equal(hourLabel(20), '8 p. m.');
  assert.equal(windowLabel(6, 11), 'de 6 a 11 a. m.');
  assert.equal(windowLabel(10, 20), 'de 10 a. m. a 8 p. m.');
  assert.equal(windowLabel(14, 18), 'de 2 a 6 p. m.');
  assert.equal(windowLabel(null, 11), null);
});

test('estado: avisó que salió, su hora de siempre o más tarde', () => {
  const b = { hora_inicio: 6, hora_fin: 11 };
  assert.equal(status(b, MORNING), 'usual');
  assert.equal(status(b, NIGHT), 'off');
  assert.equal(status({ ...b, live_until: '2026-10-27T01:00:00Z' }, NIGHT), 'live');
  assert.equal(status({ ...b, live_until: '2026-10-26T12:00:00Z' }, MORNING), 'usual'); // ya venció
});

test('el menú solo trae lo que tiene precio; el pedido no pasa de 6 tazas', () => {
  const b = { prices: { tinto: 1500, perico: '2000' }, products: ['tinto', 'perico', 'ponque', 'cigarrillos'], payments: ['efectivo', 'nequi', 'fiado'] };
  const menu = menuOf(b);
  assert.deepEqual(menu.map((m) => [m.id, m.price]), [['tinto', 1500], ['perico', 2000]]);
  assert.deepEqual(extrasOf(b), ['ponqué']); // sin cigarrillos
  assert.deepEqual(paymentsOf(b), ['Efectivo', 'Nequi']); // el fiado no se ofrece en público
  let cart = {};
  cart = bump(cart, 'tinto', 1);
  cart = bump(cart, 'tinto', 1);
  cart = bump(cart, 'perico', 1);
  assert.deepEqual(cartTotal(cart, menu), { cups: 3, total: 5000 });
  for (let i = 0; i < 10; i += 1) cart = bump(cart, 'tinto', 1);
  assert.equal(cartTotal(cart, menu).cups, MAX_CUPS);
  cart = bump(cart, 'perico', -5);
  assert.equal(cart.perico, 0);
  assert.deepEqual(cartItems(cart), [{ product: 'tinto', qty: 5 }]);
});

test('el pedido se lee en palabras', () => {
  assert.equal(itemsLabel([{ product: 'tinto', qty: 2 }]), '2 tintos');
  assert.equal(itemsLabel([{ product: 'tinto', qty: 1 }, { product: 'perico', qty: 1 }, { product: 'aromatica', qty: 2 }]), '1 tinto, 1 perico y 2 aromáticas');
  assert.equal(itemsLabel([]), '');
});

test('distancia en cuadras', () => {
  const a = { lat: 4.6431, lng: -74.0636 };
  const m = meters(a, { lat: 4.6458, lng: -74.0636 });
  assert.ok(m > 290 && m < 310, String(m));
  assert.equal(distanceLabel(m), 'a 3 cuadras');
  assert.equal(distanceLabel(80), 'a una cuadra');
  assert.equal(distanceLabel(2400), 'a 2,4 km');
  assert.equal(meters(a, { lat: null }), null);
});

test('la lista: favoritos, luego en la calle, luego su hora, luego el más cerca', () => {
  const me = { lat: 4.6431, lng: -74.0636 };
  const list = [
    { id: 'a', name: 'Lejos usual', hora_inicio: 6, hora_fin: 11, lat: 4.66, lng: -74.06 },
    { id: 'b', name: 'Cerca usual', hora_inicio: 6, hora_fin: 11, lat: 4.644, lng: -74.0636 },
    { id: 'c', name: 'En la calle', hora_inicio: 14, hora_fin: 18, live_until: '2026-10-26T15:00:00Z' },
    { id: 'd', name: 'Tarde', hora_inicio: 14, hora_fin: 18, prices: { perico: 2000 } },
  ];
  assert.deepEqual(sortBaristas(list, { me, now: MORNING }).map((b) => b.id), ['c', 'b', 'a', 'd']);
  assert.deepEqual(sortBaristas(list, { me, now: MORNING, favorites: ['d'] }).map((b) => b.id), ['d', 'c', 'b', 'a']);
  const sorted = sortBaristas(list, { me, now: MORNING });
  assert.deepEqual(filterBaristas(sorted, 'live').map((b) => b.id), ['c', 'b', 'a']);
  assert.deepEqual(filterBaristas(sorted, 'perico').map((b) => b.id), ['d']);
  // La bebida y «Ahora» se combinan
  assert.deepEqual(pickBaristas(sorted).map((b) => b.id), ['c', 'b', 'a', 'd']);
  assert.deepEqual(pickBaristas(sorted, { drink: 'perico' }).map((b) => b.id), ['d']);
  assert.deepEqual(pickBaristas(sorted, { drink: 'perico', now: true }).map((b) => b.id), []);
  assert.deepEqual(pickBaristas(sorted, { now: true }).map((b) => b.id), ['c', 'b', 'a']);
});

test('el día del barista: tazas, plata, fiado y quién espera', () => {
  const day = {
    sales: [
      { product: 'tinto', qty: 1, total: 1500 },
      { product: 'perico', qty: 2, total: 4000, fiado_name: 'Portero' },
    ],
    holds: [{ status: 'waiting', cups: 2 }, { status: 'served', cups: 1 }, { status: 'waiting', cups: 1 }],
    fiados: [{ name: 'Portero', total: 4000, cups: 2 }, { name: 'Papelería', total: '5500', cups: 3 }],
  };
  const s = daySummary(day);
  assert.equal(s.cups, 3);
  assert.equal(s.total, 5500);
  assert.equal(s.cash, 1500);
  assert.equal(s.byProduct.perico, 2);
  assert.equal(s.waiting, 2);
  assert.equal(s.waitingCups, 3);
  assert.equal(s.owed, 9500);
  assert.deepEqual(recentFiados(day), ['Portero', 'Papelería']);
  assert.match(fiadoMessage(day.fiados[1], 'Marlene Rojas'), /Te escribe Marlene.*\$5\.500.*3 tazas/);
});

test('la semana: barras relativas y hoy al final', () => {
  const bars = weekBars([{ day: '2026-10-25', cups: 10 }, { day: '2026-10-26', cups: 5 }]);
  assert.equal(bars[0].h, 1);
  assert.equal(bars[1].h, 0.5);
  assert.equal(bars[1].today, true);
  assert.equal(weekdayLetter('2026-10-26'), 'L');
  assert.deepEqual(weekBars([{ day: '2026-10-26', cups: 0 }])[0].h, 0);
});

test('rutas internas de /micra', () => {
  assert.deepEqual(parseRoute('/micra'), { view: 'home' });
  assert.deepEqual(parseRoute('/micra/'), { view: 'home' });
  assert.deepEqual(parseRoute('/micra/b/60000000-0000-0000-0000-00000000000A'), { view: 'barista-card', id: '60000000-0000-0000-0000-00000000000a' });
  assert.deepEqual(parseRoute('/micra/b/<script>'), { view: 'home' });
  assert.deepEqual(parseRoute('/micra/barista'), { view: 'barista' });
  assert.deepEqual(parseRoute('/micra/barista/vender'), { view: 'barista', tab: 'vender' });
  assert.deepEqual(parseRoute('/micra/barista/hoy'), { view: 'barista', tab: 'hoy' });
  assert.deepEqual(parseRoute('/micra/barista/aprende/'), { view: 'barista', tab: 'aprende' });
  assert.deepEqual(parseRoute('/micra/barista/otra'), { view: 'home' });
  // «Mi perfil» del barista (pestaña sin botón abajo), del cliente y del equipo
  assert.deepEqual(parseRoute('/micra/barista/perfil'), { view: 'barista', tab: 'perfil' });
  assert.deepEqual(parseRoute('/micra/perfil'), { view: 'me' });
  assert.deepEqual(parseRoute('/micra/equipo/perfil'), { view: 'owner', tab: 'perfil' });
  assert.deepEqual(parseRoute('/micra/equipo'), { view: 'owner' });
  assert.deepEqual(parseRoute('/micra/apartados'), { view: 'holds' });
  assert.deepEqual(parseRoute('/micra/hoy'), { view: 'feed' });
  assert.deepEqual(parseRoute('/micra/estudio'), { view: 'study' });
  assert.deepEqual(parseRoute('/micra/camara'), { view: 'camera' });
  assert.deepEqual(parseRoute('/micra/ficha'), { view: 'ficha' });
  assert.deepEqual(parseRoute('/micra/video'), { view: 'video' });
});

test('referencias e iniciales', () => {
  const r = newRef('venta', () => 0.5);
  assert.match(r, /^venta-[0-9a-z]+-[0-9a-z]{8}$/);
  assert.ok(r.length >= 8 && r.length <= 64);
  assert.equal(initials('Marlene Rojas Díaz'), 'MR');
  assert.equal(initials(''), '?');
});

test('holdStage: apartado → salió → en tu cuadra → recibido, sin prometer de más', () => {
  const now = new Date('2026-10-26T12:30:00Z'); // 7:30 a. m. en Bogotá
  const b = { hora_inicio: 6, hora_fin: 11 };
  const live = { ...b, live_until: '2026-10-26T15:00:00Z' };
  assert.equal(holdStage({ status: 'waiting' }, b, now), 0);
  assert.equal(holdStage({ status: 'waiting' }, live, now), 2);
  assert.equal(holdStage({ status: 'waiting' }, { ...live, hora_inicio: 14, hora_fin: 18 }, now), 1);
  assert.equal(holdStage({ status: 'served' }, b, now), 3);
  assert.equal(holdStage({ status: 'cancelled' }, b, now), null);
  assert.equal(holdStage(null, b, now), null);
});

test('outProgress: cuánto lleva la salida y cuánto le queda', () => {
  const now = new Date('2026-10-26T12:30:00Z');
  const p = outProgress('2026-10-26T14:16:00Z', now);
  assert.equal(p.pct.toFixed(2), '0.56');
  assert.equal(p.leftLabel, '1 h 46 min');
  assert.equal(outProgress('2026-10-26T12:00:00Z', now), null);
  assert.equal(outProgress(null, now), null);
  assert.equal(outProgress('2026-10-26T12:40:00Z', now).leftLabel, '10 min');
});

test('al entrar con Google, el equipo va a su panel y el barista a su día', () => {
  assert.equal(landingAfterLogin({ admin: true, barista: null }), '/micra/equipo');
  assert.equal(landingAfterLogin({ admin: true, barista: { id: 'b1' } }), '/micra/barista');
  assert.equal(landingAfterLogin({ admin: false, barista: { id: 'b1' } }), '/micra/barista');
  // Sin cuenta enlazada: a poner el código del equipo
  assert.equal(landingAfterLogin({ admin: false, barista: null }), '/micra/barista');
});

test('scoreboard: hoy con lo que no ha subido, contra ayer, meta y récord', async () => {
  const { scoreboard } = await import('./micraApp.js');
  const week = [
    { day: '2026-10-23', cups: 20, total: 30000 }, { day: '2026-10-24', cups: 40, total: 60000 },
    { day: '2026-10-25', cups: 0, total: 0 }, { day: '2026-10-26', cups: 10, total: 15000 },
    { day: '2026-10-27', cups: 25, total: 37500 }, { day: '2026-10-28', cups: 30, total: 45000 },
    { day: '2026-10-29', cups: 0, total: 0 },
  ];
  const day = { week, sales: [{ product: 'tinto', qty: 10, total: 15000 }], holds: [], fiados: [{ total: 3000 }] };
  const b = scoreboard(day, [{ product: 'tinto', qty: 2 }], { tinto: 1500 });
  assert.equal(b.cups, 12);
  assert.equal(b.total, 18000);
  assert.equal(b.goal, 40);
  assert.equal(b.goalLeft, 28);
  assert.equal(b.vsYesterday, -60);
  assert.equal(b.record, false);
  assert.equal(b.weekCups, 125 + 12);
  assert.equal(b.owed, 3000);
  const fresh = scoreboard({ week: [{ cups: 0, total: 0 }], sales: [], holds: [], fiados: [] });
  assert.equal(fresh.goal, 30);
  assert.equal(fresh.vsYesterday, null);
  assert.equal(scoreboard({ ...day, sales: [{ product: 'tinto', qty: 41, total: 61500 }] }).record, true);
});

test('la barra de arriba va en rojo solo en Vender y en la calle', () => {
  assert.equal(redTop({ view: 'barista' }, true), true);
  assert.equal(redTop({ view: 'barista', tab: 'vender' }, true), true);
  assert.equal(redTop({ view: 'barista' }, false), false);
  assert.equal(redTop({ view: 'barista', tab: 'hoy' }, true), false);
  assert.equal(redTop({ view: 'barista', tab: 'perfil' }, true), false);
  assert.equal(redTop({ view: 'home' }, true), false);
  assert.equal(redTop(null, true), false);
});
