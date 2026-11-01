import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import * as api from './api.js';
import { initials } from './micraApp.js';
import { figureFor } from './motivation.js';
import { daysLeftLabel, scoreLabel, rankEntries, voteRef, canVote, ENTRY_STATUS, MIN_VOTES } from './competencia.js';
import { IconTrophy, IconBean } from './icons.jsx';
import Figure from './Elenco.jsx';
import { Cargando } from './Animado.jsx';

const PostComposer = lazy(() => import('./PostComposer.jsx'));

// Competencia: el reto de la semana (/micra/reto y /micra/barista/reto). El
// reto abierto con sus entradas (fotos de los baristas, ya revisadas), el
// podio, la calificación de 1 a 5 granos (un voto por celular por entrada), la
// entrada propia del barista y los retos pasados con su ganador. Lo puro en
// competencia.js; lo de la base en 20261101120000_micra_competencia.sql.

const store = () => { try { return window.localStorage; } catch { return null; } };
const fecha = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Los cinco granos: para calificar (onPick) o solo para ver (sin onPick). */
function Beans({ value = 0, onPick, size = 'big', label = 'Califica' }) {
  return (
    <span className={`mapp-beans is-${size}`} role={onPick ? 'radiogroup' : undefined} aria-label={onPick ? label : `${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (onPick
        ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'grano' : 'granos'}`} className={n <= value ? 'on' : ''} onClick={() => onPick(n)}><IconBean filled={n <= value} /></button>
        : <i key={n} className={n <= Math.round(value) ? 'on' : ''} aria-hidden="true"><IconBean filled={n <= Math.round(value)} /></i>))}
    </span>
  );
}

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

export default function Competencia({ go, audience = 'client', selfId = null, asId = null }) {
  const [data, setData] = useState(null);
  const [urls, setUrls] = useState({});
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // la entrada abierta (id)
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState(null);
  const [composing, setComposing] = useState(false);
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
  const canEnter = barista && !!selfId && !asId && ch && ch.days_left >= 0 && !mine;

  return (
    <div className="mapp-reto" data-testid="competencia">
      <header className="mapp-reto-head">
        <span className="mapp-reto-cup" aria-hidden="true"><IconTrophy /></span>
        <div>
          <p className="mapp-kicker">Competencia · reto de la semana</p>
          <h1 className="mapp-title is-small">{ch ? ch.title : 'Sin reto abierto'}</h1>
        </div>
      </header>

      {!ch && (
        <section className="mapp-glass mapp-reto-empty">
          <p>{data.missing ? 'La competencia abre muy pronto.' : 'El equipo abre un reto nuevo cada semana: arte latte, la foto del puesto, el cliente de siempre. Vuelve pronto.'}</p>
          {barista && !data.missing && <p className="mapp-muted">Mientras tanto, practica tu corazón en el perico: la Escuela tiene la lección de leche.</p>}
        </section>
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
