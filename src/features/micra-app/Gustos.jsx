import { useEffect, useState } from 'react';
import * as api from './api.js';
import { QUESTIONS, pick, isPicked, cleanAnswers, answeredCount, tasteProfile, readGustos, writeGustos, introSeen, markIntroSeen } from './gustos.js';

// Los gustos del cliente (6 nov 2026, pedido del usuario): cinco preguntas cortas, una por
// pantalla, con un dato de café en cada una; todo opcional y solo en su celular. El perfil sale
// en la cabecera de «Mis apartados». Lo puro en gustos.js. Llega aparte (el bundle está al borde).


// Avisa a la barra de abajo (el punto de Mi perfil) que los gustos cambiaron
const changed = () => { try { window.dispatchEvent(new Event('micra-gustos')); } catch { /* sin ventana */ } };

export function useGustos() {
  const [answers, setAnswers] = useState(() => cleanAnswers(readGustos()?.answers));
  const save = (a) => { const clean = cleanAnswers(a); writeGustos({ answers: clean, at: new Date().toISOString() }); setAnswers(clean); changed(); };
  return [answers, save];
}

/** Las preguntas a pantalla completa: una a la vez, con «Saltar» y el perfil al final. */
export function GustosQuiz({ answers: start = {}, onDone, onClose, intro = false }) {
  const [answers, setAnswers] = useState(start);
  const [i, setI] = useState(0);
  const end = i >= QUESTIONS.length;
  const q = QUESTIONS[i];
  const profile = tasteProfile(answers);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const finish = () => { onDone(answers); onClose(); };
  return (
    <div className="mapp-gustos" role="dialog" aria-modal="true" aria-label="Tus gustos de café" data-testid="gustos-quiz">
      <header className="mapp-gustos-top">
        <ol className="mapp-gustos-dots" aria-label={`Pregunta ${Math.min(i + 1, QUESTIONS.length)} de ${QUESTIONS.length}`}>
          {QUESTIONS.map((x, k) => <li key={x.id} className={k < i ? 'done' : k === i ? 'on' : ''} />)}
        </ol>
        <button type="button" className="mapp-link" onClick={onClose} data-testid="gustos-close">{intro ? 'Saltar todo' : 'Cerrar'}</button>
      </header>
      {intro && i === 0 && <p className="mapp-gustos-welcome" data-testid="gustos-welcome"><b>Bienvenido a Micra.</b> Antes de empezar, cuéntanos qué café te gusta: 5 preguntas, 30 segundos, sin datos personales.</p>}
      {!end ? (
        <section className="mapp-gustos-q" key={q.id}>
          <p className="mapp-cota">{q.multi ? 'Escoge las que quieras' : 'Escoge una'}</p>
          <h2 className="mapp-title is-small">{q.title}</h2>
          <div className={`mapp-gustos-opts ${q.id === 'marcas' ? 'is-brands' : ''}`} role="group" aria-label={q.title}>
            {q.options.map((o) => {
              const on = isPicked(answers, q.id, o.id);
              return (
                <button key={o.id} type="button" className={`${on ? 'on' : ''} ${o.brand ? 'is-brand' : ''}`} aria-pressed={on} onClick={() => setAnswers((a) => pick(a, q.id, o.id))} data-testid={`gusto-${q.id}-${o.id}`}>
                  {o.brand ? <span className="mapp-gustos-mark" aria-hidden="true">{o.label.split(' (')[0]}</span> : <span className="mapp-gustos-ico" aria-hidden="true">{o.icon}</span>}
                  <b>{o.label}</b>
                </button>
              );
            })}
          </div>
          <p className="mapp-gustos-fact"><span aria-hidden="true">💡</span> {q.fact}</p>
        </section>
      ) : (
        <section className="mapp-gustos-q is-end" data-testid="gustos-result">
          {profile ? (
            <>
              <p className="mapp-cota">Tu perfil de café</p>
              <h2 className="mapp-title is-small">{profile.name}</h2>
              <ul className="mapp-gustos-chips">{[...profile.chips, ...profile.brands].map((c) => <li key={c}>{c}</li>)}</ul>
              <p className="mapp-gustos-fact"><span aria-hidden="true">☕</span> {profile.tip}</p>
            </>
          ) : (
            <>
              <h2 className="mapp-title is-small">Listo por ahora.</h2>
              <p className="mapp-muted">Con dos respuestas armamos tu perfil. Puedes volver cuando quieras.</p>
            </>
          )}
          <p className="mapp-fine">Se guarda solo en este celular. Lo borras en Mi perfil › Borrar mis datos.</p>
        </section>
      )}
      <footer className="mapp-gustos-foot">
        {i > 0 && <button type="button" className="mapp-btn is-ghost" onClick={() => setI((x) => x - 1)}>Atrás</button>}
        {end
          ? <button type="button" className="mapp-btn is-cta" onClick={finish} data-testid="gustos-done">Guardar mis gustos</button>
          : <button type="button" className="mapp-btn is-cta" onClick={() => setI((x) => x + 1)} data-testid="gustos-next">
            {(q.multi ? (answers[q.id]?.length ?? 0) > 0 : answers[q.id]) ? 'Siguiente' : 'Saltar'}
          </button>}
      </footer>
    </div>
  );
}

