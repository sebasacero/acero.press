import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import ColdBrewCarouselEditor from '../../admin/ColdBrewCarouselEditor.jsx';
import { fetchSection } from '../../../shared/lib/pageSections.js';
import { wrapIndex } from '../lib/houseRecipes.js';
import MapCanvas from '../../esspresale/MapCanvas.jsx';
import '../../esspresale/esspresale.css';
import './home.css';

// Después de la tienda: «Visítanos» (pin gigante sobre el plano de Bogotá, dibujado aquí sin servicio
// de mapas ni cookies; el toque abre Google Maps) junto a la foto de la barra con las recetas. Las recetas de la casa
// se ven como el banner de la barra (video y cuadro de la receta) dentro del vidrio de la vitrina. Se cambian con las pestañas o deslizando, nunca
// solas (un carrusel que avanza solo se ignora). El contenido lo edita el owner con el lápiz
// (page_sections 'cold_brew', el mismo de la vieja barra); esto es solo el respaldo.

const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');

const FALLBACK_SLIDES = [
  {
    video: '/image/cans.mp4', ratioPercent: 25.7, dose: ['0', '2', '4', 'g'],
    target: { es: '155ml H₂O', en: '155ml H₂O', ja: '155ml H₂O' },
    title1: { es: 'COLD BREW.', en: 'COLD BREW.', ja: 'コールドブリュー.' },
    figLabel: { es: 'FIG. 02 — RECETA COLD BREW (LATA 355 ML)', en: 'FIG. 02 — COLD BREW RECIPE (355 ML CAN)', ja: '図02 — コールドブリューレシピ（355ml缶）' },
    ratio: { es: 'RATIO 1:6.5', en: 'RATIO 1:6.5', ja: '比率 1:6.5' },
    doseLabel: { es: 'DOSIS CAFÉ MOLIDO / AEROPRESS INVERTIDA', en: 'GROUND COFFEE DOSE / INVERTED AEROPRESS', ja: '挽いたコーヒー粉量 / インバーテッド・エアロプレス' },
    caption: { es: 'Concentrado 155ml + 200g Hielo (Dilución) = 355ml Total Lata', en: 'Concentrate 155ml + 200g Ice (Dilution) = 355ml Total Can', ja: '濃縮液155ml + 氷200g（希釈）= 缶合計355ml' },
  },
  {
    video: '/image/cans.mp4', ratioPercent: 40, dose: ['0', '1', '8', 'g'],
    target: { es: '220ml Leche', en: '220ml Milk', ja: '220ml ミルク' },
    title1: { es: 'LATTE.', en: 'LATTE.', ja: 'ラテ.' },
    figLabel: { es: 'FIG. 03 — RECETA LATTE (TAZA 220 ML)', en: 'FIG. 03 — LATTE RECIPE (220 ML CUP)', ja: '図03 — ラテレシピ（220ml カップ）' },
    ratio: { es: 'RATIO 1:12', en: 'RATIO 1:12', ja: '比率 1:12' },
    doseLabel: { es: 'DOSIS CAFÉ MOLIDO / ESPRESSO DOBLE', en: 'GROUND COFFEE DOSE / DOUBLE ESPRESSO', ja: '挽いたコーヒー粉量 / ダブルエスプレッソ' },
    caption: { es: 'Espresso 36ml + 184ml Leche Vaporizada = 220ml Total Taza', en: 'Espresso 36ml + 184ml Steamed Milk = 220ml Total Cup', ja: 'エスプレッソ36ml + スチームミルク184ml = カップ合計220ml' },
  },
  {
    video: '/image/cans.mp4', ratioPercent: 55, dose: ['0', '1', '8', 'g'],
    target: { es: '204ml Agua', en: '204ml Water', ja: '204ml 湯' },
    title1: { es: 'AMERICANO.', en: 'AMERICANO.', ja: 'アメリカーノ.' },
    figLabel: { es: 'FIG. 04 — RECETA AMERICANO (TAZA 240 ML)', en: 'FIG. 04 — AMERICANO RECIPE (240 ML CUP)', ja: '図04 — アメリカーノレシピ（240ml カップ）' },
    ratio: { es: 'RATIO 1:13', en: 'RATIO 1:13', ja: '比率 1:13' },
    doseLabel: { es: 'DOSIS CAFÉ MOLIDO / ESPRESSO DOBLE + AGUA', en: 'GROUND COFFEE DOSE / DOUBLE ESPRESSO + WATER', ja: '挽いたコーヒー粉量 / ダブルエスプレッソ + 湯' },
    caption: { es: 'Espresso 36ml + 204ml Agua Caliente = 240ml Total Taza', en: 'Espresso 36ml + 204ml Hot Water = 240ml Total Cup', ja: 'エスプレッソ36ml + 熱湯204ml = カップ合計240ml' },
  },
  {
    video: '/image/cans.mp4', ratioPercent: 15, dose: ['0', '0', '2', 'g'],
    target: { es: '200ml Leche de Coco', en: '200ml Coconut Milk', ja: '200ml ココナッツミルク' },
    title1: { es: 'MATCHA MAMBÉ.', en: 'MAMBÉ MATCHA.', ja: 'マンベ抹茶.' },
    figLabel: { es: 'FIG. 05 — RECETA MATCHA DE MAMBÉ (TAZA 200 ML)', en: 'FIG. 05 — MAMBÉ MATCHA RECIPE (200 ML CUP)', ja: '図05 — マンベ抹茶レシピ（200ml カップ）' },
    ratio: { es: 'RATIO 1:100', en: 'RATIO 1:100', ja: '比率 1:100' },
    doseLabel: { es: 'DOSIS MAMBÉ AMAZÓNICO / BATIDO ESTILO MATCHA', en: 'AMAZONIAN MAMBÉ DOSE / MATCHA-STYLE WHISKED', ja: 'アマゾン産マンベ量 / 抹茶式泡立て' },
    caption: {
      es: 'Mambé amazónico 2g (uso tradicional indígena) + 200ml Leche de Coco tibia, batido estilo matcha = 200ml Total Taza',
      en: 'Amazonian mambé 2g (traditional indigenous use) + 200ml warm Coconut Milk, matcha-style whisked = 200ml Total Cup',
      ja: 'アマゾン産マンベ2g（先住民の伝統的な使用法）+ 温かいココナッツミルク200ml、抹茶式に泡立てる = カップ合計200ml',
    },
  },
];

