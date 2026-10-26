import { useLanguage } from '../../i18n/LanguageContext.jsx';
import translations from '../../i18n/translations.js';
import ChampionPhoto from './ChampionPhoto.jsx';
import { championOf, WAC_RECIPES_URL } from '../data/champions.js';

// Hoja de instrucciones con la estructura del folleto impreso de AeroPress y
// el estilo de la página — "plano técnico térmico": línea fina sobre papel
// con cuadrícula (blueprint), piezas metálicas en cromo y el agua pintada con
// el color de un sensor térmico según la temperatura de la receta. El dibujo
// se elige por el tipo de paso (leído del texto en español; los 3 idiomas
// tienen los mismos pasos).

const KINDS = [
  ['serve', /^(servir|enfriar|probar)/i],
  ['setup', /^(posici|aeropress invert|en posici)/i],
  ['flip', /volte|girar|dar vuelta/i],
  ['press', /presion|empuj|émbolo/i],
  ['dilute', /dilu|bypass|al extracto|al concentrado/i],
  ['cap', /tapa|filtro|enjuag|purgar/i],
  ['grind', /moler/i],
  ['pour', /verter|agua/i],
  ['stir', /remov|revolv|agit/i],
  ['wait', /reposar|esperar|florecer|infusi/i],
  ['coffee', /café/i],
];
const kindOf = (es = '') => (KINDS.find(([, re]) => re.test(es)) ?? ['serve'])[0];
// El paso de montaje se dibuja según la posición de la receta.
const artOf = (recipe, i) => {
  const kind = kindOf(recipe.steps.es[i]);
  return kind === 'setup' && recipe.position === 'Upright' ? 'upright' : kind;
};

// Rampa de sensor térmico: 20 °C (ambiente, azul) → 100 °C (hirviendo, rojo).
const HEAT = [[43, 89, 195], [0, 166, 200], [63, 196, 122], [255, 210, 63], [255, 138, 31], [249, 31, 31]];
const HEAT_MIN = 20;
const HEAT_MAX = 100;
const heatPos = (temp) => Math.max(0, Math.min(1, (parseFloat(temp) - HEAT_MIN) / (HEAT_MAX - HEAT_MIN)));
const heatColor = (temp) => {
  const x = heatPos(temp) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(x));
  const f = x - i;
  return `rgb(${HEAT[i].map((c, k) => Math.round(c + (HEAT[i + 1][k] - c) * f)).join(',')})`;
};

// Temperatura (rojo), tiempo (azul) y gramos (negrita), en es/en/ja.
const TOKEN = /(\d+(?:[.,]\d+)?\s?°C)|(\d+:\d{2}(?:[–-]\d+:\d{2})?(?:\s?min)?|~?\d+(?:[–-]\d+)?\s?(?:segundos|seconds?|minutos?|minutes?|秒間|秒|分間|分|min|s)(?![a-zA-Z]))|(≈?\d+(?:[.,]\d+)?(?:[–-]\d+)?\s?g(?![a-zA-Z]))/g;

function Marked({ text }) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const cls = m[1] ? 'rs-hot' : m[2] ? 'rs-time' : 'rs-dose';
    out.push(<b key={m.index} className={cls}>{m[0]}</b>);
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

// "Preparación con {brand} a {temp} en posición {pos}" → piezas con color.
function Title({ template, temp, pos }) {
  return template.split(/(\{brand\}|\{temp\}|\{pos\})/).map((part, i) => {
    if (part === '{brand}') return <span key={i}>AEROPRESS<sup>®</sup></span>;
    if (part === '{temp}') return <span key={i} className="rs-hot">{temp}</span>;
    if (part === '{pos}') return <span key={i} className="rs-time">{pos}</span>;
    return part;
  });
}

