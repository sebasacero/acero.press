// El café de origen en Micra (7 nov 2026, pedido del usuario): quién hace el café que se
// toma en la calle. Marcas (tostadores con acuerdo) y fincas (caficultores verificados por el
// equipo) publican sus cafés; el barista los compra por kilo para preparar y el cliente ve una
// góndola con bolsas, cold brew y kits. Todo sale de app_config `micra_origen` (un JSON que
// carga el equipo) y los pedidos van por WhatsApp al equipo: Micra no cobra ni guarda dinero.
// Sin acuerdo firmado no hay marca en el JSON, así ninguna se nombra en público antes.

import { emptyPresencia, presenciaMissing, presenciaLines } from './presencia.js';

export const ORIGEN_KEY = 'micra_origen';
export const PREPARA_KEY = 'micra_prepara_con_v1';
export const FINCA_KEY = 'micra_finca_v1';
export const MAX_QTY = 20;
export const GRAMS_PER_CUP = 12;

export const KINDS = { marca: 'Marca', finca: 'Finca' };
export const PROCESOS = ['Lavado', 'Honey', 'Natural'];
export const VARIEDADES = ['Castillo', 'Caturra', 'Colombia', 'Típica', 'Geisha', 'Otra'];

const https = (u) => (typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u : null);
const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const slug = (v) => text(v, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (v) => { const n = Number(String(v ?? '').replace(/[.\s$]/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

/** Un lote (o un café de una marca): lo que se vende por kilo al barista y en bolsa al cliente. */
function readLot(x, sellerId, i) {
  const id = slug(x?.id) || `${sellerId}-${i + 1}`;
  const bags = Array.isArray(x?.bags) ? x.bags.map((b) => ({ g: num(b?.g), price: num(b?.price) })).filter((b) => b.g && b.price).slice(0, 4) : [];
  const lot = {
    id, name: text(x?.name, 60), notes: text(x?.notes, 120), process: PROCESOS.includes(x?.process) ? x.process : null,
    variety: text(x?.variety, 40), kilo: num(x?.kilo), kg: num(x?.kg), bags, roasted: /^\d{4}-\d{2}-\d{2}$/.test(x?.roasted ?? '') ? x.roasted : null,
    grind: Array.isArray(x?.grind) ? x.grind.map((g) => text(g, 30)).filter(Boolean).slice(0, 3) : ['Molido para AeroPress', 'En grano'],
  };
  return lot.name && (lot.kilo || bags.length) ? lot : null;
}

/** El JSON de app_config, limpio: solo lo que tiene nombre y al menos un café. */
export function readOrigen(raw) {
  let o;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { o = null; }
  if (!o || typeof o !== 'object') return { sellers: [] };
  const list = [];
  for (const kind of ['marca', 'finca']) {
    const arr = Array.isArray(o[kind === 'marca' ? 'marcas' : 'fincas']) ? o[kind === 'marca' ? 'marcas' : 'fincas'] : [];
    for (const x of arr) {
      const id = slug(x?.id) || slug(x?.name);
      const name = text(x?.name, 60);
      if (!id || !name) continue;
      const lots = (Array.isArray(x?.lots) ? x.lots : []).map((l, i) => readLot(l, id, i)).filter(Boolean).slice(0, 8);
      if (!lots.length) continue;
      list.push({
        id, kind, name, city: text(x?.city, 60), desc: text(x?.desc, 240), since: num(x?.since),
        altitude: kind === 'finca' ? num(x?.altitude) : null, hectares: kind === 'finca' ? num(x?.hectares) : null,
        owner: text(x?.owner, 60), verified: x?.verified === true, baristas: Math.max(0, Math.floor(num(x?.baristas) ?? 0)),
        points: (Array.isArray(x?.points) ? x.points : []).map((p) => text(p, 80)).filter(Boolean).slice(0, 6),
        url: https(x?.url), color: /^#[0-9a-f]{6}$/i.test(x?.color ?? '') ? x.color : null, lots,
      });
    }
  }
  return { sellers: list };
}

export const sellersOf = (origen, filter = 'todas') => (origen?.sellers ?? []).filter((s) => filter === 'todas' || s.kind === (filter === 'marcas' ? 'marca' : 'finca'));
export const sellerById = (origen, id) => (origen?.sellers ?? []).find((s) => s.id === id) ?? null;
/** «AP» para el logo de una marca sin imagen. */
export const monogram = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Cuántas tazas da un kilo (12 g por taza) y cuánto café hay en cada una. */
export const cupsPerKilo = (grams = GRAMS_PER_CUP) => Math.round(1000 / grams);
export const cupCost = (kiloPrice, grams = GRAMS_PER_CUP) => (kiloPrice > 0 ? Math.round((kiloPrice * grams) / 1000) : null);
/** El precio del kilo pergamino que sale de la carga de 125 kg de la FNC, para comparar. */
export const pergaminoKilo = (carga) => (carga > 0 ? Math.round(carga / 125) : null);

/** Lo que el barista puede pedir por kilo (va a la pestaña Café de Insumos). */
export function baristaCoffee(origen) {
  return (origen?.sellers ?? []).flatMap((s) => s.lots.filter((l) => l.kilo).map((l) => ({
    id: `lote:${s.id}:${l.id}`, label: `${s.name} · ${l.name}`, seller: s.name, sellerId: s.id, kind: s.kind, kilo: l.kilo,
    unit: 'kilo', units: 'kilos', note: `${cupsPerKilo()} tazas por kilo · ${l.notes || l.process || ''}`.replace(/ · $/, ''),
  })));
}

export const SHOP_CATEGORIES = [
  { id: 'todo', label: 'Todo' }, { id: 'bolsas', label: 'Bolsas' }, { id: 'coldbrew', label: 'Cold brew' }, { id: 'aeropress', label: 'AeroPress' }, { id: 'kits', label: 'Kits' },
];

/** Lo de la casa, siempre en la góndola (precios de referencia; el equipo confirma por WhatsApp). */
export const ACERO_SHOP = [
  { id: 'acero:coldbrew', cat: 'coldbrew', icon: '🥫', name: 'Cold brew ACERO.press', sub: 'Lata 330 ml', price: 9000, seller: 'ACERO.press', sellerId: null, kind: 'acero' },
  { id: 'acero:aeropress-go', cat: 'aeropress', icon: '🧪', name: 'AeroPress Go', sub: 'La prensa de viaje', price: 220000, seller: 'ACERO.press', sellerId: null, kind: 'acero' },
  { id: 'acero:kit', cat: 'kits', icon: '🧰', name: 'Kit AeroPress Go + 250 g', sub: 'Con la Escuela', price: 260000, seller: 'ACERO.press', sellerId: null, kind: 'acero' },
];

/** La góndola del cliente: las bolsas de marcas y fincas más lo de la casa. */
export function shopItems(origen, house = ACERO_SHOP) {
  const bags = (origen?.sellers ?? []).flatMap((s) => s.lots.flatMap((l) => l.bags.map((b) => ({
    id: `bolsa:${s.id}:${l.id}:${b.g}`, cat: 'bolsas', icon: s.kind === 'finca' ? '🫘' : '☕', name: `${l.name} ${b.g} g`, sub: `${s.name}${s.city ? ` · ${s.city}` : ''}`,
    price: b.price, seller: s.name, sellerId: s.id, kind: s.kind, lot: l, grams: b.g,
  }))));
  return [...bags, ...house];
}
export const filterShop = (items, cat = 'todo') => (cat === 'todo' ? items : items.filter((i) => i.cat === cat));
export const shopItemById = (items, id) => items.find((i) => i.id === id) ?? null;

/** Suma o resta uno (entre 0 y 20); lo que queda en 0 sale del carrito. */
export function bumpCart(cart = {}, id, delta, max = MAX_QTY) {
  const n = Math.max(0, Math.min(max, (Number(cart[id]) || 0) + delta));
  const next = { ...cart };
  if (n === 0) delete next[id]; else next[id] = n;
  return next;
}
/** `grinds` es la molienda escogida por producto ({ id: 'En grano' }); sin ella, la primera del lote. */
export function cartLines(items, cart = {}, grinds = {}) {
  return items.filter((i) => (Number(cart?.[i.id]) || 0) > 0).map((i) => {
    const qty = Math.floor(Number(cart[i.id]));
    const grind = i.lot?.grind?.includes(grinds?.[i.id]) ? grinds[i.id] : (i.lot?.grind?.[0] ?? null);
    return { ...i, qty, total: i.price * qty, grind };
  });
}
export const cartCount = (lines) => lines.reduce((n, l) => n + l.qty, 0);
export const cartTotal = (lines) => lines.reduce((n, l) => n + l.total, 0);

export const DELIVERY = [
  { id: 'barista', label: 'Con mi barista, en mi cuadra', text: 'Te lo lleva con tu próxima taza. Sin envío; pagas al recibir.' },
  { id: 'domicilio', label: 'A domicilio', text: 'El equipo te lo lleva. Envío según la zona; pagas al recibir.' },
  { id: 'recoger', label: 'Recoger en ACERO.press', text: 'Cra. 13 #85-32, Bogotá. Te avisamos cuándo está listo.' },
];

/** El mensaje de WhatsApp al equipo con el pedido de la góndola. */
export function shopText({ name, zone, lines, delivery, barista }) {
  const who = String(name || '').trim() || 'un cliente de Micra';
  const d = DELIVERY.find((x) => x.id === delivery) ?? DELIVERY[1];
  const how = d.id === 'barista' ? `Me lo trae ${barista ? barista : 'mi barista'} con mi próxima taza` : d.id === 'recoger' ? 'Lo recojo en ACERO.press' : `A domicilio${zone ? ` en ${zone}` : ''}`;
  return [
    `Hola, soy ${who}. Quiero pedir de la tienda de Micra:`,
    ...lines.map((l) => `• ${l.qty} × ${l.name} (${l.seller})${l.grind ? `, ${l.grind}` : ''} · $${l.total.toLocaleString('es-CO')}`),
    `Total: $${cartTotal(lines).toLocaleString('es-CO')}`,
    `${how}. Pago al recibir.`,
  ].join('\n');
}

/** El mensaje del barista que pide café por kilo (va con el resto de los insumos). */
export const coffeeLine = (item, qty) => `${qty} ${qty === 1 ? 'kilo' : 'kilos'} · ${item.label} ($${(item.kilo * qty).toLocaleString('es-CO')})`;

// «Prepara con…»: el café que el barista escogió, en este celular (sin tabla todavía)
export function readPreparaCon(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(PREPARA_KEY) ?? 'null'); return v && typeof v.id === 'string' ? v : null; } catch { return null; }
}
export function writePreparaCon(v, storage = globalThis.localStorage) {
  try { if (v) storage?.setItem(PREPARA_KEY, JSON.stringify({ id: v.id, label: v.label, seller: v.seller })); else storage?.removeItem(PREPARA_KEY); } catch { /* sin memoria */ }
}

// ---------- El caficultor crea su finca ----------
export const FINCA_STEPS = [
  { id: 'quien', title: 'Cuéntanos de tu finca', fields: ['owner', 'name', 'city'] },
  { id: 'finca', title: 'Cómo es tu finca', fields: ['altitude', 'hectares', 'since'] },
  { id: 'lote', title: 'Publica tu primer lote', fields: ['variety', 'process', 'kg', 'kilo'] },
  // Lo que la finca tiene en internet (presencia.js): sirve al equipo para medir la brecha
  { id: 'internet', title: 'Tu finca en internet', fields: ['presencia'] },
  { id: 'listo', title: 'Lo revisamos y te llamamos', fields: [] },
];

export const emptyFinca = () => ({ owner: '', name: '', city: '', altitude: '', hectares: '', since: '', variety: 'Castillo', process: 'Lavado', kg: '', kilo: '', notes: '', phone: '', presencia: emptyPresencia() });

/** Qué falta en un paso (vacío = se puede seguir). */
export function fincaMissing(d, step) {
  const s = FINCA_STEPS[step];
  if (!s) return [];
  const labels = { owner: 'tu nombre', name: 'el nombre de la finca', city: 'el municipio', altitude: 'la altura', hectares: 'las hectáreas', since: 'desde qué año', variety: 'la variedad', process: 'el proceso', kg: 'los kilos', kilo: 'el precio por kilo' };
  if (s.fields.includes('presencia')) return presenciaMissing(d?.presencia);
  return s.fields.filter((f) => (['altitude', 'hectares', 'since', 'kg', 'kilo'].includes(f) ? !num(d?.[f]) : !text(d?.[f], 80))).map((f) => labels[f]);
}

/** El borrador como se vería su perfil público (lo que se publica tras la verificación). */
export function fincaPreview(d) {
  const id = slug(d?.name) || 'mi-finca';
  const lot = { id: `${id}-1`, name: `${text(d?.variety, 40) || 'Café'} ${String(d?.process || '').toLowerCase()}`.trim(), notes: text(d?.notes, 120), process: PROCESOS.includes(d?.process) ? d.process : null, variety: text(d?.variety, 40), kilo: num(d?.kilo), kg: num(d?.kg), bags: [], grind: ['Molido para AeroPress', 'En grano'], roasted: null };
  return { id, kind: 'finca', name: text(d?.name, 60) || 'Mi finca', city: text(d?.city, 60), desc: '', since: num(d?.since), altitude: num(d?.altitude), hectares: num(d?.hectares), owner: text(d?.owner, 60), verified: false, baristas: 0, points: [], url: null, color: null, lots: lot.kilo ? [lot] : [] };
}

/** El mensaje al equipo para verificar la finca y el lote. */
export function fincaText(d) {
  const p = fincaPreview(d);
  const lot = p.lots[0];
  return [
    `Hola, soy ${p.owner || 'caficultor'} de la finca ${p.name}${p.city ? ` (${p.city})` : ''}. Quiero vender mi café en Micra.`,
    `Finca: ${p.altitude ? `${p.altitude.toLocaleString('es-CO')} m` : 'altura sin dato'} · ${p.hectares ? `${p.hectares.toLocaleString('es-CO')} ha` : 'hectáreas sin dato'}${p.since ? ` · desde ${p.since}` : ''}`,
    lot ? `Lote: ${lot.name} · ${lot.kg ? `${lot.kg} kg` : 'kilos sin dato'} · $${lot.kilo.toLocaleString('es-CO')} el kilo${lot.notes ? ` · ${lot.notes}` : ''}` : 'Lote: sin datos todavía',
    ...(d?.presencia?.canales?.length ? presenciaLines(d.presencia) : []),
    '¿Cuándo pueden probar una muestra?',
  ].join('\n');
}

export function readFinca(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(FINCA_KEY) ?? 'null'); return v && typeof v === 'object' ? { ...emptyFinca(), ...v, presencia: { ...emptyPresencia(), ...(v.presencia ?? {}) } } : null; } catch { return null; }
}
export function writeFinca(d, storage = globalThis.localStorage) {
  try { storage?.setItem(FINCA_KEY, JSON.stringify(d)); } catch { /* sin memoria */ }
}

