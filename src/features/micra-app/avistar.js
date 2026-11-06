// El botón de GPS del estudio (6 nov 2026, pedido del usuario): al pasar por la
// calle y ver un puesto o a alguien tomando tinto, un toque lo marca con el punto
// del celular. El puesto va como ficha rápida (sin nombre, se completa después);
// «tomando tinto» es un avistamiento: sin nada de la persona, solo punto y hora.
// Sin señal (o sin la migración todavía) queda en el celular y sube después. Puro.

const QUEUE_KEY = 'micra_sightings_q_v1';

/** Las dos cosas que se marcan al pasar. */
export const SPOT_KINDS = [
  { id: 'puesto', label: 'Un puesto de café', hint: 'Queda como ficha sin nombre para completarla después' },
  { id: 'tomando', label: 'Alguien tomando tinto', hint: 'Solo el punto y la hora, nada de la persona' },
];

export function readSightingQueue(storage) {
  try {
    const q = JSON.parse(storage?.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q.filter((x) => x && x.ref && Number.isFinite(x.lat) && Number.isFinite(x.lng)) : [];
  } catch { return []; }
}
function writeSightingQueue(storage, items) {
  try { storage?.setItem(QUEUE_KEY, JSON.stringify(items.slice(-200))); } catch { /* sin memoria */ }
}
export function queueSighting(storage, item) {
  const q = readSightingQueue(storage).filter((x) => x.ref !== item.ref);
  q.push(item);
  writeSightingQueue(storage, q);
  return q;
}
export function unqueueSighting(storage, ref) {
  const q = readSightingQueue(storage).filter((x) => x.ref !== ref);
  writeSightingQueue(storage, q);
  return q;
}

/** El avistamiento desde una lectura del GPS; null si no hay punto. */
export function sightingFrom(pos, ref, now = Date.now()) {
  const lat = Number(pos?.lat ?? pos?.coords?.latitude);
  const lng = Number(pos?.lng ?? pos?.coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || pos?.error) return null;
  const acc = Number(pos?.accuracy ?? pos?.coords?.accuracy);
  return { ref, lat, lng, accuracy: Number.isFinite(acc) ? Math.round(acc) : null, at: new Date(now).toISOString() };
}

const bogotaDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(d));

/** Cuántos hoy y en 7 días, sumando lo que sigue en el celular (sin repetir lo que ya subió). */
export function sightingCounts(server = [], queued = [], now = new Date()) {
  const all = [...(server ?? []), ...(queued ?? [])].filter((s) => s?.at);
  const today = bogotaDay(now);
  const week = now.getTime() - 7 * 86400000;
  return {
    today: all.filter((s) => bogotaDay(s.at) === today).length,
    week: all.filter((s) => new Date(s.at).getTime() >= week).length,
    pending: (queued ?? []).length,
  };
}
