import { createContext, useContext, useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { bogotaHour } from '../lib/dayBanner.js';
import { sectionSky, dayPart, sectionClock } from '../lib/daySky.js';

// La portada sigue el día del banner (rediseño del 10 nov 2026, pedido del usuario): cada sección
// es unas horas más tarde que la anterior y lleva el cielo de esa hora; el texto pasa de tinta a
// claro según el cielo. La hora es la de Bogotá en que se visita la web.
const Hour = createContext(null);

export function DayPage({ children }) {
  const [hour, setHour] = useState(() => bogotaHour());
  useEffect(() => {
    const id = setInterval(() => setHour(bogotaHour()), 60000);
    return () => clearInterval(id);
  }, []);
  return <Hour.Provider value={hour}>{children}</Hour.Provider>;
}

/** Una sección con su hora: `off` horas después de la visita, hasta `next`. `name` va en la etiqueta. */
export default function DaySection({ off, next, name, className = '', children }) {
  const { t } = useLanguage();
  const hour = useContext(Hour) ?? bogotaHour();
  const sky = sectionSky(hour, off, next);
  const clock = sectionClock(hour, off);
  return (
    <div className={`pg-sec${sky.dark ? ' is-dark' : ''} ${className}`} style={{ '--pg-a': sky.a, '--pg-b': sky.b }}>
      <p className="pg-hour">
        <b>{clock.text} {clock.am ? t('day.am') : t('day.pm')}</b>
        <span>{t('page.moments')[dayPart(hour + off)]} · {name}</span>
      </p>
      {children}
    </div>
  );
}
