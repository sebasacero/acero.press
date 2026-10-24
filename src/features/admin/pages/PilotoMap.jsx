import { useEffect, useRef, useState } from 'react';
import MapCanvas from '../../esspresale/MapCanvas.jsx';
import { salesGeoJSON, tinterosGeoJSON, tinterosHeatGeoJSON, groupPins, boundsOf, routesGeoJSON } from '../../../shared/lib/streetGeo.js';
import { themeChanges } from '../../../shared/lib/mapTheme.js';

// Mapa real del estudio (MapLibre + OpenStreetMap): mapa de calor de los tinteros
// (dónde se concentra el tinto) o de las ventas, y un pin por tintero con su ficha.
// Con `placing`, tocar el mapa ubica a un tintero que no tiene GPS ni cuadra.
// Sin WebGL o si MapLibre no carga, queda el mapa ilustrado de la portada.

const CHAPINERO = [-74.0585, 4.6565];
const STYLE_TIMEOUT_MS = 8000;

// Estilos del mapa: «plano» y «noche» visten el mapa real como el de la app
// (papel o pantalla oscura, con la retícula de la hoja); «calles» lo deja tal cual.
const MAP_THEMES = [['plano', 'Plano'], ['noche', 'Noche'], ['calles', 'Calles']];
const THEME_KEY = 'acero.piloto.mapTheme';
const savedTheme = () => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return MAP_THEMES.some(([id]) => id === t) ? t : 'plano';
  } catch {
    return 'plano';
  }
};

/** Viste las capas del estilo base con el tema (las del estudio no se tocan). */
function applyTheme(map, theme) {
  if (theme === 'calles') return;
  for (const [id, kind, prop, value] of themeChanges(map.getStyle()?.layers, theme)) {
    try {
      if (kind === 'paint') map.setPaintProperty(id, prop, value);
      else map.setLayoutProperty(id, prop, value);
    } catch { /* una capa que no admite el cambio se queda como venía */ }
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Degradado térmico del mapa ilustrado (azul → rojo), para los dos calores
const THERMAL = ['interpolate', ['linear'], ['heatmap-density'],
  0, 'rgba(43,43,209,0)', 0.15, 'rgb(43,43,209)', 0.3, 'rgb(0,179,230)', 0.5, 'rgb(38,208,124)',
  0.68, 'rgb(245,225,0)', 0.84, 'rgb(255,140,0)', 1, 'rgb(255,31,31)'];
const HEATS = [['tinteros', 'Calor: tinteros'], ['ventas', 'Calor: ventas']];

function addLayers(map, sales, routes, tinterosHeat, heat) {
  // Recorridos de Mi ruta debajo del calor: la línea es el camino, el punto la parada
  map.addSource('rutas', { type: 'geojson', data: routes.lines });
  map.addSource('paradas', { type: 'geojson', data: routes.stops });
  map.addLayer({
    id: 'rutas-linea',
    type: 'line',
    source: 'rutas',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#2A3550', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 5], 'line-opacity': 0.75 },
  });
  map.addLayer({
    id: 'rutas-paradas',
    type: 'circle',
    source: 'paradas',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'minutes'], 3, 5, 20, 11],
      'circle-color': '#F7F3E8',
      'circle-stroke-color': '#2A3550',
      'circle-stroke-width': 2.5,
    },
  });
  map.addSource('ventas', { type: 'geojson', data: sales });
  map.addLayer({
    id: 'ventas-calor',
    type: 'heatmap',
    source: 'ventas',
    maxzoom: 17,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.15, 1, 1],
      // Con pocas cuadras el calor tiene que verse igual: la que más vendió llega al rojo
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 14, 2.4, 16, 3.2],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 22, 14, 48, 16, 80],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.85, 17, 0.45],
      'heatmap-color': THERMAL,
    },
    layout: { visibility: heat === 'ventas' ? 'visible' : 'none' },
  });
  // Dónde se concentran los tinteros: varios puestos juntos se ven rojos
  map.addSource('tinteros-calor', { type: 'geojson', data: tinterosHeat });
  map.addLayer({
    id: 'tinteros-calor',
    type: 'heatmap',
    source: 'tinteros-calor',
    maxzoom: 18,
    paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 13, 1.8, 16, 2.6],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 18, 13, 36, 16, 70],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.9, 18, 0.5],
      'heatmap-color': THERMAL,
    },
    layout: { visibility: heat === 'tinteros' ? 'visible' : 'none' },
  });
  // De cerca, cada cuadra como un punto con su tamaño por tazas
  map.addLayer({
    id: 'ventas-cuadras',
    type: 'circle',
    source: 'ventas',
    minzoom: 15.5,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'weight'], 0, 4, 1, 9],
      'circle-color': '#E8201C',
      'circle-opacity': 0.85,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
    layout: { visibility: heat === 'ventas' ? 'visible' : 'none' },
  });
}

