import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import './home.css';

// Aprende, en corto: la receta oficial de AeroPress (aeropress.com) en cinco pasos con su foto, y
// la puerta a la Escuela (/escuela), donde está el cronómetro y lo demás. Reemplaza a la receta que
// seguía al scroll y a la franja del temario: dos pantallas largas para lo que cabe en una.
const STEP_IMG = (i) => `/image/metodo/paso-${i + 1}.webp`;

export default function BrewGuide() {
  const { t } = useLanguage();
  const title = t('brew.title');
  const steps = t('brew.steps');

  return (
    <section className="brew" id="escuela" aria-labelledby="brew-title">
      <SheetFrame />
      <div className="brew-in">
        <div className="brew-head">
          <div className="essp-tag">{t('brew.tag')} <span className="essp-new">{t('brew.badge')}</span></div>
          <h2 className="essp-title brew-title" id="brew-title">
            {title[0]}{' '}<br />{title[1]}
            <span className="essp-script">{t('brew.script')}</span>
          </h2>
          <dl className="brew-recipe">
            {t('brew.recipe').map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>
        <ol className="brew-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <img src={STEP_IMG(i)} alt="" width="868" height="656" loading="lazy" />
              <span className="brew-num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="brew-foot">
          <div className="essp-ctas">
            <a className="essp-btn" href="/escuela#leccion-2">{t('brew.cta')} →</a>
            <a className="essp-btn is-ghost" href="/escuela">{t('brew.cta2')}</a>
          </div>
          <small className="brew-source">{t('brew.source')}</small>
        </div>
      </div>
    </section>
  );
}
