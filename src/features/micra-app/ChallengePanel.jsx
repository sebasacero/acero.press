import { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';
import { bogota } from './micraApp.js';
import { challengeDraft, CHALLENGE_IDEAS, KINDS } from './competencia.js';

// Equipo › Hoy › Competencia: abrir el reto de la semana (nombre, descripción,
// premio y fechas; las ideas vienen listas), cambiarlo y ver cuántas entradas
// y votos lleva. Las entradas se revisan en «Publicaciones por revisar», con
// la etiqueta del reto.

const EMPTY = { title: '', brief: '', prize: '', kind: 'arte_latte', starts_on: '', ends_on: '' };
const STATE = { open: ['Abierto', 'is-live'], soon: ['Programado', 'is-soon'], done: ['Cerró', 'is-off'] };
const fecha = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const plusDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

function ChallengeForm({ initial, onSaved, onCancel }) {
  const today = bogota().day;
  const [f, setF] = useState(() => ({ ...EMPTY, starts_on: today, ends_on: plusDays(today, 6), ...(initial ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    const d = challengeDraft(f, today);
    if (d.error) { setError(d.error); return; }
    setBusy(true);
    setError(null);
    try { await api.challengeSave(initial?.id ?? null, d.ch); onSaved(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <form className="mapp-glass mapp-adform" onSubmit={save} data-testid="challenge-form">
      <p className="mapp-cota">{initial?.id ? 'Cambiar reto' : 'Nuevo reto'}</p>
      {!initial?.id && (
        <div className="mapp-chips is-wrap" role="group" aria-label="Ideas">
          {CHALLENGE_IDEAS.map((i) => <button key={i.title} type="button" onClick={() => setF((o) => ({ ...o, title: i.title, brief: i.brief, kind: i.kind }))}>{i.title}</button>)}
        </div>
      )}
      <label className="mapp-field"><span>Nombre del reto</span><input value={f.title} onChange={set('title')} maxLength={80} placeholder="Arte latte: tu mejor corazón" /></label>
      <label className="mapp-field"><span>De qué se trata (opcional)</span><textarea value={f.brief} onChange={set('brief')} maxLength={280} rows={2} /></label>
      <label className="mapp-field"><span>Premio (opcional)</span><input value={f.prize} onChange={set('prize')} maxLength={120} placeholder="Un kilo de café de origen" /></label>
      <div className="mapp-chips" role="group" aria-label="Tipo">
        {KINDS.map(([id, label]) => <button key={id} type="button" className={f.kind === id ? 'on' : ''} aria-pressed={f.kind === id} onClick={() => setF((o) => ({ ...o, kind: id }))}>{label}</button>)}
      </div>
      <div className="mapp-adform-row">
        <label className="mapp-field"><span>Desde</span><input type="date" value={f.starts_on} onChange={set('starts_on')} /></label>
        <label className="mapp-field"><span>Hasta</span><input type="date" value={f.ends_on} onChange={set('ends_on')} data-testid="challenge-ends" /></label>
      </div>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <span className="mapp-row-btns">
        <button type="submit" className="mapp-btn is-small is-cta" disabled={busy}>{busy ? 'Un momento…' : 'Guardar'}</button>
        <button type="button" className="mapp-link" onClick={onCancel} disabled={busy}>Cancelar</button>
      </span>
      <p className="mapp-fine">Las entradas llegan a «Publicaciones por revisar» con la etiqueta del reto. Gana el mejor promedio con 3 votos o más.</p>
    </form>
  );
}

export default function ChallengePanel() {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api.challengesAdmin().then((l) => setList(l ?? [])).catch((e) => { setList(e.missing ? null : []); if (!e.missing) setError(e.message); }), []);
  useEffect(() => { load(); }, [load]);
  // Sin la migración, el panel no sale
  if (list === null && !error) return null;
  const open = (list ?? []).find((c) => c.state === 'open');

  return (
    <section className="mapp-glass mapp-adspanel" aria-label="Competencia" data-testid="challenge-panel">
      <header className="mapp-adspanel-head">
        <p className="mapp-cota">Competencia · {open ? 'reto abierto' : 'sin reto abierto'}</p>
        {!editing && <button type="button" className="mapp-btn is-small" onClick={() => setEditing({})} data-testid="challenge-new">＋ Nuevo reto</button>}
      </header>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      {editing && <ChallengeForm initial={editing.id ? editing : null} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}
      {(list ?? []).length === 0 && !editing && <p className="mapp-muted">Abre el primer reto: los baristas entran con su foto y todos califican.</p>}
      <ul className="mapp-adlist">
        {(list ?? []).map((c) => {
          const [label, tone] = STATE[c.state] ?? [c.state, ''];
          return (
            <li key={c.id} data-testid="challenge-row">
              <div className="mapp-adlist-top"><b>{c.title}</b><span className={`mapp-adstate ${tone}`}>{label}</span></div>
              <small>{KINDS.find(([id]) => id === c.kind)?.[1] ?? c.kind} · {fecha(c.starts_on)} a {fecha(c.ends_on)}{c.prize ? ` · 🎁 ${c.prize}` : ''}</small>
              <dl className="mapp-adstats">
                <div><dd>{c.entries}</dd><dt>entradas</dt></div>
                <div><dd>{c.pending}</dd><dt>por revisar</dt></div>
                <div><dd>{c.votes}</dd><dt>votos</dt></div>
              </dl>
              {c.state !== 'done' && <button type="button" className="mapp-link" onClick={() => setEditing(c)}>Cambiar</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
