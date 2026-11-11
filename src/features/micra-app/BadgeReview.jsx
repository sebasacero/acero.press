import { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';

// Equipo › Hoy: los videos de baristas sirviendo un tinto que esperan para ganar la insignia del
// termo, el primer requisito de todo barista (20261111090000_micra_badges.sql). Los videos son
// privados: solo el barista y el equipo los ven, y no salen en Hoy.

const hace = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`;
};

export default function BadgeReview() {
  const [list, setList] = useState(null);
  const [urls, setUrls] = useState({});
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const rows = (await api.badgesPending()) ?? [];
      setList(rows);
      setUrls(await api.postUrls(rows.map((r) => r.media_path)).catch(() => ({})));
    } catch (e) {
      // Sin la migración no hay nada que verificar
      setList(e.missing ? [] : null);
      if (!e.missing) setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const review = async (id, ok) => {
    setBusy(id);
    setError(null);
    try { await api.badgeReview(id, ok, ok ? null : notes[id]); } catch (e) { setError(e.message); }
    setBusy(null);
    load();
  };

  if (!list?.length && !error) return null;
  return (
    <section className="mapp-glass mapp-review" aria-label="Insignias por verificar" data-testid="badge-review">
      <p className="mapp-cota is-red">Insignia del termo por verificar · {list?.length ?? 0}</p>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <ul>
        {(list ?? []).map((b) => (
          <li key={b.id}>
            <div className="mapp-review-media">
              {urls[b.media_path]
                ? <video src={urls[b.media_path]} controls playsInline preload="metadata" aria-label={`Video de ${b.name}`} />
                : <span aria-hidden="true">🎥</span>}
            </div>
            <div className="mapp-review-copy">
              <b>{b.name}</b>
              <small>{hace(b.created_at)} · sirviendo un tinto del termo</small>
              <input className="mapp-review-note" type="text" maxLength={200} placeholder="Si no pasa, qué le faltó" value={notes[b.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [b.id]: e.target.value }))} aria-label={`Qué le faltó a ${b.name}`} />
              <span className="mapp-row-btns">
                <button type="button" className="mapp-btn is-small is-cta" onClick={() => review(b.id, true)} disabled={busy === b.id}>Verificar</button>
                <button type="button" className="mapp-btn is-small is-ghost" onClick={() => review(b.id, false)} disabled={busy === b.id}>No pasa</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mapp-fine">Mira que sirva limpio del termo, en vaso adecuado y con la entrega amable. El video no se publica en ningún lado.</p>
    </section>
  );
}
