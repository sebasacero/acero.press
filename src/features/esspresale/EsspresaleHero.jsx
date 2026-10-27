import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Navbar from '../../shared/layout/Navbar.jsx';
import MapCanvas from './MapCanvas.jsx';
import { StreetPhone, BaristaPhone } from './AppPhones.jsx';
import { SheetFrame, Segs, Odometer } from './parts.jsx';
import StoreButtons from './StoreButtons.jsx';
import SectionEditButton from '../admin/SectionEditButton.jsx';
import { useStreetMap } from '../../shared/lib/useStreetMap.js';
import { fetchAppConfig } from '../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../shared/layout/WhatsAppButton.jsx';
import { useEditableTexts } from '../../shared/lib/editableTexts.js';
import './esspresale.css';

// Primera sección del sitio: dos banners dibujados como las tarjetas de redes,
// en carrusel, uno después del otro: «Pide café en AeroPress a domicilio» y
// «Vive del café con tu AeroPress». Pasan solos (pedido del usuario) hasta que
// la persona elige uno con las flechas, las píldoras o el dedo.

// Cifras del celular y del panel de «Para tinteros»: un día de ejemplo, marcado como tal
const EXAMPLE_DAY = { stops: ['1', '4'], specs: ['3,2 km', '14', '38'] };

// Textos de cada banner que se cambian con su lápiz (app_config essp_<banner>_<campo>_<idioma>).
const TEXT_KEYS = ['title1', 'title2', 'script', 'loc', 'lede', 'panelText'];
const textFields = (kind) => [
  { key: `essp_${kind}_title1`, label: 'Título · línea 1' },
  { key: `essp_${kind}_title2`, label: 'Título · línea 2' },
  { key: `essp_${kind}_script`, label: 'Frase roja (marcador)' },
  { key: `essp_${kind}_loc`, label: 'Línea de ubicación' },
  { key: `essp_${kind}_lede`, label: 'Texto', multiline: true },
  { key: `essp_${kind}_panelText`, label: 'Texto del panel oscuro', multiline: true },
];

/** Cifras del panel y del celular: lo que micra_street_map cuenta, o guiones mientras llega. */
const digitsOf = (n) => (n === null ? ['—'] : String(n).padStart(2, '0').split(''));


const BG_VIEW = (w) =>
  w < 760
    ? { style: 'plano', c: 12, k: 80, ax: 0.6, ay: 0.62, s: 9, heat: 0.8 }
    : { style: 'plano', c: 12, k: 82, ax: 0.8, ay: 0.5, s: Math.max(8, w / 150), heat: 0.9, labels: 1.1 };

// Con datos del estudio de calle, el fondo dibuja el calor real de las ventas
// y los tinteros registrados; sin datos, la demanda de ejemplo de siempre.
const withLayers = (layers) => (w) => (layers ? { ...BG_VIEW(w), heatPoints: layers.heatPoints, pinPoints: layers.pinPoints, pins: layers.pinPoints.length > 0 } : BG_VIEW(w));

// Cada banner dura su turno y pasa al siguiente; se detiene con el cursor o el
// foco encima y deja de pasar solo en cuanto la persona elige uno.
const TURN_MS = 8000;

function CarouselControls({ index, onSelect, playing, paused }) {
  const { t } = useLanguage();
  const kinds = ['order', 'barista'];
  const step = (d) => onSelect((index + d + kinds.length) % kinds.length);
  return (
    <div
      className={`essp-carousel${playing ? ' is-playing' : ''}${paused ? ' is-paused' : ''}`}
      style={{ '--essp-turn': `${TURN_MS}ms` }}
    >
      <button type="button" className="essp-carousel-arrow" onClick={() => step(-1)} aria-label={t('essp.prev')}>‹</button>
      <div className="essp-carousel-tabs" role="tablist" aria-label={t('essp.tabsLabel')}>
        {kinds.map((key, i) => (
          <button key={key} type="button" role="tab" aria-selected={index === i} onClick={() => onSelect(i)}>
            <span>{t(`essp.tabs.${key}`)}</span>
          </button>
        ))}
      </div>
      <button type="button" className="essp-carousel-arrow" onClick={() => step(1)} aria-label={t('essp.next')}>›</button>
    </div>
  );
}

