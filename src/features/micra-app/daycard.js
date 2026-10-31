import { STREAK_BADGES } from './motivation.js';

// Lo puro de «Mi día en la calle» (la tarjeta del que sale caminando), del
// trazo de su recorrido y de los momentos que celebran el día (la primera
// taza, la racha, la meta y el «Ya volví»). Sin React, con tests.

/** Qué tarjeta del día le toca: la de la calle (camina) o la del puesto. */
export const storyVariant = (mode) => (mode === 'caminando' ? 'calle' : 'puesto');

/** El dibujo de la tarjeta: el chico que empuja el carrito si camina, la sombrilla o el carrito. */
export const storyFigure = (mode) => ({ caminando: 'empujando', sombrilla: 'sombrilla', fijo: 'carrito' }[mode] ?? 'carrito');

/**
 * El trazo del recorrido dentro de una caja w × h: [[lng, lat], …] a puntos
 * SVG, sin deformar (la longitud se acorta con el coseno de la latitud).
 * null si no hay al menos dos puntos distintos.
 */
export function routeLine(path, { w = 300, h = 160, pad = 12 } = {}) {
  const pts = (Array.isArray(path) ? path : []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return null;
  const k = Math.cos(((pts.reduce((a, p) => a + p[1], 0) / pts.length) * Math.PI) / 180);
  const xs = pts.map((p) => p[0] * k);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(x1 - x0, y1 - y0);
  if (span === 0) return null;
  const s = Math.min((w - pad * 2) / (x1 - x0 || span), (h - pad * 2) / (y1 - y0 || span));
  const ox = (w - (x1 - x0) * s) / 2;
  const oy = (h - (y1 - y0) * s) / 2;
  const xy = pts.map((_, i) => [+(ox + (xs[i] - x0) * s).toFixed(1), +(oy + (y1 - ys[i]) * s).toFixed(1)]);
  return { d: xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '), start: xy[0], end: xy[xy.length - 1], points: xy };
}

/** Lo del recorrido de hoy: el que va grabando, o el que guardó al volver (mismo día). */
export function dayTripOf(view, saved, dayKey) {
  if (view && (view.points > 0 || (view.path?.length ?? 0) > 1)) return { distance: view.distance ?? 0, stops: view.stops ?? 0, path: view.path ?? [] };
  if (saved && saved.day === dayKey) return { distance: saved.distance ?? 0, stops: saved.stops ?? 0, path: saved.path ?? [] };
  return { distance: 0, stops: 0, path: [] };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** El hito de racha que se alcanza justo hoy (3, 7, 14, 30 días), si hay. */
export function streakBadgeToday(count) {
  const b = STREAK_BADGES.find(([d]) => d === count);
  return b ? { days: b[0], title: b[1], text: b[2] } : null;
}

/**
 * La primera taza del día: celebra que la racha sigue (o arranca). Si hoy se
 * alcanza un hito (3, 7, 14, 30), la pantalla es la del hito.
 */
export function firstSaleMoment({ streak = 1, goal = 0, name = '' }) {
  const badge = streakBadgeToday(streak);
  return {
    id: badge ? `racha-${badge.days}` : 'primera',
    tone: badge ? 'racha' : 'primera',
    script: badge ? '¡Racha nueva!' : '¡Primera del día!',
    big: badge ? `${streak} días` : streak > 1 ? `${streak} días` : '1 día',
    sub: badge ? `${badge.title}. ${badge.text}` : streak > 1 ? `${name ? `${name}, tu` : 'Tu'} racha sigue viva. Vuelve mañana para sumar otro día.` : 'Arrancó tu racha. Mañana, otra taza y ya son dos días.',
    stats: [
      [String(streak), streak === 1 ? 'día seguido' : 'días seguidos'],
      [goal > 0 ? String(goal) : '—', 'tu meta'],
      [goal > 1 ? String(goal - 1) : '✓', 'te faltan'],
    ],
    primary: 'A vender',
  };
}

/** «Ya volví» con ventas: el resumen del día, distinto si caminó. */
export function backHomeMoment({ cups = 0, goal = 0, streak = 0, mode = null, distance = 0, stops = 0, minutes = 0, name = '' }) {
  const walking = mode === 'caminando';
  const kmLabel = `${(Math.round((distance || 0) / 100) / 10).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  const hours = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
  const stats = walking
    ? [[kmLabel, 'caminados'], [String(stops), stops === 1 ? 'parada' : 'paradas'], [String(streak), streak === 1 ? 'día seguido' : 'días seguidos']]
    : [[hours, 'en la calle'], [goal > 0 && cups >= goal ? '✓' : `${cups}/${goal}`, 'meta'], [String(streak), streak === 1 ? 'día seguido' : 'días seguidos']];
  return {
    id: 'volvi',
    tone: walking ? 'calle' : 'puesto',
    script: name ? `¡Buen día, ${name}!` : '¡Buen día!',
    big: plural(cups, 'taza', 'tazas'),
    sub: walking ? 'Tu recorrido de hoy quedó guardado. Compártelo para que tus clientes sepan por dónde pasas.' : 'Tu día quedó guardado. Compártelo para que tus clientes te encuentren mañana.',
    stats,
    primary: 'Compartir mi día',
  };
}

/** «Meta cumplida a las 10:24»: la hora en Bogotá. */
export function goalTimeLabel(date = new Date()) {
  return date.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: false });
}
