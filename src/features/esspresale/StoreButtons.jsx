import { useLanguage } from '../i18n/LanguageContext.jsx';

// Insignias de descarga de la app. Los enlaces se editan desde el lápiz del
// banner (app_config: app_store_url / play_store_url); mientras estén vacíos
// la insignia dice "Muy pronto en" y no es un enlace.

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.6c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.39-2.86 1.42-2.93-.03-.01-2.72-1.04-2.71-4.12zM13.79 4.95c.71-.87 1.2-2.07 1.06-3.27-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.09 3.18 1.15.09 2.33-.58 3.05-1.46z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M3.6 1.8 13.5 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1z" fill="#00d7fe" />
      <path d="m16.8 8.7-3.3 3.3-9.9-10.2c.3-.2.8-.2 1.2 0l12 6.9z" fill="#00f076" />
      <path d="m16.8 15.3-12 6.9c-.4.2-.9.2-1.2 0L13.5 12l3.3 3.3z" fill="#ff3a44" />
      <path d="m20.4 12.9-3.6 2.4-3.3-3.3 3.3-3.3 3.6 2.4c.6.4.6 1.4 0 1.8z" fill="#ffd400" />
    </svg>
  );
}

export default function StoreButtons({ appStoreUrl, playStoreUrl }) {
  const { t } = useLanguage();
  const stores = [
    { key: 'apple', url: appStoreUrl, top: t('essp.store.appleTop'), name: 'App Store', Icon: AppleIcon },
    { key: 'google', url: playStoreUrl, top: t('essp.store.googleTop'), name: 'Google Play', Icon: PlayIcon },
  ];
  return (
    <div className="essp-stores" role="group" aria-label={t('essp.store.label')}>
      {stores.map(({ key, url, top, name, Icon }) => {
        const body = (
          <>
            <Icon />
            <span><small>{url ? top : t('essp.store.soon')}</small><b>{name}</b></span>
          </>
        );
        return url ? (
          <a key={key} className="essp-store" href={url} target="_blank" rel="noopener noreferrer">{body}</a>
        ) : (
          <span key={key} className="essp-store is-soon" aria-disabled="true">{body}</span>
        );
      })}
    </div>
  );
}
