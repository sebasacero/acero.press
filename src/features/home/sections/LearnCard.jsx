import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import BrewDrawing from './brewDrawings.jsx';
import { lessonsFor } from '../../school/lessons.js';
import { lessonHash } from '../../school/school.js';

// Aprende en la portada (rediseño del 10 nov 2026): la hoja oficial de AeroPress Go ya no fija la
// pantalla; es una sola tarjeta de vidrio con sus diez pasos (dibujo, número y texto) que se pasan
// con los puntos o Anterior/Siguiente, igual en computador y celular. Debajo, las seis lecciones
// de la Escuela, que abren cada una en /escuela. Los pasos y las lecciones son los de siempre
// (brew.steps, school/lessons.js).
export default function LearnCard() {
  const { t, lang } = useLanguage();
  const steps = t('brew.steps');
  const [i, setI] = useState(0);
  const step = steps[i];
  const p = t('page.learn');
  const lessons = lessonsFor(lang);
  const go = (n) => setI((n + steps.length) % steps.length);

  return (
    <section className="pg-learn" id="escuela" aria-labelledby="pg-learn-title">
      <div className="pg-w">
        <div className="pg-learn-grid">
          <div>
            <span className="pg-brand"><img src="/image/logo-acero.png" alt="ACERO" width="150" height="48" /><em>.press</em><b>· {p.label}</b></span>
            <h2 id="pg-learn-title">{p.title}</h2>
            <p className="pg-lead">{p.lead}</p>
            <ul className="pg-chips" aria-label={p.chipsLabel}>{p.chips.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="pg-acts">
              <a className="pg-btn pg-btn--hot" href="/escuela">{t('brew.cta2')}</a>
              <a className="pg-btn pg-btn--line" href="/escuela#leccion-2">{t('brew.cta')}</a>
            </div>
          </div>
          <div className="pg-sheet-wrap">
            <div className="pg-sheet" role="group" aria-roledescription="carousel" aria-label={t('brew.dots')}>
              <div className="pg-sheet-pic">
                <BrewDrawing index={i} />
                <button type="button" className="pg-dot-nav is-prev" onClick={() => go(i - 1)} aria-label={t('brew.prev')}>‹</button>
                <button type="button" className="pg-dot-nav is-next" onClick={() => go(i + 1)} aria-label={t('brew.next')}>›</button>
              </div>
              <div className="pg-sheet-n" aria-live="polite">
                <b>{i + 1}</b>
                <div>
                  <h3>{step.text}</h3>
                  {step.hot && <p className="is-hot">{step.hot}</p>}
                  {step.cold && <p className="is-cold">{step.cold}</p>}
                  {step.serve && <ul>{step.serve.map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ul>}
                </div>
              </div>
              <div className="pg-dots">
                {steps.map((_, n) => (
                  <button key={n} type="button" aria-pressed={n === i} aria-label={t('brew.goStep').replace('{n}', n + 1)} onClick={() => setI(n)}>{n + 1}</button>
                ))}
              </div>
              <p className="pg-sheet-src">{t('brew.source')}</p>
            </div>
          </div>
        </div>

        <div className="pg-lessons">
          <h3>{t('school.lessonsTitle')}</h3>
          <ol>
            {lessons.map((l, n) => (
              <li key={l.key}>
                <a href={`/escuela${lessonHash(n)}`}>
                  <b>{n + 1}</b>
                  <span>{l.title}</span>
                  <small>{l.mins} min</small>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