// ── Piezas del dibujo (viewBox 0 0 140 120) ──────────────────────────────
const Chamber = ({ x = 50, y, w = 40, h, flip = false }) => {
  const marks = flip ? ['1', '2', '3'] : ['3', '2', '1'];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" />
      {marks.map((n, i) => {
        const cy = y + h * (0.22 + i * 0.18);
        return (
          <g key={n}>
            <circle cx={x + w - 9} cy={cy} r="3.4" />
            <text x={x + w - 9} y={cy + 1.9} className="rs-svg-num">{n}</text>
          </g>
        );
      })}
      <text className="rs-svg-brand" transform={`translate(${x + 9} ${y + h / 2}) rotate(${flip ? 90 : -90})`}>AEROPRESS</text>
    </g>
  );
};
const Cap = ({ x = 46, y, w = 48 }) => (
  <g>
    <path className="rs-chrome" d={`M${x} ${y}h${w}v6a3 3 0 0 1-3 3H${x + 3}a3 3 0 0 1-3-3Z`} />
    <path d={`M${x + 6} ${y + 2}v5M${x + 12} ${y + 2}v5M${x + 18} ${y + 2}v5M${x + 24} ${y + 2}v5M${x + 30} ${y + 2}v5M${x + 36} ${y + 2}v5M${x + 42} ${y + 2}v5`} className="rs-thin" />
  </g>
);
const Mug = ({ x = 44, y = 92, w = 52, h = 26, fill = true }) => (
  <g>
    <path d={`M${x} ${y}h${w}v${h - 3}a3 3 0 0 1-3 3H${x + 3}a3 3 0 0 1-3-3Z`} />
    {fill && <rect className="rs-coffee" x={x + 3} y={y + 8} width={w - 6} height={h - 11} />}
    {Array.from({ length: 7 }).map((_, i) => (
      <path key={i} className="rs-thin" d={`M${x + 5 + i * ((w - 10) / 6)} ${y + 3}v${h - 6}`} />
    ))}
  </g>
);
const Grounds = ({ x = 52, y, w = 36 }) => <path className="rs-fill" d={`M${x} ${y}q${w / 2} -6 ${w} 0v7H${x}Z`} />;
const Water = ({ x = 52, y, w = 36, h }) => <rect className="rs-water" x={x} y={y} width={w} height={h} />;
const Arrow = ({ d, head }) => (
  <g className="rs-arrow">
    <path d={d} />
    <path d={head} className="rs-head" />
  </g>
);
// Manos de línea, como en el folleto.
const PalmDown = () => (
  <g>
    <path d="M30 14c0-5 4-8 10-8h40c8 0 14-3 22-5l22-1c5 0 6 6 1 7l-16 3c5 1 8 3 8 6 0 3-3 5-7 5H38c-5 0-8-3-8-7Z" className="rs-hand" />
    <path className="rs-thin" d="M36 11h40M36 16h42" />
  </g>
);
const Pinch = () => (
  <path className="rs-hand" d="M74 20c-5-4-3-11 3-11l10 1 22-8c5-1 7 5 2 7l-16 7c3 2 3 6-1 7l-12 1c-3 0-6-1-8-4Z" />
);
const Jug = () => (
  <g>
    <path d="M84 6h32l-5 30H89Z" className="rs-chrome" />
    <path d="M116 12c11 0 11 17-3 17" />
    <path d="M84 6l-6 5 7 2" />
    <path className="rs-thin" d="M92 16h8M92 22h6M92 28h8" />
  </g>
);

