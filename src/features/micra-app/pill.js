// La pastilla viva (maqueta «Micra en tres toques», 10 nov 2026): una línea sobre
// la barra del cliente, en todas las pestañas, con lo que está pasando ahora:
// su apartado o el «quiero un café» que mandó. Puro: qué dice y a dónde lleva.
import { cupsLabel } from './micraApp.js';

export const WANT_AT_KEY = 'micra_want_at_v1';
export const WANT_MINUTES = 60; // lo que dura la señal en la base

/** Minutos que le quedan a la señal de «quiero un café», o 0. */
export function wantLeft(at, now = Date.now()) {
  const t = Number(at);
  if (!t || t > now) return 0;
  return Math.max(0, WANT_MINUTES - Math.floor((now - t) / 60000));
}

/**
 * Lo que muestra la pastilla, o null. Manda el apartado: esperando, o entregado
 * sin calificar; si no hay, la señal de «quiero un café» mientras dure.
 */
export function pillOf({ holds = [], wantAt = null, now = Date.now() } = {}) {
  const waiting = (holds ?? []).find((h) => h.status === 'waiting');
  if (waiting) return { kind: 'hold', icon: '☕', title: `Tu apartado · ${cupsLabel(waiting.cups)}`, sub: 'Toca para ver por dónde viene', to: '/micra/apartados' };
  const served = (holds ?? []).find((h) => h.status === 'served' && h.rating == null);
  if (served) return { kind: 'rate', icon: '★', title: '¿Cómo te fue con tu café?', sub: 'Califícalo en un toque', to: '/micra/apartados' };
  const left = wantLeft(wantAt, now);
  if (left > 0) return { kind: 'want', icon: '📡', title: 'Tu zona quiere café', sub: `Los baristas cerca lo ven · ${left} min más`, to: '/micra' };
  return null;
}
