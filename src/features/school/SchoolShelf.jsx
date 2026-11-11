import { useState } from 'react';
import { SCHOOLS, gearShelf, gearLabel, readSchools, writeSchools, markSchool, seenFor } from '../micra-app/escuelas.js';
import LessonVideo, { SchoolIcon } from './LessonVideo.jsx';

// Las cuatro escuelas en /escuela (6 nov 2026, pedido del usuario: «para la escuela en la web crea
// algo parecido» a Aprende de Micra): el estante con AeroPress, termo, V60 y espresso, cuyo ícono
// se enciende al terminar sus lecciones. Lo visto de termo, V60 y espresso es la misma marca que
// usa la app (micra_escuelas_v1); la AeroPress sigue con la de /escuela. Contenido en español.

export function SchoolShelf({ aeroLessons, aeroSeen, stored, current, onPick }) {
  const shelf = gearShelf(aeroLessons, aeroSeen, stored);
  return (
    <div className="ss" role="tablist" aria-label="Escuelas" data-testid="web-schools">
      {shelf.map((g) => (
        <button key={g.id} type="button" role="tab" aria-selected={current === g.id} className={`ss-item${g.unlocked ? ' is-unlocked' : ''}${current === g.id ? ' on' : ''}`} onClick={() => onPick(g.id)} data-testid={`web-school-${g.id}`}>
          <span className="ss-ico">
            <SchoolIcon id={g.id} className="ss-svg" />
            {g.unlocked ? <i className="ss-ok" aria-hidden="true">✓</i> : g.done === 0 && <i className="ss-lock" aria-hidden="true">🔒</i>}
          </span>
          <b>{g.name}</b>
          <small>{gearLabel(g, ' lecciones')}</small>
        </button>
      ))}
    </div>
  );
}

export function useSchools() {
  const [stored, setStored] = useState(() => readSchools());
  const mark = (id, key) => setStored((s) => { const next = markSchool(s, id, key); if (next !== s) writeSchools(next); return next; });
  return [stored, mark];
}

/** Las lecciones de termo, V60 o espresso: tarjetas que se abren una a la vez, con su video. */
export function OtherSchool({ id, stored, onSeen }) {
  const school = SCHOOLS.find((s) => s.id === id);
  const [open, setOpen] = useState(0);
  if (!school?.lessons) return null;
  const seen = seenFor(id, [], stored);
  return (
    <>
    {school.video && <p className="ss-note" data-testid="web-school-video-note">La insignia del termo es el primer requisito de todo barista en Micra: ves estas lecciones, te grabas sirviendo un tinto y el equipo lo verifica.</p>}
    <ol className="sa ss-lessons" data-testid={`web-school-lessons-${id}`}>
      {school.lessons.map((l, i) => {
        const isOpen = open === i;
        const isSeen = seen.includes(l.key);
        return (
          <li key={l.key} className={`sa-item${isOpen ? ' is-open' : ''}${isSeen ? ' is-seen' : ''}`}>
            <h3 className="sa-h">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                <span className="school-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="school-list-body">
                  <b>{l.title}</b>
                  {!isOpen && <span className="sa-lead">{l.lead}</span>}
                  <small>{l.mins} min{isSeen ? ' · ✓ Vista' : ''}</small>
                </span>
                <span className="sa-chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>
            </h3>
            {isOpen && (
              <div className="sa-panel sl ss-panel">
                <p className="sl-lead">{l.lead}</p>
                <div className="ss-grid">
                  <LessonVideo lesson={l} school={id} label={`Video: ${l.title}`} />
                  <div className="sl-text">
                    <h4 className="sl-label">{l.pointsLabel}</h4>
                    {l.numbered
                      ? <ol className="sl-points is-numbered">{l.points.map((p) => <li key={p}>{p}</li>)}</ol>
                      : <ul className="sl-points">{l.points.map((p) => <li key={p}>{p}</li>)}</ul>}
                    <aside className="sl-tip"><b>Truco</b><p>{l.tip}</p></aside>
                    <details className="sl-more"><summary>Practica</summary><ol className="sl-practice">{l.practice.map((p) => <li key={p}>{p}</li>)}</ol></details>
                  </div>
                </div>
                <div className="sl-nav">
                  {i < school.lessons.length - 1
                    ? <button type="button" className="essp-btn" onClick={() => { onSeen(l.key); setOpen(i + 1); }}>Siguiente →</button>
                    : <button type="button" className="essp-btn" onClick={() => onSeen(l.key)} aria-disabled={isSeen || undefined}>{isSeen ? '✓ Vista' : 'Terminar la escuela'}</button>}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
    </>
  );
}
