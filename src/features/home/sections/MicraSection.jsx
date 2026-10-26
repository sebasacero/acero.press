import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Navbar from '../../../shared/layout/Navbar.jsx';
import { StreetPhone } from '../../esspresale/AppPhones.jsx';
import { SheetFrame, Segs } from '../../esspresale/parts.jsx';
import { useStreetMap } from '../../../shared/lib/useStreetMap.js';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import { FALLBACK_WHATSAPP_NUMBER } from '../../../shared/layout/WhatsAppButton.jsx';
import '../../esspresale/esspresale.css';
import './home.css';

// Primera sección de la portada (lleva el menú y el h1). Micra presentada: qué es (la app que fomenta el barismo) y sus cuatro frentes, el
// primero en marcha (el estudio del café informal, con las cifras reales de micra_street_map) y los
// demás marcados como lo que son: en diseño, próximamente, buscando aliados. Nada se da por hecho.
// Los textos viven en translations (micra.*): las llaves viejas de app_config (essp_*) decían
// «a domicilio» y aquí ya no se leen.

const show = (n) => (n === null || n === undefined ? '—' : String(n));

export default function MicraSection({ navOpen, onOpenNavDrawer }) {
  const { t } = useLanguage();
  const { layers, summary: street } = useStreetMap();
  const [number, setNumber] = useState(FALLBACK_WHATSAPP_NUMBER);
  useEffect(() => {
    fetchAppConfig('whatsapp_number', FALLBACK_WHATSAPP_NUMBER).then((n) => setNumber(n || FALLBACK_WHATSAPP_NUMBER));
  }, []);
  const wa = (msg) => `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
  const steps = t('micra.steps');
  const specs = t('micra.specs');
  const real = !!layers;

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

        <ol className="micra-steps" aria-label={t('micra.stepsLabel')}>
          {steps.map((s, i) => (
            <li key={i} className={i === 0 ? 'is-now' : undefined}>
              <div className="micra-step-head">
                <span className="micra-step-num">{String(i + 1).padStart(2, '0')}</span>
                <span className={`micra-step-badge${i === 0 ? ' is-red' : ''}`}>{s.badge}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              {i === 0 && (
                <div className="micra-stats" aria-label={t('micra.statsLabel')}>
                  <div className="micra-stats-cota"><span>{t('micra.statsLabel')}</span><span className="essp-badge">{real ? t('micra.real') : t('micra.empty')}</span></div>
                  <dl>
                    {[street?.cups, street?.blocks, street?.tinteros].map((v, k) => (
                      <div key={k}><dd>{show(street ? v : null)}</dd><dt>{specs[k]}</dt></div>
                    ))}
                  </dl>
                  <Segs filled={Math.min(20, street?.blocks ?? 0)} />
                  <small>{t('micra.statsNote')}</small>
                </div>
              )}
              {i === 2 && <a className="micra-step-link" href="/escuela">{t('micra.cta2')} →</a>}
              {i === 3 && <a className="micra-step-link" href={wa(t('micra.partnerMsg'))} target="_blank" rel="noopener noreferrer">{t('micra.partner')} →</a>}
            </li>
          ))}
        </ol>
      </div>
    </header>
  );
}
