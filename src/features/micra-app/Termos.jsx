import { useId, useState } from 'react';
import { termosOf, termosLine, readSetting, clampTermos, clampPer, TERMOS_KEY, TERMOS_MAX, TERMOS_MIN, PER_MAX, PER_MIN } from './termos.js';

// El termo como medidor (pedido del usuario, 13 nov 2026): los termos del día en
// Vender y el termo de sellos del cliente. Lo puro está en termos.js.

/** Un termo con su nivel (0–1). marks dibuja rayas, una por tinto o por sello. */
export function TermoLevel({ level = 1, marks = 0, className = '' }) {
  const clip = `termo-in-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const top = 14, h = 58;
  const y = top + h * (1 - Math.min(1, Math.max(0, level)));
  return (
    <svg className={`mapp-tlevel ${level <= 0 ? 'is-empty' : ''} ${className}`} viewBox="0 0 40 76" aria-hidden="true">
      <defs><clipPath id={clip}><rect x="5" y={top} width="30" height={h} rx="10" /></clipPath></defs>
      <rect x="12" y="2" width="16" height="10" rx="3" className="is-cap" />
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="40" height="76" className="is-bg" />
        <rect x="0" y={y} width="40" height={76 - y} className="is-coffee" />
      </g>
      {Array.from({ length: Math.max(0, marks - 1) }, (_, i) => {
        const my = top + (h * (i + 1)) / marks;
        return <line key={i} x1="7" x2={(i + 1) % 5 === 0 ? 17 : 13} y1={my} y2={my} className="is-mark" />;
      })}
      <rect x="5" y={top} width="30" height={h} rx="10" className="is-line" />
    </svg>
  );
}

function readStored() {
  try { return readSetting(localStorage.getItem(TERMOS_KEY)); } catch { return readSetting(null); }
}

function Stepper({ label, value, min, max, onChange, testid }) {
  return (
    <div className="mapp-tstep">
      <span>{label}</span>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`${label}: uno menos`}>−</button>
      <b data-testid={testid}>{value}</b>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`${label}: uno más`}>+</button>
    </div>
  );
}

/**
 * Los termos del día: el que está sirviendo en grande (en la casilla de la
 * cabecera) y la fila de todos con cuánto le queda. Cuántos lleva y cuántos
 * tintos saca de cada uno se guardan solo en este celular.
 */
export function useTermos() {
  const [s, setS] = useState(readStored);
  const save = (next) => {
    const v = { termos: clampTermos(next.termos), per: clampPer(next.per) };
    setS(v);
    try { localStorage.setItem(TERMOS_KEY, JSON.stringify(v)); } catch { /* sin almacenamiento: vale por hoy */ }
  };
  return [s, save];
}

export function TermoNow({ t }) {
  const i = t.current ?? t.termos - 1;
  return <TermoLevel level={t.levels[i]} marks={t.per} className="is-now" />;
}

export function TermosRow({ cups, setting, onSetting }) {
  const [open, setOpen] = useState(false);
  const t = termosOf(cups, setting.termos, setting.per);
  return (
    <div className="mapp-termos" data-testid="termos">
      <button type="button" className="mapp-termos-row" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${termosLine(t)}. Cambiar cuántos termos llevas`}>
        <span className="mapp-termos-minis" aria-hidden="true">
          {t.levels.map((l, k) => <TermoLevel key={k} level={l} className={k === t.current ? 'is-cur' : ''} />)}
        </span>
        <span className="mapp-termos-line" data-testid="termos-line">{termosLine(t)}</span>
        <span className="mapp-termos-edit">{open ? 'Listo' : 'Cambiar'}</span>
      </button>
      {open && (
        <div className="mapp-termos-set">
          <Stepper label="Termos que llevas" value={t.termos} min={TERMOS_MIN} max={TERMOS_MAX} onChange={(n) => onSetting({ ...setting, termos: n })} testid="termos-n" />
          <Stepper label="Tintos por termo" value={t.per} min={PER_MIN} max={PER_MAX} onChange={(n) => onSetting({ ...setting, per: n })} testid="termos-per" />
          <small>Se guarda en este celular. Cada +1 baja el termo que estás sirviendo.</small>
        </div>
      )}
    </div>
  );
}
