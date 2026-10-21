import { useLanguage } from '../i18n/LanguageContext.jsx';

// Insignias de descarga de la app. Los enlaces se editan desde el lápiz del
// banner (app_config: app_store_url / play_store_url); mientras estén vacíos
// la insignia dice "Muy pronto en" y no es un enlace.

// Como en la pantalla de inicio del celular: el ícono de la tienda, su nombre
// debajo y un globo rojo de «Pronto» mientras no haya enlace.

function AppStoreGlyph() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="essp-as" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1ec5fd" />
          <stop offset="1" stopColor="#1d6ff2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#essp-as)" />
      <g stroke="#fff" strokeWidth="4.6" strokeLinecap="round" fill="none">
        <path d="M28.6 17.5 41.5 40" />
        <path d="M35.4 17.5 22.5 40" />
        <path d="M17 40h30" />
        <path d="M44.5 45.5 47 50" />
        <path d="M19.5 45.5 17 50" />
      </g>
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#fff" />
      <g transform="translate(17 14) scale(1.5)">
        <path d="M3.6 1.8 13.5 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1z" fill="#00d7fe" />
        <path d="m16.8 8.7-3.3 3.3-9.9-10.2c.3-.2.8-.2 1.2 0l12 6.9z" fill="#00f076" />
        <path d="m16.8 15.3-12 6.9c-.4.2-.9.2-1.2 0L13.5 12l3.3 3.3z" fill="#ff3a44" />
        <path d="m20.4 12.9-3.6 2.4-3.3-3.3 3.3-3.3 3.6 2.4c.6.4.6 1.4 0 1.8z" fill="#ffd400" />
      </g>
    </svg>
  );
}

export default function StoreButtons({ appStoreUrl, playStoreUrl }) {
  const { t } = useLanguage();
  const stores = [
    { key: 'apple', url: appStoreUrl, top: t('essp.store.appleTop'), name: 'App Store', Glyph: AppStoreGlyph },
    { key: 'google', url: playStoreUrl, top: t('essp.store.googleTop'), name: 'Google Play', Glyph: PlayGlyph },
  ];
  return (
    <div className="essp-stores" role="group" aria-label={t('essp.store.label')}>
      {stores.map(({ key, url, top, name, Glyph }) => {
        const body = (
          <>
            <span className="essp-appicon-tile"><Glyph />{!url && <i className="essp-appicon-badge">{t('essp.store.badge')}</i>}</span>
            <span className="essp-appicon-name">{name}</span>
          </>
        );
        const label = `${url ? top : t('essp.store.soon')} ${name}`;
        return url ? (
          <a key={key} className="essp-appicon" href={url} target="_blank" rel="noopener noreferrer" aria-label={label}>{body}</a>
        ) : (
          <span key={key} className="essp-appicon is-soon" role="img" aria-label={label}>{body}</span>
        );
      })}
    </div>
  );
}
