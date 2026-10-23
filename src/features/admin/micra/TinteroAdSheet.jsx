import { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import { adPlace, adProducts, canAdvertise } from './tinteroAd.js';
import { biApi, grantAdConsent } from './tinteroApi.js';

// Filtro «Tintero aliado»: elegir de qué tintero es la tarjeta. Salen los que
// tienen ficha (con lo publicable de su última encuesta); solo se usan los que
// aceptaron salir en la publicidad. A los demás se les puede preguntar ahí
// mismo y anotar que aceptaron.

export default function TinteroAdSheet({ selectedId, onPick, onClose, docked }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [asking, setAsking] = useState(null); // tintero al que se le está pidiendo el permiso
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    biApi('/tinteros')
      .then((rows) => { if (alive) setList(rows ?? []); })
      .catch((e) => { if (alive) { setError(e.message); setList([]); } });
    return () => { alive = false; };
  }, []);

  const grant = async (t) => {
    setBusy(true);
    setError(null);
    try {
      const row = await grantAdConsent(t.id);
      const next = { ...t, ...row, ad_consent: true };
      setList((l) => l.map((x) => (x.id === t.id ? next : x)));
      setAsking(null);
      onPick(next);
    } catch (e) {
      setError(`No se guardó el permiso: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Tintero aliado" onClose={onClose} docked={docked}>
      <p className="msheet-fine">Su nombre, dónde está y lo que vende salen en la tarjeta. Solo con su permiso.</p>
      {error && <p className="msheet-fine is-warn" role="alert">{error}</p>}
      {list === null && <p className="msheet-empty">Cargando tinteros…</p>}
      {list?.length === 0 && !error && <p className="msheet-empty">Aún no hay tinteros. Haz su ficha con «Tintero» en la cámara.</p>}
      <ul className="tad-list" aria-label="Tinteros">
        {(list ?? []).map((t) => {
          const ok = canAdvertise(t);
          const on = String(t.id) === String(selectedId);
          const sells = adProducts(t);
          return (
            <li key={t.id} className={`tad-item ${on ? 'on' : ''}`}>
              <button type="button" className="tad-pick" aria-pressed={on} onClick={() => (ok ? onPick(t) : setAsking(t.id))}>
                <b>{t.name}</b>
                <small>{adPlace(t)}{sells ? ` · ${sells}` : ''}</small>
                {!ok && <em>Falta su permiso</em>}
              </button>
              {asking === t.id && (
                <div className="tad-ask" role="group" aria-label={`Permiso de ${t.name}`}>
                  <p className="msheet-fine">Pregúntale: «¿Podemos publicar tu nombre, dónde estás y lo que vendes en las redes de ACERO.press?»</p>
                  <button type="button" className="msheet-btn" disabled={busy} onClick={() => grant(t)}>{busy ? 'Guardando…' : 'Aceptó: usar en la tarjeta'}</button>
                  <button type="button" className="msheet-btn is-ghost" disabled={busy} onClick={() => setAsking(null)}>No aceptó</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
