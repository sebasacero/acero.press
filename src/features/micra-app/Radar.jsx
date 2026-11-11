import { useMemo } from 'react';
import { radarView, radarTitle } from './radar.js';

/**
 * El radar del inicio del cliente (maqueta «Micra en tres toques»): cuántos
 * baristas hay en la calle, quién está más cerca y un punto por cada uno;
 * tocar un punto abre su página, que ya trae una taza puesta para apartar.
 */
export default function Radar({ list, me, onOpen, onNear, asking }) {
  const v = useMemo(() => radarView(list, me), [list, me]);
  const title = radarTitle(v);
  if (!title) return null;
  return (
    <div className={`mapp-radar is-${v.mode}`} data-testid="radar">
      <div className="mapp-radar-txt">
        <p className="mapp-radar-big" data-testid="radar-count">{title.big}<small>{title.small}</small></p>
        {v.nearest ? (
          <p className="mapp-radar-near">{v.mode === 'live' ? 'Más cerca' : 'El más cercano'}: <b>{v.nearest.name}, {v.nearest.distance}</b>.{v.nearest.price ? ` ${v.nearest.price}.` : ''}</p>
        ) : v.mode === 'off' ? (
          <p className="mapp-radar-near">Abajo ves a qué hora sale cada uno.</p>
        ) : v.located ? (
          <p className="mapp-radar-near">Nadie a menos de 25 cuadras ahora. Abajo están todos.</p>
        ) : (
          <button type="button" className="mapp-radar-loc" onClick={onNear} disabled={asking} data-testid="radar-near">{asking ? 'Buscando…' : 'Ver a cuántas cuadras'}</button>
        )}
      </div>
      <div className="mapp-radar-scope" role="group" aria-label="Radar: toca un punto para apartar">
        <span className="mapp-radar-you" aria-hidden="true" />
        {v.dots.map((d) => (
          <button key={d.id} type="button" className="mapp-radar-dot" style={{ left: `${d.left}%`, top: `${d.top}%` }} onClick={() => onOpen(d.id)} aria-label={d.label} data-testid="radar-dot">
            <span aria-hidden="true">{d.initial}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
