import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Navbar from '../../../shared/layout/Navbar.jsx';
import { StreetPhone } from '../../esspresale/AppPhones.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import SocialBanners from './SocialBanners.jsx';
import MicraPromos from './MicraPromos.jsx';
import StoreButtons from '../../esspresale/StoreButtons.jsx';
import { useStreetMap } from '../../../shared/lib/useStreetMap.js';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../../shared/layout/WhatsAppButton.jsx';
import '../../esspresale/esspresale.css';
import './home.css';

// Primera sección de la portada (lleva el menú y el h1): qué es Micra, el celular con el mapa del
// estudio, los dos banners de siempre (pedir café, vivir del café) y las fichas de redes con video.
// Arriba, pequeños, los botones de App Store y Google Play (app_config app_store_url / play_store_url;
// sin enlace dicen «Pronto»). Los textos viven en translations (micra.*).

export default function MicraSection({ navOpen, onOpenNavDrawer }) {
  const { t } = useLanguage();
  const { layers, summary: street } = useStreetMap();
  const [number, setNumber] = useState(FALLBACK_WHATSAPP_NUMBER);
  const [stores, setStores] = useState({ apple: '', google: '' });
  useEffect(() => {
    fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then((n) => setNumber(n || FALLBACK_WHATSAPP_NUMBER));
    Promise.all([fetchAppConfig('app_store_url', ''), fetchAppConfig('play_store_url', '')])
      .then(([apple, google]) => setStores({ apple: apple || '', google: google || '' }));
  }, []);
  const wa = (msg) => `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;

  return (
    <header className="micra" id="micra" aria-labelledby="micra-title">
      {/* Los enlaces viejos (/#tinteros, /#baristas: menús anteriores, mensajes enviados) llegan aquí */}
      <span id="tinteros" className="micra-anchor" aria-hidden="true" />
      <span id="baristas" className="micra-anchor" aria-hidden="true" />
      <SheetFrame />
      <Navbar variant="sheet" tone="paper" navOpen={navOpen} onOpenNavDrawer={onOpenNavDrawer} />
      <div className="micra-in">
        <div className="micra-head">
          <div className="micra-copy">
            <StoreButtons appStoreUrl={stores.apple} playStoreUrl={stores.google} />
            <div className="essp-tag">{t('micra.tag')} <span className="essp-new">{t('micra.badge')}</span></div>
            <h1 className="essp-title micra-title" id="micra-title">
              {t('micra.title')}
              <span className="essp-script">{t('micra.script')}</span>
            </h1>
            <div className="essp-loc">{t('micra.loc')}</div>
            <p className="essp-lede micra-lede">{t('micra.lede')}</p>
            <div className="essp-ctas">
              <a className="essp-btn" href={wa(t('micra.waMsg'))} target="_blank" rel="noopener noreferrer">{t('micra.cta')}</a>
              <a className="essp-btn is-ghost" href="/escuela">{t('micra.cta2')}</a>
            </div>
          </div>
          <StreetPhone className="micra-phone" street={street} layers={layers} />
        </div>

        <MicraPromos wa={wa} />

        <SocialBanners />
      </div>
    </header>
  );
}
