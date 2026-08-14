import { useLanguage } from '../../i18n/LanguageContext.jsx';

const RATIO_PERCENT = 25.7; // % que llena la barra segmentada (ver .seg-bar::after original)
const TOTAL_SEGMENTS = 20;

export default function ColdBrewHero() {
  const { t } = useLanguage();
  const filledCount = Math.round((RATIO_PERCENT / 100) * TOTAL_SEGMENTS);

  return (
    <section className="hero" id="inicio">
      <div className="hero-bg">
        <video className="hero-bg-video" autoPlay muted loop playsInline poster="/assets/hero-poster.jpg">
          <source src="/image/cans.mp4" type="video/mp4" />
        </video>
        <div className="hero-bg-overlay"></div>
      </div>

      <div className="hero-copy">
        <div className="schematic-tag"><span className="dot"></span> {t('location')}</div>
        <h1>
          {t('hero.title1')}<br />
          <div className="logo-unit">
            <img src="/image/logo.png" alt="ACERO.press" className="logo-acero1" />
            <span className="logo-press">.press</span>
          </div>
        </h1>
        <div className="fp-links"></div>
      </div>

      <div className="odometer-panel">
        <div className="cota cota-top">
          <span className="annot">{t('odometer.figLabel')}</span>
          <span className="cota-badge">{t('odometer.ratio')}</span>
        </div>

        <div className="fig-label">{t('odometer.doseLabel')} · 咖啡 dosis</div>

        <div className="odometer-row">
          <div className="odometer">
            <span className="digit">0</span><span className="digit">2</span><span className="digit">4</span><span className="digit">g</span>
          </div>
          <span className="odometer-sep">/</span>
          <span className="odometer-target">155ml H₂O</span>
        </div>

        <div className="seg-bar">
          {Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => (
            <div key={i} className={`seg ${i < filledCount ? 'filled' : ''}`}></div>
          ))}
        </div>

        <div className="progress-caption">{t('odometer.caption')}</div>
      </div>
    </section>
  );
}
