import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import SellPhone from '../../esspresale/SellPhone.jsx';
import { PEOPLE, personaSrc } from './StreetPeople.jsx';
import { useSeen } from './Doors.jsx';
import { useStreetMap } from '../../../shared/lib/useStreetMap.js';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import '../../esspresale/esspresale.css';
import './home.css';

// Micra, la calle: en térmico, como la app (rediseño del 10 nov 2026). A la izquierda qué es y
// sus tres pasos, que caen como notificaciones al llegar; a la derecha el celular vivo con Vender
// (se toca +1 y la taza sube; se toca solo mientras nadie lo use; el usuario lo pidió de vuelta el
// 10 nov 2026 en vez del panel, que sigue en /micra de computador) y las cifras reales del estudio
// de calle, que entran contando. Abajo las personas de la calle sobre el andén. Textos en micra.*.

/** Cuenta de 0 a `n` cuando `on` pasa a verdadero. Con «menos movimiento», el número de una. */
function Count({ n, on, wait = 0 }) {
  const [v, setV] = useState(n);
  useEffect(() => {
    if (!on || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(n); return undefined; }
    let raf = 0;
    const t0 = performance.now() + wait;
    setV(0);
    const step = (ts) => {
      const k = Math.min(1, Math.max(0, (ts - t0) / 900));
      setV(Math.round(n * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, on, wait]);
  return <b>{v}</b>;
}

const GLYPH = {
  apple: 'M16.4 12.6c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.7-2.2c.9-1.2 1.2-2.4 1.2-2.5-.1 0-2.6-1-2.6-3.700zM14.200 6.100c.6-.8 1-1.800.9-2.900-.900 0-2 .600-2.600 1.400-.6.700-1.100 1.800-.9 2.800 1 .1 2-.5 2.600-1.300z',
  google: 'M4 2.800v18.400c0 .6.700 1 1.200.7l15.300-9.200c.5-.3.5-1.100 0-1.400L5.200 2.100C4.700 1.800 4 2.200 4 2.800z',
};

function Stores({ urls }) {
  const { t } = useLanguage();
  const s = t('micra.store');
  return (
    <div className="pg-stores" role="group" aria-label={s.label}>
      {[['apple', s.appleTop, 'App Store'], ['google', s.googleTop, 'Google Play']].map(([key, top, name]) => {
        const url = urls[key];
        const body = (
          <>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d={GLYPH[key]} /></svg>
            <span><small>{url ? top : s.soon}</small><b>{name}</b></span>
            {!url && <i>{s.badge}</i>}
          </>
        );
        return url
          ? <a key={key} className="pg-store" href={url} target="_blank" rel="noopener noreferrer">{body}</a>
          : <span key={key} className="pg-store is-soon">{body}</span>;
      })}
    </div>
  );
}

export default function MicraSection() {
  const { t } = useLanguage();
  const { summary: street } = useStreetMap();
  const [stores, setStores] = useState({ apple: '', google: '' });
  useEffect(() => {
    Promise.all([fetchAppConfig('app_store_url', ''), fetchAppConfig('play_store_url', '')])
      .then(([apple, google]) => setStores({ apple: apple || '', google: google || '' }));
  }, []);
  const stats = t('micra.stats');
  const steps = t('micra.steps');
  const title = t('page.micra.title');
  const [notes, notesOn] = useSeen(0.6);
  const [stage, stageOn] = useSeen(0.4);

  return (
    <section className="pg-street" id="micra" aria-labelledby="micra-title">
      <div className="pg-w">
        <div className="pg-street-top">
          <div>
            <span className="pg-world"><i />{t('page.micra.world')}</span>
            <h2 id="micra-title">{title[0]} <span>{title[1]}</span></h2>
            <p className="pg-lead">{t('micra.lede')}</p>
            <ol ref={notes} className={`pg-notes${notesOn ? ' is-on' : ''}`}>
              {steps.map((st) => (
                <li key={st.title}>
                  <img src="/image/micra-icon-192.png" alt="" width="44" height="44" />
                  <div><b>{st.title}</b><span>{st.text}</span></div>
                  <time>{t('micra.notices.now')}</time>
                </li>
              ))}
            </ol>
            <Stores urls={stores} />
          </div>
          <div ref={stage} className={`pg-stage${stageOn ? ' is-on' : ''}`}>
            {/* Vender, como lo ve el barista: se toca +1 y la taza se llena */}
            <SellPhone className="pg-phone" demo />
            {/* Las cifras del estudio de calle solo cuando hay (nada de ceros) */}
            {(street?.tinteros > 0 || street?.cups > 0) && (
              <ul className="pg-figs" aria-label={stats.label}>
                {street.cups > 0 && <li className="pg-fig pg-fig--a"><Count n={street.cups} on={stageOn} wait={300} /><span>{stats.cups}</span></li>}
                {street.blocks > 0 && <li className="pg-fig pg-fig--c"><Count n={street.blocks} on={stageOn} wait={650} /><span>{stats.blocks}</span></li>}
                {street.tinteros > 0 && <li className="pg-fig pg-fig--b"><Count n={street.tinteros} on={stageOn} wait={1000} /><span>{stats.baristas}</span></li>}
              </ul>
            )}
          </div>
        </div>
        {/* Personajes, no gente del estudio: los datos y fotos del estudio nunca salen en público */}
        <div className="pg-walkers" aria-hidden="true">
          {PEOPLE.map((name) => <img key={name} src={personaSrc(name)} alt="" loading="lazy" decoding="async" />)}
        </div>
      </div>
    </section>
  );
}
