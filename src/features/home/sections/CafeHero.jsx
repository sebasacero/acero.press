import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function CafeHero() {
  const { t } = useLanguage();

  return (
    <div className="hero-image-container">
      <img src="/image/local.jpg" alt="Foto del local ACEROPRESS" className="hero-bg-img" />
      <div className="hero-dim-overlay" aria-hidden="true"></div>

      <a href="#beans" className="hero-location-badge" aria-label={t('hero.addressCta')}>
        <span className="hero-location-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </span>
        <span className="hero-location-text">
          <span className="hero-location-address">{t('hero.address')}</span>
          <span className="hero-location-cta">{t('hero.addressCta')} →</span>
        </span>
      </a>
    </div>
  );
}
