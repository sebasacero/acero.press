import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOrigen, sellersOf, sellerById, monogram, cupsPerKilo, cupCost, pergaminoKilo, baristaCoffee, shopItems, filterShop, bumpCart, cartLines, cartCount, cartTotal, shopText, coffeeLine, readPreparaCon, writePreparaCon, fincaMissing, fincaPreview, fincaText, emptyFinca, readFinca, writeFinca, DEMO_ORIGEN } from './origen.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('readOrigen limpia el JSON: solo marcas y fincas con nombre y un café; nada roto pasa', () => {
  assert.deepEqual(readOrigen('no es json'), { sellers: [] });
  assert.deepEqual(readOrigen(null), { sellers: [] });
  const o = readOrigen(JSON.stringify(DEMO_ORIGEN));
  assert.equal(o.sellers.length, 5);
  assert.equal(sellersOf(o, 'marcas').length, 4);
  assert.equal(sellersOf(o, 'fincas').length, 1);
  const f = sellerById(o, 'la-esperanza');
  assert.equal(f.kind, 'finca');
  assert.equal(f.verified, true);
  assert.equal(f.lots[0].bags.length, 2);
  assert.equal(f.lots[0].roasted, '2026-10-29');
  // Sin lotes no entra; un lote sin precio ni bolsa tampoco
  const r = readOrigen({ marcas: [{ name: 'Sin café' }, { name: 'Una', lots: [{ name: 'x' }, { name: 'ok', kilo: '52.000' }] }], fincas: 'no' });
  assert.equal(r.sellers.length, 1);
  assert.equal(r.sellers[0].id, 'una');
  assert.equal(r.sellers[0].lots.length, 1);
  assert.equal(r.sellers[0].lots[0].kilo, 52000);
  // Enlaces solo https; color solo #rrggbb
  const u = readOrigen({ marcas: [{ name: 'M', url: 'http://x', color: 'red', lots: [{ name: 'a', kilo: 1000 }] }] });
  assert.equal(u.sellers[0].url, null);
  assert.equal(u.sellers[0].color, null);
  assert.equal(monogram('Amor Perfecto'), 'AP');
});

test('la cuenta del barista: tazas por kilo, café por taza y el kilo pergamino de la carga', () => {
  assert.equal(cupsPerKilo(), 83);
  assert.equal(cupCost(48000), 576);
  assert.equal(cupCost(0), null);
  assert.equal(pergaminoKilo(2900000), 23200);
  const o = readOrigen(DEMO_ORIGEN);
  const list = baristaCoffee(o);
  assert.equal(list.length, 7);
  assert.equal(list[0].id, 'lote:amor-perfecto:espresso');
  assert.match(list[0].note, /83 tazas por kilo/);
  assert.equal(coffeeLine(list[0], 2), '2 kilos · Amor Perfecto · Espresso de la casa ($104.000)');
});

test('la góndola del cliente: bolsas de marcas y fincas más lo de la casa, filtros y carrito', () => {
  const items = shopItems(readOrigen(DEMO_ORIGEN));
  assert.equal(items.filter((i) => i.cat === 'bolsas').length, 8);
  assert.equal(filterShop(items, 'coldbrew').length, 1);
  assert.equal(filterShop(items, 'todo').length, items.length);
  let cart = bumpCart({}, 'acero:coldbrew', 1);
  cart = bumpCart(cart, 'acero:coldbrew', 3);
  cart = bumpCart(cart, 'bolsa:la-esperanza:castillo:250', 1);
  cart = bumpCart(cart, 'bolsa:la-esperanza:castillo:250', -1);
  assert.deepEqual(cart, { 'acero:coldbrew': 4 });
  assert.equal(bumpCart({ a: 20 }, 'a', 1).a, 20);
  const lines = cartLines(items, { 'acero:coldbrew': 4, 'bolsa:la-esperanza:castillo:250': 1, 'nada': 3 });
  assert.equal(lines.length, 2);
  assert.equal(cartCount(lines), 5);
  assert.equal(cartTotal(lines), 52000);
  assert.equal(lines.find((l) => l.id.startsWith('bolsa:')).grind, 'Molido para AeroPress');
  assert.match(shopText({ lines: cartLines(items, { 'bolsa:la-esperanza:castillo:250': 1 }, { 'bolsa:la-esperanza:castillo:250': 'En grano' }), delivery: 'recoger' }), /Castillo lavado 250 g \(Finca La Esperanza\), En grano/);
  const t = shopText({ name: 'Ana', zone: 'Chapinero', lines, delivery: 'barista', barista: 'Marlene' });
  assert.match(t, /Hola, soy Ana/);
  assert.match(t, /1 × Castillo lavado 250 g \(Finca La Esperanza\), Molido para AeroPress · \$16.000/);
  assert.match(t, /Total: \$52.000/);
  assert.match(t, /Me lo trae Marlene con mi próxima taza/);
  assert.match(shopText({ lines, delivery: 'recoger' }), /un cliente de Micra[\s\S]*Lo recojo en ACERO.press/);
  assert.match(shopText({ lines, delivery: 'domicilio', zone: 'Usaquén' }), /A domicilio en Usaquén/);
});

