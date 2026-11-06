// Mi plata, la contabilidad del barista (6 nov 2026, pedido del usuario: «un tablero como
// Vender, su sistema de contabilidad»). Lógica pura: lo vendido por producto y por hora, los
// gastos del día que anota en su celular y la cuenta del día (entró, cobrado, fiado, gastos,
// ganancia). Los gastos viven solo en el celular, como la meta: no tocan la base ni `orders`.

export const EXPENSE_KINDS = [
  { id: 'cafe', label: 'Café', icon: '☕' },
  { id: 'vasos', label: 'Vasos', icon: '🥤' },
  { id: 'leche', label: 'Leche', icon: '🥛' },
  { id: 'azucar', label: 'Azúcar', icon: '🧂' },
  { id: 'transporte', label: 'Transporte', icon: '🚌' },
  { id: 'otro', label: 'Otro', icon: '🧾' },
];
const KIND_IDS = new Set(EXPENSE_KINDS.map((k) => k.id));
export const MAX_EXPENSE = 1_000_000;
const KEEP_DAYS = 60;

/** El día en Bogotá (AAAA-MM-DD) de una fecha. */
export function bogotaDay(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}

/** Lo vendido hoy por producto, de más a menos plata, con su parte del total (0–1). */
export function byProductRows(sales, menu = []) {
  const label = Object.fromEntries((menu ?? []).map((m) => [m.id, m.label]));
  const acc = new Map();
  for (const s of sales ?? []) {
    const r = acc.get(s.product) ?? { id: s.product, label: label[s.product] ?? s.product, cups: 0, total: 0 };
    r.cups += Number(s.qty) || 0;
    r.total += Number(s.total) || 0;
    acc.set(s.product, r);
  }
  const rows = [...acc.values()].sort((a, b) => b.total - a.total || b.cups - a.cups);
  const all = rows.reduce((a, r) => a + r.total, 0);
  return rows.map((r) => ({ ...r, share: all > 0 ? r.total / all : 0 }));
}

/** Tazas por hora de Bogotá (de las 5 a. m. a las 9 p. m.) y la mejor hora. */
export function byHourRows(sales, from = 5, to = 21) {
  const hours = Array.from({ length: to - from + 1 }, (_, i) => ({ hour: from + i, cups: 0 }));
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' });
  for (const s of sales ?? []) {
    if (!s.at) continue;
    const h = Number(fmt.format(new Date(s.at)));
    const row = hours.find((x) => x.hour === h);
    if (row) row.cups += Number(s.qty) || 0;
  }
  const max = Math.max(0, ...hours.map((x) => x.cups));
  const best = max > 0 ? hours.find((x) => x.cups === max).hour : null;
  return { hours: hours.map((x) => ({ ...x, h: max > 0 ? x.cups / max : 0 })), best };
}

/** Agrega un gasto (en pesos, entero positivo); devuelve la lista nueva o la misma si no vale. */
export function addExpense(list, kind, amount, at = new Date()) {
  const n = Math.round(Number(amount));
  if (!KIND_IDS.has(kind) || !Number.isFinite(n) || n <= 0 || n > MAX_EXPENSE) return list ?? [];
  const today = bogotaDay(at);
  const keep = (list ?? []).filter((e) => daysBetween(e.day, today) < KEEP_DAYS);
  return [...keep, { id: `g-${new Date(at).getTime()}-${keep.length}`, kind, amount: n, day: today, at: new Date(at).toISOString() }];
}

/** Quita un gasto por su id. */
export function removeExpense(list, id) {
  return (list ?? []).filter((e) => e.id !== id);
}

/** Los gastos de un día. */
export function expensesOf(list, day = bogotaDay()) {
  return (list ?? []).filter((e) => e.day === day);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * La cuenta del día: lo que entró (vendido), lo cobrado y lo fiado, los gastos y la ganancia
 * (lo cobrado menos lo gastado: lo fiado no es plata en el bolsillo hasta que pague).
 */
export function ledger({ total = 0, cash = 0, fiado = 0, expenses = [] } = {}) {
  const gastos = (expenses ?? []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const ganancia = cash - gastos;
  return { vendido: total, cobrado: cash, fiado, gastos, ganancia, margen: cash > 0 ? ganancia / cash : null };
}
