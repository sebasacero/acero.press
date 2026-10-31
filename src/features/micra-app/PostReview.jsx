import { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';

// Equipo › Hoy: lo que los baristas mandaron para el muro de Hoy y espera
// revisión (20261031160000_micra_barista_posts.sql). Solo sale lo aprobado; si
// el barista no está en el mapa público, su publicación no sale aunque se apruebe.

const hace = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`;
};

export default function PostReview() {
  const [list, setList] = useState(null);
  const [urls, setUrls] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const rows = (await api.postsPending()) ?? [];
      setList(rows);
      setUrls(await api.postUrls(rows.map((r) => r.media_path)).catch(() => ({})));
    } catch (e) {
      // Sin la migración no hay nada que revisar
      setList(e.missing ? [] : null);
      if (!e.missing) setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id, ok) => {
    setBusy(id);
    setError(null);
    try { await api.postReview(id, ok); } catch (e) { setError(e.message); }
    setBusy(null);
    load();
  };

  if (!list?.length && !error) return null;
  return (
    <section className="mapp-glass mapp-review" aria-label="Publicaciones por revisar" data-testid="post-review">
      <p className="mapp-cota is-red">Publicaciones por revisar · {list?.length ?? 0}</p>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <ul>
        {(list ?? []).map((p) => (
          <li key={p.id}>
            <div className="mapp-review-media">
              {!urls[p.media_path] ? <span aria-hidden="true">{p.kind === 'video' ? '🎥' : '📸'}</span>
                : p.kind === 'video'
                  ? <video src={urls[p.media_path]} controls playsInline preload="metadata" />
                  : <img src={urls[p.media_path]} alt={`Foto de ${p.name}`} />}
            </div>
            <div className="mapp-review-copy">
              <b>{p.name}</b>
              <small>{hace(p.created_at)}{p.public ? '' : ' · no sale en el mapa: no se verá aunque la apruebes'}</small>
              {p.caption && <p>{p.caption}</p>}
              <span className="mapp-row-btns">
                <button type="button" className="mapp-btn is-small is-cta" onClick={() => review(p.id, true)} disabled={busy === p.id}>Aprobar</button>
                <button type="button" className="mapp-btn is-small is-ghost" onClick={() => review(p.id, false)} disabled={busy === p.id}>No publicar</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mapp-fine">Revisa que no salga nadie sin permiso, ni datos personales, ni marcas de otros. Lo aprobado lo ven clientes y baristas en Hoy.</p>
    </section>
  );
}
