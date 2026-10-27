// Los dibujos de la hoja de instrucciones de AeroPress Go, a trazo (como la hoja impresa): uno por
// paso, en un lienzo de 160 × 120. Piezas: cámara, émbolo, tapa del filtro, taza. Sin texto adentro.

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const W = '#fff';

/** Cámara de la Go con sus marcas 1–3 (la ③ resaltada si se llena). */
function Chamber({ x = 60, y = 34, w = 40, h = 56, level = 0, mark = false }) {
  const lv = level > 0 ? y + h - (h - 6) * level : null;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={W} {...S} />
      {lv && <rect x={x + 2} y={lv} width={w - 4} height={y + h - lv - 1} fill="currentColor" opacity=".18" />}
      <path d={`M${x - 3} ${y}h${w + 6}`} {...S} />
      {[0.25, 0.5, 0.75].map((f, i) => (
        <g key={i}>
          <circle cx={x + 8} cy={y + h - (h - 8) * f} r="3.2" {...S} strokeWidth="1.3" fill={mark && i === 2 ? 'currentColor' : W} />
          <path d={`M${x + 13} ${y + h - (h - 8) * f}h7`} {...S} strokeWidth="1.3" />
        </g>
      ))}
      <path d={`M${x + w - 9} ${y + 10}v${h - 20}`} {...S} strokeWidth="1.2" opacity=".5" />
    </g>
  );
}

