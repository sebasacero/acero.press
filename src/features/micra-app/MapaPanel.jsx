import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { apiUrl } from '../../shared/lib/apiBase.js';
import { themeChanges } from '../../shared/lib/mapTheme.js';
import { initials, money } from './micraApp.js';
import { zonesGeoJSON } from './liveMap.js';
import * as api from './api.js';
import {
  PANEL_POLL_MS, LIVE_POINTS_MAX, WINDOWS, LAYERS, DEFAULT_LAYERS, STATUS_LABEL,
  windowSince, windowDays, routeTracks, panelPeople, searchPeople, studyPoints, sightingPoints,
  tracksGeoJSON, panelKpis, boundsOf, personDetail, agoLabel, kmLabel,
} from './mapaPanel.js';
import './mapa-panel.css';

// El panel del mapa del equipo (/micra/mapa): en un mapa, quién está
// conectado, la ruta que lleva cada barista y lo del estudio de calle, para
// todas las personas a la vez. Se refresca cada 20 s con la pantalla a la
// vista. Sin migración nueva: lee lo que el equipo ya puede leer (la API de BI
// del piloto, micra_live_map, micra_sightings y los puntos de las rutas
// abiertas, que RLS deja ver solo a is_admin()). Los clientes salen solo como
// zonas del «busco café», nunca como personas.

const BOGOTA = [-74.0817, 4.6497];
const STYLE_TIMEOUT_MS = 6000;
const EMPTY = { type: 'FeatureCollection', features: [] };
// Las pruebas lo acortan para no esperar 20 s
const pollMs = () => (typeof window !== 'undefined' && Number(window.__micraPanelPollMs)) || PANEL_POLL_MS;

async function loadPiloto(days) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(apiUrl(`/api/v1/bi/piloto?days=${days}`), { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || 'La API de Acero no respondió.');
  return data;
}

