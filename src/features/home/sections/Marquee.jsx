import { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fetchAppConfig } from '../../../shared/lib/appConfig.js';

const classes = ['mh', '', 'mc', '', 'mh', '', 'mc', '', 'mh', '', 'mc'];

export default function Marquee() {
  const { t, lang } = useLanguage();
  const fallbackItems = t('marquee');
  const [items, setItems] = useState(fallbackItems);

  useEffect(() => {
    let active = true;
    fetchAppConfig(`marquee_${lang}`, null).then((value) => {
      if (active && value) setItems(value.split('|'));
      else if (active) setItems(fallbackItems);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const doubled = [...items, ...items];

  return (
    <div className="mq-wrap">
      <div className="mq-track">
        {doubled.map((text, i) => (
          <span key={i} className={classes[i % classes.length]}>{text}</span>
        ))}
      </div>
    </div>
  );
}
