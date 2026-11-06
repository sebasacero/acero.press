import { useEffect, useRef, useState } from 'react';
import { SheetFrame } from '../../esspresale/parts.jsx';
import BrewDrawing from './brewDrawings.jsx';
import StreetScene from './StreetScene.jsx';
import { scrollProgress, stepAt, progressFor } from '../lib/scrolly.js';
import './home.css';

// Pasos contados con el scroll (Aprende en la portada y la receta de la Escuela): la hoja queda
// fija en pantalla y cada tramo de scroll pasa al siguiente paso (dibujo grande, número y texto).
// Todos los pasos siguen en la lista (los no activos, transparentes) para lectores de pantalla.
// En pantallas bajas (celular acostado) no hay altura para fijar la hoja: los pasos pasan a una
// fila que se desliza con el dedo (CSS). Cada paso puede elegir su dibujo con `draw`.
// Se cuenta en la calle del guion de Micra: la calle a trazo al pie (StreetScene), la hoja
// como tarjeta blanca encima y, si se pasa `persona`, una persona de la calle parada en el
// andén junto a la hoja (`streetSeed` cambia las fachadas de una sección a otra).
// En el celular (de pie) no se secuestra el scroll: los pasos son tarjetas que se pasan de lado
// con el dedo o con Anterior/Siguiente, y la página sigue bajando normal (pedido del usuario, 6 nov).
const SWIPE_MQ = '(max-width: 760px) and (min-height: 561px)';
const swipeNow = () => typeof window !== 'undefined' && !!window.matchMedia?.(SWIPE_MQ).matches;
export default function StepScrolly({ id, tag, badge, title, script, legend, steps, labels, source, ctas, persona, streetSeed = 7, headingLevel = 2 }) {
  const n = steps.length;
  const ref = useRef(null);
  const sheetRef = useRef(null);
  const [active, setActive] = useState(0);
  const [swipe, setSwipe] = useState(swipeNow);
  const Heading = `h${headingLevel}`;

  useEffect(() => {
    const mq = window.matchMedia?.(SWIPE_MQ);
    if (!mq) return undefined;
    const on = () => setSwipe(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    let frame = 0;
    // De lado: el paso es la tarjeta que está a la vista; de pie, el tramo de scroll de la página
    const update = () => {
      frame = 0;
      if (swipe) {
        const sh = sheetRef.current;
        if (sh && sh.clientWidth) setActive(Math.max(0, Math.min(n - 1, Math.round(sh.scrollLeft / sh.clientWidth))));
        return;
      }
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setActive(stepAt(scrollProgress(r.top, r.height, window.innerHeight), n));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    const target = swipe ? sheetRef.current : window;
    target?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      target?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [n, swipe]);

  // Los puntos (y Anterior/Siguiente) llevan a ese paso: de lado mueven la fila; de pie, el scroll
  const goTo = (i) => {
    const k = Math.max(0, Math.min(n - 1, i));
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (swipe) {
      const sh = sheetRef.current;
      if (sh) sh.scrollTo({ left: sh.clientWidth * k, behavior: reduce ? 'auto' : 'smooth' });
      setActive(k);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const run = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + run * progressFor(k, n), behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section ref={ref} className={`brew${swipe ? ' is-swipe' : ''}`} id={id} aria-labelledby={`${id}-title`} style={{ '--brew-steps': n }}>
      <div className="brew-pin">
        <SheetFrame />
        <StreetScene className="brew-street" seed={streetSeed} />
        {/* Una persona de la calle parada en el andén, junto a la hoja (decorativa: se va donde no cabe) */}
        {persona && <img className="brew-persona" src={persona} alt="" decoding="async" loading="lazy" aria-hidden="true" />}
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
          <div className="brew-stage">
            <ol className="brew-sheet" ref={sheetRef}>
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
          </div>
          {/* El aviso para que se entienda que se baja: en el primer paso; al bajar se va (ya se entendió) */}
          <div className={`brew-swipe${active > 0 ? ' is-gone' : ''}`} aria-hidden="true">
            <span className="brew-swipe-icon">{swipe ? '→' : '↓'}</span> {labels.swipe}
          </div>
          <div className="brew-nav">
            {swipe && (
              <button type="button" className="brew-step-btn" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label={labels.prev}>
                <span aria-hidden="true">←</span>
              </button>
            )}
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
            {swipe && (
              <button type="button" className="brew-step-btn is-next" onClick={() => goTo(active + 1)} disabled={active === n - 1} aria-label={labels.next}>
                <span aria-hidden="true">→</span>
              </button>
            )}
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
