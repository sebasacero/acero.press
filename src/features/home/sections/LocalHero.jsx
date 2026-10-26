import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import ColdBrewCarouselEditor from '../../admin/ColdBrewCarouselEditor.jsx';
import { fetchSection } from '../../../shared/lib/pageSections.js';
import { wrapIndex } from '../lib/houseRecipes.js';
import '../../esspresale/esspresale.css';
import './home.css';

// Después de la tienda: la foto de la barra, centrada y grande. Las recetas de la casa
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

/**
 * El banner de la barra (video de fondo y el cuadro de la receta con su odómetro), proyectado
 * dentro del vidrio de la vitrina, como una pantalla detrás del cristal. Solo el visible carga video.
 */
function WindowBanner({ slide, index, total, lang, t }) {
  const ref = useRef(null);
  const name = slide.title1?.[lang] ?? slide.title1?.es ?? '';
  const filled = Math.round(((Number(slide.ratioPercent) || 0) / 100) * SEGMENTS);
  const price = Number(slide.price) > 0 ? money(slide.price) : null;
  useEffect(() => { ref.current?.play?.().catch(() => {}); }, [slide.video]);
  return (
    <article className="lh-banner" aria-roledescription="slide" aria-label={`${index + 1} / ${total} · ${name}`}>
      <video ref={ref} key={slide.video} className="lh-banner-video" src={slide.video || '/image/cans.mp4'} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" />
      <div className="lh-banner-shade" aria-hidden="true" />
      <div className="lh-banner-in">
        {/* El banner original de la barra: título con el logo, cuadro oscuro y botón crema */}
        <h3 className="hero-h">
          {name}<br />
          <span className="logo-unit" aria-hidden="true">
            <img src="/image/logo.png" alt="" className="logo-acero1" />
            <span className="logo-press">.press</span>
          </span>
        </h3>
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

  const go = (i) => setIndex(wrapIndex(i, slides.length));
  const slide = slides[wrapIndex(index, slides.length)];

  return (
    <section className="lh" aria-labelledby="lh-title">
      <SheetFrame />
      <div className="lh-in">
        <div className="lh-head">
          <div className="essp-tag">{t('brand.tag')} <span className="essp-new">{t('brand.badge')}</span></div>
          <h2 className="essp-title lh-title" id="lh-title">{t('brand.recipes')}</h2>
        </div>

        <figure className="lh-store" id="recetas" aria-roledescription="carousel" aria-label={t('brand.recipes')}>
          <ColdBrewCarouselEditor slides={slides} activeIndex={index} onSaved={load} />
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