/** Datos de muestra para el simulador y las capturas (no van a producción: el JSON real lo carga el equipo). */
export const DEMO_ORIGEN = {
  marcas: [
    { id: 'amor-perfecto', name: 'Amor Perfecto', city: 'Bogotá', since: 1997, color: '#B3261E', baristas: 11, desc: 'Tostador de especialidad; café de fincas colombianas con tueste medio.', points: ['Chapinero', 'Usaquén', 'Centro'], lots: [
      { id: 'espresso', name: 'Espresso de la casa', notes: 'Chocolate, nuez', process: 'Lavado', kilo: 52000, bags: [{ g: 340, price: 38000 }] },
      { id: 'huila', name: 'Huila lavado', notes: 'Panela, cítrico', process: 'Lavado', kilo: 58000, bags: [{ g: 340, price: 42000 }] },
    ] },
    { id: 'tropicalia', name: 'Tropicalia', city: 'Bogotá', since: 2014, color: '#1E6B3F', baristas: 5, desc: 'Café de especialidad con origen directo.', lots: [
      { id: 'narino', name: 'Nariño honey', notes: 'Mora, dulce', process: 'Honey', kilo: 64000, bags: [{ g: 250, price: 36000 }] },
    ] },
    { id: 'juan-valdez', name: 'Juan Valdez', city: 'Nacional', since: 2002, color: '#8A5A2B', baristas: 2, lots: [
      { id: 'clasico', name: 'Clásico', notes: 'Suave, balanceado', kilo: 48000, bags: [{ g: 500, price: 29000 }] },
    ] },
    { id: 'devocion', name: 'Devoción', city: 'Bogotá', since: 2006, color: '#1F2452', baristas: 3, lots: [
      { id: 'tolima', name: 'Tolima lavado', notes: 'Caramelo, naranja', process: 'Lavado', kilo: 60000, bags: [{ g: 250, price: 34000 }] },
    ] },
  ],
  fincas: [
    { id: 'la-esperanza', name: 'Finca La Esperanza', owner: 'Rosalba Quintero', city: 'Pitalito, Huila', altitude: 1750, hectares: 3.5, since: 2009, verified: true, baristas: 7, lots: [
      { id: 'castillo', name: 'Castillo lavado', variety: 'Castillo', process: 'Lavado', notes: 'Panela, naranja, cuerpo medio', kilo: 48000, kg: 40, roasted: '2026-10-29', bags: [{ g: 250, price: 16000 }, { g: 500, price: 30000 }] },
      { id: 'caturra', name: 'Caturra honey', variety: 'Caturra', process: 'Honey', notes: 'Mora, chocolate, dulce', kilo: 62000, kg: 12, bags: [{ g: 250, price: 19000 }] },
    ] },
  ],
};

