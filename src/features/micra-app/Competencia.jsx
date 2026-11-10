import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from './api.js';
import { initials } from './micraApp.js';
import { figureFor } from './motivation.js';
import { daysLeftLabel, scoreLabel, rankEntries, voteRef, canVote, ENTRY_STATUS, MIN_VOTES, BASIC_SECTIONS, sectionOf, shortTitle, medalBoard, videoOf } from './competencia.js';
import { IconTrophy } from './icons.jsx';
import Beans from './Beans.jsx';
import Figure from './Elenco.jsx';
import { Cargando } from './Animado.jsx';
import { JudgeBadge, JudgeBars } from './Juez.jsx';
import { SchoolIcon } from '../school/LessonVideo.jsx';

// El dibujo a trazo de cada sección de retos (los mismos de las escuelas)
const SECTION_ICON = { filtrados: 'v60', espresso: 'espresso', arte_latte: 'taza', leche: 'leche', molienda: 'balanza', cata: 'cafe', calle: 'termo' };

const PostComposer = lazy(() => import('./PostComposer.jsx'));

// Competencia: el reto de la semana (/micra/reto y /micra/barista/reto). El
// reto abierto con sus entradas (fotos de los baristas, ya revisadas), el
// podio, la calificación de 1 a 5 granos (un voto por celular por entrada), la
// entrada propia del barista y los retos pasados con su ganador. Lo puro en
// competencia.js; lo de la base en 20261101120000_micra_competencia.sql.

const store = () => { try { return window.localStorage; } catch { return null; } };
const fecha = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Una entrada abierta: la foto grande, quién, su nota y los granos para calificar. */
function EntryView({ entry, url, challenge, onVote, onClose, voting, error }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const open = canVote(entry, challenge);
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label={`Entrada de ${entry.name}`} data-testid="entry-view">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section className="mapp-sheet is-scroll mapp-entry">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <header className="mapp-ig-head">
          <Figure name={figureFor(entry.tintero_id)} className="is-avatar" />
          <span className="mapp-ig-who"><b>{entry.name}{entry.rank && <span className="mapp-levelchip is-rank">#{entry.rank}</span>}</b><small>{entry.votes ? `${scoreLabel(entry.avg)} · ${entry.votes} ${entry.votes === 1 ? 'voto' : 'votos'}` : 'Sin votos todavía'}</small></span>
          <button type="button" className="mapp-link" onClick={onClose}>Listo</button>
        </header>
        <div className="mapp-entry-photo">{url ? <img src={url} alt={entry.caption ? `Entrada de ${entry.name}: ${entry.caption}` : `Entrada de ${entry.name}`} /> : <span aria-hidden="true">📸</span>}</div>
        {entry.caption && <p className="mapp-post-text">{entry.caption}</p>}
        {entry.judge?.score != null && (
          <div className="mapp-entry-judge" data-testid="entry-judge">
            <div className="mapp-entry-judge-head">
              <p className="mapp-cota">Juez Micra</p>
              <JudgeBadge score={entry.judge.score} small />
              {entry.team != null && <span className="mapp-entry-judge-team">Jurado: {Number(entry.team).toLocaleString('es-CO', { maximumFractionDigits: 1 })} · {entry.team_n}</span>}
            </div>
            <JudgeBars scores={entry.judge.scores} compact />
          </div>
        )}
        {entry.mine ? (
          <p className="mapp-fine" data-testid="entry-mine">Esta es tu entrada: la califican los demás.</p>
        ) : open ? (
          <div className="mapp-entry-vote">
            <p className="mapp-cota">{entry.my_score ? 'Tu nota' : 'Califica'}</p>
            <Beans value={entry.my_score ?? 0} onPick={onVote} />
            <p className="mapp-fine">{voting ? 'Guardando…' : entry.my_score ? 'Puedes cambiarla mientras el reto esté abierto.' : 'Un voto por celular; lo puedes cambiar.'}</p>
            {error && <p className="mapp-error" role="alert">{error}</p>}
          </div>
        ) : (
          <p className="mapp-fine">El reto ya cerró.</p>
        )}
      </section>
    </div>
  );
}