function pinElement(f) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `piloto-pin${f.properties.active ? ' is-active' : ''}`;
  el.setAttribute('aria-label', `Tintero: ${f.properties.label}`);
  el.innerHTML = `<i aria-hidden="true"></i><span>${esc(f.properties.label)}</span>`;
  return el;
}

export default function PilotoMap({ sales, tinteros, routes, fallbackView, label, withNames = true, placing = null, onPlace }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const baseRef = useRef(null); // el estilo base en uso (OpenFreeMap u OpenStreetMap)
  const [state, setState] = useState('loading'); // loading · ready · fallback
  const [style, setStyle] = useState('vector'); // vector · osm
  const [theme, setTheme] = useState(savedTheme);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const [heat, setHeat] = useState('tinteros');
  const heatRef = useRef(heat);
  heatRef.current = heat;
  const placeRef = useRef(null);
  placeRef.current = placing && onPlace ? onPlace : null;
  const salesGeo = salesGeoJSON(sales);
  // En la presentación (la ve el distribuidor) los pines no llevan nombres
  const tinterosGeo = tinterosGeoJSON(tinteros, { withNames });
  // Los recorridos solo en el panel (llevan el nombre del tintero)
  const routesGeo = routesGeoJSON(withNames ? routes : [], tinteros);
  const tinterosHeat = tinterosHeatGeoJSON(tinteros);
  const routePoints = { features: routesGeo.lines.features.flatMap((f) => f.geometry.coordinates.map((c) => ({ geometry: { coordinates: c } }))) };
  const dataKey = JSON.stringify([salesGeo, tinterosGeo, routesGeo]);

  useEffect(() => {
    let map = null;
    let cancelled = false;
    let styleTimer = 0;
    const markers = [];
    (async () => {
      let lib;
      try {
        lib = await import('../../../shared/lib/maplibre.js');
      } catch {
        if (!cancelled) setState('fallback');
        return;
      }
      if (cancelled) return;
      if (!lib.hasWebGL()) { setState('fallback'); return; }
      const { default: ml, STYLE_URL, OSM_STYLE } = lib;
      const bounds = boundsOf(salesGeo, tinterosGeo, routePoints);
      baseRef.current = STYLE_URL;
      try {
        map = new ml.Map({
          container: box.current,
          style: STYLE_URL,
          center: CHAPINERO,
          zoom: 13,
          attributionControl: { compact: true },
          cooperativeGestures: true, // en el celular la página sigue bajando con un dedo
        });
      } catch {
        setState('fallback');
        return;
      }
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      let loaded = false;
      const onStyleError = () => {
        if (loaded) return;
        loaded = true;
        setStyle('osm');
        baseRef.current = OSM_STYLE;
        map.setStyle(OSM_STYLE);
      };
      // Si OpenFreeMap no contesta a tiempo, OpenStreetMap
      styleTimer = setTimeout(onStyleError, STYLE_TIMEOUT_MS);
      map.on('error', (e) => { if (!loaded && /style|fetch|Failed/i.test(String(e?.error?.message ?? e?.error ?? ''))) onStyleError(); });
      let framed = false;
      // Cada estilo nuevo (el base, la caída a OpenStreetMap o un cambio de tema)
      // llega sin las capas del estudio: se vuelven a poner y se viste el mapa
      map.on('style.load', () => {
        clearTimeout(styleTimer);
        loaded = true;
        applyTheme(map, themeRef.current);
        if (!map.getSource('ventas')) addLayers(map, salesGeo, routesGeo, tinterosHeat, heatRef.current);
        if (framed) return;
        framed = true;
        if (bounds) {
          const [[w, s], [e, n]] = bounds;
          const single = w === e && s === n;
          if (single) map.jumpTo({ center: [w, s], zoom: 15 });
          else map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
        }
        const card = (p) => `<b>${esc(p.name ?? p.label)}</b><span>${esc(p.place)}</span><span>${esc(p.detail)}</span>${p.notes ? `<small>${esc(p.notes)}</small>` : ''}`;
        for (const f of groupPins(tinterosGeo.features)) {
          const p = f.properties;
          // Varios puestos pegados: un pin y en su ficha todos, uno debajo del otro
          const popup = new ml.Popup({ offset: 18, closeButton: true, className: 'piloto-popup' }).setHTML(
            p.group ? p.group.map(card).join('<hr />') : card(p),
          );
          markers.push(new ml.Marker({ element: pinElement(f), anchor: 'bottom' }).setLngLat(f.geometry.coordinates).setPopup(popup).addTo(map));
        }
        // Ubicar a mano: el toque en el mapa es el lugar del tintero
        map.on('click', (e) => { placeRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
        // Tocar una parada: quién, a qué hora y cuánto se quedó
        map.on('click', 'rutas-paradas', (e) => {
          const f = e.features?.[0];
          if (f) new ml.Popup({ offset: 10, className: 'piloto-popup' }).setLngLat(f.geometry.coordinates).setHTML(`<span>${esc(f.properties.label)}</span>`).addTo(map);
        });
        mapRef.current = map;
        if (box.current) box.current.__map = map; // para las pruebas de navegador
        setState('ready');
      });
    })();
    return () => {
      cancelled = true;
      clearTimeout(styleTimer);
      markers.forEach((m) => m.remove());
      map?.remove();
      mapRef.current = null;
    };
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calor de tinteros o de ventas: solo se prende y apaga la capa
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('tinteros-calor')) return;
    map.setLayoutProperty('tinteros-calor', 'visibility', heat === 'tinteros' ? 'visible' : 'none');
    for (const id of ['ventas-calor', 'ventas-cuadras']) map.setLayoutProperty(id, 'visibility', heat === 'ventas' ? 'visible' : 'none');
  }, [heat, state]);
  // Ubicando a un tintero: cursor de mira
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = placing ? 'crosshair' : '';
  }, [placing, state]);

  // Cambiar de tema: se recarga el estilo base y style.load lo viste de nuevo
  const firstTheme = useRef(true);
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* sin almacenamiento, solo esta vez */ }
    if (firstTheme.current) { firstTheme.current = false; return; }
    const map = mapRef.current;
    if (map && baseRef.current) map.setStyle(baseRef.current);
  }, [theme]);

  return (
    <div
      className={`piloto-geo is-${state} is-${theme}`}
      data-state={state}
      data-style={style}
      data-theme={theme}
      data-sales={salesGeo.features.length}
      data-tinteros={tinterosGeo.features.length}
      data-heat={heat}
      data-routes={routesGeo.lines.features.length}
      data-stops={routesGeo.stops.features.length}
      role="region"
      aria-label={label}
    >
      {state === 'fallback' ? <MapCanvas view={fallbackView} redrawKey={dataKey} label={label} /> : (
        <>
          <div ref={box} className="piloto-geo-map" />
          {/* La hoja de plano encima: retícula y doble marco, sin tapar los toques */}
          {theme !== 'calles' && <div className="piloto-geo-sheet" aria-hidden="true" />}
          <div className="piloto-geo-themes" role="group" aria-label="Estilo del mapa">
            {MAP_THEMES.map(([id, name]) => (
              <button key={id} type="button" aria-pressed={theme === id} className={theme === id ? 'on' : undefined} onClick={() => setTheme(id)}>{name}</button>
            ))}
          </div>
          <div className="piloto-geo-themes piloto-geo-heat" role="group" aria-label="Mapa de calor">
            {HEATS.map(([id, name]) => (
              <button key={id} type="button" aria-pressed={heat === id} className={heat === id ? 'on' : undefined} onClick={() => setHeat(id)}>{name}</button>
            ))}
          </div>
          {placing && <p className="piloto-geo-placing" role="status">Toca el mapa donde está {placing}</p>}
        </>
      )}
    </div>
  );
}