function Slide({ kind, active, index, onSelect, playing, paused, street = null, streetLayers = null, whatsapp, stores }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  const [text, reloadTexts] = useEditableTexts(TEXT_KEYS.map((f) => `essp_${kind}_${f}`));
  const base = (key) => t(`essp.${kind}.${key}`);
  const k = (key) => text(`essp_${kind}_${key}`, base(key));
  const isOrder = kind === 'order';
  // Un solo h1 en la portada: el de la primera diapositiva; la otra es un h2
  const Title = isOrder ? 'h1' : 'h2';
  const title = [text(`essp_${kind}_title1`, base('title')[0]), text(`essp_${kind}_title2`, base('title')[1])];
  const specs = base('specs');
  // Datos reales del estudio (null hasta que lleguen): tazas, cuadras con venta, tinteros
  const cups = street ? street.cups : null;
  const blocks = street ? street.blocks : null;
  const tinteros = street ? street.tinteros : null;
  const show = (n) => (n === null ? '—' : String(n));

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
            <MapCanvas view={withLayers(streetLayers)} redrawKey={streetLayers} />
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
      <SectionEditButton
        section={t(`essp.tabs.${kind}`)}
        fig={base('tag')}
        placement="hero"
        fields={textFields(kind)}
        onSaved={reloadTexts}
      />

      <div className="essp-in">
        <hr className="essp-dash" />
        <div className="essp-main">
          <div className="essp-copy">
            <div className="essp-tag">{k('tag')} <span className="essp-new">{k('badge')}</span></div>
            <Title className="essp-title">
              {title[0]}<br />{title[1]}
              <span className="essp-script">{k('script')}</span>
            </Title>
            <div className="essp-loc">{k('loc')}</div>
            <p className="essp-lede">{k('lede')}</p>
            <div className="essp-ctas">
              {isOrder ? (
                <>
                  <a className="essp-btn" href="#beans">{base('cta')}</a>
                  <button type="button" className="essp-btn is-ghost" onClick={() => onSelect(1)}>{base('cta2')}</button>
                </>
              ) : (
                <>
                  <a className="essp-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">{base('cta')}</a>
                  <a className="essp-btn is-ghost" href="/escuela">{base('cta2')}</a>
                </>
              )}
            </div>
          </div>

          {/* Debajo del iPhone, pequeños, los botones de las tiendas (sin enlace dicen «Pronto») */}
          <div className="essp-hero-device">
            {isOrder ? <StreetPhone className="essp-hero-phone" street={street} layers={streetLayers} /> : <BaristaPhone className="essp-hero-phone" />}
            <StoreButtons appStoreUrl={stores.apple} playStoreUrl={stores.google} />
          </div>

          <aside className="essp-panel" aria-label={k('panelFig')}>
            {/* Sin puntos reales el mapa dibuja una demanda de ejemplo: el panel no dice «datos reales» encima */}
            <div className="essp-panel-cota"><span>{k('panelFig')}</span><span className="essp-badge">{isOrder && !streetLayers ? base('panelBadgeDemo') : k('panelBadge')}</span></div>
            <div className="essp-panel-label">{k('panelLabel')}</div>
            <div className="essp-odo-row">
              <Odometer digits={isOrder ? digitsOf(cups) : EXAMPLE_DAY.stops} />
              <span className="essp-odo-sep">/</span>
              <span className="essp-odo-target">{isOrder ? `${show(blocks)} ${blocks === 1 ? base('target1') : base('target')}` : k('days')}</span>
            </div>
            <Segs filled={isOrder ? Math.min(20, blocks ?? 0) : 10} className="essp-bar" />
            <div className="essp-specs">
              {(isOrder ? [show(cups), show(blocks), show(tinteros)] : EXAMPLE_DAY.specs).map((v, i) => (
                <div key={i}><b>{v}</b><span>{specs[i]}</span></div>
              ))}
            </div>
            <p className="essp-panel-text">{k('panelText')}</p>
          </aside>
        </div>
        {/* key: la píldora activa vuelve a llenarse desde cero en cada turno */}
        <CarouselControls key={active ? index : 'idle'} index={index} onSelect={onSelect} playing={playing && active} paused={paused} />
      </div>
    </section>
  );
}

const BARISTA_HASHES = ['#baristas', '#tinteros'];

export default function EsspresaleHero({ navOpen, onOpenNavDrawer }) {
  const { t } = useLanguage();
  const { layers: streetLayers, summary: street } = useStreetMap();
  // #baristas (el menú, un enlace compartido) abre «Para baristas»; #tinteros sigue sirviendo para enlaces viejos
  const [index, setIndex] = useState(() => (BARISTA_HASHES.includes(window.location.hash) ? 1 : 0));
  // Pasa solo hasta que la persona elige (o llega con #baristas, o pidió menos movimiento)
  const [auto, setAuto] = useState(() => !BARISTA_HASHES.includes(window.location.hash) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [hold, setHold] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const root = useRef(null);
  const select = useCallback((i) => { setAuto(false); setIndex(i); }, []);
  useEffect(() => {
    const onHash = () => { if (BARISTA_HASHES.includes(window.location.hash)) select(1); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [select]);
  // Fuera de pantalla o con la pestaña escondida no corre el turno
  useEffect(() => {
    const el = root.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const paused = hold || !onScreen;
  useEffect(() => {
    if (!auto || paused) return undefined;
    const id = setTimeout(() => { if (!document.hidden) setIndex((i) => (i + 1) % 2); }, TURN_MS);
    return () => clearTimeout(id);
  }, [auto, paused, index]);
  // Deslizar con el dedo cambia de banner (como el carrusel de recetas)
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = [e.touches[0].clientX, e.touches[0].clientY]; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current[0];
    const dy = e.changedTouches[0].clientY - touch.current[1];
    touch.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) select((index + (dx < 0 ? 1 : -1) + 2) % 2);
  };

  // «Para baristas» escribe al WhatsApp del negocio (el mismo del botón flotante), con el mensaje listo
  const [number, setNumber] = useState(FALLBACK_WHATSAPP_NUMBER);
  const [stores, setStores] = useState({ apple: '', google: '' });
  useEffect(() => {
    fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then(setNumber);
    Promise.all([fetchAppConfig('app_store_url', ''), fetchAppConfig('play_store_url', '')])
      .then(([apple, google]) => setStores({ apple: apple || '', google: google || '' }));
  }, []);
  const whatsapp = `https://wa.me/${number}?text=${encodeURIComponent(t('essp.barista.waMsg'))}`;

  const tone = index === 0 ? 'paper' : 'photo';

  return (
    <header
      ref={root}
      className={`essp-hero essp-hero--${tone}`}
      id="baristas"
      aria-roledescription="carousel"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHold(false); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <Navbar variant="sheet" tone={tone} navOpen={navOpen} onOpenNavDrawer={onOpenNavDrawer} />
      <div className="essp-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        <Slide kind="order" active={index === 0} index={index} onSelect={select} playing={auto} paused={paused} street={street} streetLayers={streetLayers} stores={stores} />
        <Slide kind="barista" active={index === 1} index={index} onSelect={select} playing={auto} paused={paused} whatsapp={whatsapp} stores={stores} />
      </div>
    </header>
  );
}