const SEGMENTS = 20;
const PRICE_LABEL = { es: 'PRECIO', en: 'PRICE', ja: '価格' };

// El banner de la barra tal cual era en el celular (390 px de ancho, mismas clases y estilos de
// index.css: .hero, .hero-h, .odometer-panel, .bar-order-btn, .loc-badge) y escalado entero al vidrio
// de la vitrina, que tiene casi la misma proporción. Así no cambia ni un espacio ni una letra.
const BAR_W = 390;

function useFitScale(ref) {
  const [box, setBox] = useState({ scale: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width) setBox({ scale: width / BAR_W, height: height / (width / BAR_W) });
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return box;
}

function BarBadge({ t }) {
  const address = t('brand.address');
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`ACERO.press, ${address}`)}`;
  return (
    <span className="loc-badge-wrap">
      <a className="loc-badge" href={maps} target="_blank" rel="noopener noreferrer" aria-label={`${address} · ${t('brand.mapsCta')}`}>
        <span className="loc-badge-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <span className="loc-badge-text">
          <span className="loc-badge-address">{address}</span>
          <span className="loc-badge-cta">{t('location')} · {t('brand.mapsCta')} →</span>
        </span>
      </a>
    </span>
  );
}

function WindowBanner({ slide, index, total, lang, t }) {
  const box = useRef(null);
  const video = useRef(null);
  const { scale, height } = useFitScale(box);
  const name = slide.title1?.[lang] ?? slide.title1?.es ?? '';
  const filled = Math.round(((Number(slide.ratioPercent) || 0) / 100) * SEGMENTS);
  const price = Number(slide.price) > 0 ? money(slide.price) : null;
  useEffect(() => { video.current?.play?.().catch(() => {}); }, [slide.video]);
  return (
    <article ref={box} className="lh-banner" aria-roledescription="slide" aria-label={`${index + 1} / ${total} · ${name}`}>
      <div className="hero lh-hero" style={{ width: BAR_W, height: height || undefined, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
        <div className="hero-bg">
          <video ref={video} key={slide.video} className="hero-bg-video" src={slide.video || '/image/cans.mp4'} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" />
          <div className="hero-bg-overlay" />
        </div>
        <div className="hero-copy">
          <div className="bar-actions"><BarBadge t={t} /></div>
          <h3 className="hero-h">
            {name}<br />
            <span className="logo-unit" aria-hidden="true">
              <img src="/image/logo.png" alt="" className="logo-acero1" />
              <span className="logo-press">.press</span>
            </span>
          </h3>
        </div>
        <div className="bar-panel-col">
          <div className="odometer-panel">
            <div className="cota cota-top">
              <span className="annot">{slide.figLabel?.[lang] ?? slide.figLabel?.es}</span>
              <span className="cota-badge">{slide.ratio?.[lang] ?? slide.ratio?.es}</span>
            </div>
            <div className="fig-label">{slide.doseLabel?.[lang] ?? slide.doseLabel?.es}</div>
            <div className="odometer-row">
              <div className="odometer">
                {(slide.dose ?? []).map((d, i) => <span className="digit" key={i}>{d}</span>)}
              </div>
              <span className="odometer-sep">/</span>
              <span className="odometer-target">{slide.target?.[lang] ?? slide.target?.es}</span>
            </div>
            <div className="seg-bar" aria-hidden="true">
              {Array.from({ length: SEGMENTS }, (_, i) => <div key={i} className={`seg ${i < filled ? 'filled' : ''}`} />)}
            </div>
            <div className="progress-caption">{slide.caption?.[lang] ?? slide.caption?.es}</div>
            {price && (
              <div className="cota cota-price">
                <span className="annot">{PRICE_LABEL[lang] || PRICE_LABEL.es}</span>
                <span className="price-value">{price} <small>COP</small></span>
              </div>
            )}
          </div>
          <a className="bar-order-btn" href="#beans">{t('brand.poster.cta')} <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>
  );
}

export default function LocalHero() {
  const { t, lang } = useLanguage();
  const [slides, setSlides] = useState(FALLBACK_SLIDES);
  const [index, setIndex] = useState(0);
  const touchX = useRef(null);
  const p = t('brand.poster');

  const load = useCallback(() => {
    fetchSection('cold_brew').then((section) => {
      const fetched = section?.content?.slides;
      if (Array.isArray(fetched) && fetched.length > 0) setSlides(fetched);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const address = t('brand.address');
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`ACERO.press, ${address}`)}`;

  const go = (i) => setIndex(wrapIndex(i, slides.length));
  const slide = slides[wrapIndex(index, slides.length)];

  return (
    <section className="lh" aria-labelledby="lh-title">
      <SheetFrame />
      <div className="lh-in">
        <div className="visit-copy" id="visitanos">
          <div className="essp-tag">{t('brand.visitTag')}</div>
          {/* El logo de Visítanos: el plano de Bogotá acostado como piso, el pin parado encima y el
              nombre con nuestras dos letras (Archivo y Permanent Marker). Todo abre Google Maps. */}
          <a className="visit-logo" href={maps} target="_blank" rel="noopener noreferrer" aria-label={`${address} · ${t('brand.mapsCta')}`}>
            <span className="visit-stage" aria-hidden="true">
              <span className="visit-floor">
                <MapCanvas className="visit-floor-map" view={(w) => ({ style: 'blanco', c: 13, k: 85, ax: 0.5, ay: 0.5, s: w < 360 ? 13 : 17, heat: 0 })} />
              </span>
              <span className="visit-shadow" />
              {/* El pin es una AeroPress: émbolo, cámara con sus números, la tapa del filtro y una gota de
                  café que cae justo en la 85 */}
              <svg className="visit-pin visit-press" viewBox="0 0 80 136">
                <g stroke="#fff" strokeWidth="3" strokeLinejoin="round">
                  <path d="M14 4h52l-6 9H20z" fill="var(--ink)" />
                  <rect x="22" y="12" width="36" height="26" fill="var(--ink)" />
                  <path d="M12 36h56v6H12z" fill="var(--red)" />
                  <rect x="15" y="41" width="50" height="58" rx="3" fill="var(--red)" />
                  <path d="M10 98h60v6l-4 8H14l-4-8z" fill="var(--ink)" />
                  <path d="M40 116c-5 7-7 10-7 13a7 7 0 0 0 14 0c0-3-2-6-7-13z" fill="var(--red)" />
                </g>
                <path d="M21 50v40" stroke="rgba(255,255,255,.45)" strokeWidth="4" strokeLinecap="round" />
                <g stroke="rgba(255,255,255,.5)" strokeWidth="1.5">{[17, 25, 33, 41, 49, 57, 63].map((x) => <path key={x} d={`M${x} 105v4`} />)}</g>
                <g fill="none" stroke="#fff" strokeWidth="1.8">
                  {[52, 63, 74, 85].map((y) => <g key={y}><circle cx="52" cy={y} r="4.2" /><path d={`M33 ${y}h11`} strokeLinecap="round" /></g>)}
                </g>
                <g fill="#fff" fontFamily="JetBrains Mono, monospace" fontSize="5.6" fontWeight="700" textAnchor="middle">
                  {['4', '3', '2', '1'].map((n, i) => <text key={n} x="52" y={54 + i * 11}>{n}</text>)}
                </g>
              </svg>
            </span>
            <span className="visit-word">
              <h2 className="visit-title" id="lh-title">{t('brand.title')}</h2>
              <span className="visit-script">{t('brand.visitScript')}</span>
            </span>
          </a>
          <div className="essp-loc">{t('brand.loc')}</div>
          <p className="visit-address">{address}</p>
          <div className="essp-ctas">
            <a className="essp-btn" href={maps} target="_blank" rel="noopener noreferrer">{t('brand.mapsCta')}</a>
            <a className="essp-btn is-ghost" href="#beans">{t('brand.cta')}</a>
          </div>
        </div>

        <figure className="lh-store" id="recetas" aria-roledescription="carousel" aria-label={t('brand.recipes')}>
          <ColdBrewCarouselEditor slides={slides} activeIndex={index} onSaved={load} />
          <div className="lh-kicker">{t('brand.recipes')}</div>
          <div
            className="lh-stage"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
            }}
          >
            <div className="lh-photo">
              <img src="/image/local.webp" alt={t('brand.photoAlt')} width="907" height="893" loading="lazy" />
              {/* El banner va en el vidrio de la vitrina grande (coordenadas de la foto) */}
              <div className="lh-window" aria-live="polite">
                {slide && <WindowBanner key={wrapIndex(index, slides.length)} slide={slide} index={wrapIndex(index, slides.length)} total={slides.length} lang={lang} t={t} />}
              </div>
            </div>
          </div>
          <div className="lh-tabs">
            <button type="button" className="lh-arrow" onClick={() => go(index - 1)} aria-label={p.prev}>‹</button>
            <div className="lh-tablist" role="tablist" aria-label={t('brand.recipes')}>
              {slides.map((s, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === wrapIndex(index, slides.length)} onClick={() => go(i)}>
                  {String(s.title1?.[lang] ?? s.title1?.es ?? '').replace(/\.\s*$/, '')}
                </button>
              ))}
            </div>
            <button type="button" className="lh-arrow" onClick={() => go(index + 1)} aria-label={p.next}>›</button>
          </div>
          <figcaption className="lh-caption">{t('brand.caption')}</figcaption>
        </figure>
      </div>
    </section>
  );
}
