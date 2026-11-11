// El radar del inicio del cliente (maqueta «Micra en tres toques», 10 nov 2026):
// quién está en la calle cerca, como puntos alrededor de ti, y un toque para
// apartarle. Puro: dónde va cada punto y qué dice el texto.
import { meters, distanceLabel, menuOf, money } from './micraApp.js';

export const RADAR_RANGE_M = 2500; // el borde del radar: unas 25 cuadras
export const RADAR_MAX = 6;

const rad = (d) => (d * Math.PI) / 180;

/** Rumbo de a hacia b en grados (0 = norte, 90 = oriente). */
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Lo que muestra el radar. `list` ya viene con `status` (sortBaristas).
 * Con la ubicación (`me`) el centro eres tú y los puntos van a su distancia;
 * sin ella el centro es el medio de los que salen y no se dicen cuadras.
 * Sin nadie en la calle, los que suelen estar a esta hora; y sin ellos, todos, apagados.
 */
export function radarView(list, me = null, { range = RADAR_RANGE_M, max = RADAR_MAX } = {}) {
  const withPos = (list ?? []).filter((b) => b?.lat != null && b?.lng != null);
  const live = withPos.filter((b) => b.status === 'live');
  // El radar no se esconde (10 nov 2026: de noche no salía y el cliente creía que no estaba):
  // sin nadie en la calle ni de turno a esta hora, muestra apagados a los que están en Micra
  const mode = live.length ? 'live' : withPos.some((b) => b.status === 'usual') ? 'usual' : 'off';
  const pool = mode === 'live' ? live : mode === 'usual' ? withPos.filter((b) => b.status === 'usual') : withPos;
  if (!pool.length) return { mode: 'off', count: 0, dots: [], nearest: null, located: !!me };
  const center = me ?? {
    lat: pool.reduce((s, b) => s + b.lat, 0) / pool.length,
    lng: pool.reduce((s, b) => s + b.lng, 0) / pool.length,
  };
  const far = Math.max(range, ...(me ? [] : pool.map((b) => meters(center, b) * 1.25)));
  const placed = pool
    .map((b) => ({ b, d: meters(center, b) }))
    .filter((x) => !me || x.d <= range)
    .sort((x, y) => x.d - y.d);
  const dots = placed.slice(0, max).map(({ b, d }) => {
    // Raíz: lo cercano no se amontona en el centro; nunca encima de «tú»
    const r = (me ? 0.1 : 0.2) + (me ? 0.36 : 0.26) * Math.sqrt(Math.min(d, far) / far);
    const t = rad(d < 5 ? 45 : bearing(center, b));
    return {
      id: b.id,
      name: b.name,
      initial: String(b.name ?? '?').trim().charAt(0).toUpperCase() || '?',
      left: Math.round((50 + r * 100 * Math.sin(t)) * 10) / 10,
      top: Math.round((50 - r * 100 * Math.cos(t)) * 10) / 10,
      distance: me ? d : null,
      label: me ? `${b.name}, ${distanceLabel(d)}` : b.name,
    };
  });
  const first = placed[0]?.b;
  const cheapest = first ? menuOf(first)[0] : null;
  return {
    mode,
    located: !!me,
    count: me ? placed.length : pool.length,
    dots,
    nearest: first && me ? {
      id: first.id, name: first.name, distance: distanceLabel(placed[0].d),
      price: cheapest ? `${cheapest.label} a ${money(cheapest.price)}` : null,
    } : null,
  };
}

/** La frase grande: «3 baristas» y debajo dónde. */
export function radarTitle(v) {
  const n = v.count;
  const who = n === 1 ? '1 barista' : `${n} baristas`;
  if (v.mode === 'live') return { big: who, small: v.located ? 'en la calle cerca de ti' : 'en la calle ahora' };
  if (v.mode === 'usual') return { big: 'Nadie en la calle', small: `${n === 1 ? '1 barista suele' : `${n} baristas suelen`} salir a esta hora` };
  return { big: 'Nadie en la calle', small: n ? `${n === 1 ? '1 barista está' : `${n} baristas están`} en Micra; ${n === 1 ? 'sale' : 'salen'} en su horario` : 'a esta hora' };
}
