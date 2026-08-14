import { useLanguage } from '../../i18n/LanguageContext.jsx';

const classes = ['mh', '', 'mc', '', 'mh', '', 'mc', '', 'mh', '', 'mc'];

export default function Marquee() {
  const { t } = useLanguage();
  const items = t('marquee');
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
