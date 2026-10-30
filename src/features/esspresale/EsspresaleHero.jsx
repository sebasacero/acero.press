import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Navbar from '../../shared/layout/Navbar.jsx';
import StoreButtons from './StoreButtons.jsx';
import LiveCard, { DayCard } from './LiveCard.jsx';
import SectionEditButton from '../admin/SectionEditButton.jsx';
import { fetchAppConfig } from '../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../shared/layout/WhatsAppButton.jsx';
import { useEditableTexts } from '../../shared/lib/editableTexts.js';
import './esspresale.css';

// Primera sección del sitio: dos banners dibujados como las tarjetas de redes,
// en carrusel, uno después del otro: «Pide café en AeroPress a domicilio» y
// «Vive del café con tu AeroPress». Pasan solos y con el dedo (pedido del usuario).

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

// Cada banner dura su turno y pasa al siguiente; se detiene mientras el cursor o
// el foco están encima. Sin flechas ni píldoras (pedido del usuario): pasa solo,
// con el dedo, o con «Soy barista»; por eso nunca deja de pasar del todo.
const TURN_MS = 8000;

function Slide({ kind, active, onSelect, whatsapp, stores }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  const [text, reloadTexts] = useEditableTexts(TEXT_KEYS.map((f) => `essp_${kind}_${f}`));
  const base = (key) => t(`essp.${kind}.${key}`);
  const k = (key) => text(`essp_${kind}_${key}`, base(key));
  const isOrder = kind === 'order';
  // Un solo h1 en la portada: el de la primera diapositiva; la otra es un h2
  const Title = isOrder ? 'h1' : 'h2';
  const title = [text(`essp_${kind}_title1`, base('title')[0]), text(`essp_${kind}_title2`, base('title')[1])];
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
                  <a className="essp-btn" href="/micra">{base('cta')}</a>
                  <button type="button" className="essp-btn is-link" onClick={() => onSelect(1)}>{base('cta2')}</button>
                </>
              ) : (
                <>
                  <a className="essp-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">{base('cta')}</a>
                  <a className="essp-btn is-link" href="/escuela">{base('cta2')}</a>
                </>
              )}
            </div>
          </div>

          {/* La app viva (quién está en la calle) o el día del barista; las tiendas solo cuando hay enlace */}
          <div className="essp-hero-device">
            {isOrder ? <LiveCard /> : <DayCard />}
            {(stores.apple || stores.google) && <StoreButtons appStoreUrl={stores.apple} playStoreUrl={stores.google} />}
          </div>
        </div>
      </div>
    </section>
  );
}

const BARISTA_HASHES = ['#baristas', '#tinteros'];

export default function EsspresaleHero({ navOpen, onOpenNavDrawer }) {
  const { t } = useLanguage();
  // #baristas (el menú, un enlace compartido) abre «Para baristas»; #tinteros sigue sirviendo para enlaces viejos
  const [index, setIndex] = useState(() => (BARISTA_HASHES.includes(window.location.hash) ? 1 : 0));
  // Pasa solo, salvo si llega con #baristas (vino a ese banner) o pidió menos movimiento
  const [auto] = useState(() => !BARISTA_HASHES.includes(window.location.hash) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [hold, setHold] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const root = useRef(null);
  // Elegir (con el dedo o «Soy barista») reinicia el turno del banner elegido
  const select = useCallback((i) => setIndex(i), []);
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
        <Slide kind="order" active={index === 0} onSelect={select} stores={stores} />
        <Slide kind="barista" active={index === 1} onSelect={select} whatsapp={whatsapp} stores={stores} />
      </div>
    </header>
  );
}
