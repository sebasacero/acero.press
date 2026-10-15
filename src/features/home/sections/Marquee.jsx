import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';
import SectionEditButton from '../../admin/SectionEditButton.jsx';

const classes = ['mh', '', 'mc', '', 'mh', '', 'mc', '', 'mh', '', 'mc'];
const MARQUEE_FIELDS = [
  {
    key: 'marquee',
    label: 'Frases de la cinta',
    multiline: true,
    hint: 'Separa cada frase con | (barra vertical). Ej.: Ethiopia Yirgacheffe | 1:15 · 92°C | Bourbon Rosado',
  },
];

export default function Marquee() {
  const { t, lang } = useLanguage();
  const fallbackItems = t('marquee');
  const [items, setItems] = useState(fallbackItems);

  const load = useCallback(() => {
    let active = true;
    fetchAppConfig(`marquee_${lang}`, null).then((value) => {
      if (!active) return;
      const parsed = value ? value.split('|').map((s) => s.trim()).filter(Boolean) : [];
      setItems(parsed.length ? parsed : t('marquee'));
    });
    return () => { active = false; };
  }, [lang, t]);

  useEffect(() => load(), [load]);

  const doubled = [...items, ...items];

  return (
    <div className="mq-wrap">
      <SectionEditButton section="Cinta" fig="FIG. — CINTA" placement="inline" onSaved={load} fields={MARQUEE_FIELDS} />
      <div className="mq-track">
        {doubled.map((text, i) => (
          <span key={i} className={classes[i % classes.length]}>{text}</span>
        ))}
      </div>
    </div>
  );
}
