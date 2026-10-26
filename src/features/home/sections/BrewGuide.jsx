import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import BrewDrawing from './brewDrawings.jsx';
import './home.css';

// Aprende: la hoja de instrucciones de AeroPress Go tal cual, en diez pasos con su dibujo, sobre
// papel cuadriculado. Caliente en rojo y cold brew en tinta, como en la hoja. La Escuela (/escuela)
// tiene el cronómetro y lo demás.
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
          <ul className="brew-legend">
            <li className="is-hot">{t('brew.hot')}</li>
            <li className="is-cold">{t('brew.cold')}</li>
          </ul>
        </div>
        <ol className="brew-sheet">
          {steps.map((s, i) => (
            <li key={i} className={i === steps.length - 1 ? 'is-serve' : s.notesLeft ? 'is-notes-left' : undefined}>
              <BrewDrawing index={i} />
              {s.notes && (
                <span className="brew-notes" aria-hidden="true">
                  {s.notes.map((n, k) => <span key={k}>{n}</span>)}
                </span>
              )}
              <span className="brew-num">{i + 1}</span>
              <p>
                {s.text}
                {s.hot && <><br /><b className="is-hot">{s.hot}</b></>}
                {s.cold && <><br /><b className="is-cold">{s.cold}</b></>}
              </p>
              {s.serve && (
                <dl className="brew-serve">
                  {s.serve.map(([k, v], j) => (
                    <div key={k} className={j === s.serve.length - 1 ? 'is-cold' : undefined}><dt>{k}:</dt> <dd>{v}</dd></div>
                  ))}
                </dl>
              )}
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
