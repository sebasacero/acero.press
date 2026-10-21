// Cómo se escriben las cifras del informe: como en Colombia ($1.500, 4,7 kg)
// y con «—» cuando no hay dato, nunca un cero inventado.
export const DASH = '—';
const fmt = (d) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: d });
export const isVal = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

export const money = (v) => (isVal(v) ? `$${fmt(0).format(Math.round(Number(v)))}` : DASH);
/** Montos grandes en palabras: $4,7 millones. */
export const moneyBig = (v) => {
  if (!isVal(v)) return DASH;
  if (Math.abs(v) < 1e6) return money(v);
  const m = Math.round((v / 1e6) * 10) / 10;
  return `$${fmt(1).format(m)} ${Math.abs(m) === 1 ? 'millón' : 'millones'}`;
};
export const kg = (v) => (isVal(v) ? `${fmt(Number(v) < 10 ? 1 : 0).format(Number(v))} kg` : DASH);
export const num = (v, d = 0) => (isVal(v) ? fmt(d).format(Number(v)) : DASH);
export const pct = (v) => (isVal(v) ? `${v > 0 ? '▲' : v < 0 ? '▼' : ''} ${fmt(0).format(Math.abs(v * 100))} %`.trim() : DASH);
export const share = (count, n) => (n ? `${count} de ${n}` : DASH);
export const nNote = (n) => (n ? `n = ${n}` : 'sin datos aún');
/** «$1.000 a $2.000» si hay más de un valor distinto. */
export const rangeOf = (st, f = money) => (st?.n > 1 && st.min !== st.max ? `${f(st.min)} a ${f(st.max)}` : null);
export const dateLong = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' }) : DASH);
export const dateShort = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' }) : DASH);
