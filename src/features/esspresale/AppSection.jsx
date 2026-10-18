import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { ClientPhone, BaristaPhone } from './AppPhones.jsx';
import { APP_ROLE_EVENT } from './parts.jsx';
import './esspresale.css';

const PATHS = [
  { role: 'cliente', tab: 'order', Phone: ClientPhone },
  { role: 'barista', tab: 'barista', Phone: BaristaPhone },
];

/** Sección #app: los dos caminos de Esspresale en un carrusel. */
export default function AppSection() {
  const { t } = useLanguage();
  const [role, setRole] = useState('cliente');

  // Los botones del banner llegan aquí con el camino ya elegido.
  useEffect(() => {
    const onRole = (e) => {
      if (e.detail === 'cliente' || e.detail === 'barista') setRole(e.detail);
    };
    window.addEventListener(APP_ROLE_EVENT, onRole);
    return () => window.removeEventListener(APP_ROLE_EVENT, onRole);
  }, []);

  // La diapositiva visible es el camino elegido (pestañas, flechas o banner).
  const slide = Math.max(0, PATHS.findIndex((p) => p.role === role));
  const step = (d) => setRole(PATHS[(slide + d + PATHS.length) % PATHS.length].role);
  const touchX = useRef(null);
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  };

  return (
    <section className="essp-app" id="app" aria-labelledby="essp-app-title">
      <div className="section-label">
        <span className="num">{t('essp.app.num')}</span>
        <span className="rule"></span>
        <span className="sub">{t('essp.app.sub')}</span>
      </div>
      <div className="sp">
        <h2 className="sec-h2" id="essp-app-title">{t('essp.app.title')}</h2>
        <p className="sec-desc">
          {t('essp.app.desc')}
          <span className="jp" style={{ display: 'block', marginTop: '.4rem' }}>{t('essp.app.descJp')}</span>
        </p>
      </div>

      <div className="essp-paths" aria-roledescription="carousel" aria-label={t('essp.tabsLabel')}>
        <div className="essp-paths-head">
          <div className="essp-paths-tabs" role="tablist">
            {PATHS.map((p) => (
              <button key={p.role} type="button" role="tab" aria-selected={role === p.role} onClick={() => setRole(p.role)}>
                {t(`essp.tabs.${p.tab}`)}
              </button>
            ))}
          </div>
          <span className="essp-paths-count" aria-hidden="true">{String(slide + 1).padStart(2, '0')} / {String(PATHS.length).padStart(2, '0')}</span>
          <div className="essp-paths-arrows">
            <button type="button" aria-label="‹" onClick={() => step(-1)}>‹</button>
            <button type="button" aria-label="›" onClick={() => step(1)}>›</button>
          </div>
        </div>
        <div className="essp-paths-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="essp-paths-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {PATHS.map((p, i) => {
              const steps = t(`essp.app.${p.tab}Steps`);
              const Phone = p.Phone;
              return (
                <article
                  key={p.role}
                  ref={(el) => { if (el) el.inert = i !== slide; }}
                  className="essp-path"
                  aria-roledescription="slide"
                  aria-label={t(`essp.tabs.${p.tab}`)}
                  aria-hidden={i !== slide}
                >
                  <div className="essp-path-fig"><span>{t(`essp.app.${p.tab}Fig`)}</span><span className="essp-badge">{t(`essp.tabs.${p.tab}`)}</span></div>
                  <div className="essp-path-body">
                    <Phone className="essp-path-phone" />
                    <ol className="essp-steps">
                      {steps.map((s, n) => <li key={n}><b>{String(n + 1).padStart(2, '0')}</b><span>{s}</span></li>)}
                    </ol>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

    </section>
  );
}
