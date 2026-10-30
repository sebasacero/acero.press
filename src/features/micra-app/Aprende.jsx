import { useEffect, useRef, useState } from 'react';
import { lessonsFor } from '../school/lessons.js';
import { readSeen, writeSeen } from '../school/progress.js';
import { lessonHash } from '../school/school.js';
import { lessonPath, LEVELS } from './motivation.js';
import platform from './platform.js';
import Figure from './Elenco.jsx';
import { IconCheck } from './icons.jsx';

// Aprende: las seis lecciones de la Escuela como un camino que se recorre una
// parada a la vez, con el nivel arriba. Lo visto se guarda en el celular (la
// misma marca que /escuela); el paso al nivel 2 es un video que revisa el equipo.

// Dónde cae cada parada a lo ancho (en %), para que el camino serpentee
const XS = [22, 70, 42, 74, 30, 64];
const ROW = 104;

function Path({ steps }) {
  const pts = steps.map((s, i) => [XS[i % XS.length], ROW * i + 40]);
  pts.push([50, ROW * steps.length + 40]); // la última parada: el video
  const d = pts.map(([x, y], i) => {
    if (!i) return `M${x} ${y}`;
    const [px, py] = pts[i - 1];
    return `C${px} ${py + ROW / 2} ${x} ${y - ROW / 2} ${x} ${y}`;
  }).join(' ');
  const doneUpTo = Math.max(0, steps.findIndex((s) => s.state !== 'done'));
  const h = ROW * steps.length + 80;
  return (
    <svg className="mapp-path-line" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ height: h }} aria-hidden="true">
      <path d={d} className="is-road" />
      <path d={d} className="is-dash" />
      <path d={d} className="is-done" style={{ strokeDasharray: `${doneUpTo / (steps.length) * 100} 100` }} pathLength="100" />
    </svg>
  );
}

function LessonSheet({ lesson, n, seen, onDone, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const on = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="mapp-lesson" role="dialog" aria-modal="true" aria-labelledby="mapp-lesson-title" data-testid="lesson">
      <header className="mapp-lesson-top">
        <button ref={ref} type="button" className="mapp-lesson-x" onClick={onClose} aria-label="Cerrar la lección">‹</button>
        <span className="mapp-cota">Lección {n} · {lesson.mins} min</span>
      </header>
      <div className="mapp-lesson-body">
        <h2 id="mapp-lesson-title" className="mapp-title is-small">{lesson.title}</h2>
        {lesson.key === 'first' && (
          <video className="mapp-lesson-video" src={platform.siteUrl('/image/metodo/aeropress-metodo.mp4')} poster={platform.siteUrl('/image/metodo/poster.webp')} controls playsInline preload="none" />
        )}
        <p className="mapp-lede">{lesson.lead}</p>
        {lesson.points?.length > 0 && (
          <section className="mapp-glass">
            <p className="mapp-cota">{lesson.pointsLabel || 'Lo que necesitas'}</p>
            <ol className={`mapp-lesson-points ${lesson.numbered ? 'is-numbered' : ''}`}>
              {lesson.points.map((p) => <li key={p}>{p}</li>)}
            </ol>
          </section>
        )}
        {lesson.tip && <p className="mapp-lesson-tip"><b>Truco:</b> {lesson.tip}</p>}
        {lesson.practice?.length > 0 && (
          <section className="mapp-glass">
            <p className="mapp-cota">Practica</p>
            <ul className="mapp-lesson-points">{lesson.practice.map((p) => <li key={p}>{p}</li>)}</ul>
          </section>
        )}
        <a className="mapp-link" href={platform.siteUrl(`/escuela${lessonHash(n - 1)}`)} target="_blank" rel="noreferrer">Verla con dibujos en la Escuela</a>
      </div>
      <footer className="mapp-lesson-foot">
        <button type="button" className="mapp-btn is-cta" onClick={onDone}>{seen ? 'Listo' : 'Ya la vi ✓'}</button>
      </footer>
    </div>
  );
}

