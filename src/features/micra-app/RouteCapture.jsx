import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { themeChanges } from '../../shared/lib/mapTheme.js';
import { acceptFix, fromPosition, distanceOf, km } from '../ruta/track.js';
import { newRef } from './micraApp.js';
import { teamRouteBody } from './routeStudy.js';
import platform from './platform.js';

// El recorrido de un carrito en el estudio (desde la ficha rápida): o lo que el
// tintero cuenta, tocando las calles en el mapa, o acompañándolo unas cuadras
// con el GPS del celular. Va a tintero_route_team (solo el equipo).

const STYLE_TIMEOUT_MS = 6000;
const lineOf = (pts) => ({ type: 'FeatureCollection', features: pts.length < 2 ? [] : [{ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) }, properties: {} }] });
const dotsOf = (pts) => ({ type: 'FeatureCollection', features: pts.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { i } })) });

export default function RouteCapture({ tintero, start, onClose, onSaved }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const [mapState, setMapState] = useState('loading');
  const [mode, setMode] = useState(null); // 'relato' | 'acompanado'
  const [points, setPoints] = useState([]);
  const [walking, setWalking] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const stopRef = useRef(null);
  const refRef = useRef(newRef('r'));

  // El mapa, centrado en el puesto; un toque agrega un punto cuando se está marcando lo que cuenta
  useEffect(() => {
    let map = null;
    let cancelled = false;
    let timer = 0;
    (async () => {
      let lib;
      try { lib = await import('../../shared/lib/maplibre.js'); } catch { if (!cancelled) setMapState('off'); return; }
      if (cancelled || !lib.hasWebGL()) { setMapState('off'); return; }
      const { default: ml, STYLE_URL, OSM_STYLE } = lib;
      const center = start ? [start.lng, start.lat] : [-74.0636, 4.6431];
      try { map = new ml.Map({ container: box.current, style: STYLE_URL, center, zoom: 15.5, attributionControl: { compact: true } }); } catch { setMapState('off'); return; }
      let loaded = false;
      const fallback = () => { if (loaded) return; loaded = true; map.setStyle(OSM_STYLE); };
      timer = setTimeout(fallback, STYLE_TIMEOUT_MS);
      map.on('style.load', () => {
        clearTimeout(timer);
        loaded = true;
        for (const [id, kind, prop, value] of themeChanges(map.getStyle()?.layers, 'noche')) {
          try { if (kind === 'paint') map.setPaintProperty(id, prop, value); else map.setLayoutProperty(id, prop, value); } catch { /* se queda como venía */ }
        }
        if (!map.getSource('ruta')) {
          map.addSource('ruta', { type: 'geojson', data: lineOf([]) });
          map.addSource('ruta-puntos', { type: 'geojson', data: dotsOf([]) });
          map.addLayer({ id: 'ruta', type: 'line', source: 'ruta', paint: { 'line-color': '#DE1B1B', 'line-width': 5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
          map.addLayer({ id: 'ruta-puntos', type: 'circle', source: 'ruta-puntos', paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': '#DE1B1B', 'circle-stroke-width': 3 } });
        }
        mapRef.current = map;
        setMapState('ready');
      });
      map.on('click', (e) => {
        if (modeRef.current !== 'relato') return;
        setPoints((p) => [...p, { lng: Math.round(e.lngLat.lng * 1e6) / 1e6, lat: Math.round(e.lngLat.lat * 1e6) / 1e6 }]);
      });
    })();
    return () => { cancelled = true; clearTimeout(timer); stopRef.current?.(); map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (mapState !== 'ready' || !map) return;
    map.getSource('ruta')?.setData(lineOf(points));
    map.getSource('ruta-puntos')?.setData(dotsOf(mode === 'relato' ? points : points.slice(-1)));
    if (mode === 'acompanado' && points.length) map.easeTo({ center: [points.at(-1).lng, points.at(-1).lat], duration: 400 });
  }, [points, mapState, mode]);

  const walk = () => {
    setError(null);
    setWalking(true);
    setNote('Buscando el GPS…');
    stopRef.current = platform.watch((pos) => {
      const fix = fromPosition(pos);
      setPoints((prev) => {
        const last = prev.at(-1);
        const { keep, reason } = acceptFix(last ? { t: last.t, lat: last.lat, lng: last.lng, acc: null } : null, fix);
        setNote(keep ? null : reason === 'impreciso' ? 'Señal débil: el punto no se guardó.' : null);
        return keep ? [...prev, fix] : prev;
      });
    }, () => setNote('El GPS no responde: revisa el permiso de ubicación.'));
  };
  const stopWalk = () => { stopRef.current?.(); stopRef.current = null; setWalking(false); setNote(null); };

  const save = async () => {
    if (walking) stopWalk();
    const { body, error: e } = teamRouteBody({ tinteroId: tintero?.id, source: mode, points, ref: refRef.current });
    if (e) { setError(e); return; }
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc('tintero_route_team', body);
    setBusy(false);
    if (rpcErr) { setError(/function|does not exist|schema cache/i.test(rpcErr.message) ? 'La base aún no tiene los recorridos del equipo (falta la migración).' : rpcErr.message); return; }
    onSaved({ id: data?.id, distance: body.p_distance_m });
  };

  return (
    <div className="mff mff-screen" data-screen="recorrido">
      <header className="mff-top">
        <button type="button" className="mff-back" onClick={() => { stopWalk(); onClose(); }} aria-label="Atrás">‹</button>
        <span className="mff-step">Su recorrido · opcional</span>
        <span className="mff-gps">{points.length > 1 ? km(distanceOf(points)) : `${points.length} pts`}</span>
      </header>
      <div className="mrc-map" ref={box} data-testid="route-map" role="region" aria-label="Mapa del recorrido" />
      {mapState === 'off' && <p className="msheet-fine is-warn mrc-off">El mapa no carga en este celular. Puedes acompañarlo con el GPS igual.</p>}
      <div className="mff-body mrc-body">
        {!mode ? (
          <>
            <p className="mapp-muted">¿Por dónde pasa {tintero?.name ? tintero.name.replace(/^Puesto · /, 'este puesto') : 'el carrito'} durante el día?</p>
            <div className="mff-extras">
              <button type="button" className="mff-extra" onClick={() => setMode('relato')} disabled={mapState === 'off'} data-testid="route-relato"><b>Lo que cuenta</b><small>pregúntale y toca las calles en el mapa</small></button>
              <button type="button" className="mff-extra" onClick={() => { setMode('acompanado'); walk(); }} data-testid="route-acompanado"><b>Acompañarlo</b><small>camina con él: tu GPS graba el trazo</small></button>
            </div>
          </>
        ) : mode === 'relato' ? (
          <p className="mapp-muted">Toca en el mapa, en orden, las esquinas por donde pasa. {points.length > 0 && <button type="button" className="mapp-link" onClick={() => setPoints((p) => p.slice(0, -1))}>Quitar el último</button>}</p>
        ) : (
          <p className="mapp-muted">{walking ? 'Grabando mientras caminas. Puedes guardar en cualquier momento.' : 'Pausado.'} {!walking && <button type="button" className="mapp-link" onClick={walk}>Seguir</button>}</p>
        )}
        {note && <p className="msheet-fine is-warn" role="status">{note}</p>}
        {error && <p className="msheet-notice is-err" role="alert">{error}</p>}
      </div>
      {mode && (
        <footer className="mff-foot">
          <button type="button" className="mapp-btn is-ghost" onClick={() => { stopWalk(); setPoints([]); setMode(null); }}>Cambiar</button>
          <button type="button" className="mapp-btn is-cta is-big" disabled={busy || points.length < 2} onClick={save} data-testid="route-save">{busy ? 'Guardando…' : 'Guardar recorrido'}</button>
        </footer>
      )}
    </div>
  );
}