// Los puntos de las rutas en curso (los últimos 1000): el trazo de ahora y el punto exacto
async function loadLivePoints(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('tintero_route_points')
    .select('route_id,recorded_at,lat,lng')
    .in('route_id', ids)
    .order('recorded_at', { ascending: false })
    .limit(LIVE_POINTS_MAX);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Lee todo y lo refresca mientras la pantalla esté a la vista. */
function usePanelData(win) {
  const [state, setState] = useState({ piloto: null, live: null, points: [], sightings: [], at: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    let timer = 0;
    let tick = 0;
    let piloto = null;
    const days = windowDays(win);
    const visible = () => document.visibilityState !== 'hidden';
    const load = async () => {
      // El piloto (fichas, rutas, encuestas) cada tres vueltas; lo vivo en cada una
      const needPiloto = !piloto || tick % 3 === 0;
      tick += 1;
      try {
        if (needPiloto) piloto = await loadPiloto(days);
        const open = (piloto?.routes ?? []).filter((r) => !r.ended_at).map((r) => r.id);
        const [live, points, sightings] = await Promise.all([
          api.call('micra_live_map', {}).catch(() => null),
          loadLivePoints(open).catch(() => []),
          needPiloto ? api.sightings(days).catch(() => []) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setState((s) => ({ piloto, live: live ?? s.live, points, sightings: sightings ?? s.sightings, at: Date.now(), error: null, loading: false }));
      } catch (e) {
        if (alive) setState((s) => ({ ...s, error: e.message, loading: false }));
      }
    };
    const next = () => {
      clearTimeout(timer);
      if (!alive || !visible()) return;
      timer = setTimeout(() => { load().then(next); }, pollMs());
    };
    setState((s) => ({ ...s, loading: true }));
    load().then(next);
    const onVis = () => { if (!visible()) clearTimeout(timer); else load().then(next); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [win]);
  return state;
}

function applyTheme(map) {
  for (const [id, kind, prop, value] of themeChanges(map.getStyle()?.layers, 'plano')) {
    try {
      if (kind === 'paint') map.setPaintProperty(id, prop, value);
      else map.setLayoutProperty(id, prop, value);
    } catch { /* la capa que no admite el cambio se queda como venía */ }
  }
}

function addLayers(map) {
  const src = (id) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY }); };
  ['p-demanda', 'p-estudio', 'p-rutas', 'p-avist'].forEach(src);
  map.addLayer({ id: 'p-demanda', type: 'fill', source: 'p-demanda', paint: { 'fill-color': '#DE1B1B', 'fill-opacity': ['interpolate', ['linear'], ['get', 'w'], 0, 0.16, 1, 0.42] } });
  map.addLayer({ id: 'p-demanda-borde', type: 'line', source: 'p-demanda', paint: { 'line-color': '#DE1B1B', 'line-width': 1.2, 'line-opacity': 0.8 } });
  map.addLayer({
    id: 'p-estudio', type: 'circle', source: 'p-estudio',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 15, 8],
      'circle-color': ['case', ['get', 'survey'], '#1F2452', '#FFFFFF'],
      'circle-stroke-color': '#1F2452',
      'circle-stroke-width': 2,
    },
  });
  // El halo debajo hace que el trazo se lea sobre cualquier tesela
  map.addLayer({ id: 'p-rutas-halo', type: 'line', source: 'p-rutas', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 7, 'line-opacity': ['case', ['==', ['get', 'dim'], 1], 0.2, 0.9] } });
  map.addLayer({ id: 'p-rutas', type: 'line', source: 'p-rutas', filter: ['==', ['get', 'team'], 0], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['get', 'live'], 1], 4.5, 3.2], 'line-opacity': ['case', ['==', ['get', 'dim'], 1], 0.18, 0.95] } });
  map.addLayer({ id: 'p-rutas-equipo', type: 'line', source: 'p-rutas', filter: ['==', ['get', 'team'], 1], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [1.5, 1.5], 'line-opacity': ['case', ['==', ['get', 'dim'], 1], 0.18, 0.9] } });
  map.addLayer({ id: 'p-avist', type: 'circle', source: 'p-avist', paint: { 'circle-radius': 6, 'circle-color': '#B0127A', 'circle-opacity': 0.75, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
}

const LAYER_IDS = {
  demanda: ['p-demanda', 'p-demanda-borde'],
  estudio: ['p-estudio'],
  rutas: ['p-rutas-halo', 'p-rutas', 'p-rutas-equipo'],
  avistamientos: ['p-avist'],
};

function pinEl(p, onPick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `mpanel-pin is-${p.status}${p.tracking ? ' is-tracking' : ''}`;
  el.dataset.testid = 'panel-pin';
  el.setAttribute('aria-label', `${p.name}: ${STATUS_LABEL[p.status]}`);
  const dot = document.createElement('span');
  dot.textContent = initials(p.name);
  const tag = document.createElement('i');
  tag.textContent = p.name.split(' ')[0];
  el.append(dot, tag);
  el.addEventListener('click', (e) => { e.stopPropagation(); onPick(p.id); });
  return el;
}

/** El mapa: capas de MapLibre y los pines de las personas como botones. */
function PanelMap({ people, layers, routesGeo, study, demand, sightings, focus, fitTo, onPick, onState }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const markers = useRef([]);
  const [ready, setReady] = useState(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let map = null;
    let cancelled = false;
    let timer = 0;
    (async () => {
      let lib;
      try { lib = await import('../../shared/lib/maplibre.js'); } catch { if (!cancelled) onState('off'); return; }
      if (cancelled) return;
      if (!lib.hasWebGL()) { onState('off'); return; }
      libRef.current = lib;
      const { default: ml, STYLE_URL, OSM_STYLE } = lib;
      try {
        map = new ml.Map({ container: box.current, style: STYLE_URL, center: BOGOTA, zoom: 11.2, attributionControl: { compact: true } });
      } catch { onState('off'); return; }
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      let loaded = false;
      const fallback = () => { if (loaded) return; loaded = true; map.setStyle(OSM_STYLE); };
      timer = setTimeout(fallback, STYLE_TIMEOUT_MS);
      map.on('error', (e) => { if (!loaded && /style|fetch|Failed/i.test(String(e?.error?.message ?? e?.error ?? ''))) fallback(); });
      map.on('style.load', () => {
        clearTimeout(timer);
        loaded = true;
        applyTheme(map);
        if (!map.getLayer('p-estudio')) addLayers(map);
        mapRef.current = map;
        setReady(false);
        setReady(true);
        onState('ready');
      });
      // Tocar una ficha del estudio: su nombre, si tiene encuesta y el precio (sin notas ni fotos)
      map.on('click', 'p-estudio', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties;
        const div = document.createElement('div');
        div.className = 'mpanel-pop';
        const b = document.createElement('b');
        b.textContent = p.name;
        const s = document.createElement('span');
        s.textContent = [p.where, p.survey === true || p.survey === 'true' ? 'Con encuesta' : 'Sin encuesta', p.price ? `Tinto ${money(Number(p.price))}` : null].filter(Boolean).join(' · ');
        div.append(b, s);
        new ml.Popup({ closeButton: false, offset: 10 }).setLngLat(f.geometry.coordinates).setDOMContent(div).addTo(map);
      });
      map.on('mouseenter', 'p-estudio', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'p-estudio', () => { map.getCanvas().style.cursor = ''; });
    })();
    return () => { cancelled = true; clearTimeout(timer); markers.current.forEach((m) => m.remove()); markers.current = []; map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Datos de las capas
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource('p-rutas')?.setData(routesGeo);
    map.getSource('p-estudio')?.setData(study);
    map.getSource('p-demanda')?.setData(demand);
    map.getSource('p-avist')?.setData(sightings);
  }, [ready, routesGeo, study, demand, sightings]);

  // Qué capas se ven
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const [key, ids] of Object.entries(LAYER_IDS)) {
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layers[key] ? 'visible' : 'none');
    }
  }, [ready, layers]);

  // Los pines de las personas (solo las que tienen dónde ponerse)
  const pinKey = JSON.stringify([layers.vivo, focus, people.map((p) => [p.id, p.status, p.tracking, p.pos?.lat, p.pos?.lng])]);
  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current?.default;
    if (!ready || !map || !ml) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    if (!layers.vivo) return;
    // Los de «sin conexión» solo salen si se escogen: el mapa es de lo de ahora
    for (const p of people) {
      if (!p.pos || (p.status === 'off' && p.id !== focus)) continue;
      const el = pinEl(p, (id) => pickRef.current(id));
      if (focus && focus !== p.id) el.classList.add('is-dim');
      if (focus === p.id) el.classList.add('is-focus');
      markers.current.push(new ml.Marker({ element: el }).setLngLat([p.pos.lng, p.pos.lat]).addTo(map));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinKey]);

  // Encuadrar cuando se pide (al cargar, al escoger a alguien o con «Ver todo»)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !fitTo) return;
    const b = fitTo.bounds;
    if (!b) return;
    const same = b[0][0] === b[1][0] && b[0][1] === b[1][1];
    if (same) map.easeTo({ center: b[0], zoom: 15, duration: 500 });
    else map.fitBounds(b, { padding: 56, maxZoom: 16, duration: 500 });
  }, [ready, fitTo]);

  return <div className="mpanel-map" ref={box} role="region" aria-label="Mapa del panel: personas conectadas, rutas y estudio de calle" data-testid="panel-map" />;
}

