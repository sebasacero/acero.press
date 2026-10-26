import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import MapCanvas from '../../esspresale/MapCanvas.jsx';
import './home.css';

// Visítanos, justo antes del pie: un pin gigante sobre el plano de Bogotá en la Cra. 13 con 85. El
// plano se dibuja aquí (sin servicio de mapas ni cookies); el toque abre Google Maps.
export default function VisitSection() {
  const { t } = useLanguage();
  const address = t('brand.address');
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`ACERO.press, ${address}`)}`;

  return (
    <section className="visit" id="visitanos" aria-labelledby="visit-title">
      <SheetFrame />
      <div className="visit-in">
        <div className="visit-copy">
          <div className="essp-tag">{t('brand.visitTag')}</div>
          <h2 className="essp-title visit-title" id="visit-title">{t('brand.title')}</h2>
          <div className="essp-loc">{t('brand.loc')}</div>
          <p className="visit-address">{address}</p>
          <div className="essp-ctas">
            <a className="essp-btn" href={maps} target="_blank" rel="noopener noreferrer">{t('brand.mapsCta')}</a>
            <a className="essp-btn is-ghost" href="#beans">{t('brand.cta')}</a>
          </div>
        </div>
        <a className="visit-map" href={maps} target="_blank" rel="noopener noreferrer" aria-label={`${address} · ${t('brand.mapsCta')}`}>
          <MapCanvas
            className="visit-map-canvas"
            label={t('brand.mapLabel')}
            view={(w) => ({ style: 'blanco', c: 13, k: 85, ax: 0.5, ay: 0.58, s: w < 420 ? 15 : 20, heat: 0 })}
          />
          {/* El pin, gigante, en el centro del plano */}
          <svg className="visit-pin" viewBox="0 0 64 88" aria-hidden="true">
            <ellipse cx="32" cy="84" rx="13" ry="3.5" fill="rgba(42,53,80,.25)" />
            <path d="M32 2C15.4 2 2 15.2 2 31.6 2 53.8 32 84 32 84s30-30.2 30-52.4C62 15.2 48.6 2 32 2Z" fill="var(--red)" stroke="#fff" strokeWidth="3" />
            <circle cx="32" cy="31" r="11" fill="#fff" />
          </svg>
          <span className="visit-card">
            <b>ACERO.press</b>
            <span>{address}</span>
            <em>{t('brand.mapsCta')} →</em>
          </span>
        </a>
      </div>
    </section>
  );
}
