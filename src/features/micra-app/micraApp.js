// Lógica pura de la app Micra (/micra): horas de Bogotá, qué se vende y a
// cuánto, el apartado, la libreta del barista y las rutas internas. Sin React
// ni Supabase, para probarla con node --test.

export const PRODUCTS = [
  { id: 'tinto', label: 'Tinto', one: 'tinto', many: 'tintos' },
  { id: 'perico', label: 'Perico', one: 'perico', many: 'pericos' },
  { id: 'aromatica', label: 'Aromática', one: 'aromática', many: 'aromáticas' },
];
const PRODUCT = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
// Lo demás que puede llevar en el carrito (ficha del estudio): se muestra, no se aparta
const EXTRAS = { chocolate: 'chocolate', agua_panela: 'agua de panela', ponque: 'ponqué', galletas: 'galletas', empanadas: 'empanadas', dulces: 'dulces' };
const PAYMENTS = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', bre_b: 'Bre-B' };
export const MAX_CUPS = 6;

/** La hora de Bogotá (0–23) y el día (AAAA-MM-DD), sin depender del huso del celular. */
export function bogota(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** De día (6 a. m. a 6 p. m. en Bogotá) la app es blanca; de noche, negra. */
export const isNight = (now = new Date()) => { const { hour } = bogota(now); return hour < 6 || hour >= 18; };

export const greeting = (now = new Date()) => {
  const { hour } = bogota(now);
  return hour < 12 ? 'Buen día' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
};

/** $1.500 */
export const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

/** «7 a. m.», «12 m.», «3 p. m.» como se dice en Bogotá */
export function hourLabel(h) {
  if (h == null) return '';
  const x = ((h % 24) + 24) % 24;
  if (x === 12) return '12 m.';
  if (x === 0) return '12 a. m.';
  return x < 12 ? `${x} a. m.` : `${x - 12} p. m.`;
}

/** «Pasa de 6 a 11 a. m.» o «de 10 a. m. a 8 p. m.» */
export function windowLabel(from, to) {
  if (from == null || to == null) return null;
  const sameHalf = (from < 12) === (to < 12) && to !== 12 && to !== 24;
  return sameHalf ? `de ${from > 12 ? from - 12 : from} a ${hourLabel(to)}` : `de ${hourLabel(from)} a ${hourLabel(to)}`;
}

/** ¿Está dentro de su horario ahora? */
export function inWindow(b, now = new Date()) {
  if (b?.hora_inicio == null || b?.hora_fin == null) return false;
  const { hour } = bogota(now);
  return hour >= b.hora_inicio && hour < b.hora_fin;
}

/** Estado de un barista para el cliente: 'live' (avisó que salió), 'usual' (es su hora), 'off'. */
export function status(b, now = new Date()) {
  if (b?.live_until && Date.parse(b.live_until) > now.getTime()) return 'live';
  return inWindow(b, now) ? 'usual' : 'off';
}

export const STATUS_TEXT = { live: 'En la calle', usual: 'Suele estar ahora', off: 'Hoy más tarde o mañana' };

/** Lo que se puede apartar con un barista: productos con precio, en el orden de siempre. */
export function menuOf(b) {
  const prices = b?.prices ?? {};
  return PRODUCTS.filter((p) => prices[p.id] != null).map((p) => ({ ...p, price: Number(prices[p.id]) }));
}

export const extrasOf = (b) => (b?.products ?? []).filter((p) => EXTRAS[p]).map((p) => EXTRAS[p]);
export const paymentsOf = (b) => (b?.payments ?? []).filter((p) => PAYMENTS[p]).map((p) => PAYMENTS[p]);

/** Tazas y total de un pedido {tinto: 2, perico: 1} con el menú del barista. */
export function cartTotal(cart, menu) {
  let cups = 0;
  let total = 0;
  for (const item of menu) {
    const q = Math.max(0, Math.floor(cart[item.id] || 0));
    cups += q;
    total += q * item.price;
  }
  return { cups, total };
}

/** Sumar o quitar una taza sin pasar de MAX_CUPS en total ni bajar de 0. */
export function bump(cart, id, delta) {
  const now = cart[id] || 0;
  const cups = Object.values(cart).reduce((a, b) => a + (b || 0), 0);
  if (delta > 0 && cups >= MAX_CUPS) return cart;
  const next = Math.max(0, now + delta);
  return { ...cart, [id]: next };
}

/** Para la base: [{product, qty}] sin ceros (el precio lo pone la base). */
export const cartItems = (cart) => Object.entries(cart).filter(([, q]) => q > 0).map(([product, qty]) => ({ product, qty }));

/** «2 tintos y 1 perico» */
export function itemsLabel(items) {
  const parts = (items ?? []).filter((i) => i.qty > 0).map((i) => {
    const p = PRODUCT[i.product];
    return `${i.qty} ${p ? (i.qty === 1 ? p.one : p.many) : i.product}`;
  });
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`;
}

export const cupsLabel = (n) => `${n} ${n === 1 ? 'taza' : 'tazas'}`;

/** Distancia en metros entre dos puntos (lat, lng). */
export function meters(a, b) {
  if (a?.lat == null || b?.lat == null) return null;
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** «a 3 cuadras» (una cuadra ≈ 100 m en Bogotá), «a 2,4 km» */
export function distanceLabel(m) {
  if (m == null) return null;
  if (m < 150) return 'a una cuadra';
  if (m < 1000) return `a ${Math.round(m / 100)} cuadras`;
  return `a ${(Math.round(m / 100) / 10).toLocaleString('es-CO')} km`;
}

/**
 * El orden de la lista del cliente: primero los que están en la calle, luego
 * los que suelen estar a esta hora, y dentro de cada grupo el más cercano.
 */
export function sortBaristas(list, { me = null, now = new Date(), favorites = [] } = {}) {
  const rank = { live: 0, usual: 1, off: 2 };
  return (list ?? [])
    .map((b) => ({ ...b, status: status(b, now), distance: me ? meters(me, b) : null, favorite: favorites.includes(b.id) }))
    .sort((a, b) => (b.favorite - a.favorite)
      || (rank[a.status] - rank[b.status])
      || ((a.distance ?? 1e9) - (b.distance ?? 1e9))
      || String(a.name).localeCompare(String(b.name), 'es'));
}

export function filterBaristas(list, filter) {
  if (!filter || filter === 'all') return list;
  if (filter === 'live') return list.filter((b) => b.status === 'live' || b.status === 'usual');
  return list.filter((b) => b.prices?.[filter] != null);
}

/** El resumen del día del barista desde su libreta. */
export function daySummary(day) {
  const sales = day?.sales ?? [];
  const byProduct = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));
  let cups = 0;
  let total = 0;
  let fiado = 0;
  for (const s of sales) {
    byProduct[s.product] = (byProduct[s.product] || 0) + s.qty;
    cups += s.qty;
    total += Number(s.total) || 0;
    if (s.fiado_name) fiado += Number(s.total) || 0;
  }
  const holds = day?.holds ?? [];
  const waiting = holds.filter((h) => h.status === 'waiting');
  return {
    cups, total, fiado, cash: total - fiado, byProduct,
    waiting: waiting.length,
    waitingCups: waiting.reduce((a, h) => a + h.cups, 0),
    owed: (day?.fiados ?? []).reduce((a, f) => a + Number(f.total || 0), 0),
  };
}

/** Altura de cada barra de la semana (0–1) y cuál es hoy. */
export function weekBars(week) {
  const max = Math.max(1, ...(week ?? []).map((d) => d.cups));
  return (week ?? []).map((d, i, all) => ({ ...d, h: d.cups / max, today: i === all.length - 1 }));
}

const WEEKDAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const weekdayLetter = (iso) => WEEKDAY[new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getUTCDay()];

/** El texto para cobrar un fiado por WhatsApp. */
export const fiadoMessage = (f, barista) => `Hola, ${f.name}. Te escribe ${String(barista ?? '').split(' ')[0]}, el del café. Quedaron ${money(f.total)} pendientes (${cupsLabel(f.cups)}). Puedes pagarme en la próxima o por Nequi. ¡Gracias!`;

/** Enlace del barista para sus clientes (el QR del termo). */
export const baristaPath = (id) => `/micra/b/${id}`;

/**
 * Rutas internas de /micra:
 *   /micra               inicio según quién entra
 *   /micra/b/<id>        un barista (lo que abre el QR del termo)
 *   /micra/apartados     mis apartados de hoy
 *   /micra/barista       el modo barista (entrar y enlazar si falta)
 *   /micra/equipo        el modo del equipo
 */
export function parseRoute(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '');
  const b = p.match(/^\/micra\/b\/([0-9a-f-]{8,40})$/i);
  if (b) return { view: 'barista-card', id: b[1].toLowerCase() };
  if (p === '/micra/apartados') return { view: 'holds' };
  if (p === '/micra/barista') return { view: 'barista' };
  if (p === '/micra/equipo') return { view: 'owner' };
  return { view: 'home' };
}

/** Un identificador aleatorio para este celular o para un +1. */
export function newRef(prefix = 'm', rand = Math.random) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(rand() * 36 ** 8).toString(36).padStart(8, '0')}`;
}

/** Iniciales para el avatar: «Marlene Rojas» → «MR». */
export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Nombres de fiado que ya usó (para tocar en vez de escribir), los más recientes primero. */
export function recentFiados(day, limit = 6) {
  const seen = [];
  for (const f of day?.fiados ?? []) if (!seen.includes(f.name)) seen.push(f.name);
  for (const s of day?.sales ?? []) if (s.fiado_name && !seen.includes(s.fiado_name)) seen.push(s.fiado_name);
  return seen.slice(0, limit);
}