/** Tapa del filtro con sus huecos, vista de lado. */
function Cap({ x = 56, y = 90, w = 48 }) {
  return (
    <g>
      <path d={`M${x} ${y}h${w}l-3 8h${-(w - 6)}z`} fill={W} {...S} />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${x + 8 + i * 6.5} ${y + 3}v2.5`} {...S} strokeWidth="1.4" />)}
    </g>
  );
}

/** Émbolo: vástago, borde de arriba y sello de caucho abajo. */
function Plunger({ x = 64, y = 6, w = 32, h = 50 }) {
  return (
    <g>
      <rect x={x - 5} y={y} width={w + 10} height="6" rx="2" fill={W} {...S} />
      <rect x={x} y={y + 6} width={w} height={h - 12} fill={W} {...S} />
      <rect x={x - 1} y={y + h - 6} width={w + 2} height="6" rx="1.5" fill="currentColor" stroke="currentColor" strokeWidth="1" />
    </g>
  );
}

/** Taza firme (con asa). */
function Mug({ x = 50, y = 98, w = 60, h = 18 }) {
  return (
    <g>
      <path d={`M${x} ${y}h${w}v${h - 4}a4 4 0 0 1-4 4h${-(w - 8)}a4 4 0 0 1-4-4z`} fill={W} {...S} />
      <path d={`M${x + w} ${y + 4}h5a5 5 0 0 1 0 10h-5`} {...S} />
    </g>
  );
}

const Arrow = ({ d, head }) => (
  <g>
    <path d={d} {...S} strokeWidth="1.8" />
    <path d={head} {...S} strokeWidth="1.8" />
  </g>
);

const DRAWINGS = [
  // 1 · Saca el émbolo de la cámara
  () => (
    <>
      <Chamber y={52} h={56} />
      <Plunger y={8} h={56} />
      <Arrow d="M124 70V22" head="M117 30l7-8 7 8" />
    </>
  ),
  // 2 · Filtro en la tapa
  () => (
    <>
      <ellipse cx="80" cy="34" rx="30" ry="9" fill={W} {...S} />
      {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${62 + i * 9} 31l3 6`} {...S} strokeWidth="1" opacity=".5" />)}
      <Arrow d="M80 50v22" head="M74 66l6 7 6-7" />
      <ellipse cx="80" cy="86" rx="34" ry="10" fill={W} {...S} />
      <path d="M46 86v10c0 5.5 15 10 34 10s34-4.5 34-10V86" fill={W} {...S} />
      {Array.from({ length: 7 }, (_, i) => <circle key={i} cx={62 + i * 6} cy="86" r="1.3" fill="currentColor" />)}
    </>
  ),
  // 3 · Enrosca la tapa en la cámara
  () => (
    <>
      <Chamber y={14} h={58} />
      <Cap y={94} />
      <path d="M44 88c10 9 62 9 72 0" {...S} strokeWidth="1.8" />
      <path d="M110 82l6 6-8 3" {...S} strokeWidth="1.8" />
      <Arrow d="M80 90v-10" head="M75 85l5-6 5 6" />
    </>
  ),
  // 4 · Sobre la taza, una cucharada colmada de café
  () => (
    <>
      <Chamber y={36} h={56} level={0.12} />
      <Cap y={92} w={48} />
      <Mug y={100} />
      <path d="M96 10h22a8 8 0 0 1-8 10H98z" fill={W} {...S} transform="rotate(28 106 15)" />
      <path d="M118 6l18-6" {...S} />
      {[[92, 26], [88, 32], [94, 36], [86, 40], [91, 44]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.6" fill="currentColor" />)}
    </>
  ),
  // 5 · Agita suave para nivelar
  () => (
    <>
      <Chamber y={30} h={58} level={0.14} />
      <Cap y={88} />
      <Mug y={96} />
      <path d="M36 52c-8 10-8 22 0 32M124 52c8 10 8 22 0 32" {...S} strokeWidth="1.8" />
      <path d="M32 58l4-6 5 4M128 78l-4 6-5-4" {...S} strokeWidth="1.8" />
    </>
  ),
  // 6 · Agua hasta el ③
  () => (
    <>
      <Chamber y={40} h={56} level={0.72} mark />
      <Cap y={96} />
      <path d="M96 4h32l-4 34H100z" fill={W} {...S} transform="rotate(-38 112 21)" />
      <path d="M88 24c-2 8-3 18-3 30" {...S} strokeWidth="1.6" />
      <path d="M128 10c6 2 8 8 4 12" {...S} transform="rotate(-38 112 21)" />
    </>
  ),
  // 7 · Remueve
  () => (
    <>
      <Chamber y={40} h={56} level={0.72} />
      <Cap y={96} />
      <rect x="86" y="8" width="7" height="72" rx="3" fill={W} {...S} transform="rotate(14 89 44)" />
      <path d="M66 70c6 6 22 6 28 0" {...S} strokeWidth="1.6" />
      <path d="M90 66l4 4-5 2" {...S} strokeWidth="1.6" />
    </>
  ),
  // 8 · Émbolo adentro y presiona suave
  () => (
    <>
      <Chamber y={50} h={50} level={0.3} />
      <Cap y={100} />
      <Plunger y={22} h={40} />
      <path d="M60 22c0-10 10-16 22-16s24 4 24 12l-2 4H60z" fill={W} {...S} />
      <path d="M70 12c4-2 10-2 14 0" {...S} strokeWidth="1.3" />
      <Arrow d="M124 26v24" head="M118 44l6 7 6-7" />
      <Arrow d="M36 26v24" head="M30 44l6 7 6-7" />
    </>
  ),
  // 9 · Fuera la tapa y el disco de café
  () => (
    <>
      <g transform="rotate(-20 72 56)">
        <Chamber x={46} y={36} h={46} />
        <Plunger x={50} y={12} h={34} />
      </g>
      <ellipse cx="108" cy="94" rx="15" ry="5" fill="currentColor" opacity=".55" />
      <path d="M93 94v4c0 2.8 6.7 5 15 5s15-2.2 15-5v-4" {...S} />
      <path d="M128 52l12 6-6 12-12-6z" fill={W} {...S} />
      <Arrow d="M96 74l8 10" head="M98 84l6 1 1-6" />
    </>
  ),
  // 10 · A tu gusto: espresso, americano, latte o cold brew
  () => (
    <>
      <path d="M30 52h40v50a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6z" fill={W} {...S} />
      <rect x="33" y="80" width="34" height="25" rx="3" fill="currentColor" opacity=".7" />
      <path d="M86 40h46v60a6 6 0 0 1-6 6H92a6 6 0 0 1-6-6z" fill={W} {...S} />
      <rect x="89" y="58" width="40" height="45" rx="3" fill="currentColor" opacity=".25" />
      {Array.from({ length: 4 }, (_, i) => <path key={i} d={`M${88 + i * 11} 48v54`} {...S} strokeWidth="1" opacity=".35" />)}
    </>
  ),
];

export default function BrewDrawing({ index }) {
  const Draw = DRAWINGS[index];
  if (!Draw) return null;
  return (
    <svg className="brew-draw" viewBox="0 0 160 120" aria-hidden="true">
      <Draw />
    </svg>
  );
}
