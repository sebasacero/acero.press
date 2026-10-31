import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed, filterFeed, chipCounts, readPrices, millions, cupCost, coffeeOrderText, HOUSE, achievements, photoIdeas, readCurated, addCurated, CURATED } from './feed.js';

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
