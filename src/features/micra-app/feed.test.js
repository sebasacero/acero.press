import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed, filterFeed, chipCounts, readPrices, millions, cupCost, coffeeOrderText, HOUSE, achievements, photoIdeas, readCurated, addCurated, CURATED, coffeeHead, priceTrend, priceRows, hoyTab, tabFeed, medalsOf, newsMark } from './feed.js';

const B = [
  { id: 'a', name: 'Marlene', referencia: 'Cl. 85 con Cra. 15', hora_inicio: 6, hora_fin: 11, prices: { tinto: 1500 }, status: 'usual' },
  { id: 'b', name: 'Wilson', localidad: 'Chapinero', status: 'live' },
  { id: 'c', name: 'Sin lugar' },
];

test('el muro abre con el precio y pone primero los puestos en la calle', () => {
  const f = buildFeed({ baristas: B });
  assert.equal(f[0].kind, 'precios');
  const puestos = f.filter((i) => i.kind === 'puestos');
  assert.deepEqual(puestos.map((p) => p.by), ['Wilson', 'Marlene']);
  assert.equal(puestos[1].text, 'Suele pasar de 6 a 11 a. m.');
  // Lo de la casa va del más nuevo al más viejo
  const house = f.filter((i) => HOUSE.some((h) => h.id === i.id));
  assert.equal(house[0].id, 'woc-bogota-2027');
  assert.equal(house.at(-1).id, 'wac-2025');
  // Lo curado sin fecha va al final
  assert.equal(f.at(-1).id, CURATED.find((c) => !c.date).id);
});

test('el barista no se ve a sí mismo como puesto; sus logros e ideas salen solo con su día', () => {
  assert.equal(buildFeed({ baristas: B, selfId: 'a' }).some((i) => i.baristaId === 'a'), false);
  assert.equal(buildFeed({}).some((i) => i.kind === 'logros' || i.kind === 'publicar'), false);
  const f = buildFeed({ me: { name: 'Marlene', streak: { count: 4, todayDone: true }, lessonsDone: 2, lessonsTotal: 6 }, dayKey: '2026-10-31' });
  assert.deepEqual(f.filter((i) => i.kind === 'logros').map((i) => i.id), ['racha', 'hito-3', 'escuela']);
  assert.equal(f.filter((i) => i.kind === 'publicar').length, 2);
  // Nunca cuántas tazas ni cuánta plata
  assert.ok(f.every((i) => !/tazas|\$/.test(`${i.title ?? ''} ${i.kind === 'logros' ? i.text : ''}`)));
});

test('el cliente (sin día propio) ve el café: precio, puestos, café de Colombia, recetas, videos y noticias', () => {
  const f = buildFeed({ baristas: B, dayKey: '2026-10-31' });
  const kinds = new Set(f.map((i) => i.kind));
  for (const k of ['precios', 'puestos', 'cafe', 'recetas', 'videos', 'noticias']) assert.ok(kinds.has(k), k);
  assert.ok(!kinds.has('logros') && !kinds.has('publicar'));
  const counts = chipCounts(f);
  assert.equal(counts.logros, 0);
  assert.equal(counts.publicar, 0);
});

test('la racha: invita a salir si hoy no vendió, a compartir si ya sumó', () => {
  const [r0] = achievements({ name: 'M', streak: { count: 0 } });
  assert.equal(r0.title, 'Empieza tu racha hoy');
  const [r1] = achievements({ name: 'M', streak: { count: 5, todayDone: false } });
  assert.equal(r1.title, '5 días en racha');
  assert.equal(r1.cta, 'out');
  const all = achievements({ name: 'M', streak: { count: 31, todayDone: true }, goalMet: true, lessonsDone: 6, lessonsTotal: 6 });
  assert.deepEqual(all.map((i) => i.title), ['31 días en racha', 'Un mes en la calle', '¡Cumpliste tu meta de hoy!', 'Escuela completa']);
  assert.deepEqual(achievements(null), []);
});

test('las ideas de foto cambian con el día y respetan cómo sale', () => {
  const a = photoIdeas('2026-10-31');
  assert.equal(a.length, 2);
  assert.notEqual(a[0].id, a[1].id);
  assert.deepEqual(photoIdeas('2026-10-31').map((x) => x.id), a.map((x) => x.id));
  assert.ok(photoIdeas('2026-10-31').every((x) => !['idea-recorrido', 'idea-sombrilla'].includes(x.id)));
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  assert.ok(days.some((d) => photoIdeas(d, 'caminando').some((x) => x.id === 'idea-recorrido')));
  assert.ok(days.every((d) => photoIdeas(d, 'caminando').every((x) => x.id !== 'idea-sombrilla')));
});