/**
 * Los retos básicos: las experiencias de base del barismo por sección (filtrados, espresso,
 * arte latte, leche, molienda, cata, calle). El barista los ve todos para practicar; el equipo
 * abre uno como reto de la semana. El reto abierto sale marcado en su sección.
 */
/** La hoja de un reto básico: el ícono grande, la descripción, cómo se califica y el video si lo tiene. */
function BasicSheet({ c, section, live, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const video = videoOf(c);
  // En el body: la sección de los retos recorta lo que se sale (overflow) y taparía la hoja
  return createPortal(
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label={shortTitle(c.title)} data-testid="basic-sheet">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section className="mapp-sheet is-scroll mapp-basics-sheet">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <div className="mapp-basics-hero">
          <span className="mapp-basics-ic" aria-hidden="true"><SchoolIcon id={SECTION_ICON[section.id] ?? 'cafe'} /></span>
          <p className="mapp-kicker">{section.label}{live ? ' · Reto de esta semana' : ''}</p>
          <h2 className="mapp-title is-small">{shortTitle(c.title)}</h2>
        </div>
        {video && (
          <video className="mapp-basics-video" src={video.src} poster={video.poster ?? undefined} controls playsInline preload="none" aria-label={`Video: ${shortTitle(c.title)}`} />
        )}
        <p className="mapp-basics-brief">{c.brief}</p>
        <p className="mapp-basics-how"><b>{c.kind === 'arte_latte' ? '🏅 Cómo se califica' : '✓ Qué se mira'}</b>{c.how}</p>
        {live
          ? <a className="mapp-btn is-cta" href="#mapp-reto" onClick={onClose}>Participar en el reto</a>
          : <p className="mapp-fine">Cuando el equipo abra este reto, participas desde aquí con una foto.</p>}
        <button type="button" className="mapp-btn is-ghost" onClick={onClose}>Listo</button>
      </section>
    </div>,
    document.querySelector('.mapp') ?? document.body, // dentro de la app, para heredar sus colores
  );
}

function Basics({ current, sec, setSec }) {
  const here = sectionOf(current);
  const cur = sec ?? here?.id ?? BASIC_SECTIONS[0].id;
  const s = BASIC_SECTIONS.find((x) => x.id === cur) ?? BASIC_SECTIONS[0];
  // Qué tarjeta está a la vista, para los puntos de abajo
  const track = useRef(null);
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(null); // el reto abierto en la hoja
  useEffect(() => { setAt(0); }, [cur]);
  const onScroll = () => {
    const el = track.current;
    const first = el?.firstElementChild;
    if (!first) return;
    setAt(Math.round(el.scrollLeft / (first.offsetWidth + 12)));
  };
  return (
    <section className="mapp-glass mapp-basics" id="mapp-basics" aria-labelledby="basics-h" data-testid="basics">
      {/* Cabecera naranja: solo el título y los íconos de los métodos (pedido del usuario, 7 nov 2026) */}
      <header className="mapp-basics-head">
        <h2 id="basics-h">Retos básicos</h2>
        <div className="mapp-basics-methods" role="tablist" aria-label="Métodos">
          {BASIC_SECTIONS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={cur === x.id} className={`${cur === x.id ? 'on' : ''} ${here?.id === x.id ? 'is-now' : ''}`} onClick={() => setSec(x.id)} aria-label={x.label} data-testid={`basics-${x.id}`}>
              <SchoolIcon id={SECTION_ICON[x.id] ?? 'cafe'} />
              <span>{x.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </header>
      <p className="mapp-basics-why">{s.why}</p>
      {/* Tarjetas en carrusel (pedido del usuario, 7 nov 2026): se pasan de lado con el dedo y la siguiente se asoma */}
      <ol className="mapp-basics-list is-carousel" role="tabpanel" aria-label={s.label} ref={track} onScroll={onScroll} key={s.id}>
        {s.challenges.map((c, i) => {
          const live = current && current.title === c.title;
          return (
            <li key={c.title} className={live ? 'is-live' : ''} aria-label={`${i + 1} de ${s.challenges.length}`}>
              {/* Solo el ícono grande del método y el nombre; la descripción y el video, al entrar (pedido del usuario, 7 nov 2026) */}
              <button type="button" className="mapp-basics-open" onClick={() => setOpen(c)} data-testid={`basic-${i}`}>
                <div className="mapp-basics-top">
                  <span className="mapp-basics-ic" aria-hidden="true"><SchoolIcon id={SECTION_ICON[s.id] ?? 'cafe'} /></span>
                  <span className="mapp-basics-n" aria-hidden="true">{i + 1}/{s.challenges.length}</span>
                  {live && <em className="mapp-basics-now">Reto de esta semana</em>}
                </div>
                <b>{shortTitle(c.title)}</b>
                <small>{videoOf(c) ? '▶ Con video · ' : ''}Ver el reto</small>
              </button>
            </li>
          );
        })}
      </ol>
      {s.challenges.length > 1 && (
        <div className="mapp-basics-dots" aria-hidden="true">
          {s.challenges.map((c, i) => <i key={c.title} className={i === at ? 'on' : ''} />)}
        </div>
      )}
      {open && <BasicSheet c={open} section={s} live={current && current.title === open.title} onClose={() => setOpen(null)} />}
    </section>
  );
}

export default function Competencia({ go, audience = 'client', selfId = null, asId = null }) {
  const [data, setData] = useState(null);
  const [urls, setUrls] = useState({});
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // la entrada abierta (id)
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState(null);
  const [composing, setComposing] = useState(false);
  const [sec, setSec] = useState(null); // la sección de retos básicos a la vista (null: la del reto abierto)
  const ref = voteRef(store());
  const barista = audience === 'barista';

  const load = useCallback(async () => {
    try {
      const d = await api.challenge(ref);
      setData(d ?? { challenge: null, entries: [], past: [], my_wins: 0 });
      const paths = [...(d?.entries ?? []).map((e) => e.media_path), ...(d?.past ?? []).map((p) => p.winner?.media_path), d?.my_entry?.media_path].filter(Boolean);
      setUrls(await api.postUrls(paths).catch(() => ({})));
    } catch (e) {
      if (e.missing) setData({ missing: true, challenge: null, entries: [], past: [], my_wins: 0 });
      else setError(e.message);
    }
  }, [ref]);
  useEffect(() => { load(); }, [load]);

  const vote = async (entry, score) => {
    setVoting(true);
    setVoteError(null);
    try {
      const r = await api.vote(entry.id, ref, score);
      setData((d) => ({ ...d, entries: d.entries.map((e) => (e.id === entry.id ? { ...e, my_score: r.my_score, votes: r.votes, avg: r.avg } : e)) }));
    } catch (e) { setVoteError(e.message); }
    setVoting(false);
  };

  if (error) return <p className="mapp-error" role="alert">No se pudo abrir el reto: {error} <button type="button" className="mapp-link" onClick={load}>Reintentar</button></p>;
  if (!data) return <Cargando fig="aeropress">Abriendo el reto…</Cargando>;

  const ch = data.challenge;
  const entries = rankEntries(data.entries);
  const podium = entries.filter((e) => e.rank && e.rank <= 3);
  const current = entries.find((e) => e.id === open);
  const mine = data.my_entry;
  const board = medalBoard(data.past);
  const canEnter = barista && !!selfId && !asId && ch && ch.days_left >= 0 && !mine;

  return (
    <div className="mapp-reto" data-testid="competencia">
      {/* La cabecera en gradiente con los íconos de los retos (pedido del usuario, 6 nov 2026) */}
      <header className="mapp-reto-head is-grad" data-testid="reto-head">
        <div className="mapp-reto-headtop">
          <span className="mapp-reto-cup" aria-hidden="true"><IconTrophy /></span>
          <div>
            <p className="mapp-kicker">Competencia · {sectionOf(ch)?.label ?? 'reto de la semana'}</p>
            <h1 className="mapp-title is-small">{ch ? ch.title : 'Sin reto abierto'}</h1>
          </div>
        </div>
        {ch && (
          <dl className="mapp-reto-kpis">
            <div><dt>{ch.days_left > 0 ? 'días' : 'cierra'}</dt><dd>{ch.days_left > 0 ? ch.days_left : 'hoy'}</dd></div>
            <div><dt>{entries.length === 1 ? 'entrada' : 'entradas'}</dt><dd>{entries.length}</dd></div>
            <div><dt>{barista ? 'retos ganados' : 'votos'}</dt><dd>{barista ? (data.my_wins ?? 0) : entries.reduce((n, e) => n + (e.votes ?? 0), 0)}</dd></div>
          </dl>
        )}
        {/* Arriba el medallero de los retos ya cerrados; los íconos de los métodos van en la cabecera
            naranja de los retos básicos (pedido del usuario, 7 nov 2026) */}
        <ul className="mapp-medals" aria-label={`Medallero: ${board.total === 1 ? '1 reto cerrado' : `${board.total} retos cerrados`}`} data-testid="medals">
          {board.medals.map((m) => (
            <li key={m.id} className={m.done ? 'is-on' : ''} aria-label={`${m.label}: ${m.done ? `${m.done} ${m.done === 1 ? 'reto' : 'retos'}` : 'por abrir'}`}>
              <span className="mapp-medal"><SchoolIcon id={SECTION_ICON[m.id] ?? 'cafe'} />{m.done > 1 && <i>{m.done}</i>}</span>
              <small>{m.label}</small>
            </li>
          ))}
        </ul>
      </header>

      {/* Sin reto abierto no hay tarjeta de explicación (pedido del usuario, 7 nov 2026): van directo los retos básicos */}
      {!ch && data.missing && (
        <section className="mapp-glass mapp-reto-empty"><p>La competencia abre muy pronto.</p></section>
      )}

      {ch && (
        <>
          <section className="mapp-glass mapp-reto-card" data-testid="reto-card">
            {ch.brief && <p>{ch.brief}</p>}
            <p className="mapp-reto-meta">
              <span className={`mapp-reto-days ${ch.days_left <= 1 ? 'is-hot' : ''}`}>{daysLeftLabel(ch.days_left)}</span>
              <span>{fecha(ch.starts_on)} – {fecha(ch.ends_on)}</span>
              <span>{entries.length === 1 ? '1 entrada' : `${entries.length} entradas`}</span>
            </p>
            {ch.prize && <p className="mapp-reto-prize">🎁 {ch.prize}</p>}
            {barista && (
              mine ? (
                <p className="mapp-reto-mine" data-testid="my-entry">
                  <b>Tu entrada · {ENTRY_STATUS[mine.status] ?? mine.status}</b>
                  {mine.status === 'pending' && <small>El equipo la revisa y entra al reto.</small>}
                  {mine.status === 'approved' && <small>Ya la están calificando. Comparte el reto para sumar votos.</small>}
                  {mine.judge?.score != null && <small>Juez Micra: {mine.judge.score} de 100.</small>}
                </p>
              ) : canEnter ? (
                <button type="button" className="mapp-btn is-cta" onClick={() => setComposing(true)} data-testid="reto-enter">Participar con mi foto</button>
              ) : asId ? (
                <p className="mapp-fine">Actuando como otro barista no se entra al reto.</p>
              ) : null
            )}
            {!barista && <p className="mapp-fine">Califica las entradas de 1 a 5 granos. Un voto por celular en cada una; lo puedes cambiar.</p>}
          </section>

          {podium.length > 0 && (
            <section className="mapp-podium" aria-label="Podio" data-testid="podium">
              {podium.map((e) => (
                <button key={e.id} type="button" className={`mapp-podium-item is-${e.rank}`} onClick={() => setOpen(e.id)}>
                  <span className="mapp-podium-rank">{e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}</span>
                  <span className="mapp-podium-photo">{urls[e.media_path] ? <img src={urls[e.media_path]} alt="" /> : <b>{initials(e.name)}</b>}</span>
                  <b>{e.name}</b>
                  <small>{scoreLabel(e.avg)} · {e.votes} votos</small>
                </button>
              ))}
            </section>
          )}

          {entries.length === 0 ? (
            <section className="mapp-glass"><p className="mapp-muted">{barista ? 'Nadie ha entrado todavía: sé el primero.' : 'Las entradas van llegando: el equipo las revisa antes de que salgan aquí.'}</p></section>
          ) : (
            <ul className="mapp-reto-grid" aria-label="Entradas" data-testid="entries">
              {entries.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setOpen(e.id)} aria-label={`${e.name}: ${e.votes ? `${scoreLabel(e.avg)} con ${e.votes} votos` : 'sin votos'}${e.my_score ? `, tu nota ${e.my_score}` : ''}`}>
                    <span className="mapp-reto-photo">
                      {urls[e.media_path] ? <img src={urls[e.media_path]} alt="" loading="lazy" /> : <b>{initials(e.name)}</b>}
                      {e.rank && <i className="mapp-reto-rank">#{e.rank}</i>}
                      {e.judge?.score != null && <span className="mapp-reto-judge"><JudgeBadge score={e.judge.score} small /></span>}
                      {e.mine && <i className="mapp-reto-tag">Tuya</i>}
                      {e.my_score && !e.mine && <i className="mapp-reto-tag is-voted">Tu nota: {e.my_score}</i>}
                    </span>
                    <span className="mapp-reto-who"><b>{e.name}</b><small>{e.votes ? `${scoreLabel(e.avg)} · ${e.votes} ${e.votes === 1 ? 'voto' : 'votos'}` : 'Sin votos'}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {entries.length > 0 && entries.every((e) => !e.rank) && <p className="mapp-fine is-center">Al podio se entra con {MIN_VOTES} votos o más.</p>}
        </>
      )}

      {barista && data.my_wins > 0 && (
        <section className="mapp-glass mapp-reto-wins" data-testid="my-wins">
          <span aria-hidden="true">🏆</span>
          <p><b>{data.my_wins === 1 ? 'Has ganado 1 reto' : `Has ganado ${data.my_wins} retos`}</b><small>Sale en tu perfil y en Hoy.</small></p>
        </section>
      )}

      <Basics current={ch} sec={sec} setSec={setSec} />

      {data.past.length > 0 && (
        <section className="mapp-glass" aria-label="Retos anteriores" data-testid="past">
          <p className="mapp-cota">Retos anteriores</p>
          <ul className="mapp-holds">
            {data.past.map((p) => (
              <li key={p.id}>
                <span className="mapp-av" aria-hidden="true">{p.winner ? '🏆' : '—'}</span>
                <div>
                  <b>{p.title}</b>
                  <span>{p.winner ? `Ganó ${p.winner.name} · ${scoreLabel(p.winner.avg)} con ${p.winner.votes} votos` : `Sin ganador (faltaron votos) · cerró el ${fecha(p.ends_on)}`}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {current && <EntryView entry={current} url={urls[current.media_path]} challenge={ch} onVote={(n) => vote(current, n)} onClose={() => { setOpen(null); setVoteError(null); }} voting={voting} error={voteError} />}
      {composing && (
        <Suspense fallback={null}>
          <PostComposer selfId={selfId} asId={asId} challenge={ch} onClose={() => setComposing(false)} onSent={load} />
        </Suspense>
      )}
      {!barista && <p className="mapp-fine is-center">¿Vendes café en la calle? <button type="button" className="mapp-link" onClick={() => go('/micra/barista')}>Entra al reto como barista</button></p>}
    </div>
  );
}
