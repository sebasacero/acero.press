import { useMemo } from 'react';
import { buildStreet, pavingLines } from '../lib/streetScene.js';

// La calle a trazo del guion (cerros, fachadas, andén) como fondo de una sección. Se pega
// al borde inferior del contenedor y recorta por los lados en pantallas angostas. Decorativa.
// El andén ocupa los últimos `height - ground` px del dibujo: lo que se pare «en la calle»
// (una persona, una tarjeta) va alineado con esa línea desde el CSS (--street-ground).
export default function StreetScene({ seed = 7, noon = false, width = 1400, height = 420, ground = 340, className = '' }) {
  const s = useMemo(() => buildStreet({ width, height, ground, seed, noon }), [width, height, ground, seed, noon]);
  const paving = pavingLines(width);
  const hills = `M0 ${ground} L${s.hills.map((p) => `${p.x} ${p.y}`).join(' L')} L${width} ${ground} Z`;
  return (
    <svg className={`street ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <circle className="street-sun" cx={s.sun.cx} cy={s.sun.cy} r={s.sun.r} />
      <path className="street-hills" d={hills} />
      {s.facades.map((f) => (
        <g key={f.x} className={`street-facade${f.sand ? ' is-sand' : ''}`}>
          <rect x={f.x} y={ground - f.h} width={f.w} height={f.h} />
          {f.windows.map((w) => <rect key={`${w.x}-${w.y}`} className={`street-win${w.lit ? ' is-lit' : ''}`} x={w.x} y={w.y} width="18" height="26" />)}
          <line className="street-roof" x1={f.x - 4} y1={ground - f.h} x2={f.x + f.w + 4} y2={ground - f.h} />
          {f.door && <rect className="street-door" x={f.x + f.w / 2 - 16} y={ground - 58} width="32" height="58" />}
        </g>
      ))}
      <line className="street-lamp" x1={s.lamp.x} y1={ground + 8} x2={s.lamp.x} y2={s.lamp.top} />
      <rect className="street-lamp-head" x={s.lamp.x - 15} y={s.lamp.top - 28} width="30" height="30" rx="5" />
      <line className="street-trunk" x1={s.tree.x} y1={ground + 8} x2={s.tree.x} y2={s.tree.top} />
      {s.tree.crowns.map((c, i) => <circle key={i} className="street-crown" cx={s.tree.x + c.dx} cy={ground + c.dy} r={c.r} />)}
      <rect className="street-walk" x="0" y={ground} width={width} height={height - ground} />
      <line className="street-curb" x1="0" y1={ground} x2={width} y2={ground} />
      {paving.map((x) => <line key={x} className="street-tile" x1={x} y1={ground} x2={x - 22} y2={height} />)}
      <line className="street-stripe" x1="0" y1={height - 18} x2={width} y2={height - 18} />
    </svg>
  );
}
