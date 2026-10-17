import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Navbar from '../../shared/layout/Navbar.jsx';
import MapCanvas from './MapCanvas.jsx';
import { ClientPhone, BaristaPhone } from './AppPhones.jsx';
import { SheetFrame, Segs, Odometer, useClock, selectAppRole } from './parts.jsx';
import './esspresale.css';

// Primera sección del sitio: dos banners de Esspresale (pedir café / ser
// barista) dibujados como las tarjetas de redes. Rotan solos cada 8 s y se
// detienen mientras el cursor o el foco están encima.
const AUTO_MS = 8000;

const BG_VIEW = (w) =>
  w < 760
    ? { style: 'plano', c: 12, k: 80, ax: 0.6, ay: 0.62, s: 9, heat: 0.8 }
    : { style: 'plano', c: 12, k: 82, ax: 0.8, ay: 0.5, s: Math.max(8, w / 150), heat: 0.9, labels: 1.1 };

function Tabs({ index, onSelect }) {
  const { t } = useLanguage();
  return (
    <div className="essp-tabs" role="tablist" aria-label={t('essp.tabsLabel')}>
      {['order', 'barista'].map((key, i) => (
        <button key={key} type="button" role="tab" aria-selected={index === i} onClick={() => onSelect(i)}>
          {t(`essp.tabs.${key}`)}
        </button>
      ))}
    </div>
  );
}

function TitleBlock({ maker, makerIsYou, index, onSelect }) {
  const { t } = useLanguage();
  const { time, date } = useClock();
  return (
    <div className="essp-block">
      <div><span>{t('essp.block.zone')}</span><b>Chapinero</b></div>
      <div><span>{t('essp.block.time')}</span><b>{time}</b></div>
      <div><span>{t('essp.block.date')}</span><b>{date}</b></div>
      <div><span>{t('essp.block.maker')}</span><b className="is-red">{makerIsYou ? t('essp.block.you') : maker}</b></div>
      <Tabs index={index} onSelect={onSelect} />
    </div>
  );
}

function Slide({ kind, active, index, onSelect }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  const k = (key) => t(`essp.${kind}.${key}`);
  const isOrder = kind === 'order';
  const title = k('title');
  const specs = k('specs');

  // La diapositiva oculta no debe recibir foco ni lectores de pantalla.
  useEffect(() => {
    if (ref.current) ref.current.inert = !active;
  }, [active]);

  return (
    <section
      ref={ref}
      className={`essp-slide essp-slide--${isOrder ? 'paper' : 'photo'}`}
      aria-roledescription="slide"
      aria-label={t(`essp.tabs.${kind}`)}
      aria-hidden={!active}
    >
      <div className="essp-bg" aria-hidden="true">
        {isOrder ? (
          <>
            <MapCanvas view={BG_VIEW} />
            <div className="essp-paper-fade" />
          </>
        ) : (
          <>
            <div className="essp-photo" />
            <div className="essp-grid-light" />
          </>
        )}
      </div>
      <SheetFrame />

      <div className="essp-in">
        <hr className="essp-dash" />
        <div className="essp-main">
          <div className="essp-copy">
            <div className="essp-tag">{k('tag')} <span className="essp-new">{k('badge')}</span></div>
            <h1 className="essp-title">
              {title[0]}<br />{title[1]}
              <span className="essp-script">{k('script')}</span>
            </h1>
            <div className="essp-loc">{k('loc')}</div>
            <p className="essp-lede">{k('lede')}</p>
            <div className="essp-ctas">
              <a className="essp-btn" href="#app" onClick={() => selectAppRole(isOrder ? 'cliente' : 'barista')}>
                {k('cta')} <span aria-hidden="true">→</span>
              </a>
              <a className="essp-link" href="#app" onClick={() => selectAppRole(isOrder ? 'cliente' : 'barista')}>{k('link')}</a>
            </div>
          </div>

          {isOrder ? <ClientPhone className="essp-hero-phone" /> : <BaristaPhone className="essp-hero-phone" />}

          <aside className="essp-panel" aria-label={k('panelFig')}>
            <div className="essp-panel-cota"><span>{k('panelFig')}</span><span className="essp-badge">{k('panelBadge')}</span></div>
            <div className="essp-panel-label">{k('panelLabel')}</div>
            <div className="essp-odo-row">
              <Odometer digits={isOrder ? ['0', '1', '2', '′'] : ['0', '2', '5']} />
              <span className="essp-odo-sep">/</span>
              <span className="essp-odo-target">{isOrder ? 'Laura' : k('days')}</span>
            </div>
            <Segs filled={isOrder ? 13 : 10} className="essp-bar" />
            <div className="essp-specs">
              {(isOrder ? ['12′', '700 m', '3'] : ['1', '350', '1 kg']).map((v, i) => (
                <div key={i}><b>{v}</b><span>{specs[i]}</span></div>
              ))}
            </div>
            <p className="essp-panel-text">{k('panelText')}</p>
          </aside>
        </div>
        <TitleBlock maker="Laura" makerIsYou={!isOrder} index={index} onSelect={onSelect} />
      </div>
    </section>
  );
}

export default function EsspresaleHero({ navOpen, onOpenNavDrawer }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);

  const select = useCallback((i) => {
    setIndex(i);
    setTick((n) => n + 1); // reinicia el temporizador al elegir a mano
  }, []);

  useEffect(() => {
    if (paused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % 2), AUTO_MS);
    return () => clearInterval(id);
  }, [paused, tick]);

  const tone = index === 0 ? 'paper' : 'photo';

  return (
    <header
      className={`essp-hero essp-hero--${tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}
    >
      <Navbar variant="sheet" tone={tone} navOpen={navOpen} onOpenNavDrawer={onOpenNavDrawer} />
      <div className="essp-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        <Slide kind="order" active={index === 0} index={index} onSelect={select} />
        <Slide kind="barista" active={index === 1} index={index} onSelect={select} />
      </div>
    </header>
  );
}
