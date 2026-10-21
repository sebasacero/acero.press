import { useEffect, useRef, useState } from 'react';
import MapCanvas from '../../esspresale/MapCanvas.jsx';
import { salesGeoJSON, tinterosGeoJSON, boundsOf } from '../../../shared/lib/streetGeo.js';

// Mapa real del piloto (MapLibre + OpenStreetMap): calor de las ventas por
// cuadra y un pin por tintero con su ficha. Es la vista que tendrá la app.
// Sin WebGL o si MapLibre no carga, queda el mapa ilustrado de la portada.

const CHAPINERO = [-74.0585, 4.6565];
const STYLE_TIMEOUT_MS = 8000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function addLayers(map, sales) {
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
      // Mismo degradado térmico que el mapa ilustrado (azul → rojo)
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(43,43,209,0)', 0.15, 'rgb(43,43,209)', 0.3, 'rgb(0,179,230)', 0.5, 'rgb(38,208,124)',
        0.68, 'rgb(245,225,0)', 0.84, 'rgb(255,140,0)', 1, 'rgb(255,31,31)'],
    },
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

export default function PilotoMap({ sales, tinteros, fallbackView, label }) {
  const box = useRef(null);
  const [state, setState] = useState('loading'); // loading · ready · fallback
  const [style, setStyle] = useState('vector'); // vector · osm
  const salesGeo = salesGeoJSON(sales);
  const tinterosGeo = tinterosGeoJSON(tinteros, { withNames: true });
  const dataKey = JSON.stringify([salesGeo, tinterosGeo]);

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
      const bounds = boundsOf(salesGeo, tinterosGeo);
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
        map.setStyle(OSM_STYLE);
      };
      // Si OpenFreeMap no contesta a tiempo, OpenStreetMap
      styleTimer = setTimeout(onStyleError, STYLE_TIMEOUT_MS);
      map.on('error', (e) => { if (!loaded && /style|fetch|Failed/i.test(String(e?.error?.message ?? e?.error ?? ''))) onStyleError(); });
      map.on('style.load', () => {
        clearTimeout(styleTimer);
        loaded = true;
        if (map.getSource('ventas')) return;
        addLayers(map, salesGeo);
        if (bounds) {
          const [[w, s], [e, n]] = bounds;
          const single = w === e && s === n;
          if (single) map.jumpTo({ center: [w, s], zoom: 15 });
          else map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
        }
        for (const f of tinterosGeo.features) {
          const p = f.properties;
          const popup = new ml.Popup({ offset: 18, closeButton: true, className: 'piloto-popup' }).setHTML(
            `<b>${esc(p.name ?? p.label)}</b><span>${esc(p.place)}</span><span>${esc(p.detail)}</span>${p.notes ? `<small>${esc(p.notes)}</small>` : ''}`,
          );
          markers.push(new ml.Marker({ element: pinElement(f), anchor: 'bottom' }).setLngLat(f.geometry.coordinates).setPopup(popup).addTo(map));
        }
        setState('ready');
      });
    })();
    return () => {
      cancelled = true;
      clearTimeout(styleTimer);
      markers.forEach((m) => m.remove());
      map?.remove();
    };
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`piloto-geo is-${state}`}
      data-state={state}
      data-style={style}
      data-sales={salesGeo.features.length}
      data-tinteros={tinterosGeo.features.length}
      role="region"
      aria-label={label}
    >
      {state === 'fallback' ? <MapCanvas view={fallbackView} redrawKey={dataKey} label={label} /> : <div ref={box} className="piloto-geo-map" />}
    </div>
  );
}
