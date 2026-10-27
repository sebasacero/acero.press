import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { StreetPhone } from '../../esspresale/AppPhones.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import SocialBanners from './SocialBanners.jsx';
import { useStreetMap } from '../../../shared/lib/useStreetMap.js';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../../shared/layout/WhatsAppButton.jsx';
import '../../esspresale/esspresale.css';
import './home.css';

// Micra, justo después de los banners principales: qué es, el celular con el mapa del estudio y
// las fichas de redes con video. Textos en micra.*.

export default function MicraSection() {
  const { t } = useLanguage();
  const { layers, summary: street } = useStreetMap();
  const [number, setNumber] = useState(FALLBACK_WHATSAPP_NUMBER);
  useEffect(() => {
    fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then((n) => setNumber(n || FALLBACK_WHATSAPP_NUMBER));
  }, []);
  const wa = (msg) => `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;

  return (
    <section className="micra" id="micra" aria-labelledby="micra-title">
      <SheetFrame />
      <div className="micra-in">
        <div className="micra-head">
          <div className="micra-copy">
            <div className="essp-tag">{t('micra.tag')} <span className="essp-new">{t('micra.badge')}</span></div>
            <h2 className="essp-title micra-title" id="micra-title">
              {t('micra.title')}
              <span className="essp-script">{t('micra.script')}</span>
            </h2>
            <div className="essp-loc">{t('micra.loc')}</div>
            <p className="essp-lede micra-lede">{t('micra.lede')}</p>
            <div className="essp-ctas">
              <a className="essp-btn" href={wa(t('micra.waMsg'))} target="_blank" rel="noopener noreferrer">{t('micra.cta')}</a>
              <a className="essp-btn is-ghost" href="/escuela">{t('micra.cta2')}</a>
            </div>
          </div>
          <StreetPhone className="micra-phone" street={street} layers={layers} />
        </div>

        <SocialBanners />
      </div>
    </section>
  );
}
