// «¿Cómo te fue?»: después de la entrega el cliente pone de 1 a 5 granos y dice
// cuánto pagó (lo de la base en 20261110130000_micra_hold_rating.sql). Lo puro.

/** ¿Este apartado espera la nota? Solo entregado y sin calificar. */
export function needsRating(hold) {
  return !!hold && hold.status === 'served' && hold.rating == null;
}

const round100 = (n) => Math.max(0, Math.round(n / 100) * 100);

/**
 * Los botones de «¿Cuánto pagaste?»: lo apartado primero (lo más común), luego
 * un poco menos y un poco más por taza. Sin repetidos ni ceros.
 */
export function paidChoices(total, cups = 1) {
  const t = Number(total) || 0;
  const c = Math.max(1, Number(cups) || 1);
  if (t <= 0) return [];
  const step = 500 * c;
  return [...new Set([round100(t), round100(t - step), round100(t + step)])].filter((v) => v > 0);
}

/** Lo que se le manda a la base: nota 1–5 entera y lo pagado (o null). */
export function ratePayload(rating, paid) {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return null;
  const p = paid === '' || paid == null ? null : Math.round(Number(paid));
  if (p != null && !(p >= 0 && p <= 60000)) return null;
  return { rating: r, paid: p };
}

/** «4,6 · 12 opiniones» para el barista; null sin notas. */
export function ratingLabel(r) {
  if (!r || !r.n) return null;
  const avg = Number(r.avg).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${avg} · ${r.n} ${r.n === 1 ? 'opinión' : 'opiniones'}`;
}
