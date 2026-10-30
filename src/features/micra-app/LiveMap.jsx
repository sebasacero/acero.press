import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { baristaPath, cupsLabel } from './micraApp.js';
import { POLL_MS, legendCounts, shouldPoll, zonesGeoJSON } from './liveMap.js';
import * as api from './api.js';

// El mapa en vivo (como Uber al ponerse «en línea»): con «Salí a vender»
// activo, el barista ve a los otros baristas en la calle, dónde quieren café
// (zonas de 2 señales o más, nunca personas) y dónde suelen estar los puestos
// del estudio. Se refresca cada 30 s con la pantalla a la vista y se detiene
// al ocultarla o con «Ya volví». Sin salir: una vista previa con el estudio y
// la invitación a salir. El equipo lo ve igual, siempre en vivo.

const MicraMap = lazy(() => import('./MicraMap.jsx'));

// Las pruebas lo acortan (window.__micraLivePollMs) para no esperar 30 s
const pollMs = () => (typeof window !== 'undefined' && Number(window.__micraLivePollMs)) || POLL_MS;

/** Lee el mapa en vivo; con `poll`, lo refresca mientras la pantalla esté a la vista. */
export function useLiveMap({ enabled = true, poll = false } = {}) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let timer = 0;
    const visible = () => document.visibilityState !== 'hidden';
    // micra_live_map (20261030180000_micra_live_map.sql): baristas enlazados y equipo
    const load = () => api.call('micra_live_map', {})
      .then((data) => { if (alive) setState({ data, error: null }); })
      .catch((error) => { if (alive) setState((s) => ({ data: s.data, error })); });
    const next = () => {
      clearTimeout(timer);
      if (!alive || !poll || !shouldPoll({ enabled, visible: visible() })) return;
      timer = setTimeout(() => { load().then(next); }, pollMs());
    };
    load().then(next);
    const onVisibility = () => {
      if (!visible()) { clearTimeout(timer); return; }
      load().then(next); // de vuelta a la vista: al día de una vez
    };
    if (poll) document.addEventListener('visibilitychange', onVisibility);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [enabled, poll]);
  return state;
}

function Legend({ counts, team, demand = true }) {
  return (
    <>
      <p className="mapp-live-count" data-testid="live-count" role="status">
        {team ? counts.label.replace(' cerca', '') : counts.label}
      </p>
      <ul className="mapp-live-legend" aria-label="Qué muestra el mapa">
        {demand && <li><i className="is-demand" aria-hidden="true" />Quieren café</li>}
        <li><i className="is-study" aria-hidden="true" />Suelen vender</li>
        <li><i className="is-pin" aria-hidden="true" />Baristas en línea</li>
      </ul>
    </>
  );
}

/**
 * mode: 'barista' (live: en la calle; si no, vista previa) o 'team' (siempre en vivo).
 * selfId: el barista de la sesión (no se cuenta ni se pinta como otro).
 */
export default function LivePanel({ mode = 'barista', live = false, selfId = null, night = false, go }) {
  const team = mode === 'team';
  const inLive = team || live;
  const { data, error } = useLiveMap({ poll: inLive });
  const [pos, setPos] = useState(null);
  // La posición del celular, una vez, para el punto azul y el «cerca»; el equipo no la necesita
  useEffect(() => {
    if (team) return undefined;
    let alive = true;
    api.onePosition().then((p) => { if (alive && p) setPos(p); });
    return () => { alive = false; };
  }, [team]);
  // Sin la migración del mapa en vivo, la vista previa sigue mostrando a los baristas de alrededor
  const [fallback, setFallback] = useState(null);
  useEffect(() => {
    if (!error?.missing || fallback) return;
    api.listBaristas().then((l) => setFallback((l ?? []).filter((b) => b.live_until))).catch(() => setFallback([]));
  }, [error, fallback]);

  const self = (data?.baristas ?? []).find((b) => b.me || b.id === selfId);
  const me = pos ?? (self ? { lat: Number(self.lat), lng: Number(self.lng) } : null);
  const others = useMemo(
    () => (fallback ?? data?.baristas ?? []).filter((b) => !b.me && b.id !== selfId).map((b) => ({ ...b, status: 'live' })),
    [data, fallback, selfId],
  );
  const zones = useMemo(() => {
    const z = zonesGeoJSON(data, data?.min_count);
    // En la vista previa no se ve la demanda: es para quien salió a vender
    return inLive ? z : { demand: { type: 'FeatureCollection', features: [] }, study: z.study };
  }, [data, inLive]);
  const counts = legendCounts(data, { me: team ? null : me, selfId, min: data?.min_count });
  const theme = night ? 'noche' : 'plano';
  const open = (id) => go?.(baristaPath(id));

  if (!inLive) {
    return (
      <section className="mapp-glass mapp-nearby mapp-live is-preview" aria-labelledby="mapp-live-t" data-testid="live-panel" data-live="false">
        <p className="mapp-cota" id="mapp-live-t">Cerca de ti{data || fallback ? ` · ${others.length === 1 ? '1 barista en la calle' : `${others.length} baristas en la calle`}` : ''}</p>
        <div className="mapp-live-wrap">
          <Suspense fallback={<div className="mapp-map" aria-hidden="true" />}>
            <MicraMap baristas={others} me={me} theme={theme} onPick={open} zones={zones} label="Mapa de los baristas cerca de ti" />
          </Suspense>
          <p className="mapp-live-nudge" data-testid="live-nudge">Sal a vender para ver quién busca café ahora</p>
        </div>
        {(data?.study?.length ?? 0) > 0 && <ul className="mapp-live-legend"><li><i className="is-study" aria-hidden="true" />Suelen vender (estudio de calle)</li></ul>}
      </section>
    );
  }

  return (
    <section className={`mapp-live ${team ? 'is-team' : ''}`} aria-labelledby="mapp-live-t" data-testid="live-panel" data-live="true">
      <p className="mapp-cota" id="mapp-live-t"><span className="mapp-live-dot" aria-hidden="true" />{team ? 'En vivo · toda la calle' : 'En línea · el mapa en vivo'}</p>
      {data ? <Legend counts={counts} team={team} /> : <p className="mapp-live-count">{error ? (error.missing ? 'El mapa en vivo abre muy pronto.' : 'Sin señal: el mapa vuelve a intentar solo.') : 'Buscando quién está en la calle…'}</p>}
      <Suspense fallback={<div className="mapp-map is-big is-loading" aria-hidden="true" />}>
        <MicraMap baristas={others} me={me} theme={theme} onPick={open} zones={zones} big named label="Mapa en vivo: baristas en la calle y zonas donde quieren café" />
      </Suspense>
      {!team && counts.waiting > 0 && <p className="mapp-live-wait">Aparte, a ti te esperan <b>{cupsLabel(counts.waiting)}</b>.</p>}
      <p className="mapp-fine">Zonas de unos 400 m con {data?.min_count ?? 2} o más personas en los últimos {data?.minutes ?? 45} min. Nunca se ve a una persona ni dónde está exactamente.</p>
    </section>
  );
}