// La pestaña Café (12 nov 2026, pedido del usuario: «aquí deberían verse principalmente la
// sección de las fincas y el café que venden»): las fincas y marcas con acuerdo y los cafés
// que vende ACERO.press (la tabla products, los mismos de la tienda de la web).
const SIZE_LABEL = { '18G': '18 g', '250G': '250 g', '500G': '500 g', '1KG': '1 kg' };
export const sizeLabel = (s) => SIZE_LABEL[s] ?? String(s ?? '').toLowerCase();

/** Una tarjeta por café de la casa: la bolsa de 250 g (o la primera que no sea el sobre de 18 g). */
export function houseCoffeeCards(coffees = []) {
  return (coffees ?? []).map((c) => {
    const sizes = (c.sizes ?? []).filter((z) => c.prices?.[z] > 0);
    const size = sizes.includes('250G') ? '250G' : sizes.find((z) => z !== '18G') ?? sizes[0];
    if (!c.name || !size) return null;
    const from = sizes.filter((z) => z !== '18G').map(sizeLabel).join(' · ');
    return { id: c.id, name: c.name, variety: c.variety && c.variety !== c.name ? c.variety : null, region: c.region ?? null, image: c.image ?? null, size, sizeText: sizeLabel(size), price: c.prices[size], sizes: from };
  }).filter(Boolean);
}

