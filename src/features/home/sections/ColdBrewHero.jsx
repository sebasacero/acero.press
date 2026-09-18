import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const TOTAL_SEGMENTS = 20;
const AUTO_MS = 6000;

// Diapositiva 1 (Cold Brew) sigue viniendo de translations.js — no se toca.
// Las 3 siguientes se definen aquí, con su propia receta y texto por idioma,
// siguiendo el mismo formato que ya existía (FIG. — RECETA, RATIO, DOSIS, CAPTION).
const EXTRA_SLIDES = [
  {
    video: '/image/cans.mp4',
    ratioPercent: 40,
    dose: ['0', '1', '8', 'g'],
    target: { es: '220ml Leche', en: '220ml Milk', ja: '220ml ミルク' },
    title1: { es: 'LATTE.', en: 'LATTE.', ja: 'ラテ.' },
    figLabel: {
      es: 'FIG. 03 — RECETA LATTE (TAZA 220 ML)',
      en: 'FIG. 03 — LATTE RECIPE (220 ML CUP)',
      ja: '図03 — ラテレシピ（220ml カップ）',
    },
    ratio: { es: 'RATIO 1:12', en: 'RATIO 1:12', ja: '比率 1:12' },
    doseLabel: {
      es: 'DOSIS CAFÉ MOLIDO / ESPRESSO DOBLE',
      en: 'GROUND COFFEE DOSE / DOUBLE ESPRESSO',
      ja: '挽いたコーヒー粉量 / ダブルエスプレッソ',
    },
    caption: {
      es: 'Espresso 36ml + 184ml Leche Vaporizada = 220ml Total Taza',
      en: 'Espresso 36ml + 184ml Steamed Milk = 220ml Total Cup',
      ja: 'エスプレッソ36ml + スチームミルク184ml = カップ合計220ml',
    },
  },
  {
    video: '/image/cans.mp4',
    ratioPercent: 55,
    dose: ['0', '1', '8', 'g'],
    target: { es: '204ml Agua', en: '204ml Water', ja: '204ml 湯' },
    title1: { es: 'AMERICANO.', en: 'AMERICANO.', ja: 'アメリカーノ.' },
    figLabel: {
      es: 'FIG. 04 — RECETA AMERICANO (TAZA 240 ML)',
      en: 'FIG. 04 — AMERICANO RECIPE (240 ML CUP)',
      ja: '図04 — アメリカーノレシピ（240ml カップ）',
    },
    ratio: { es: 'RATIO 1:13', en: 'RATIO 1:13', ja: '比率 1:13' },
    doseLabel: {
      es: 'DOSIS CAFÉ MOLIDO / ESPRESSO DOBLE + AGUA',
      en: 'GROUND COFFEE DOSE / DOUBLE ESPRESSO + WATER',
      ja: '挽いたコーヒー粉量 / ダブルエスプレッソ + 湯',
    },
    caption: {
      es: 'Espresso 36ml + 204ml Agua Caliente = 240ml Total Taza',
      en: 'Espresso 36ml + 204ml Hot Water = 240ml Total Cup',
      ja: 'エスプレッソ36ml + 熱湯204ml = カップ合計240ml',
    },
  },
  {
    video: '/image/cans.mp4',
    ratioPercent: 15,
    dose: ['0', '0', '2', 'g'],
    target: { es: '200ml Leche de Coco', en: '200ml Coconut Milk', ja: '200ml ココナッツミルク' },
    title1: { es: 'MATCHA MAMBÉ.', en: 'MAMBÉ MATCHA.', ja: 'マンベ抹茶.' },
    figLabel: {
      es: 'FIG. 05 — RECETA MATCHA DE MAMBÉ (TAZA 200 ML)',
      en: 'FIG. 05 — MAMBÉ MATCHA RECIPE (200 ML CUP)',
      ja: '図05 — マンベ抹茶レシピ（200ml カップ）',
    },
    ratio: { es: 'RATIO 1:100', en: 'RATIO 1:100', ja: '比率 1:100' },
    doseLabel: {
      es: 'DOSIS MAMBÉ AMAZÓNICO / BATIDO ESTILO MATCHA',
      en: 'AMAZONIAN MAMBÉ DOSE / MATCHA-STYLE WHISKED',
      ja: 'アマゾン産マンベ量 / 抹茶式泡立て',
    },
    caption: {
      es: 'Mambé amazónico 2g (uso tradicional indígena) + 200ml Leche de Coco tibia, batido estilo matcha = 200ml Total Taza',
      en: 'Amazonian mambé 2g (traditional indigenous use) + 200ml warm Coconut Milk, matcha-style whisked = 200ml Total Cup',
      ja: 'アマゾン産マンベ2g（先住民の伝統的な使用法）+ 温かいココナッツミルク200ml、抹茶式に泡立てる = カップ合計200ml',
    },
  },
];

