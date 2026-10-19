import { useLanguage } from '../../i18n/LanguageContext.jsx';

// Hoja de instrucciones al estilo del folleto de AeroPress: cada paso de la
// receta con su número, un dibujo de línea y el texto, resaltando en rojo la
// temperatura y en azul los tiempos. El dibujo se elige por el tipo de paso
// (leído del texto en español; los 3 idiomas tienen los mismos pasos).

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

// Piezas del AeroPress en línea (viewBox 0 0 120 100).
const Chamber = ({ y = 22, h = 52 }) => (
  <>
    <rect x="44" y={y} width="32" height={h} rx="3" />
    <path d={`M48 ${y + 10}h6M48 ${y + 20}h6M48 ${y + 30}h6`} />
  </>
);
const Cap = ({ y }) => <path d={`M40 ${y}h40v5a3 3 0 0 1-3 3H43a3 3 0 0 1-3-3Z`} />;
const Mug = () => <path d="M38 80h44v14a4 4 0 0 1-4 4H42a4 4 0 0 1-4-4ZM82 84h5a4 4 0 0 1 0 8h-5" />;
const Grounds = ({ y }) => <path className="rs-fill" d={`M47 ${y}q13 -5 26 0v6H47Z`} />;
const Water = ({ y, h }) => <rect className="rs-water" x="46" y={y} width="28" height={h} rx="1" />;

const ART = {
  setup: (
    <>
      <Chamber y={12} h={48} />
      <rect x="47" y="56" width="26" height="30" rx="2" />
      <path d="M40 86h40v6H40Z" />
      <path className="rs-arrow" d="M98 30a22 22 0 0 1 0 36m0 0-6-2m6 2 1-6" />
    </>
  ),
  upright: (
    <>
      <Chamber y={26} h={48} />
      <Cap y={74} />
      <Mug />
      <path className="rs-arrow" d="M98 34v30m0 0-3-4m3 4 3-4" />
    </>
  ),
  coffee: (
    <>
      <Chamber y={34} h={44} />
      <Grounds y={70} />
      <path d="M64 6l26-6 3 9-26 7Z" />
      <path className="rs-dots" d="M66 18v4m-2 4v4m4 2v4m-3 4v4m2 4v4" />
    </>
  ),
  grind: (
    <>
      <rect x="46" y="30" width="28" height="50" rx="4" />
      <path d="M50 30v-6h20v6M60 24V12h22" />
      <circle cx="84" cy="12" r="4" />
      <path d="M50 46h20M50 52h20" />
      <path className="rs-dots" d="M56 86v3m8-3v3m-4 3v3" />
    </>
  ),
  pour: (
    <>
      <Chamber y={34} h={44} />
      <Water y={48} h={26} />
      <Grounds y={68} />
      <path d="M70 4h22a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H74M70 4l-10 10 10 2" />
      <path className="rs-stream" d="M60 14q-2 14 0 34" />
    </>
  ),
  stir: (
    <>
      <Chamber y={34} h={44} />
      <Water y={44} h={30} />
      <path d="M62 6l-4 58M54 64h8" />
      <path className="rs-arrow" d="M40 58c8 6 32 6 40 0m0 0-6 0m6 0-2 6M40 58l6 0m-6 0 2 6" />
    </>
  ),
  wait: (
    <>
      <Chamber y={34} h={44} />
      <Water y={44} h={30} />
      <circle cx="92" cy="28" r="14" />
      <path d="M92 20v8l6 4M88 10h8" />
    </>
  ),
  cap: (
    <>
      <Chamber y={40} h={46} />
      <Cap y={30} />
      <ellipse className="rs-fill" cx="60" cy="12" rx="14" ry="4" />
      <path className="rs-arrow" d="M60 18v8m0 0-3-3m3 3 3-3" />
    </>
  ),
  flip: (
    <>
      <Chamber y={26} h={46} />
      <Cap y={72} />
      <path className="rs-arrow" d="M30 24a34 34 0 0 1 60 0m0 0-7 0m7 0-1-7M30 80a34 34 0 0 0 60 0" />
    </>
  ),
  press: (
    <>
      <path d="M40 6h40v6H40ZM47 12h26v24H47Z" />
      <Chamber y={30} h={40} />
      <Cap y={70} />
      <Mug />
      <path className="rs-arrow" d="M34 10v26m0 0-3-4m3 4 3-4M86 10v26m0 0-3-4m3 4 3-4" />
    </>
  ),
  dilute: (
    <>
      <path d="M30 40h40v50a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4Z" />
      <Water y={70} h={22} />
      <path d="M66 6h22a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H70M66 6l-10 10 10 2" />
      <path className="rs-stream" d="M56 16q-2 20 0 50" />
    </>
  ),
  serve: (
    <>
      <path d="M22 44h34v44a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4ZM64 44h34v44a4 4 0 0 1-4 4H68a4 4 0 0 1-4-4Z" />
      <path className="rs-fill" d="M24 54h30v6H24ZM66 54h30v6H66Z" />
      <path className="rs-steam" d="M32 36q-4-6 0-12t0-12M44 36q-4-6 0-12M76 36q-4-6 0-12t0-12M88 36q-4-6 0-12" />
    </>
  ),
};

export default function RecipeSheet({ recipe }) {
  const { lang, t } = useLanguage();
  const steps = recipe.steps[lang] ?? recipe.steps.es;
  const grind = recipe.equipment.find((e) => e.label === 'grind');
  const filter = recipe.equipment.find((e) => e.label === 'filter');

  return (
    <section className="rs" aria-labelledby={`rs-${recipe.year}`}>
      <div className="rs-main">
        <h4 id={`rs-${recipe.year}`} className="rs-title">
          AEROPRESS<sup>®</sup> {t('sheet.title')} <span className="rs-hot">{recipe.temp}</span> · <span className="rs-time">{t(`position.${recipe.position}`)}</span>
        </h4>
        <p className="rs-sub">{t('sheet.recipeOf').replace('{name}', recipe.name).replace('{year}', recipe.year)}</p>
        <ol className="rs-steps">
          {steps.map((step, i) => (
            <li key={i} className="rs-step">
              <svg className="rs-art" viewBox="0 0 120 100" aria-hidden="true">{ART[artOf(recipe, i)]}</svg>
              <span className="rs-n">{i + 1}</span>
              <p><Marked text={step} /></p>
            </li>
          ))}
        </ol>
      </div>

      <aside className="rs-side" aria-label={t('sheet.data')}>
        <h4>{t('sheet.data')}</h4>
        <dl>
          <dt>{t('modal.dose')}</dt><dd>{recipe.dose}</dd>
          <dt>{t('modal.temp')}</dt><dd className="rs-hot">{recipe.temp}</dd>
          <dt>{t('modal.position')}</dt><dd>{t(`position.${recipe.position}`)}</dd>
          <dt>{t('modal.water')}</dt><dd>{recipe.water}</dd>
        </dl>
        {grind && <p><b>{t('equipmentLabels.grind')}:</b> {grind.value[lang]}</p>}
        {filter && <p><b>{t('equipmentLabels.filter')}:</b> {filter.value[lang]}</p>}
        <p className="rs-legend"><b className="rs-hot">°C</b> {t('sheet.legendTemp')} · <b className="rs-time">0:00</b> {t('sheet.legendTime')}</p>
        <p className="rs-site">www.aceropress.com</p>
      </aside>
    </section>
  );
}