export default function Aprende({ go }) {
  const lessons = lessonsFor('es');
  const [seen, setSeen] = useState(readSeen);
  const [open, setOpen] = useState(null);
  const path = lessonPath(lessons, seen);
  const markSeen = (key) => {
    const next = seen.includes(key) ? seen : [...seen, key];
    writeSeen(next);
    setSeen(next);
    setOpen(null);
  };
  const lvl = LEVELS[0];
  const nextLvl = LEVELS[1];

  return (
    <div className="mapp-learn">
      <p className="mapp-kicker">Escuela Micra</p>
      <h1 className="mapp-title is-small">Tu camino a <span className="mapp-script">Barista AeroPress</span></h1>

      <section className="mapp-glass mapp-level" aria-label="Tu nivel" data-testid="level">
        <svg className="mapp-shield" viewBox="0 0 54 62" aria-hidden="true"><path d="M27 2l23 9v20c0 15-11 25-23 29C15 56 4 46 4 31V11z" /><text x="27" y="38" textAnchor="middle">{lvl.id}</text></svg>
        <div>
          <b>{lvl.name} → {nextLvl.name}</b>
          <div className="mapp-level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={path.total} aria-valuenow={path.done} aria-label="Lecciones vistas"><i style={{ width: `${path.pct * 100}%` }} /></div>
          <small>{path.done} de {path.total} lecciones · y tu video</small>
        </div>
      </section>
      <ol className="mapp-levels" aria-label="Niveles">
        {LEVELS.map((l, i) => <li key={l.id} className={i === 0 ? 'on' : ''}><b>{l.id}</b>{l.name}</li>)}
      </ol>

      <div className="mapp-path" style={{ height: ROW * path.steps.length + 80 }}>
        <Path steps={path.steps} />
        <ol aria-label="Lecciones">
          {path.steps.map((s, i) => (
            <li key={s.key} className={`is-${s.state} ${XS[i % XS.length] > 50 ? 'is-right' : ''}`} style={{ '--x': `${XS[i % XS.length]}%`, top: ROW * i + 40 }}>
              <button type="button" className="mapp-stop" onClick={() => setOpen(i)} aria-label={`Lección ${s.n}: ${s.title}${s.state === 'done' ? ' (vista)' : ''}`}>
                {s.state === 'done' ? <IconCheck /> : s.n}
              </button>
              <span className="mapp-stop-label"><b>{s.title}</b><small>{s.mins} min</small></span>
              {s.state === 'now' && (
                <>
                  <button type="button" className="mapp-btn is-cta is-small mapp-stop-go" onClick={() => setOpen(i)}>Empezar</button>
                  <Figure name="ruana" className="is-path" />
                </>
              )}
            </li>
          ))}
          <li className={`is-final ${path.ready ? 'is-now' : 'is-next'}`} style={{ '--x': '50%', top: ROW * path.steps.length + 40 }}>
            <span className="mapp-stop" aria-hidden="true">🏅</span>
            <span className="mapp-stop-label"><b>Tu video → {nextLvl.id}</b><small>{path.ready ? 'Grábalo y el equipo lo revisa' : 'Al terminar las lecciones'}</small></span>
          </li>
        </ol>
      </div>

      {path.ready && (
        <section className="mapp-glass mapp-final" data-testid="level-video">
          <p className="mapp-cota">Siguiente nivel · {nextLvl.name}</p>
          <p>Graba un video corto preparando una taza con la receta y compártelo con el equipo de Micra. Lo revisamos para subirte a <b>{nextLvl.name}</b>.</p>
          <button type="button" className="mapp-btn is-cta" onClick={() => go('/micra/video')}>Grabar mi video</button>
        </section>
      )}

      {open != null && (
        <LessonSheet lesson={lessons[open]} n={open + 1} seen={seen.includes(lessons[open].key)} onDone={() => markSeen(lessons[open].key)} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
