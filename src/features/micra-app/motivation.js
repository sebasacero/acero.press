// Lo que le da ganas al barista de salir, vender y aprender: la racha de días,
// la meta del día, los avisos al pasar de 5 en 5 y el camino de lecciones.
// Todo sale de lo que ya trae la base (la semana y la libreta) o de lo que el
// celular recuerda; nada de esto es saldo ni promete dinero.
import { weekdayLetter, cupsLabel } from './micraApp.js';

/** Metas que se pueden escoger en un toque. */
export const GOAL_CHOICES = [10, 15, 20, 25, 30, 40];

/**
 * La racha: días seguidos con ventas, contando hacia atrás desde ayer, más hoy
 * si ya vendió. `week` son los últimos 7 días (el último es hoy). `full`: la
 * racha llena toda la semana que se conoce (puede ser más larga).
 */
export function streakOf(week, todayCups = null) {
  const days = (week ?? []).map((d, i, all) => {
    const today = i === all.length - 1;
    const cups = today && todayCups != null ? todayCups : d.cups;
    return { day: d.day, letter: weekdayLetter(d.day), cups, done: cups > 0, today };
  });
  const todayDone = !!days.at(-1)?.done;
  let back = 0;
  for (let i = days.length - 2; i >= 0 && days[i].done; i -= 1) back += 1;
  const count = back + (todayDone ? 1 : 0);
  return { days, count, todayDone, full: days.length > 0 && back === days.length - 1, ifToday: back + 1 };
}

/** «4 días» o «7+ días» cuando la racha llena la semana conocida. */
export const streakLabel = (s) => `${s.count}${s.full && s.todayDone ? '+' : ''} ${s.count === 1 ? 'día' : 'días'}`;

/**
 * La meta del día: la que escogió el barista o, si no, su mejor día de la
 * semana redondeado a 5 (con una semana vacía, 15 tazas).
 */
export function goalOf(week, saved = null) {
  if (Number.isFinite(saved) && saved > 0) return Math.round(saved);
  const past = (week ?? []).slice(0, -1);
  const best = Math.max(0, ...past.map((d) => d.cups || 0));
  return best > 0 ? Math.max(5, Math.ceil(best / 5) * 5) : 15;
}

/**
 * Qué celebrar al pasar de `prev` a `cups` tazas: la meta (una vez) o cada 5.
 * Bajar (deshacer) no celebra nada.
 */
export function milestone(prev, cups, goal) {
  if (!(cups > prev)) return null;
  if (goal > 0 && prev < goal && cups >= goal) return { kind: 'goal', cups };
  if (Math.floor(cups / 5) > Math.floor(prev / 5)) return { kind: 'step', cups: Math.floor(cups / 5) * 5, left: Math.max(0, goal - cups) };
  return null;
}

/** El texto del aviso de cada 5 tazas. */
export function stepText(m) {
  if (!m || m.kind !== 'step') return '';
  return m.left > 0 ? `¡Llevas ${m.cups}! Te faltan ${m.left} para tu meta.` : `¡Llevas ${m.cups}! Vas por encima de tu meta.`;
}

/**
 * Los niveles de Micra. Hoy solo existe el primero en la app: el segundo pide
 * un video que revisa el equipo. Se muestran para que se vea el camino.
 */
export const LEVELS = [
  { id: 'N1', name: 'Aprendiz' },
  { id: 'N2', name: 'Barista de calle' },
  { id: 'N3', name: 'Barista AeroPress' },
  { id: 'N4', name: 'Mentor' },
];

/**
 * El camino de lecciones: cuáles vio, cuál sigue y si ya puede mandar su
 * video para el siguiente nivel. `seen` son las claves vistas (las de la Escuela).
 */
export function lessonPath(lessons, seen = []) {
  const set = new Set(seen);
  const nextIdx = lessons.findIndex((l) => !set.has(l.key));
  const steps = lessons.map((l, i) => ({
    key: l.key, title: l.title, mins: l.mins, n: i + 1,
    state: set.has(l.key) ? 'done' : i === nextIdx ? 'now' : 'next',
  }));
  const done = steps.filter((s) => s.state === 'done').length;
  return { steps, done, total: lessons.length, nextIdx, ready: lessons.length > 0 && done === lessons.length, pct: lessons.length ? done / lessons.length : 0 };
}

/** Un personaje del elenco para cada barista, siempre el mismo. */
// Los tres dibujos de una sola persona más livianos: en la lista del cliente llegan varios a la vez
export const CAST = ['carrito', 'caminando', 'ruana'];
export function figureFor(id) {
  let h = 0;
  for (const c of String(id ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CAST[h % CAST.length];
}

/** Lo que dice «Compartir mi día» (va con la tarjeta y su enlace). Sin pesos: sale a las redes. */
export function dayStory({ cups, streak = 0 }) {
  const racha = streak > 1 ? ` y ${streak} días seguidos en la calle` : '';
  return `Hoy vendí ${cupsLabel(cups)} de café${racha}. Apártame el tuyo en Micra:`;
}

/** Qué tan llena va la taza de la meta (0–1). */
export const fillOf = (cups, goal) => (goal > 0 ? Math.min(1, Math.max(0, cups / goal)) : 0);