test('lo curado por el equipo: con título, de quién y solo enlaces https', () => {
  const raw = JSON.stringify([
    { id: 'f1', org: 'Finca', by: 'Finca La Esperanza', title: 'Cosecha nueva', text: 'Geisha lavado', source: 'https://ejemplo.co/x', image: 'javascript:alert(1)', date: '2026-10-30' },
    { org: 'Otro', by: 'X', title: 'Sin tipo' },
    { org: 'FNC', by: 'FNC', title: '' },
  ]);
  const c = readCurated(raw);
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'cafe');
  assert.equal(c[0].image, null);
  assert.equal(c[0].source, 'https://ejemplo.co/x');
  assert.deepEqual(readCurated('no es json'), []);
  assert.equal(addCurated(Array.from({ length: 30 }, (_, i) => ({ id: String(i) })), { title: 'nuevo' }).length, 30);
  assert.equal(addCurated(null, { title: 'nuevo' })[0].title, 'nuevo');
});

test('los chips filtran y cuentan; todo muestra todo', () => {
  const f = buildFeed({ baristas: B });
  assert.equal(filterFeed(f, 'todo').length, f.length);
  assert.ok(filterFeed(f, 'recetas').every((i) => i.kind === 'recetas'));
  const c = chipCounts(f);
  assert.equal(c.todo, f.length);
  assert.equal(c.puestos, 2);
  assert.equal(c.logros, 0);
});

test('los precios del equipo: solo números positivos y fecha AAAA-MM-DD', () => {
  assert.deepEqual(readPrices({ micra_precio_carga: '2.850.000', micra_precio_ny: '3.8', micra_precio_fecha: '2026-10-30' }), { carga: 2850000, ny: 3.8, date: '2026-10-30' });
  assert.deepEqual(readPrices({ micra_precio_carga: 'x', micra_precio_ny: '-1', micra_precio_fecha: 'ayer' }), { carga: null, ny: null, date: null });
  assert.equal(millions(2850000), '$2,85 M');
  assert.equal(cupCost(60000), 720);
});

test('el pedido de café por WhatsApp dice quién, cuánto y dónde', () => {
  assert.equal(coffeeOrderText({ name: 'Marlene Rojas', kilos: 2, where: 'Chapinero' }), 'Hola, soy Marlene de Micra. Quiero pedir 2 kilos de café para la AeroPress, para recoger o recibir en Chapinero. ¿Cuánto es y cuándo me llega?');
  assert.match(coffeeOrderText({ name: '', kilos: 1 }), /^Hola, soy barista de Micra\. Quiero pedir 1 kilo de café para la AeroPress\. /);
});

test('lo que publican los baristas va después del precio (y de los logros), antes de los puestos', () => {
  const post = { id: 'post-1', kind: 'publicaciones', by: 'Marlene' };
  const c = buildFeed({ baristas: B, posts: [post] });
  assert.equal(c[0].kind, 'precios');
  assert.equal(c[1].id, 'post-1');
  assert.ok(c.findIndex((i) => i.kind === 'puestos') > 1);
  const b = buildFeed({ baristas: B, posts: [post], me: { name: 'Jairo', streak: { count: 2 } }, dayKey: '2026-10-31' });
  assert.ok(b.findIndex((i) => i.id === 'post-1') > b.findLastIndex((i) => i.kind === 'logros'));
  assert.equal(chipCounts(c).publicaciones, 1);
  assert.deepEqual(filterFeed(c, 'publicaciones').map((i) => i.id), ['post-1']);
});

test('el reto de la semana va justo después del precio', () => {
  const f = buildFeed({ baristas: B, challenge: { id: 'c1', title: 'Arte latte: corazón', brief: 'El más limpio', days_left: 4, entries: 2 } });
  assert.equal(f[1].kind, 'reto');
  assert.equal(f[1].title, 'Arte latte: corazón');
  assert.equal(f[1].daysLeft, 4);
  assert.equal(buildFeed({ baristas: B, challenge: null }).some((i) => i.kind === 'reto'), false);
});

