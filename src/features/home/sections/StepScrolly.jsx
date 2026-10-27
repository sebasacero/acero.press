import { useEffect, useRef, useState } from 'react';
import { SheetFrame } from '../../esspresale/parts.jsx';
import BrewDrawing from './brewDrawings.jsx';
import { scrollProgress, stepAt, progressFor } from '../lib/scrolly.js';
import './home.css';

// Pasos contados con el scroll (Aprende en la portada y la receta de la Escuela): la hoja queda
// fija en pantalla y cada tramo de scroll pasa al siguiente paso (dibujo grande, número y texto).
// Todos los pasos siguen en la lista (los no activos, transparentes) para lectores de pantalla.
// En pantallas bajas (celular acostado) no hay altura para fijar la hoja: los pasos pasan a una
// fila que se desliza con el dedo (CSS). Cada paso puede elegir su dibujo con `draw`.
export default function StepScrolly({ id, tag, badge, title, script, legend, steps, labels, source, ctas, headingLevel = 2 }) {
  const n = steps.length;
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const Heading = `h${headingLevel}`;

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
    <section ref={ref} className="brew" id={id} aria-labelledby={`${id}-title`} style={{ '--brew-steps': n }}>
      <div className="brew-pin">
        <SheetFrame />
        <div className="brew-in">
          <div className="brew-head">
            <div className="essp-tag">{tag} {badge && <span className="essp-new">{badge}</span>}</div>
            <Heading className="essp-title brew-title" id={`${id}-title`}>
              {title[0]}{' '}<br />{title[1]}
              {script && <span className="essp-script">{script}</span>}
            </Heading>
            {legend && (
              <ul className="brew-legend">
                <li className="is-hot">{legend.hot}</li>
                <li className="is-cold">{legend.cold}</li>
              </ul>
            )}
          </div>
          <ol className="brew-sheet">
            {steps.map((s, i) => (
              <li
                key={i}
                className={[s.serve && 'is-serve', s.notesLeft && 'is-notes-left', i === active && 'is-active'].filter(Boolean).join(' ')}
                aria-current={i === active ? 'step' : undefined}
              >
                <BrewDrawing index={s.draw ?? i} />
                {s.notes && (
                  <span className="brew-notes" aria-hidden="true">
                    {s.notes.map((note, k) => <span key={k}>{note}</span>)}
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
                      <div key={k} className={legend && j === s.serve.length - 1 ? 'is-cold' : undefined}><dt>{k}:</dt> <dd>{v}</dd></div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ol>
          {/* El aviso para que se entienda que se baja: en el primer paso; al bajar se va (ya se entendió) */}
          <div className={`brew-swipe${active > 0 ? ' is-gone' : ''}`} aria-hidden="true">
            <span className="brew-swipe-icon">↓</span> {labels.swipe}
          </div>
          <div className="brew-dots" role="group" aria-label={labels.dots}>
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === active ? 'is-on' : i < active ? 'is-done' : undefined}
                aria-label={labels.goStep.replace('{n}', i + 1)}
                aria-pressed={i === active}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <div className="brew-foot">
            {ctas && <div className="essp-ctas">{ctas}</div>}
            {source && <small className="brew-source">{source}</small>}
          </div>
        </div>
      </div>
    </section>
  );
}
