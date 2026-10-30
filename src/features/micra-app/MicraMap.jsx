import { useEffect, useRef, useState } from 'react';
import { themeChanges } from '../../shared/lib/mapTheme.js';
import { initials } from './micraApp.js';

// El mapa del cliente: dónde suele estar cada barista (el punto de su ficha o,
// si avisó que salió, el de ese momento, redondeado a una cuadra). MapLibre se
// carga aparte; sin WebGL o sin red el mapa no sale y la lista basta.

const CHAPINERO = [-74.0636, 4.6431];
const STYLE_TIMEOUT_MS = 6000;

function applyTheme(map, theme) {
  for (const [id, kind, prop, value] of themeChanges(map.getStyle()?.layers, theme)) {
    try {
      if (kind === 'paint') map.setPaintProperty(id, prop, value);
      else map.setLayoutProperty(id, prop, value);
    } catch { /* la capa que no admite el cambio se queda como venía */ }
  }
}

function pin(b, onPick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `mapp-pin is-${b.status}`;
  el.textContent = b.n ?? initials(b.name);
  el.setAttribute('aria-label', `Ver a ${b.name}`);
  el.addEventListener('click', (e) => { e.stopPropagation(); onPick(b.id); });
  return el;
}

export default function MicraMap({ baristas, me, theme, onPick, big = false }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const markers = useRef([]);
  const [state, setState] = useState('loading');
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let map = null;
    let cancelled = false;
    let timer = 0;
    (async () => {
      let lib;
      try { lib = await import('../../shared/lib/maplibre.js'); } catch { if (!cancelled) setState('off'); return; }
      if (cancelled) return;
      if (!lib.hasWebGL()) { setState('off'); return; }
      libRef.current = lib;
      const { default: ml, STYLE_URL, OSM_STYLE } = lib;
      try {
        map = new ml.Map({ container: box.current, style: STYLE_URL, center: CHAPINERO, zoom: 13, attributionControl: { compact: true }, cooperativeGestures: true });
      } catch { setState('off'); return; }
      let loaded = false;
      const fallback = () => { if (loaded) return; loaded = true; map.setStyle(OSM_STYLE); };
      timer = setTimeout(fallback, STYLE_TIMEOUT_MS);
      map.on('error', (e) => { if (!loaded && /style|fetch|Failed/i.test(String(e?.error?.message ?? e?.error ?? ''))) fallback(); });
      map.on('style.load', () => {
        clearTimeout(timer);
        loaded = true;
        applyTheme(map, theme);
        mapRef.current = map;
        if (box.current) box.current.__map = map;
        setState('ready');
      });
    })();
    return () => { cancelled = true; clearTimeout(timer); markers.current.forEach((m) => m.remove()); map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (state === 'ready') applyTheme(mapRef.current, theme); }, [theme, state]);

  // Pines y encuadre cada vez que cambia la lista
  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current?.default;
    if (state !== 'ready' || !map || !ml) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const placed = (baristas ?? []).filter((b) => b.lat != null && b.lng != null);
    for (const b of placed) {
      markers.current.push(new ml.Marker({ element: pin(b, (id) => pickRef.current?.(id)), anchor: 'center' }).setLngLat([Number(b.lng), Number(b.lat)]).addTo(map));
    }
    if (me) {
      const dot = document.createElement('span');
      dot.className = 'mapp-me';
      dot.setAttribute('aria-label', 'Tú');
      markers.current.push(new ml.Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(map));
    }
    const pts = [...placed.map((b) => [Number(b.lng), Number(b.lat)]), ...(me ? [[me.lng, me.lat]] : [])];
    if (pts.length === 1) map.jumpTo({ center: pts[0], zoom: 15 });
    else if (pts.length > 1) {
      const lngs = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: big ? { top: 76, bottom: 40, left: 40, right: 40 } : 48, maxZoom: 15, duration: 0 }); // en el grande, las bebidas van arriba
    }
  }, [baristas, me, state, big]);

  if (state === 'off') return null;
  return <div className={`mapp-map${big ? ' is-big' : ''}`} ref={box} data-testid="micra-map" aria-label="Mapa de los baristas" role="region" />;
}