test('«Prepara con…» se guarda en el celular', () => {
  const s = mem();
  assert.equal(readPreparaCon(s), null);
  writePreparaCon({ id: 'lote:x:y', label: 'X · Y', seller: 'X', extra: 1 }, s);
  assert.deepEqual(readPreparaCon(s), { id: 'lote:x:y', label: 'X · Y', seller: 'X' });
  writePreparaCon(null, s);
  assert.equal(readPreparaCon(s), null);
});

test('la finca: qué falta en cada paso, la vista previa y el mensaje al equipo', () => {
  const d = emptyFinca();
  assert.deepEqual(fincaMissing(d, 0), ['tu nombre', 'el nombre de la finca', 'el municipio']);
  Object.assign(d, { owner: 'Rosalba Quintero', name: 'La Esperanza', city: 'Pitalito, Huila' });
  assert.deepEqual(fincaMissing(d, 0), []);
  assert.deepEqual(fincaMissing(d, 1), ['la altura', 'las hectáreas', 'desde qué año']);
  Object.assign(d, { altitude: '1.750', hectares: '3,5', since: '2009' });
  assert.deepEqual(fincaMissing(d, 1), []);
  assert.deepEqual(fincaMissing(d, 2), ['los kilos', 'el precio por kilo']);
  Object.assign(d, { kg: '40', kilo: '48.000', notes: 'Panela, naranja' });
  assert.deepEqual(fincaMissing(d, 2), []);
  assert.deepEqual(fincaMissing(d, 3), ['qué tiene tu finca en internet', 'a quién le vendes', 'si te interesa vender a baristas']);
  d.presencia = { ...d.presencia, canales: ['whatsapp', 'facebook'], venta: 'cooperativa', interes: 'si' };
  assert.deepEqual(fincaMissing(d, 3), []);
  assert.deepEqual(fincaMissing(d, 4), []);
  const p = fincaPreview(d);
  assert.equal(p.id, 'la-esperanza');
  assert.equal(p.altitude, 1750);
  assert.equal(p.hectares, 3.5);
  assert.equal(p.lots[0].name, 'Castillo lavado');
  assert.equal(p.lots[0].kilo, 48000);
  const t = fincaText(d);
  assert.match(t, /Rosalba Quintero de la finca La Esperanza \(Pitalito, Huila\)/);
  assert.match(t, /1.750 m · 3,5 ha · desde 2009/);
  assert.match(t, /Lote: Castillo lavado · 40 kg · \$48.000 el kilo · Panela, naranja/);
  assert.match(t, /En internet: whatsapp en mi celular, página de facebook de la finca/);
  assert.match(t, /Hoy vendo: a la cooperativa o la fnc/);
  const s = mem();
  assert.equal(readFinca(s), null);
  writeFinca(d, s);
  assert.equal(readFinca(s).name, 'La Esperanza');
  assert.deepEqual(readFinca(s).presencia.canales, ['whatsapp', 'facebook']);
  // Un borrador de antes de este paso abre con la presencia vacía
  s.setItem('micra_finca_v1', JSON.stringify({ name: 'Vieja' }));
  assert.deepEqual(readFinca(s).presencia.canales, []);
});

test('café de la casa: una tarjeta de 250 g por café, sin el sobre ni los que no tienen precio', async () => {
  const { houseCoffeeCards, houseOrderText } = await import('./origen.js');
  const cards = houseCoffeeCards([
    { id: 'aji', name: 'Bourbon Aji', variety: 'Bourbon Aji', image: '/image/aji.png', sizes: ['18G', '250G', '500G', '1KG'], prices: { '18G': 3000, '250G': 25000, '500G': 50000, '1KG': 68000 } },
    { id: 'solo-kilo', name: 'Kilo', sizes: ['18G', '1KG'], prices: { '18G': 3000, '1KG': 60000 } },
    { id: 'sin', name: 'Sin precio', sizes: [], prices: {} },
  ]);
  assert.equal(cards.length, 2);
  assert.deepEqual([cards[0].size, cards[0].price, cards[0].sizeText, cards[0].variety, cards[0].sizes], ['250G', 25000, '250 g', null, '250 g · 500 g · 1 kg']);
  assert.equal(cards[1].size, '1KG');
  assert.match(houseOrderText(cards[0]), /Bourbon Aji en bolsa de 250 g/);
});

test('Café como restaurantes: fincas primero, cada café con su bolsa más pequeña o el kilo', async () => {
  const { sellerShelves, lotCard } = await import('./origen.js');
  const origen = readOrigen(DEMO_ORIGEN);
  const all = sellerShelves(origen);
  assert.equal(all[0].kind, 'finca');
  assert.equal(all.length, DEMO_ORIGEN.marcas.length + DEMO_ORIGEN.fincas.length);
  assert.ok(sellerShelves(origen, 'marcas').every((x) => x.kind === 'marca'));
  assert.deepEqual(sellerShelves({ sellers: [] }), []);
  const c = lotCard(all[0].lots[0]);
  assert.deepEqual([c.price, c.unit, c.line, c.notes], [16000, '250 g', 'Lavado', 'Panela, naranja, cuerpo medio']);
  assert.deepEqual([lotCard({ id: 'k', name: 'Kilo', kilo: 50000, bags: [] }).unit, lotCard({ id: 'k', name: 'Kilo', kilo: 50000, bags: [] }).price], ['kilo', 50000]);
});