const ART = {
  setup: (
    <>
      <Chamber y={10} h={74} flip />
      <rect x="54" y="58" width="32" height="44" rx="2" />
      <path d="M46 102h48v7H46Z" className="rs-chrome" />
      <Arrow d="M110 30a30 30 0 0 1 0 50" head="M110 80l-7-1m7 1 0-7" />
    </>
  ),
  upright: (
    <>
      <Chamber y={18} h={62} />
      <Cap y={80} />
      <Mug y={90} fill={false} />
      <Arrow d="M114 22v40" head="M114 62l-4-6m4 6 4-6" />
    </>
  ),
  coffee: (
    <>
      <Chamber y={36} h={56} />
      <Grounds y={84} />
      <Cap y={92} />
      <path d="M86 6h22v4a11 11 0 0 1-22 0Z" className="rs-hand" />
      <path d="M108 8h24" />
      <path className="rs-dots" d="M88 22l-5 5m-3 5-3 5m-3 5-2 5m-2 6-1 5m-1 6v4" />
    </>
  ),
  grind: (
    <>
      <rect x="54" y="36" width="32" height="56" rx="5" className="rs-chrome" />
      <path d="M58 36v-7h24v7M70 29V16h34" className="rs-chrome" />
      <circle cx="108" cy="16" r="5" />
      <path className="rs-thin" d="M58 52h24M58 58h24" />
      <path className="rs-dots" d="M64 98v4m6-2v4m6-6v4m-9 8v3m6-2v3" />
    </>
  ),
  pour: (
    <>
      <Chamber y={40} h={52} />
      <Water y={56} h={30} />
      <Grounds y={84} />
      <Cap y={92} />
      <Jug />
      <path className="rs-stream" d="M80 10q-10 16-8 46" />
    </>
  ),
  stir: (
    <>
      <Chamber y={40} h={52} />
      <Water y={50} h={36} />
      <Grounds y={84} />
      <Cap y={92} />
      <path d="M80 18l-8 60M68 78h8" />
      <Pinch />
      <Arrow d="M20 70h22" head="M42 70l-5-4m5 4-5 4" />
      <Arrow d="M120 70H98" head="M98 70l5-4m-5 4 5 4" />
    </>
  ),
  wait: (
    <>
      <Chamber y={40} h={52} />
      <Water y={50} h={36} />
      <Grounds y={84} />
      <Cap y={92} />
      <circle cx="112" cy="30" r="16" />
      <path d="M112 20v10l7 5M106 10h12M112 10v4" />
    </>
  ),
  cap: (
    <>
      <Chamber y={44} h={64} />
      <Cap y={30} />
      <ellipse className="rs-paper" cx="70" cy="10" rx="20" ry="5" />
      <Arrow d="M70 16v10" head="M70 26l-4-4m4 4 4-4" />
      <Arrow d="M36 36c10 8 58 8 68 0" head="M104 36l-7 1m7-1-2 7" />
    </>
  ),
  flip: (
    <>
      <Chamber y={22} h={58} />
      <Cap y={80} />
      <Arrow d="M28 34a46 46 0 0 1 84 0" head="M112 34l-8-1m8 1 1-8" />
      <Arrow d="M112 96a46 46 0 0 1-84 0" head="M28 96l8 1m-8-1-1 8" />
    </>
  ),
  press: (
    <>
      <path d="M46 22h48v6H46Z" className="rs-chrome" />
      <rect x="54" y="28" width="32" height="20" rx="2" />
      <PalmDown />
      <Chamber y={40} h={40} />
      <Cap y={80} />
      <Mug y={90} />
      <Arrow d="M30 30v44" head="M30 74l-4-6m4 6 4-6" />
      <Arrow d="M110 30v44" head="M110 74l-4-6m4 6 4-6" />
    </>
  ),
  dilute: (
    <>
      <path d="M34 50h52v56a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4Z" />
      <rect className="rs-coffee" x="37" y="80" width="46" height="27" />
      <Water x={37} y={66} w={46} h={14} />
      <Jug />
      <path className="rs-stream" d="M80 10q-14 20-12 56" />
    </>
  ),
  serve: (
    <>
      <Mug x={20} y={50} w={46} h={62} />
      <Mug x={76} y={50} w={46} h={62} />
      <path className="rs-steam" d="M34 42q-5-7 0-14t0-14M50 42q-5-7 0-14M90 42q-5-7 0-14t0-14M106 42q-5-7 0-14" />
    </>
  ),
};

