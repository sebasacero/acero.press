import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { ago } from '../lib/controlPanel.js';
import { briefing, diffEvents, insights, pushLog, snapshot } from '../lib/panelInsights.js';
import { zonesGeoJSON } from '../../micra-app/liveMap.js';

// El centro de control avanzado (pedido del usuario, 10 nov 2026: «con mapa y… notificaciones en
// tiempo real de posibles mejoras y tendencias»). Solo en el panel ancho de /micra en computador.
// Cada vez que el panel lee (`at`), el dueño trae además el mapa en vivo y las notas; lo que cambió
// frente a la lectura anterior sale en «Ahora mismo». Las reglas, en panelInsights.js.
const MicraMap = lazy(() => import('../../micra-app/MicraMap.jsx'));

const rpc = (fn, args) => supabase.rpc(fn, args).then(({ data, error }) => (error ? null : data), () => null);

// El parte se escribe letra a letra (vista HUD); con «menos movimiento», de una vez
function useTyped(text) {
  const [n, setN] = useState(text.length);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return undefined; }
    setN(0);
    const id = setInterval(() => setN((v) => { if (v >= text.length) { clearInterval(id); return v; } return v + 2; }), 24);
    return () => clearInterval(id);
  }, [text]);
  return text.slice(0, n);
}

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
function speak(text) {
  window.speechSynthesis.cancel();
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = 'es-CO';
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

export default function ControlRoom({ state, places, at, p, hud = false, picked = null }) {
  const [extra, setExtra] = useState({ live: null, ratings: null, times: null });
  const [log, setLog] = useState([]);
  const snap = useRef(null);
  const latest = useRef({ state, places });
  latest.current = { state, places };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { state: st, places: pl } = latest.current;
      const live = st.owner ? await rpc('micra_live_map', {}) : null;
      const ratings = st.owner ? await rpc('micra_hold_ratings') : null;
      const times = st.owner ? await rpc('micra_hold_times', { p_days: 7 }) : null;
      if (!alive) return;
      setExtra({ live, ratings, times });
      // Solo se comparan dos lecturas iguales (del dueño y con o sin mapa las dos): la primera
      // llega antes de saber quién mira y todo parecería nuevo
      const now = { ...snapshot({ state: st, live }), like: `${st.owner}|${!!live}` };
      const events = st.owner && snap.current?.like === now.like ? diffEvents(snap.current, now, { places: [...(live?.baristas ?? []), ...pl] }) : [];
      snap.current = now;
      if (events.length) setLog((l) => pushLog(l, events));
    })();
    return () => { alive = false; };
  }, [at]);

  const notes = useMemo(() => (state.owner ? insights({ state, live: extra.live, ratings: extra.ratings, times: extra.times, places }) : []), [state, extra, places]);
  const zones = useMemo(() => (extra.live ? zonesGeoJSON(extra.live, extra.live.min_count) : null), [extra.live]);
  // En el mapa: quien está en la calle (con su punto de ahora) y, apagados, los demás públicos
  const pins = useMemo(() => {
    const live = (extra.live?.baristas ?? []).map((b) => ({ ...b, status: 'live' }));
    const seen = new Set(live.map((b) => b.id));
    const rest = places.filter((b) => b.lat != null && b.lng != null && !seen.has(b.id))
      .map((b) => ({ ...b, status: b.live_until && Date.parse(b.live_until) > Date.now() ? 'live' : 'off' }));
    return [...live, ...rest];
  }, [extra.live, places]);
  const brief = useMemo(() => briefing({ state, notes }), [state, notes]);
  const typed = useTyped(brief);
  // El escogido en la lista: su punto en el mapa, si lo tiene
  const focus = useMemo(() => {
    const b = picked && pins.find((x) => x.id === picked.id);
    return b ? { lat: b.lat, lng: b.lng, at: picked.at } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  const demandN = (zones?.demand.features ?? []).reduce((a, f) => a + f.properties.n, 0);

  return (
    <>
      <div className="pg-fleet-map" data-testid="ctl-map">
        <h2 className="pg-fleet-vh">{p.map.title}</h2>
        <ul className="pg-ctl-legend" aria-label={p.map.legend}>
          <li><i className="is-pin" />{p.map.pins}</li>
          {state.owner && <li><i className="is-demand" />{p.map.demand}{demandN > 0 && <b> · {demandN}</b>}</li>}
          {state.owner && <li><i className="is-study" />{p.map.study}</li>}
        </ul>
        <Suspense fallback={<div className="mapp-map is-big" aria-hidden="true" />}>
          <MicraMap baristas={pins} me={null} theme={hud ? 'noche' : 'plano'} focus={focus} onPick={(id) => window.location.assign(`/micra/b/${id}`)} zones={zones} big named label={p.map.title} testId="ctl-map-canvas" />
        </Suspense>
        <p className="pg-ctl-fine">{state.owner ? p.map.fine : p.map.finePublic}</p>
        {hud && <div className="pg-hud-scan" aria-hidden="true"><i /><b /><b /><b /><b /></div>}
      </div>
      <div className="pg-fleet-feed">
        <h2>{p.feed.now}</h2>
        {state.owner ? (
          <>
            <ul className="pg-ctl-notes" aria-live="polite" data-testid="ctl-events">
              {log.length === 0 && <li className="pg-ctl-empty">{p.feed.nowEmpty}</li>}
              {log.map((e) => (
                <li key={e.key} className={`is-${e.level} is-new`}>
                  <b>{e.title}</b>{e.text && <span>{e.text}</span>}<time>{ago(new Date(e.at).toISOString(), at?.getTime())}</time>
                </li>
              ))}
            </ul>
            <h2>{p.feed.title}</h2>
            <ul className="pg-ctl-notes" data-testid="ctl-insights">
              {notes.length === 0 && <li className="pg-ctl-empty">{p.feed.empty}</li>}
              {notes.map((n) => (
                <li key={n.key} className={`is-${n.level}`}>
                  <em>{p.feed.kinds[n.kind]}</em><b>{n.title}</b><span>{n.text}</span>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="pg-ctl-empty">{p.feed.locked}</p>}
      </div>
      {hud && (
        <footer className="pg-hud-brief" data-testid="ctl-brief">
          <span aria-hidden="true">{p.hud.brief}</span>
          <p aria-label={brief}>{typed}<i aria-hidden="true" /></p>
          {canSpeak() && <button type="button" onClick={() => speak(brief)}>{p.hud.speak}</button>}
        </footer>
      )}
    </>
  );
}