function ColdBrewSlide({ t, lang, videoRef, extra }) {
  const location = t('location');
  const title1 = extra ? extra.title1[lang] : t('hero.title1');
  const figLabel = extra ? extra.figLabel[lang] : t('odometer.figLabel');
  const ratio = extra ? extra.ratio[lang] : t('odometer.ratio');
  const doseLabel = extra ? extra.doseLabel[lang] : t('odometer.doseLabel');
  const caption = extra ? extra.caption[lang] : t('odometer.caption');
  const dose = extra ? extra.dose : ['0', '2', '4', 'g'];
  const target = extra ? extra.target[lang] : '155ml H₂O';
  const ratioPercent = extra ? extra.ratioPercent : 25.7;
  const video = extra ? extra.video : '/image/cans.mp4';
  const filledCount = Math.round((ratioPercent / 100) * TOTAL_SEGMENTS);

  return (
    <div className="hero">
      <div className="hero-bg">
        <video ref={videoRef} className="hero-bg-video" muted loop playsInline poster="/assets/hero-poster.jpg">
          <source src={video} type="video/mp4" />
        </video>
        <div className="hero-bg-overlay"></div>
      </div>

      <div className="hero-copy">
        <div className="schematic-tag"><span className="dot"></span> {location}</div>
        <h1>
          {title1}<br />
          <div className="logo-unit">
            <img src="/image/logo.png" alt="ACERO.press" className="logo-acero1" />
            <span className="logo-press">.press</span>
          </div>
        </h1>
        <div className="fp-links"></div>
      </div>

      <div className="odometer-panel">
        <div className="cota cota-top">
          <span className="annot">{figLabel}</span>
          <span className="cota-badge">{ratio}</span>
        </div>

        <div className="fig-label">{doseLabel}</div>

        <div className="odometer-row">
          <div className="odometer">
            {dose.map((d, i) => <span className="digit" key={i}>{d}</span>)}
          </div>
          <span className="odometer-sep">/</span>
          <span className="odometer-target">{target}</span>
        </div>

        <div className="seg-bar">
          {Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => (
            <div key={i} className={`seg ${i < filledCount ? 'filled' : ''}`}></div>
          ))}
        </div>

        <div className="progress-caption">{caption}</div>
      </div>
    </div>
  );
}

export default function ColdBrewHero() {
  const { t, lang } = useLanguage();
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const videoRefs = useRef([]);
  const slideCount = EXTRA_SLIDES.length + 1;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slideCount);
    }, AUTO_MS);
    return () => clearInterval(timerRef.current);
  }, [slideCount]);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) v.play().catch(() => {});
      else v.pause();
    });
  }, [index]);

  const goTo = (i) => {
    clearInterval(timerRef.current);
    setIndex(((i % slideCount) + slideCount) % slideCount);
  };

  return (
    <section className="coldbrew-carousel" id="inicio">
      <div className="coldbrew-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        <div className="coldbrew-slide">
          <ColdBrewSlide t={t} lang={lang} videoRef={(el) => (videoRefs.current[0] = el)} extra={null} />
        </div>
        {EXTRA_SLIDES.map((s, i) => (
          <div className="coldbrew-slide" key={i}>
            <ColdBrewSlide t={t} lang={lang} videoRef={(el) => (videoRefs.current[i + 1] = el)} extra={s} />
          </div>
        ))}
      </div>

      <button className="coldbrew-carousel-arrow left" onClick={() => goTo(index - 1)} aria-label="Anterior">‹</button>
      <button className="coldbrew-carousel-arrow right" onClick={() => goTo(index + 1)} aria-label="Siguiente">›</button>

      <div className="coldbrew-carousel-dots">
        {Array.from({ length: slideCount }).map((_, i) => (
          <button
            key={i}
            className={`coldbrew-carousel-dot ${i === index ? 'active' : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Ir a la diapositiva ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
