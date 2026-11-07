import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import SellPhone from '../../esspresale/SellPhone.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import SocialBanners from './SocialBanners.jsx';
import StreetPeople from './StreetPeople.jsx';
import StoreButtons from '../../esspresale/StoreButtons.jsx';
import { useStreetMap } from '../../../shared/lib/useStreetMap.js';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../../shared/layout/WhatsAppButton.jsx';
import '../../esspresale/esspresale.css';
import './home.css';

// Micra, justo después de los banners principales. A la izquierda qué es y sus tres pasos
// (aprende, vende, certifícate); a la derecha un panel oscuro con el celular (Vender, que se puede
// tocar), las cifras reales
// del estudio alrededor y las tiendas; abajo las fichas de redes. Textos en micra.*.
const show = (n) => (n === null || n === undefined ? '—' : String(n));

export default function MicraSection() {
  const { t } = useLanguage();
  const { summary: street } = useStreetMap();
  const [number, setNumber] = useState(FALLBACK_WHATSAPP_NUMBER);
  useEffect(() => {
    fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then((n) => setNumber(n || FALLBACK_WHATSAPP_NUMBER));
  }, []);
  const [stores, setStores] = useState({ apple: '', google: '' });
  useEffect(() => {
    Promise.all([fetchAppConfig('app_store_url', ''), fetchAppConfig('play_store_url', '')])
      .then(([apple, google]) => setStores({ apple: apple || '', google: google || '' }));
  }, []);
  const stats = t('micra.stats');
  const notices = t('micra.notices');
  const steps = t('micra.steps');
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
            <ol className="micra-steps">
              {steps.map((st, i) => (
                <li key={i}>
                  <span className="micra-step-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <b>{st.title}</b>
                  <span>{st.text}</span>
                </li>
              ))}
            </ol>
            <div className="essp-ctas">
              <a className="essp-btn" href="/micra">{t('micra.open')}</a>
              <a className="essp-btn" href={wa(t('micra.waMsg'))} target="_blank" rel="noopener noreferrer">{t('micra.cta')}</a>
              <a className="essp-btn" href="/escuela">{t('micra.cta2')}</a>
            </div>
          </div>
          <div className="micra-stage">
            {/* Vender, como lo ve el barista: se toca +1 y la taza se llena */}
            <SellPhone className="micra-phone" />
            {/* Las cifras del estudio de calle, las mismas del celular, sueltas alrededor */}
            {/* Las cifras solo cuando hay (nada de ceros) y, alrededor, avisos de la app como
                notificaciones del celular (pedido del usuario, 7 nov 2026) */}
            {street?.cups > 0 && (
              <ul className="micra-stats" aria-label={stats.label}>
                <li><b>{show(street.cups)}</b><span>{stats.cups}</span></li>
                {street.blocks > 0 && <li><b>{show(street.blocks)}</b><span>{stats.blocks}</span></li>}
                {street.tinteros > 0 && <li><b>{show(street.tinteros)}</b><span>{stats.baristas}</span></li>}
              </ul>
            )}
            <ul className="micra-notices" aria-label={notices.label}>
              {notices.items.map(([title, body], i) => (
                <li key={i}>
                  <img src="/image/micra-icon-180.png" alt="" width="30" height="30" />
                  <span><b>{title}</b>{body}</span>
                  <small>{notices.now}</small>
                </li>
              ))}
            </ul>
            <StoreButtons appStoreUrl={stores.apple} playStoreUrl={stores.google} />
          </div>
        </div>

        <StreetPeople />

        <div className="micra-social">
          <div className="essp-tag">{t('posts.label')}</div>
          <SocialBanners />
        </div>
      </div>
    </section>
  );
}
