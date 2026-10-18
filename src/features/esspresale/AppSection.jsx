import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { ClientPhone, BaristaPhone } from './AppPhones.jsx';
import { APP_ROLE_EVENT } from './parts.jsx';
import './esspresale.css';

const digits = (s) => String(s).replace(/\D/g, '');

const PATHS = [
  { role: 'cliente', tab: 'order', Phone: ClientPhone },
  { role: 'barista', tab: 'barista', Phone: BaristaPhone },
];

/** Sección #app: los dos caminos de Esspresale y la lista de espera. */
export default function AppSection() {
  const { t, lang } = useLanguage();
  const f = (key) => t(`essp.app.form.${key}`);
  const [role, setRole] = useState('cliente');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState('');
  const [hasAeropress, setHasAeropress] = useState(null);
  const [status, setStatus] = useState({ kind: 'idle', message: '' });
  const nameRef = useRef(null);

  // Los botones del banner llegan aquí con el camino ya elegido.
  useEffect(() => {
    const onRole = (e) => {
      if (e.detail === 'cliente' || e.detail === 'barista') setRole(e.detail);
      setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 600);
    };
    window.addEventListener(APP_ROLE_EVENT, onRole);
    return () => window.removeEventListener(APP_ROLE_EVENT, onRole);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    const phoneDigits = digits(phone);
    if (cleanName.length < 2) return setStatus({ kind: 'error', message: f('invalidName') });
    if (phoneDigits.length < 7 || phoneDigits.length > 15) return setStatus({ kind: 'error', message: f('invalidPhone') });

    setStatus({ kind: 'sending', message: '' });
    const { error } = await supabase.from('app_waitlist').insert({
      role,
      name: cleanName.slice(0, 80),
      phone: phoneDigits,
      zone: zone.trim().slice(0, 80) || null,
      has_aeropress: role === 'barista' ? hasAeropress : null,
      lang,
    });
    if (error && error.code !== '23505') {
      console.error(error);
      return setStatus({ kind: 'error', message: f('error') });
    }
    setStatus({
      kind: 'done',
      message: error ? f('dup') : f('done').replace('{name}', cleanName.split(' ')[0]).replace('{phone}', phone.trim()),
    });
    if (!error) {
      setName('');
      setPhone('');
      setZone('');
      setHasAeropress(null);
    }
  };

  // Carrusel de los dos caminos: la diapositiva visible es el camino elegido
  // (también en el formulario), así no hay dos estados que se contradigan.
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

      <div className="essp-app-body">
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

      <form className="essp-wait" onSubmit={submit} noValidate>
        <div className="essp-wait-head">
          <span className="essp-wait-fig">{f('fig')}</span>
          <h3>{f('title')}</h3>
          <p>{f('sub')}</p>
        </div>

        <div className="essp-wait-grid">
          <fieldset className="essp-wait-role">
            <legend>{f('role')}</legend>
            {[['cliente', t('essp.tabs.order')], ['barista', t('essp.tabs.barista')]].map(([value, label]) => (
              <label key={value} className={role === value ? 'is-on' : ''}>
                <input type="radio" name="essp-role" value={value} checked={role === value} onChange={() => setRole(value)} />
                {label}
              </label>
            ))}
          </fieldset>

          <label className="essp-field">
            <span>{f('name')}</span>
            <input id="essp-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={80} required />
          </label>
          <label className="essp-field">
            <span>{f('phone')}</span>
            <input id="essp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder={f('phoneHint')} maxLength={22} required />
          </label>
          <label className="essp-field">
            <span>{f('zone')}</span>
            <input id="essp-zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder={f('zoneHint')} maxLength={80} />
          </label>

          {role === 'barista' && (
            <fieldset className="essp-wait-yn">
              <legend>{f('aeropress')}</legend>
              {[[true, f('yes')], [false, f('no')]].map(([value, label]) => (
                <label key={String(value)} className={hasAeropress === value ? 'is-on' : ''}>
                  <input type="radio" name="essp-aeropress" checked={hasAeropress === value} onChange={() => setHasAeropress(value)} />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
        </div>

        <div className="essp-wait-foot">
          <button type="submit" className="essp-btn" disabled={status.kind === 'sending'}>
            {status.kind === 'sending' ? f('sending') : f('submit')} <span aria-hidden="true">→</span>
          </button>
          <p className="essp-wait-privacy">{f('privacy')}</p>
        </div>
        <p className={`essp-wait-status is-${status.kind}`} role="status" aria-live="polite">{status.message}</p>
      </form>
      </div>
    </section>
  );
}
