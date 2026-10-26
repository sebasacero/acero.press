import { FORMATS } from '../espresaleCard.js';

// Zonas: lo que queda fuera de la zona segura (lo tapa la app) sombreado y
// con su nombre. App: la interfaz de la red dibujada encima, para ver la
// tarjeta como la verá la gente. Solo DOM/SVG: no toca el lienzo.

const pct = (v, total) => `${(v / total) * 100}%`;

function Zones({ F }) {
  const { w, h, safe } = F;
  const strips = {
    top: { left: 0, top: 0, width: '100%', height: pct(safe.y0, h) },
    bottom: { left: 0, top: pct(safe.y1, h), width: '100%', height: pct(h - safe.y1, h) },
    left: { left: 0, top: pct(safe.y0, h), width: pct(safe.x0, w), height: pct(safe.y1 - safe.y0, h) },
    right: { left: pct(safe.x1, w), top: pct(safe.y0, h), width: pct(w - safe.x1, w), height: pct(safe.y1 - safe.y0, h) },
  };
  const labels = {};
  for (const c of F.covers ?? []) {
    const side = c.side === 'all' ? 'top' : c.side;
    labels[side] = labels[side] ? `${labels[side]} · ${c.label}` : c.label;
  }
  return (
    <div className="mst-zones" aria-hidden="true">
      {Object.entries(strips).map(([side, style]) => (
        <div key={side} className={`mst-zone-shade is-${side}`} style={style}>
          {labels[side] && <span>{labels[side]}</span>}
        </div>
      ))}
      <div className="mst-zone-safe" style={{ left: pct(safe.x0, w), top: pct(safe.y0, h), width: pct(safe.x1 - safe.x0, w), height: pct(safe.y1 - safe.y0, h) }}>
        <span>ZONA SEGURA</span>
      </div>
    </div>
  );
}

const ink = { fill: 'rgba(255,255,255,.92)', stroke: 'rgba(0,0,0,.35)', strokeWidth: 2 };
const txt = (x, y, s, t, anchor = 'start', weight = 600) => (
  <text x={x} y={y} fontSize={s} fontWeight={weight} textAnchor={anchor} fill="#fff" stroke="rgba(0,0,0,.35)" strokeWidth="1.5" paintOrder="stroke" fontFamily="-apple-system, 'Archivo', sans-serif">{t}</text>
);
// Columna de botones a la derecha (me gusta, comentar, compartir…)
const column = (x, y0, n = 4, gap = 150) => Array.from({ length: n }, (_, i) => (
  <g key={i}>
    <circle cx={x} cy={y0 + i * gap} r="34" fill="none" stroke="#fff" strokeWidth="6" opacity=".92" />
    <rect x={x - 26} y={y0 + i * gap + 46} width="52" height="14" rx="7" {...ink} />
  </g>
));

function Ghost({ id, F }) {
  const { w, h } = F;
  let body = null;
  if (id === 'story') {
    body = (
      <>
        {[0, 1, 2].map((i) => <rect key={i} x={24 + i * 348} y={28} width={336} height={6} rx={3} fill="#fff" opacity={i ? 0.45 : 0.95} />)}
        <circle cx={78} cy={104} r={34} {...ink} />
        {txt(128, 116, 34, 'aceropress · 2 min')}
        {txt(1030, 118, 54, '×', 'end', 400)}
        <rect x={40} y={1810} width={760} height={84} rx={42} fill="none" stroke="#fff" strokeWidth="4" opacity=".9" />
        {txt(84, 1864, 32, 'Enviar mensaje', 'start', 500)}
        {txt(890, 1868, 52, '♡', 'middle', 400)}
        {txt(1000, 1868, 46, '➤', 'middle', 400)}
      </>
    );
  } else if (id === 'reel' || id === 'tiktok' || id === 'shorts') {
    const top = id === 'reel' ? txt(48, 130, 52, 'Reels', 'start', 800)
      : id === 'tiktok' ? <>{txt(450, 130, 40, 'Siguiendo', 'end', 600)}{txt(540, 130, 40, '|', 'middle', 400)}{txt(630, 130, 40, 'Para ti', 'start', 800)}</>
        : txt(1030, 130, 46, '⌕   ⋮', 'end', 600);
    const name = id === 'tiktok' ? '@aceropress' : 'aceropress';
    const follow = id === 'reel' ? 'Seguir' : id === 'shorts' ? 'Suscribirse' : null;
    const y = id === 'tiktok' ? 1600 : id === 'shorts' ? 1560 : 1600;
    body = (
      <>
        {top}
        {column(1000, id === 'tiktok' ? 1020 : 1180, id === 'tiktok' ? 5 : 4)}
        <circle cx={92} cy={y - 14} r={36} {...ink} />
        {txt(148, y, 36, name, 'start', 700)}
        {follow && <><rect x={148 + name.length * 21} y={y - 42} width={follow.length * 22 + 40} height={58} rx={12} fill="none" stroke="#fff" strokeWidth="3" />{txt(168 + name.length * 21, y - 2, 30, follow, 'start', 700)}</>}
        <rect x={48} y={y + 50} width={640} height={22} rx={11} {...ink} />
        <rect x={48} y={y + 92} width={420} height={22} rx={11} {...ink} />
        {id !== 'shorts' && txt(48, y + 180, 32, '♫  Audio original · aceropress', 'start', 500)}
      </>
    );
  } else if (id === 'grid34') {
    const cut = (w - (h * 3) / 4) / 2;
    body = (
      <>
        <rect x={cut} y={2} width={w - cut * 2} height={h - 4} fill="none" stroke="#DE1B1B" strokeWidth="4" strokeDasharray="18 12" />
        <rect x={0} y={0} width={cut} height={h} fill="rgba(0,0,0,.5)" />
        <rect x={w - cut} y={0} width={cut} height={h} fill="rgba(0,0,0,.5)" />
        {txt(w / 2, h - 40, 30, 'Cuadrícula del perfil (3:4)', 'middle', 700)}
      </>
    );
  } else if (id === 'player') {
    body = (
      <>
        <rect x={0} y={h - 150} width={w} height={150} fill="rgba(0,0,0,.45)" />
        <rect x={60} y={h - 120} width={w - 120} height={8} rx={4} fill="rgba(255,255,255,.4)" />
        <rect x={60} y={h - 120} width={(w - 120) * 0.32} height={8} rx={4} fill="#DE1B1B" />
        {txt(60, h - 50, 40, '▶   ⏭   🔊   0:12 / 0:45', 'start', 600)}
        {txt(w - 60, h - 50, 40, '⚙   ⛶', 'end', 600)}
      </>
    );
  } else {
    body = (
      <>
        <rect x={w / 2 - 330} y={h / 2 - 50} width={660} height={92} rx={46} fill="rgba(0,0,0,.55)" />
        {txt(w / 2, h / 2 + 10, 36, 'Nada la tapa: se ve completa', 'middle', 700)}
      </>
    );
  }
  return (
    <svg className="mst-ghost" data-ghost={id} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">{body}</svg>
  );
}

export default function SafeZoneOverlay({ format, mode }) {
  const F = FORMATS[format];
  if (mode === 'zones') return <Zones F={F} />;
  if (mode === 'app') return <Ghost id={F.ghost ?? 'none'} F={F} />;
  return null;
}
