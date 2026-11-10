// La página sigue el día del banner: cada sección de la portada es una hora más tarde que la
// anterior y lleva el cielo de esa hora. Lo que se puede probar sin navegador.
import { paletteAt, mix, clockOf } from './dayBanner.js';

const parts = (c) => c.match(/[\d.]+/g).map(Number);
/** El color del cielo a una hora: la mitad entre arriba y abajo del cielo del banner. */
export function skyAt(hour) {
  const v = paletteAt(hour).vars;
  return mix(v['--db-top'], v['--db-bot'], 0.5);
}
const lum = (c) => { const [r, g, b] = parts(c); return r * 0.299 + g * 0.587 + b * 0.114; };

/**
 * El cielo de una sección: empieza en su hora (la de la visita más `off`) y termina en la de la
 * siguiente (`next`), para que una sección entregue el color a la otra. `dark` dice si el texto
 * va en claro.
 */
export function sectionSky(hour, off, next = off + 3) {
  const a = skyAt(hour + off), b = skyAt(hour + next);
  const dark = lum(mix(a, b, 0.5)) < 150;
  return { a: legible(a, b, dark), b: legible(b, a, dark), dark };
}
// Una sección que cruza el amanecer o el atardecer va de claro a oscuro: la punta que no deja
// leer el texto se acerca a la otra (o al índigo / al papel si la otra tampoco sirve).
function legible(c, other, dark) {
  const L = lum(c);
  if (dark && L > 120) return mix(c, lum(other) < 90 ? other : 'rgba(34,18,90,1)', 0.7);
  if (!dark && L < 165) return mix(c, lum(other) > 200 ? other : 'rgba(247,239,224,1)', 0.7);
  return c;
}

/** En qué parte del día cae una hora: índice de page.moments (madrugada … noche). */
export function dayPart(hour) {
  const h = ((hour % 24) + 24) % 24;
  return h < 4.5 ? 0 : h < 7 ? 1 : h < 11.5 ? 2 : h < 13.5 ? 3 : h < 17 ? 4 : h < 19 ? 5 : 6;
}

/** La hora de una sección para su etiqueta: { text: '6:05', am: true }. */
export const sectionClock = (hour, off) => clockOf(hour + off);
