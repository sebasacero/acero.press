import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { SheetFrame } from '../../esspresale/parts.jsx';
import BrewDrawing from './brewDrawings.jsx';
import { scrollProgress, stepAt, progressFor } from '../lib/scrolly.js';
import './home.css';

// Aprende: la hoja de instrucciones de AeroPress Go, en diez pasos con su dibujo, contada con el
// scroll: la hoja queda fija en pantalla y cada tramo de scroll pasa al siguiente paso (dibujo
// grande, número y texto). Ocupa una pantalla en vez de la hoja entera. Caliente en rojo y cold
// brew en tinta, como en la hoja. Los diez pasos siguen en la lista (los no activos, transparentes)
// para lectores de pantalla. La Escuela (/escuela) tiene el cronómetro y lo demás.
export default function BrewGuide() {
  const { t } = useLanguage();
  const title = t('brew.title');
  const steps = t('brew.steps');
  const n = steps.length;
  const ref = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setActive(stepAt(scrollProgress(r.top, r.height, window.innerHeight), n));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [n]);

  // Los puntos llevan el scroll al tramo de ese paso (y así el paso queda activo)
  const goTo = (i) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const run = el.offsetHeight - window.innerHeight;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: top + run * progressFor(i, n), behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section ref={ref} className="brew" id="escuela" aria-labelledby="brew-title" style={{ '--brew-steps': n }}>
      <div className="brew-pin">
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
            <li
              key={i}
              className={[i === n - 1 && 'is-serve', s.notesLeft && 'is-notes-left', i === active && 'is-active'].filter(Boolean).join(' ')}
              aria-current={i === active ? 'step' : undefined}
            >
              <BrewDrawing index={i} />
              {s.notes && (
                <span className="brew-notes" aria-hidden="true">
                  {s.notes.map((n, k) => <span key={k}>{n}</span>)}
                </span>
              )}
              <span className="brew-num">{i + 1}<small>/{n}</small></span>
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
        <div className="brew-dots" role="group" aria-label={t('brew.dots')}>
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === active ? 'is-on' : i < active ? 'is-done' : undefined}
              aria-label={t('brew.goStep').replace('{n}', i + 1)}
              aria-pressed={i === active}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <div className="brew-foot">
          <div className="essp-ctas">
            <a className="essp-btn" href="/escuela#leccion-2">{t('brew.cta')} →</a>
            <a className="essp-btn is-ghost" href="/escuela">{t('brew.cta2')}</a>
          </div>
          <small className="brew-source">{t('brew.source')}</small>
        </div>
      </div>
      </div>
    </section>
  );
}