export default function MapaPanel({ go }) {
  const [win, setWin] = useState('hoy');
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(null);
  const [mapState, setMapState] = useState('loading');
  const [fitTo, setFitTo] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const { piloto, live, points, sightings: seen, at, error, loading } = usePanelData(win);

  // El «hace X s» se mueve solo
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(id); }, []);

  const since = windowSince(win, at ?? now);
  const tracks = useMemo(() => routeTracks({ routes: piloto?.routes, livePoints: points, since, now: at ?? Date.now() }), [piloto, points, since, at]);
  const people = useMemo(() => panelPeople({ tinteros: piloto?.tinteros, tracks, live, since, now: at ?? Date.now() }), [piloto, tracks, live, since, at]);
  const study = useMemo(() => studyPoints(piloto?.tinteros, piloto?.surveys), [piloto]);
  const sight = useMemo(() => sightingPoints(seen, since), [seen, since]);
  const demand = useMemo(() => zonesGeoJSON(live, live?.min_count).demand, [live]);
  const routesGeo = useMemo(() => tracksGeoJSON(tracks, focus), [tracks, focus]);
  const kpis = panelKpis({ people, tracks, study, live, sightings: sight });
  const shown = searchPeople(people, query);
  const person = people.find((p) => p.id === focus) ?? null;
  const detail = personDetail(person, tracks, at ?? now);

  // El primer encuadre: lo que hay (personas, rutas y estudio)
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !piloto) return;
    // Primero lo de ahora (personas y rutas); el estudio entero solo si no hay nada más
    const current = [...people.filter((p) => p.pos && p.status !== 'off').map((p) => [p.pos.lng, p.pos.lat]), ...tracks.flatMap((t) => t.coords)];
    const bounds = boundsOf(current.length ? current : study.features.map((f) => f.geometry.coordinates));
    if (bounds) { framed.current = true; setFitTo({ bounds }); }
  }, [piloto, people, tracks, study]);

  const pick = useCallback((id) => {
    setFocus((cur) => (cur === id ? null : id));
  }, []);
  // Al escoger a alguien, el mapa va a su ruta y su punto
  useEffect(() => {
    if (!focus) return;
    const d = personDetail(people.find((p) => p.id === focus), tracks);
    const bounds = boundsOf(d?.coords);
    if (bounds) setFitTo({ bounds, id: focus });
    // Solo al cambiar de persona, no en cada refresco
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const fitAll = () => {
    setFocus(null);
    const bounds = boundsOf([...people.filter((p) => p.pos).map((p) => [p.pos.lng, p.pos.lat]), ...tracks.flatMap((t) => t.coords), ...study.features.map((f) => f.geometry.coordinates)]);
    if (bounds) setFitTo({ bounds, t: Date.now() });
  };

  const toggle = (key) => setLayers((l) => ({ ...l, [key]: !l[key] }));
  const updated = at ? agoLabel(at, now) : null;

  return (
    <div className="mpanel" data-testid="map-panel">
      <header className="mpanel-head">
        <div>
          <p className="mapp-kicker"><span className={`mpanel-dot ${error ? 'is-off' : ''}`} aria-hidden="true" />Equipo · en vivo</p>
          <h1 className="mpanel-title">Panel del mapa</h1>
          <p className="mpanel-sub" role="status" data-testid="panel-updated">
            {loading && !at ? 'Cargando a todos…' : error ? `Sin señal: vuelve a intentar solo. ${error}` : `Actualizado ${updated} · se refresca solo`}
          </p>
        </div>
        <div className="mpanel-win" role="group" aria-label="Qué tanto hacia atrás">
          {WINDOWS.map((w) => (
            <button key={w.key} type="button" aria-pressed={win === w.key} onClick={() => setWin(w.key)}>{w.label}</button>
          ))}
        </div>
      </header>

      <dl className="mpanel-kpis" data-testid="panel-kpis">
        <div className="is-hot"><dt>En la calle</dt><dd>{kpis.calle}</dd><small>{kpis.online} conectados</small></div>
        <div><dt>Rutas</dt><dd>{kpis.rutas}</dd><small>{kmLabel(kpis.km)}</small></div>
        <div><dt>Estudio</dt><dd>{kpis.fichas}</dd><small>{kpis.encuestas} con encuesta</small></div>
        <div><dt>Buscan café</dt><dd>{kpis.buscan}</dd><small>{kpis.zonas === 1 ? '1 zona' : `${kpis.zonas} zonas`}</small></div>
      </dl>

      <div className="mpanel-body">
        <div className="mpanel-mapwrap">
          <div className="mpanel-layers" role="group" aria-label="Capas del mapa">
            {LAYERS.map((l) => (
              <button key={l.key} type="button" aria-pressed={!!layers[l.key]} title={l.hint} onClick={() => toggle(l.key)} className={`is-${l.key}`} data-testid={`layer-${l.key}`}>
                <i aria-hidden="true" />{l.label}
              </button>
            ))}
          </div>
          {mapState === 'off'
            ? <p className="mpanel-nomap" role="note">Este navegador no dibuja el mapa (le falta WebGL). La lista sigue al día.</p>
            : <PanelMap people={people} layers={layers} routesGeo={routesGeo} study={study} demand={demand} sightings={sight} focus={focus} fitTo={fitTo} onPick={pick} onState={setMapState} />}
          <button type="button" className="mpanel-fit" onClick={fitAll}>Ver todo</button>
          <ul className="mpanel-legend" aria-label="Qué es cada color">
            <li><i className="is-now" />Ruta en curso</li>
            <li><i className="is-today" />Hoy</li>
            <li><i className="is-old" />Antes</li>
            <li><i className="is-study" />Ficha con encuesta</li>
            <li><i className="is-study-empty" />Sin encuesta</li>
          </ul>
        </div>

        <aside className="mpanel-side">
          {detail ? (
            <section className="mpanel-card mpanel-detail" aria-label={`Detalle de ${detail.name}`} data-testid="panel-detail">
              <div className="mpanel-detail-head">
                <span className={`mpanel-av is-${detail.status}`} aria-hidden="true">{initials(detail.name)}</span>
                <div>
                  <h2>{detail.name}</h2>
                  <p><span className={`mpanel-badge is-${detail.status}`}>{detail.statusLabel}</span> {detail.seenLabel !== 'nunca' && `· ${detail.seenLabel}`}</p>
                </div>
                <button type="button" className="mpanel-x" onClick={() => setFocus(null)} aria-label="Cerrar el detalle">×</button>
              </div>
              {detail.where && <p className="mpanel-muted">{detail.where}{detail.localidad && detail.localidad !== detail.where ? ` · ${detail.localidad}` : ''}</p>}
              <p className="mpanel-muted">
                {detail.posKind === 'gps' ? 'En el mapa: su último punto de GPS.' : detail.posKind === 'salida' ? 'En el mapa: donde salió a vender (unos 100 m).' : detail.posKind === 'ficha' ? 'En el mapa: el punto de su ficha.' : 'Sin punto en el mapa.'}
              </p>
              {detail.tracks.length === 0
                ? <p className="mpanel-muted">Sin rutas en {WINDOWS.find((w) => w.key === win).label.toLowerCase()}.</p>
                : (
                  <ul className="mpanel-tracks" aria-label="Sus rutas">
                    {detail.tracks.map((t) => (
                      <li key={t.id}>
                        <i style={{ background: t.color }} aria-hidden="true" />
                        <span>{t.live ? 'En curso' : new Date(t.when).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', hour: 'numeric', minute: '2-digit' })}{t.team ? ' · la levantó el equipo' : ''}</span>
                        <b>{t.km}</b>
                        <small>{t.dur}{t.stops ? ` · ${t.stops} ${t.stops === 1 ? 'parada' : 'paradas'}` : ''}</small>
                      </li>
                    ))}
                  </ul>
                )}
              {detail.linked && <button type="button" className="mapp-link" onClick={() => go?.(`/micra/b/${detail.id}`)}>Ver su tarjeta pública ›</button>}
            </section>
          ) : null}

          <section className="mpanel-card" aria-label="Personas">
            <label className="mapp-cota" htmlFor="mpanel-q">Personas · {people.length}</label>
            <input id="mpanel-q" className="mapp-search" type="search" placeholder="Nombre, lugar o «en la calle»" value={query} onChange={(e) => setQuery(e.target.value)} />
            {shown.length === 0
              ? <p className="mpanel-muted" role="status">{people.length === 0 ? 'Nadie conectado ni con rutas en este tiempo.' : 'Nadie con eso.'}</p>
              : (
                <ul className="mpanel-people" aria-label="Personas en el panel" data-testid="panel-people">
                  {shown.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => pick(p.id)} aria-pressed={focus === p.id}>
                        <span className={`mpanel-av is-${p.status}`} aria-hidden="true">{initials(p.name)}</span>
                        <span className="mpanel-who">
                          <b>{p.name}</b>
                          <small>{STATUS_LABEL[p.status]}{p.tracking ? ' · grabando ruta' : ''}{p.where ? ` · ${p.where}` : ''}</small>
                        </span>
                        <span className="mpanel-num">
                          {p.routes > 0 ? <b>{kmLabel(p.distance)}</b> : null}
                          <small>{agoLabel(p.lastSeen, at ?? now)}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          <p className="mpanel-fine">Los clientes nunca salen como personas: solo las zonas de unos 400 m donde 2 o más buscan café en los últimos 45 min. Los baristas salen porque aceptaron compartir su ubicación al salir a vender.</p>
        </aside>
      </div>
    </div>
  );
}