export default function RecipeSheet({ recipe }) {
  const { lang, t } = useLanguage();
  const steps = recipe.steps[lang] ?? recipe.steps.es;
  const pos = t(`position.${recipe.position}`);
  const others = ['es', 'en', 'ja'].filter((l) => l !== lang);
  const heat = heatColor(recipe.temp);
  const champ = championOf(recipe.year);

  return (
    <section className="rs" lang={lang} aria-labelledby={`rs-${recipe.year}`} style={{ '--rs-heat': heat }}>
      {/* Degradados compartidos por los dibujos: cromo y agua a la temperatura de la receta. */}
      <svg width="0" height="0" className="rs-defs" aria-hidden="true">
        <defs>
          <linearGradient id="rs-chrome" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8d939a" />
            <stop offset=".22" stopColor="#f4f5f6" />
            <stop offset=".45" stopColor="#b9bec4" />
            <stop offset=".62" stopColor="#ffffff" />
            <stop offset="1" stopColor="#7d838a" />
          </linearGradient>
          <linearGradient id="rs-heat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={heat} stopOpacity=".95" />
            <stop offset="1" stopColor={heat} stopOpacity=".35" />
          </linearGradient>
        </defs>
      </svg>
      <div className="rs-sheet">
        <div className="rs-main">
          <h4 id={`rs-${recipe.year}`} className="rs-title">
            <Title template={t('sheet.title')} temp={recipe.temp} pos={pos} />
          </h4>
          <ol className="rs-steps">
            {steps.map((step, i) => (
              <li key={i} className="rs-step">
                <div className="rs-cell">
                  <span className="rs-fig">FIG. {String(i + 1).padStart(2, '0')} — {t(`sheet.kind.${artOf(recipe, i)}`)}</span>
                  <svg className="rs-art" viewBox="0 0 140 120" aria-hidden="true">{ART[artOf(recipe, i)]}</svg>
                </div>
                <span className="rs-n">{String(i + 1).padStart(2, '0')}</span>
                <p><Marked text={step} /></p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="rs-side" aria-label={t('sheet.data')}>
          <h4>{t('sheet.data')}</h4>
          <p className="rs-lead">{t('sheet.lead').replace('{name}', recipe.name).replace('{year}', recipe.year)}</p>
          <ChampionPhoto key={recipe.year} recipe={recipe} className="rs-champ" />
          <ul className="rs-links">
            <li><a href={WAC_RECIPES_URL} target="_blank" rel="noopener noreferrer">{t('champ.source')} ↗</a></li>
            {champ?.final && <li><a href={champ.final} target="_blank" rel="noopener noreferrer">{t('champ.final').replace('{year}', recipe.year)} ↗</a></li>}
            {champ?.video && <li><a href={champ.video} target="_blank" rel="noopener noreferrer">{t('champ.video')} ↗</a></li>}
          </ul>
          <p>
            <b>{t('modal.dose')}:</b> {recipe.dose} · <b>{t('modal.temp')}:</b> <span className="rs-hot">{recipe.temp}</span> · <b>{t('modal.water')}:</b> {recipe.water}
          </p>
          {recipe.equipment.map((e) => (
            <p key={e.label}><b>{t(`equipmentLabels.${e.label}`)}:</b> {e.value[lang]}</p>
          ))}
          <p className="rs-pos"><b>{t('modal.position')}:</b> <span className="rs-time">{pos}</span></p>
          <div className="rs-sensor" role="img" aria-label={`${t('modal.temp')} ${recipe.temp}`}>
            <span className="rs-sensor-label">{t('sheet.sensor')}</span>
            <div className="rs-sensor-bar"><i style={{ left: `${heatPos(recipe.temp) * 100}%` }} /></div>
            <div className="rs-sensor-scale"><span>{HEAT_MIN}°C</span><b style={{ color: heat }}>{recipe.temp}</b><span>{HEAT_MAX}°C</span></div>
          </div>
          <hr />
          <p className="rs-coffee-note"><b><i>{t('sheet.coffee')}:</i></b> {recipe.coffee[lang]}</p>
          <hr />
          <p className="rs-site">www.aceropress.com</p>
          <hr />
          <p className="rs-legal">{t('sheet.legal')}</p>
          <p className="rs-copy">© {new Date().getFullYear()} Acero.press</p>
        </aside>
      </div>

      {/* El doblez del folleto: la siguiente cara empieza en otro idioma. */}
      <div className="rs-fold" aria-hidden="true">
        {others.map((l) => (
          <span key={l}>{l.toUpperCase()} · {translations[l].sheet.foldTitle}</span>
        ))}
      </div>
    </section>
  );
}
