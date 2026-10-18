import { useLanguage } from '../../features/i18n/LanguageContext.jsx';
import { useEditableTexts } from '../lib/editableTexts.js';
import SectionEditButton from '../../features/admin/SectionEditButton.jsx';

const FIELDS = [{ key: 'hero_address', label: 'Dirección del local', hint: 'Abre Google Maps con esta dirección.' }];

/**
 * Botón de ubicación con ícono (como la insignia de la portada anterior):
 * dirección de la barra + "Bogotá, 2.600 msnm · Cómo llegar". Abre Google Maps.
 * La dirección se edita con el lápiz (app_config hero_address_<idioma>).
 */
export default function LocationBadge({ className = '' }) {
  const { t } = useLanguage();
  const [text, reload] = useEditableTexts(['hero_address']);
  const address = text('hero_address', t('hero.address'));
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <span className={`loc-badge-wrap ${className}`}>
      <SectionEditButton section="Dirección" fig="FIG. — UBICACIÓN" placement="inline" onSaved={reload} fields={FIELDS} />
      <a className="loc-badge" href={maps} target="_blank" rel="noopener noreferrer" aria-label={`${address} · ${t('hero.mapsCta')}`}>
        <span className="loc-badge-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <span className="loc-badge-text">
          <span className="loc-badge-address">{address}</span>
          <span className="loc-badge-cta">{t('location')} · {t('hero.mapsCta')} →</span>
        </span>
      </a>
    </span>
  );
}
