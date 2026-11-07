// Insumos del barista (6 nov 2026, pedido del usuario): desde Mi perfil pide café, vasos,
// cigarrillos, chocolate y lo demás que vende o usa. Se arma el pedido y sale por WhatsApp al
// equipo, que confirma precio y entrega (como «Tu café»): Micra no cobra ni guarda dinero.
// El último pedido se queda en el celular para repetirlo con un toque.

export const INSUMOS_KEY = 'micra_insumos_v1';
export const MAX_QTY = 99;

export const CATEGORIES = [
  { id: 'cafe', label: 'Café', icon: '☕' },
  { id: 'vasos', label: 'Vasos', icon: '🥤' },
  { id: 'bebidas', label: 'Chocolate y más', icon: '🍫' },
  { id: 'cigarrillos', label: 'Cigarrillos', icon: '🚬' },
  { id: 'dulces', label: 'Dulces', icon: '🍬' },
  { id: 'equipo', label: 'Equipo', icon: '🧰' },
];

/** Lo que se puede pedir. `unit` es cómo se cuenta (lo que el equipo entrega por cada 1). */
export const INSUMOS = [
  { id: 'cafe-molido', icon: '☕', cat: 'cafe', label: 'Café molido para AeroPress', unit: 'kilo', units: 'kilos', note: 'Un kilo da unas 80 tazas' },
  { id: 'cafe-grano', icon: '🫘', cat: 'cafe', label: 'Café en grano', unit: 'kilo', units: 'kilos' },
  { id: 'vaso-4', icon: '🥤', cat: 'vasos', label: 'Vasos de 4 oz (tinto)', unit: 'paquete de 50', units: 'paquetes de 50' },
  { id: 'vaso-7', icon: '🥤', cat: 'vasos', label: 'Vasos de 7 oz (perico)', unit: 'paquete de 50', units: 'paquetes de 50' },
  { id: 'tapas', icon: '🫙', cat: 'vasos', label: 'Tapas', unit: 'paquete de 50', units: 'paquetes de 50' },
  { id: 'mezcladores', icon: '🥄', cat: 'vasos', label: 'Mezcladores', unit: 'paquete de 100', units: 'paquetes de 100' },
  { id: 'servilletas', icon: '🧻', cat: 'vasos', label: 'Servilletas', unit: 'paquete', units: 'paquetes' },
  { id: 'chocolate', icon: '🍫', cat: 'bebidas', label: 'Chocolate de mesa', unit: 'libra', units: 'libras' },
  { id: 'aromatica', icon: '🍵', cat: 'bebidas', label: 'Aromática', unit: 'caja de 20', units: 'cajas de 20' },
  { id: 'azucar', icon: '🍯', cat: 'bebidas', label: 'Azúcar en sobres', unit: 'bolsa de 100', units: 'bolsas de 100' },
  { id: 'panela', cat: 'bebidas', label: 'Panela', unit: 'kilo', units: 'kilos' },
  { id: 'leche', icon: '🥛', cat: 'bebidas', label: 'Leche', unit: 'litro', units: 'litros' },
  { id: 'cigarrillos', icon: '🚬', cat: 'cigarrillos', label: 'Cigarrillos', unit: 'cajetilla de 20', units: 'cajetillas de 20', note: 'Por cajetilla. Nunca a menores de edad' },
  { id: 'dulces', icon: '🍬', cat: 'dulces', label: 'Dulces y chicles', unit: 'bolsa', units: 'bolsas' },
  { id: 'galletas', icon: '🍪', cat: 'dulces', label: 'Galletas o ponqué', unit: 'paquete', units: 'paquetes' },
  { id: 'filtros', icon: '📄', cat: 'equipo', label: 'Filtros de papel AeroPress', unit: 'caja de 350', units: 'cajas de 350' },
  { id: 'termo', icon: '🧴', cat: 'equipo', label: 'Termo', unit: 'unidad', units: 'unidades' },
];

export const insumoOf = (id) => INSUMOS.find((i) => i.id === id) ?? null;
export const itemsOf = (cat) => INSUMOS.filter((i) => i.cat === cat);
/** El dibujo del producto en la góndola: el suyo o el de su categoría. */
export const iconOf = (item) => item?.icon ?? CATEGORIES.find((c) => c.id === item?.cat)?.icon ?? '📦';

/** Suma o resta uno (entre 0 y 99); lo que queda en 0 sale del pedido. */
export function bumpInsumo(cart = {}, id, delta) {
  if (!insumoOf(id)) return cart;
  const n = Math.max(0, Math.min(MAX_QTY, (Number(cart[id]) || 0) + delta));
  const next = { ...cart };
  if (n === 0) delete next[id]; else next[id] = n;
  return next;
}

/** Las líneas del pedido en el orden del catálogo, sin lo que no existe o está en 0. */
export function orderLines(cart = {}) {
  return INSUMOS.filter((i) => (Number(cart?.[i.id]) || 0) > 0).map((i) => {
    const qty = Math.min(MAX_QTY, Math.floor(Number(cart[i.id])));
    return { id: i.id, qty, text: `${qty} ${qty === 1 ? i.unit : i.units} · ${i.label}` };
  });
}

export const orderCount = (cart) => orderLines(cart).reduce((n, l) => n + l.qty, 0);

/** El mensaje de WhatsApp al equipo, con cada insumo en su línea. */
export function insumosText({ name, where, cart, note = '' }) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'barista';
  const lines = orderLines(cart).map((l) => `• ${l.text}`);
  const extra = String(note || '').trim().slice(0, 200);
  return [
    `Hola, soy ${first} de Micra. Quiero pedir insumos${where ? ` para ${where}` : ''}:`,
    ...lines,
    ...(extra ? [`Otro: ${extra}`] : []),
    '¿Cuánto es y cuándo me llega?',
  ].join('\n');
}

export function readLastOrder(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(INSUMOS_KEY) ?? 'null');
    return v && typeof v.cart === 'object' && orderLines(v.cart).length ? v : null;
  } catch { return null; }
}

export function writeLastOrder(cart, storage = globalThis.localStorage, now = new Date()) {
  try { storage?.setItem(INSUMOS_KEY, JSON.stringify({ cart, at: now.toISOString() })); } catch { /* sin memoria */ }
}