test('coffeeHead: la carga en grande y los datos del café; sin precio, el tinto de la calle', () => {
  const now = new Date('2026-11-06T15:00:00Z');
  const baristas = [{ live_until: '2026-11-06T17:00:00Z' }, { live_until: '2026-11-06T10:00:00Z' }, {}];
  const h = coffeeHead({ prices: { carga: 2850000, ny: 3.8, date: '2026-11-06' }, baristas, now });
  assert.equal(h.big.value, millions(2850000));
  assert.deepEqual(h.kpis.map((k) => k.id), ['ny', 'kilo', 'taza', 'tinto', 'live']);
  assert.equal(h.kpis.find((k) => k.id === 'kilo').value, '$22.800');
  assert.equal(h.kpis.find((k) => k.id === 'taza').value, `$${cupCost(22800).toLocaleString('es-CO')}`);
  assert.equal(h.kpis.find((k) => k.id === 'live').value, '1');
  assert.equal(h.kpis.find((k) => k.id === 'live').label, 'barista en la calle');
  const none = coffeeHead({ prices: {}, baristas: [], now });
  assert.match(none.big.label, /tinto en la calle/);
  assert.deepEqual(none.kpis.map((k) => k.id), ['live']);
});

test('la flechita del precio: subió, bajó o igual, y el anterior se guarda al cambiar de día', () => {
  assert.equal(priceTrend(100, null), null);
  assert.deepEqual(priceTrend(2900000, 2850000), { dir: 'up', pct: '1,8 %' });
  assert.equal(priceTrend(3.7, 3.8).dir, 'down');
  assert.equal(priceTrend(100, 100).dir, 'flat');
  const p = readPrices({ micra_precio_carga: '2.900.000', micra_precio_carga_ant: '2.850.000', micra_precio_ny: '3,80' });
  assert.equal(p.prevCarga, 2850000);
  assert.equal(p.prevNy, undefined);
  const h = coffeeHead({ prices: p, baristas: [] });
  assert.equal(h.big.trend.dir, 'up');
  assert.equal(h.kpis.find((k) => k.id === 'kilo').trend.dir, 'up');
  assert.equal(h.kpis.find((k) => k.id === 'ny').trend, null);
  // Cambia de día: el de antes pasa a ser el anterior
  const cfg = { micra_precio_carga: '2.850.000', micra_precio_ny: '3,80', micra_precio_fecha: '2026-11-06' };
  const rows = Object.fromEntries(priceRows({ carga: '2.900.000', ny: '3,70' }, cfg, '2026-11-07').map((r) => [r.key, r.value]));
  assert.deepEqual(rows, { micra_precio_carga: '2.900.000', micra_precio_ny: '3,70', micra_precio_fecha: '2026-11-07', micra_precio_carga_ant: '2.850.000', micra_precio_ny_ant: '3,80' });
  // Corrige el mismo día: el anterior no se pisa
  const same = Object.fromEntries(priceRows({ carga: '2.910.000', ny: '3,70' }, { ...cfg, micra_precio_fecha: '2026-11-07', micra_precio_carga_ant: '2.800.000' }, '2026-11-07').map((r) => [r.key, r.value]));
  assert.equal(same.micra_precio_carga_ant, '2.800.000');
  assert.equal(same.micra_precio_ny_ant, undefined);
});

test('el muro lleva a lo más 12 puestos, los de la calle primero', async () => {
  const { FEED_PUESTOS } = await import('./feed.js');
  const baristas = Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, referencia: `Cra. ${i}`, status: i === 39 ? 'live' : 'off' }));
  const puestos = buildFeed({ baristas }).filter((i) => i.kind === 'puestos');
  assert.equal(puestos.length, FEED_PUESTOS);
  assert.equal(puestos[0].by, 'B39');
});

test('Hoy en tres pestañas: noticias y recetas aparte, los logros como medallas', () => {
  assert.equal(hoyTab('cafe'), 'noticias');
  assert.equal(hoyTab('videos'), 'noticias');
  assert.equal(hoyTab('recetas'), 'recetas');
  assert.equal(hoyTab('puestos'), 'ahora');
  const items = [
    { id: 'racha', kind: 'logros', badge: 'racha', count: 4, title: 'Llevas 4 días' },
    { id: 'escuela', kind: 'logros', badge: 'escuela', done: 2, total: 6, title: '2 de 6 lecciones', text: 'Sigue' },
    { id: 'meta', kind: 'logros', badge: 'meta', title: '¡Cumpliste tu meta de hoy!' },
    { id: 'p', kind: 'puestos' }, { id: 'n', kind: 'cafe', org: 'FNC' }, { id: 'r', kind: 'recetas' },
  ];
  assert.deepEqual(tabFeed(items, 'ahora').map((i) => i.id), ['p']);
  assert.deepEqual(tabFeed(items, 'noticias').map((i) => i.id), ['n']);
  assert.deepEqual(medalsOf(items).map((m) => m.mark), ['4', '2/6', '✓']);
  assert.equal(medalsOf(items)[0].title, 'Días de racha');
  assert.equal(newsMark({ org: 'FNC' }), 'FNC');
  assert.equal(newsMark({ by: 'ACERO.press' }), 'AP');
  assert.equal(newsMark({ kind: 'videos' }), '▶');
});
