import { useEffect, useRef, useState } from 'react';
import { lessonsFor } from '../school/lessons.js';
import { readSeen, writeSeen } from '../school/progress.js';
import { lessonHash } from '../school/school.js';
import { lessonPath, LEVELS } from './motivation.js';
import platform from './platform.js';
import * as api from './api.js';
import Figure from './Elenco.jsx';
import { IconCheck } from './icons.jsx';
import LessonVideo from '../school/LessonVideo.jsx';
import { schoolOf, schoolLessons, seenFor, markSchool, gearShelf, readSchools, writeSchools } from './escuelas.js';

/** Los íconos de cada escuela, a trazo: se encienden en térmico al desbloquearse. */
function GearIcon({ id }) {
  const common = { viewBox: '0 0 40 40', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (id === 'termo') return <svg {...common}><rect x="13" y="9" width="14" height="26" rx="4" /><path d="M15 5h10v4H15zM13 16h14M27 19h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" /></svg>;
  if (id === 'v60') return <svg {...common}><path d="M8 9h24l-8 13h-8z" /><path d="M16 22h8M14 26h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" /><path d="M32 12c3 0 3 5 0 6" /></svg>;
  if (id === 'espresso') return <svg {...common}><rect x="7" y="5" width="26" height="10" rx="2" /><path d="M9 15v20M31 15v20M15 15v3h10v-3M20 18v3" /><path d="M15 27h10v3a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z" /><path d="M25 28h2a1.5 1.5 0 0 1 0 3h-2" /></svg>;
  return <svg {...common}><rect x="12" y="13" width="16" height="20" rx="2" /><path d="M10 33h20M14 13V7h12v6M18 7V4h4v3M15 19h10M15 24h10" /></svg>;
}

/** El estante de escuelas: AeroPress, termo, V60 y espresso. */
function GearShelf({ shelf, current, onPick }) {
  return (
    <div className="mapp-gears" role="tablist" aria-label="Escuelas" data-testid="schools">
      {shelf.map((g) => (
        <button key={g.id} type="button" role="tab" aria-selected={current === g.id} className={`mapp-gear ${g.unlocked ? 'is-unlocked' : ''} ${current === g.id ? 'on' : ''}`} onClick={() => onPick(g.id)} data-testid={`school-${g.id}`}>
          <span className="mapp-gear-ico"><GearIcon id={g.id} />{g.unlocked ? <i className="mapp-gear-ok" aria-hidden="true">✓</i> : !g.done && <i className="mapp-gear-lock" aria-hidden="true">🔒</i>}</span>
          <b>{g.name}</b>
          <small>{g.unlocked ? 'Desbloqueada' : `${g.done}/${g.total}`}</small>
        </button>
      ))}
    </div>
  );
}

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

function LessonSheet({ lesson, n, seen, aero = true, school = 'aeropress', onDone, onClose }) {
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
        {/* El video de la lección, armado con sus pasos (pedido del usuario, 6 nov 2026) */}
        <LessonVideo lesson={lesson} school={school} label={`Video: ${lesson.title}`} />
        {aero && lesson.key === 'first' && (
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
        {aero && <a className="mapp-link" href={platform.siteUrl(`/escuela${lessonHash(n - 1)}`)} target="_blank" rel="noreferrer">Verla con dibujos en la Escuela</a>}
      </div>
      <footer className="mapp-lesson-foot">
        <button type="button" className="mapp-btn is-cta" onClick={onDone}>{seen ? 'Listo' : 'Ya la vi ✓'}</button>
      </footer>
    </div>
  );
}

export default function Aprende({ go }) {
  // El video del nivel se graba con la cámara del celular y se manda al equipo por WhatsApp
  // (la cámara con filtros de Micra es solo del equipo)
  const [team, setTeam] = useState('573152125327');
  useEffect(() => { api.teamWhatsApp().then((n) => n && setTeam(n)).catch(() => {}); }, []);
  const aeroLessons = lessonsFor('es');
  const [aeroSeen, setAeroSeen] = useState(readSeen);
  const [stored, setStored] = useState(readSchools);
  const [schoolId, setSchoolId] = useState('aeropress');
  const [open, setOpen] = useState(null);
  const school = schoolOf(schoolId);
  const aero = school.id === 'aeropress';
  const lessons = schoolLessons(school, aeroLessons);
  const seen = seenFor(school.id, aeroSeen, stored);
  const path = lessonPath(lessons, seen);
  const shelf = gearShelf(aeroLessons, aeroSeen, stored);
  const mine = shelf.find((g) => g.id === school.id);
  const markSeen = (key) => {
    if (aero) {
      const next = aeroSeen.includes(key) ? aeroSeen : [...aeroSeen, key];
      writeSeen(next);
      setAeroSeen(next);
    } else {
      const next = markSchool(stored, school.id, key);
      writeSchools(next);
      setStored(next);
    }
    setOpen(null);
  };
  const pick = (id) => { setSchoolId(id); setOpen(null); };
  const lvl = LEVELS[0];
  const nextLvl = LEVELS[1];

  return (
    <div className="mapp-learn">
      <p className="mapp-kicker">Escuela Micra</p>
      <h1 className="mapp-title is-small">Tu camino a <span className="mapp-script">{school.title}</span></h1>

      <GearShelf shelf={shelf} current={school.id} onPick={pick} />

      {aero ? (
      <section className="mapp-glass mapp-level" aria-label="Tu nivel" data-testid="level">
        <svg className="mapp-shield" viewBox="0 0 54 62" aria-hidden="true"><path d="M27 2l23 9v20c0 15-11 25-23 29C15 56 4 46 4 31V11z" /><text x="27" y="38" textAnchor="middle">{lvl.id}</text></svg>
        <div>
          <b>{lvl.name} → {nextLvl.name}</b>
          <div className="mapp-level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={path.total} aria-valuenow={path.done} aria-label="Lecciones vistas"><i style={{ width: `${path.pct * 100}%` }} /></div>
          <small>{path.done} de {path.total} lecciones · y tu video</small>
        </div>
      </section>
      ) : (
        <section className="mapp-glass mapp-level is-gear" aria-label={`Escuela ${school.name}`} data-testid="school-progress">
          <span className={`mapp-gear-ico is-big ${mine.unlocked ? 'is-unlocked' : ''}`}><GearIcon id={school.id} /></span>
          <div>
            <b>{mine.unlocked ? `${school.name} desbloqueada` : `Desbloquea ${school.name}`}</b>
            <div className="mapp-level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={path.total} aria-valuenow={path.done} aria-label="Lecciones vistas"><i style={{ width: `${path.pct * 100}%` }} /></div>
            <small>{path.done} de {path.total} lecciones</small>
          </div>
        </section>
      )}

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
            {aero
              ? <span className="mapp-stop-label"><b>Tu video → {nextLvl.id}</b><small>{path.ready ? 'Grábalo y el equipo lo revisa' : 'Al terminar las lecciones'}</small></span>
              : <span className="mapp-stop-label"><b>Ícono {school.name}</b><small>{path.ready ? '¡Desbloqueado!' : 'Al terminar las lecciones'}</small></span>}
          </li>
        </ol>
      </div>

      {aero && path.ready && (
        <section className="mapp-glass mapp-final" data-testid="level-video">
          <p className="mapp-cota">Siguiente nivel · {nextLvl.name}</p>
          <p>Graba con tu celular un video corto preparando una taza con la receta y mándaselo al equipo de Micra por WhatsApp. Lo revisamos para subirte a <b>{nextLvl.name}</b>.</p>
          <a className="mapp-btn is-cta" href={`https://wa.me/${team}?text=${encodeURIComponent(`Hola, equipo de Micra. Les mando mi video para subir a ${nextLvl.name}.`)}`} target="_blank" rel="noopener noreferrer" data-testid="level-video-send">Mandar mi video por WhatsApp</a>
        </section>
      )}

      {open != null && (
        <LessonSheet lesson={lessons[open]} n={open + 1} aero={aero} school={school.id} seen={seen.includes(lessons[open].key)} onDone={() => markSeen(lessons[open].key)} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
