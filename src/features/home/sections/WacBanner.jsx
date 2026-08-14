import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function WacBanner() {
  const { t } = useLanguage();
  return (
    <div className="product-banner">
      <div className="banner-text-wac">{t('banners.wac')}</div>
    </div>
  );
}