/**
 * La primera vez que el cliente abre Micra salen las preguntas solas (pedido del usuario, 6 nov 2026).
 * Si las salta, queda un punto en Mi perfil, donde las puede contestar después.
 */
export function GustosIntro() {
  const [answers, save] = useGustos();
  const [open, setOpen] = useState(() => !introSeen() && answeredCount(answers) === 0);
  if (!open) return null;
  const close = () => { markIntroSeen(); changed(); setOpen(false); };
  return <GustosQuiz intro answers={answers} onDone={save} onClose={close} />;
}

/**
 * La cabecera de «Mis apartados» (pedido del usuario): el gradiente con su perfil de café, lo que
 * le gusta y sus sellos. Sin respuestas, la invitación a contarlo.
 */
export function GustosHead({ waiting = 0 }) {
  const [answers, save] = useGustos();
  const [open, setOpen] = useState(false);
  const [stamps, setStamps] = useState(null);
  useEffect(() => { api.myStamps().then(setStamps).catch(() => setStamps(null)); }, []);
  const profile = tasteProfile(answers);
  const per = stamps?.per ?? 10;
  const toward = Number.isFinite(stamps?.toward) ? stamps.toward : null;
  return (
    <section className="mapp-mehead mapp-gustos-head" aria-label="Tus gustos" data-testid="gustos-head">
      <p className="mapp-mehead-kicker">Mis apartados</p>
      <h1 className="mapp-mehead-name">{profile ? profile.name : 'Tu café de hoy'}</h1>
      {profile ? (
        <ul className="mapp-gustos-chips is-head" data-testid="gustos-chips">
          {[...profile.chips, ...profile.brands].slice(0, 7).map((c) => <li key={c}>{c}</li>)}
        </ul>
      ) : (
        <p className="mapp-gustos-headlead">Cuéntanos qué café te gusta y te decimos qué pedirle a tu barista.</p>
      )}
      <dl className="mapp-mehead-kpis">
        <div><dt>Hoy</dt><dd>{waiting}</dd></div>
        <div><dt>Sellos</dt><dd>{toward != null ? `${toward}/${per}` : '—'}</dd></div>
        <div><dt>Tazas</dt><dd>{stamps?.cups ?? 0}</dd></div>
      </dl>
      {profile && <p className="mapp-gustos-tip">☕ {profile.tip}</p>}
      <button type="button" className="mapp-gustos-edit" onClick={() => setOpen(true)} data-testid="gustos-edit">
        {profile ? 'Cambiar mis gustos' : 'Completar mi perfil'}
      </button>
      {open && <GustosQuiz answers={answers} onDone={save} onClose={() => setOpen(false)} />}
    </section>
  );
}
