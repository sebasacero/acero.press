import { useEffect, useRef, useState } from 'react';
import { themeChanges } from '../../shared/lib/mapTheme.js';
import { heatPoints } from './study.js';
import { routeSectors } from './routeStudy.js';

// Mapa de calor del estudio de calle (equipo): dónde están los vendedores que
// ya mapeamos. Lejos se ve el calor (azul → rojo, el mismo degradado del mapa
// del panel); de cerca, cada puesto como un punto. MapLibre se carga aparte.

const BOGOTA = [-74.0817, 4.6097];
const STYLE_TIMEOUT_MS = 6000;

function applyTheme(map, theme) {
  for (const [id, kind, prop, value] of themeChanges(map.getStyle()?.layers, theme)) {
    try {
      if (kind === 'paint') map.setPaintProperty(id, prop, value);
      else map.setLayoutProperty(id, prop, value);
    } catch { /* la capa que no admite el cambio se queda como venía */ }
  }
}

const RAMP = ['interpolate', ['linear'], ['heatmap-density'],
  0, 'rgba(43,43,209,0)', 0.15, 'rgb(43,43,209)', 0.3, 'rgb(0,179,230)', 0.5, 'rgb(38,208,124)',
  0.68, 'rgb(245,225,0)', 0.84, 'rgb(255,140,0)', 1, 'rgb(255,31,31)'];

// Recorridos: el calor sale de los sectores (cuántos carritos distintos pasan) y encima los trazos
function addRouteLayers(map, sectors) {
  map.addSource('sectores', { type: 'geojson', data: sectors.cells });
  map.addSource('trazos', { type: 'geojson', data: sectors.lines });
  map.addLayer({
    id: 'sectores-calor', type: 'heatmap', source: 'sectores', maxzoom: 17,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 13, 1.6, 16, 2.4],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 16, 13, 34, 16, 90],
      'heatmap-opacity': 0.8,
      'heatmap-color': RAMP,
    },
  });
  map.addLayer({
    id: 'trazos', type: 'line', source: 'trazos', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#fff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 3], 'line-opacity': 0.55 },
  });
}

function addLayers(map, data) {
  map.addSource('fichas', { type: 'geojson', data });
  map.addLayer({
    id: 'fichas-calor',
    type: 'heatmap',
    source: 'fichas',
    maxzoom: 17,
    paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 13, 2, 16, 3],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 18, 13, 36, 16, 70],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.85, 17, 0.4],
      'heatmap-color': RAMP,
    },
  });
  map.addLayer({
    id: 'fichas-puntos',
    type: 'circle',
    source: 'fichas',
    minzoom: 14.5,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'weight'], 0.3, 5, 1, 9],
      'circle-color': '#DE1B1B',
      'circle-opacity': 0.9,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });
}

function frame(map, data) {
  const pts = data.features.map((f) => f.geometry.coordinates);
  if (pts.length === 1) map.jumpTo({ center: pts[0], zoom: 14 });
  else if (pts.length > 1) {
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 40, maxZoom: 14, duration: 0 });
  }
}

export default function StudyHeatMap({ rows, routes = [], theme = 'noche' }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const [state, setState] = useState('loading');
  const [mode, setMode] = useState('puestos'); // puestos | recorridos
  const data = heatPoints(rows);
  const dataRef = useRef(data);
  dataRef.current = data;
  const sectors = routeSectors(routes);
  const sectorsRef = useRef(sectors);
  sectorsRef.current = sectors;

  useEffect(() => {
    let map = null;
    let cancelled = false;
    let timer = 0;
    (async () => {
      let lib;
      try { lib = await import('../../shared/lib/maplibre.js'); } catch { if (!cancelled) setState('off'); return; }
      if (cancelled) return;
      if (!lib.hasWebGL()) { setState('off'); return; }
      const { default: ml, STYLE_URL, OSM_STYLE } = lib;
      try {
        map = new ml.Map({ container: box.current, style: STYLE_URL, center: BOGOTA, zoom: 11, attributionControl: { compact: true }, cooperativeGestures: true });
      } catch { setState('off'); return; }
      let loaded = false;
      const fallback = () => { if (loaded) return; loaded = true; map.setStyle(OSM_STYLE); };
      timer = setTimeout(fallback, STYLE_TIMEOUT_MS);
      map.on('error', (e) => { if (!loaded && /style|fetch|Failed/i.test(String(e?.error?.message ?? e?.error ?? ''))) fallback(); });
      map.on('style.load', () => {
        clearTimeout(timer);
        loaded = true;
        applyTheme(map, theme);
        // Un cambio de estilo (el respaldo de OSM) borra las capas: se vuelven a poner
        if (!map.getSource('fichas')) addLayers(map, dataRef.current);
        if (!map.getSource('sectores')) addRouteLayers(map, sectorsRef.current);
        frame(map, dataRef.current);
        mapRef.current = map;
        setState('ready');
      });
    })();
    return () => { cancelled = true; clearTimeout(timer); map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fichas nuevas (la que se acaba de guardar): el calor se actualiza sin volver a crear el mapa
  const key = data.features.map((f) => `${f.properties.id}:${f.geometry.coordinates.join(',')}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (state !== 'ready' || !map) return;
    map.getSource('fichas')?.setData(dataRef.current);
  }, [key, state]);

  const routesKey = `${routes.length}:${sectors.cells.features.length}`;
  useEffect(() => {
    const map = mapRef.current;
    if (state !== 'ready' || !map) return;
    map.getSource('sectores')?.setData(sectorsRef.current.cells);
    map.getSource('trazos')?.setData(sectorsRef.current.lines);
  }, [routesKey, state]);

  // Un modo a la vez: los puestos mapeados o los sectores que recorren
  useEffect(() => {
    const map = mapRef.current;
    if (state !== 'ready' || !map) return;
    const show = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
    show('fichas-calor', mode === 'puestos');
    show('fichas-puntos', mode === 'puestos');
    show('sectores-calor', mode === 'recorridos');
    show('trazos', mode === 'recorridos');
  }, [mode, state]);

  if (state === 'off') return null;
  return (
    <figure className="mapp-heat">
      <div className="mapp-heat-modes" role="group" aria-label="Qué muestra el mapa">
        <button type="button" aria-pressed={mode === 'puestos'} onClick={() => setMode('puestos')}>Puestos</button>
        <button type="button" aria-pressed={mode === 'recorridos'} onClick={() => setMode('recorridos')} data-testid="heat-routes">Recorridos</button>
      </div>
      <div className="mapp-map is-heat" ref={box} data-testid="study-heatmap" role="region"
        aria-label={mode === 'puestos' ? `Mapa de calor del estudio: ${data.features.length} puestos con GPS` : `Sectores que recorren ${sectors.carts} carritos`} />
      <figcaption className="mapp-heat-legend">
        <span>Menos</span><i aria-hidden="true" /><span>{mode === 'puestos' ? 'Más vendedores' : 'Más carritos pasan'}</span>
        <b>{mode === 'puestos' ? `${data.features.length} con GPS` : `${sectors.carts} carritos · ${routes.length} recorridos`}</b>
      </figcaption>
      {mode === 'recorridos' && (routes.length === 0
        ? <p className="mapp-muted">Aún no hay recorridos. En la ficha de un carrito toca «Su recorrido».</p>
        : sectors.top[0]?.carts > 1 && <p className="mapp-heat-top">El sector más recorrido: {sectors.top[0].carts} carritos distintos.</p>)}
    </figure>
  );
}