/** El mensaje de WhatsApp para pedir un café de la casa desde Micra. */
export function houseOrderText(card) {
  return `Hola, equipo de ACERO.press. Quiero pedir el café ${card.name} en bolsa de ${card.sizeText}. ¿Me cuentan cómo me llega? (Desde Micra)`;
}

/** La región de una finca o marca: lo último de «Pitalito, Huila» (el departamento), o la ciudad. */
export function regionOf(s) {
  const parts = String(s?.city ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return parts.at(-1) ?? null;
}

/** Las regiones con fincas, de la que más tiene a la que menos (12 nov 2026, pedido del usuario:
 *  «un carrusel de las fincas principales según la región»). Las marcas no cuentan como región. */
export function regionsOf(sellers) {
  const n = new Map();
  for (const s of sellers) if (s.kind === 'finca' && regionOf(s)) n.set(regionOf(s), (n.get(regionOf(s)) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([r]) => r);
}

/** Café como un listado de restaurantes (12 nov 2026, pedido del usuario): cada finca o marca
 *  con su nombre y debajo sus cafés en fila; primero las fincas, las verificadas y con más cafés
 *  delante. Con una región, solo las fincas de ahí (las marcas no tienen región). */
export function sellerShelves(origen, region = null) {
  const all = origen?.sellers ?? [];
  const rank = (a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0) || b.lots.length - a.lots.length;
  const fincas = all.filter((s) => s.kind === 'finca' && (!region || regionOf(s) === region)).sort(rank);
  return region ? fincas : [...fincas, ...all.filter((s) => s.kind !== 'finca')];
}

/** La tarjeta de un café de una finca o marca: la bolsa más pequeña, o el kilo si no vende bolsas. */
export function lotCard(lot) {
  const bag = [...(lot?.bags ?? [])].sort((a, b) => a.g - b.g)[0];
  const price = bag ? bag.price : lot?.kilo ?? null;
  return {
    id: lot.id, name: lot.name,
    line: [lot.process, lot.variety && !lot.name.includes(lot.variety) ? lot.variety : null].filter(Boolean).join(' · '),
    notes: lot.notes || null, price, unit: bag ? `${bag.g} g` : 'kilo',
  };
}

/** Espacios de muestra mientras no hay fincas (12 nov 2026, pedido del usuario: «aunque todavía no
 *  hay fincas crea 3 o 4 espacios de cómo se vería»). Sin nombres reales: ningún aliado se nombra
 *  antes del acuerdo. Tienen la forma de una finca de verdad para pasar por el mismo dibujo. */
const sampleLot = (id, name, process) => ({ id, name, process, notes: 'Tus notas de sabor', bags: [] });
export const SHELF_SAMPLES = [
  { id: 'muestra-huila', kind: 'finca', sample: true, name: 'Tu finca aquí', city: 'Huila', altitude: 1700, lots: [sampleLot('a', 'Tu café lavado', 'Lavado'), sampleLot('b', 'Tu café honey', 'Honey')] },
  { id: 'muestra-narino', kind: 'finca', sample: true, name: 'Tu finca aquí', city: 'Nariño', altitude: 1900, lots: [sampleLot('a', 'Tu café lavado', 'Lavado'), sampleLot('b', 'Tu microlote', 'Natural')] },
  { id: 'muestra-tolima', kind: 'finca', sample: true, name: 'Tu finca aquí', city: 'Tolima', altitude: 1600, lots: [sampleLot('a', 'Tu café natural', 'Natural')] },
  { id: 'muestra-marca', kind: 'marca', sample: true, name: 'Tu marca aquí', city: 'Bogotá', lots: [sampleLot('a', 'Tu café de la casa', 'Tostión media'), sampleLot('b', 'Tu espresso', 'Tostión oscura')] },
];
