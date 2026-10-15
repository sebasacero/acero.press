import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';

const WAC_FIELDS = [{ key: 'banner_wac', label: 'Texto de la franja', hint: 'Se muestra grande en una sola línea.' }];

export default function WacBanner() {
  const { t, lang } = useLanguage();
  const [text, setText] = useState(null);

  const load = useCallback(() => {
    fetchAppConfig(`banner_wac_${lang}`, null).then(setText);
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="product-banner" style={{ position: 'relative' }}>
      <SectionEditButton section="Franja WAC" fig="FIG. 03 — FRANJA" onSaved={load} fields={WAC_FIELDS} />
      <div className="banner-text-wac">{text || t('banners.wac')}</div>
    </div>
  );
}
