/**
 * «Pedido»: la calculadora del barista cuando llega un grupo (13 nov 2026,
 * pedido del usuario: «un botón de pedido que suba como una calculadora y me
 * dé el precio que se debe cobrar»). Puro: sin React ni red.
 *
 * Los precios salen del menú del barista; aquí solo se suma. El descuento
 * baja el total y redondea a $100 hacia abajo, porque en la calle nadie da
 * vueltas de $50.
 */

export const DISCOUNTS = [0, 5, 10, 15];
export const QTY_MAX = 99;
/** En Micra un apartado lleva hasta 6 tazas: un grupo grande ocupa varios. */
export const HOLD_MAX = 6;

const clampQty = (n) => Math.max(0, Math.min(QTY_MAX, Math.round(Number(n) || 0)));

/** Suma o resta tazas de un producto; nunca baja de 0 ni pasa de 99. */
export function bump(qty, id, delta) {
  const next = { ...(qty ?? {}) };
  const v = clampQty((next[id] || 0) + delta);
  if (v) next[id] = v; else delete next[id];
  return next;
}

/**
 * El precio del pedido. `menu`: [{ id, label, price, custom? }]; `qty`: { id: n };
 * `pct`: descuento en %. Devuelve las líneas, tazas, las que salen del termo
 * (los productos propios no), bruto, descuento, total, precio por taza y
 * cuántos apartados ocuparía.
 */
export function orderOf(menu, qty, pct = 0) {
  const lines = (menu ?? [])
    .filter((m) => (qty?.[m.id] || 0) > 0)
    .map((m) => ({ id: m.id, label: m.label, n: qty[m.id], price: Number(m.price) || 0, sub: qty[m.id] * (Number(m.price) || 0), custom: !!m.custom }));
  const cups = lines.reduce((s, l) => s + l.n, 0);
  const fromTermo = lines.filter((l) => !l.custom).reduce((s, l) => s + l.n, 0);
  const gross = lines.reduce((s, l) => s + l.sub, 0);
  const p = DISCOUNTS.includes(pct) ? pct : 0;
  const total = p ? Math.floor((gross * (100 - p)) / 100 / 100) * 100 : gross;
  return {
    lines, cups, fromTermo, gross, pct: p, disc: gross - total, total,
    each: cups ? Math.round(total / cups) : 0,
    holds: Math.ceil(cups / HOLD_MAX),
  };
}

/**
 * ¿Le alcanza el café? `leftTotal` viene de termosOf (tintos que le quedan en
 * los termos) y `per` es cuántos saca de cada termo.
 */
export function fitsTermos(cups, leftTotal, per) {
  const short = Math.max(0, cups - Math.max(0, leftTotal));
  return {
    ok: short === 0,
    left: Math.max(0, leftTotal - cups),
    short,
    more: per > 0 ? Math.ceil(short / per) : 0,
  };
}

/** El texto para mandar por WhatsApp al que pidió. */
export function orderText(o, money) {
  if (!o.cups) return '';
  const rows = o.lines.map((l) => `${l.n} × ${l.label} (${money(l.price)}) = ${money(l.sub)}`);
  if (o.disc) rows.push(`Descuento de grupo ${o.pct} %: −${money(o.disc)}`);
  rows.push(`Total: ${money(o.total)}`);
  return `Pedido ☕\n${rows.join('\n')}`;
}
