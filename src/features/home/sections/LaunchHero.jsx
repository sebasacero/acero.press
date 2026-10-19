import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { useEditableTexts } from '../../../shared/lib/editableTexts.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';
import Navbar from '../../../shared/layout/Navbar.jsx';
import '../../esspresale/esspresale.css';
import './launch.css';

// Banner principal estilo "transmisión de lanzamiento": video a sangre en
// negro, tipografía DIN en mayúsculas, botones de contorno y, abajo, la
// telemetría en vivo de una preparación de AeroPress (reloj T+, etapas como
// en un webcast y medidores de temperatura y extracción).

const LOOP = 90; // segundos de una preparación completa
const STAGES = [
  { key: 'grind', at: 0 },
  { key: 'pour', at: 10 },
  { key: 'stir', at: 25 },
  { key: 'press', at: 50 },
  { key: 'serve', at: 75 },
];
const FIELDS = ['tag', 'title1', 'title2', 'lede'].map((k) => ({
  key: `launch_${k}`,
  label: { tag: 'Etiqueta superior', title1: 'Título — línea 1', title2: 'Título — línea 2', lede: 'Texto' }[k],
  multiline: k === 'lede',
}));

// Las etapas van espaciadas parejo en la línea; el avance sigue el tiempo real
// de cada etapa (tramo a tramo), como en una transmisión de lanzamiento.
const stagePos = (i) => i / (STAGES.length - 1);
const lineProgress = (s) => {
  const i = STAGES.findLastIndex((x) => s >= x.at);
  if (i === STAGES.length - 1) return 1;
  const a = STAGES[i];
  const b = STAGES[i + 1];
  return stagePos(i) + ((s - a.at) / (b.at - a.at)) * (stagePos(i + 1) - stagePos(i));
};

const clock = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function useBrewClock() {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [s, setS] = useState(reduce ? 50 : 0);
  useEffect(() => {
    if (reduce) return undefined;
    const id = setInterval(() => setS((x) => (x + 1) % LOOP), 1000);
    return () => clearInterval(id);
  }, [reduce]);
  return s;
}

function Gauge({ value, max, label, unit, digits }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270°
  const fill = Math.max(0, Math.min(1, value / max));
  return (
    <div className="lx-gauge">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} className="lx-gauge-track" strokeDasharray={`${c * arc} ${c}`} />
        <circle cx="60" cy="60" r={r} className="lx-gauge-fill" strokeDasharray={`${c * arc * fill} ${c}`} />
      </svg>
      <div className="lx-gauge-read">
        <b>{value.toFixed(digits)}</b>
        <span>{unit}</span>
      </div>
      <div className="lx-gauge-label">{label}</div>
    </div>
  );
}

export default function LaunchHero({ navOpen, onOpenNavDrawer }) {
  const { t, lang } = useLanguage();
  const [text, reload] = useEditableTexts(FIELDS.map((f) => f.key));
  const s = useBrewClock();
  const stage = [...STAGES].reverse().find((x) => s >= x.at) ?? STAGES[0];
  const progress = s / LOOP;
  // Agua que se enfría de 92 °C a 84 °C y extracción que sube hasta ~20 %.
  const temp = 92 - 8 * progress;
  const extraction = Math.min(20.5, 21 * Math.sqrt(progress));

  return (
    <section className="lx" lang={lang} aria-label={t('launch.aria')}>
      <video className="lx-video" src="/image/hero_main1.mp4" poster="/image/local.jpg" autoPlay muted loop playsInline aria-hidden="true" />
      <div className="lx-shade" aria-hidden="true" />
      <Navbar variant="sheet" tone="photo" navOpen={navOpen} onOpenNavDrawer={onOpenNavDrawer} />
      <SectionEditButton section="Banner principal" fig="FIG. 00 — LANZAMIENTO" placement="hero" onSaved={reload} fields={FIELDS} />

      <div className="lx-copy">
        <p className="lx-tag">{text('launch_tag', t('launch.tag'))}</p>
        <h1 className="lx-title">
          <span>{text('launch_title1', t('launch.title1'))}</span>
          <span>{text('launch_title2', t('launch.title2'))}</span>
        </h1>
        <p className="lx-lede">{text('launch_lede', t('launch.lede'))}</p>
        <div className="lx-ctas">
          <a className="lx-btn" href="#beans">{t('launch.ctaShop')}</a>
          <a className="lx-btn lx-btn--ghost" href="#metodo">{t('launch.ctaRecipes')}</a>
        </div>
      </div>

      <div className="lx-gauges">
        <Gauge value={temp} max={100} label={t('launch.gTemp')} unit="°C" digits={1} />
        <Gauge value={extraction} max={25} label={t('launch.gExt')} unit="%" digits={1} />
      </div>

      <div className="lx-hud">
        <div className="lx-clock" aria-live="off">
          <span>{t('launch.mission')}</span>
          <b>T+ {clock(s)}</b>
        </div>
        <ol className="lx-timeline" style={{ '--lx-p': lineProgress(s) }}>
          {STAGES.map((x, i) => (
            <li key={x.key} className={s >= x.at ? 'is-done' : ''} style={{ left: `${stagePos(i) * 100}%` }} aria-current={x === stage ? 'step' : undefined}>
              <i />
              <span>{t(`launch.stage.${x.key}`)}</span>
            </li>
          ))}
        </ol>
        <div className="lx-coords">
          <span>CHAPINERO · BOGOTÁ</span>
          <b>4.65°N 74.06°W · 2.600 {t('launch.masl')}</b>
        </div>
      </div>
    </section>
  );
}
