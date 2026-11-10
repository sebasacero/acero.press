import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { bogotaHour, stepHour } from '../lib/dayBanner.js';
import { sectionSky, dayPart, sectionClock } from '../lib/daySky.js';

// La portada sigue el día del banner (rediseño del 10 nov 2026, pedido del usuario): cada sección
// es unas horas más tarde que la anterior y lleva el cielo de esa hora; el texto pasa de tinta a
// claro según el cielo. El reloj arranca en la hora de Bogotá de la visita y corre: el día entero
// pasa en un minuto, de hora en hora (pedido del usuario, 10 nov 2026: el cambio se ve más rápido que
// minuto a minuto); el banner pasa al salto suave y las secciones con el CSS.
const TICK_MS = 200;   // cinco veces por segundo alcanza: el color entre un paso y otro lo suaviza el CSS

function makeClock() {
  const subs = new Set();
  let start = bogotaHour(), secs = 0;
  const c = {
    hour: Math.floor(start),
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    get: () => c.hour,
    /** Avanza `dt` segundos de página a la vista. */
    tick(dt) { secs += dt; const h = stepHour(start, secs); if (h !== c.hour) { c.hour = h; subs.forEach((fn) => fn()); } },
    /** Sin correr («menos movimiento»): la hora real. */
    real() { start = bogotaHour(); secs = 0; if (c.hour !== start) { c.hour = start; subs.forEach((fn) => fn()); } },
  };
  return c;
}
const Clock = createContext(null);
let solo = null;   // una sección suelta, fuera de DayPage: la hora real, quieta

export function useDayClock() {
  return useContext(Clock) ?? (solo ??= makeClock());
}

export function DayPage({ children }) {
  const ref = useRef(null);
  const clock = (ref.current ??= makeClock());
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const id = setInterval(() => clock.real(), 60000);
      return () => clearInterval(id);
    }
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      if (!document.hidden) clock.tick(dt);   // con la pestaña escondida el día espera
    }, TICK_MS);
    return () => clearInterval(id);
  }, [clock]);
  return <Clock.Provider value={clock}>{children}</Clock.Provider>;
}

/** Una sección con su hora: `off` horas después de la del reloj, hasta `next`. `name` va en la etiqueta. */
export default function DaySection({ off, next, name, className = '', children }) {
  const { t } = useLanguage();
  const clock = useDayClock();
  const hour = useSyncExternalStore(clock.subscribe, clock.get);
  const sky = sectionSky(hour, off, next);
  const time = sectionClock(hour, off);
  return (
    <div className={`pg-sec${sky.dark ? ' is-dark' : ''} ${className}`} style={{ '--pg-a': sky.a, '--pg-b': sky.b }}>
      <p className="pg-hour">
        <b>{time.text} {time.am ? t('day.am') : t('day.pm')}</b>
        <span>{t('page.moments')[dayPart(hour + off)]} · {name}</span>
      </p>
      {children}
    </div>
  );
}
