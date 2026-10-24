import { useState } from 'react';
import { useLanguage } from '../../features/i18n/LanguageContext.jsx';
import { readConsent, setConsent } from '../lib/analytics.js';

// Aviso de cookies (Ley 1581): se pregunta una vez. Sin respuesta, Google
// Analytics solo recibe señales sin cookies; con «Aceptar», mide la visita completa.
export default function ConsentBanner() {
  const { t } = useLanguage();
  const [answered, setAnswered] = useState(() => readConsent() !== null);
  if (answered) return null;
  const choose = (granted) => { setConsent(granted); setAnswered(true); };
  return (
    <div className="consent" role="region" aria-label={t('consent.label')}>
      <p>{t('consent.text')}</p>
      <div className="consent-actions">
        <button type="button" className="consent-btn is-ghost" onClick={() => choose(false)}>{t('consent.decline')}</button>
        <button type="button" className="consent-btn" onClick={() => choose(true)}>{t('consent.accept')}</button>
      </div>
    </div>
  );
}
