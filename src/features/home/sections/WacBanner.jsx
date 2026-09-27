import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';

export default function WacBanner() {
  const { t, lang } = useLanguage();
  const [text, setText] = useState(null);

  const load = useCallback(() => {
    fetchAppConfig(`banner_wac_${lang}`, null).then(setText);
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="product-banner" style={{ position: 'relative' }}>
      <SectionEditButton
        className="section-edit-top-right"
        onSaved={load}
        fields={[{ baseKey: 'banner_wac', label: 'Texto del banner (se repite en bucle)' }]}
      />
      <div className="banner-text-wac">{text || t('banners.wac')}</div>
    </div>
  );
}
