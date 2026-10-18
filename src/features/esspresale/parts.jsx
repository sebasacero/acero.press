import { useEffect, useState } from 'react';

// Piezas del lenguaje de los formatos de redes (ver admin/espresaleCard.js):
// hoja con marco y zonas, odómetro, barra segmentada y cajetín.

/** Hora y fecha de Bogotá que avanzan solas (como el cajetín de las tarjetas). */
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return {
    time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }),
    date: now
      .toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota' })
      .replace(/\//g, '.'),
  };
}

const COLS = [1, 2, 3, 4, 5, 6];
const ROWS = ['A', 'B', 'C', 'D'];

/** Marco doble del plano con las zonas 1–6 / A–D. */
export function SheetFrame() {
  return (
    <div className="essp-sheet" aria-hidden="true">
      {COLS.map((n, i) => (
        <span key={`t${n}`} className="essp-zone" style={{ left: `${((i + 0.5) / 6) * 100}%`, top: 7 }}>{n}</span>
      ))}
      {COLS.map((n, i) => (
        <span key={`b${n}`} className="essp-zone" style={{ left: `${((i + 0.5) / 6) * 100}%`, bottom: -7 }}>{n}</span>
      ))}
      {ROWS.map((r, j) => (
        <span key={`l${r}`} className="essp-zone" style={{ top: `${((j + 0.5) / 4) * 100}%`, left: 7 }}>{r}</span>
      ))}
      {ROWS.map((r, j) => (
        <span key={`r${r}`} className="essp-zone" style={{ top: `${((j + 0.5) / 4) * 100}%`, right: -7 }}>{r}</span>
      ))}
    </div>
  );
}

/** Barra segmentada roja del odómetro (20 segmentos). */
export function Segs({ filled, className = 'essp-segs' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <i key={i} className={i < filled ? 'on' : undefined} />
      ))}
    </div>
  );
}

export function Odometer({ digits }) {
  return (
    <div className="essp-odo" aria-hidden="true">
      {digits.map((d, i) => (
        <span key={i}>{d}</span>
      ))}
    </div>
  );
}
