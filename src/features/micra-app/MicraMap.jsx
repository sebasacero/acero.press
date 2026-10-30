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

// Las zonas del mapa en vivo (liveMap.js): demanda en rojo, estudio en tinta
// (azul oscuro en Plano, crema en Noche), así se distinguen también por lo claro
const ZONE = {
  plano: { demand: '#DE1B1B', study: '#1F2452' },
  noche: { demand: '#DE1B1B', study: '#EDE6D3' },
};
const EMPTY = { type: 'FeatureCollection', features: [] };
// Qué hay que volver a pintar: quién, dónde y con qué número (no la identidad del arreglo)
const frameKey = (baristas, me) => JSON.stringify([(baristas ?? []).map((b) => [b.id, b.lat, b.lng, b.status, b.n, b.name]), me ? [me.lat, me.lng] : null]);

function ensureZones(map, theme) {
  const Z = ZONE[theme] ?? ZONE.plano;
  if (!map.getSource('zonas-estudio')) {
    map.addSource('zonas-estudio', { type: 'geojson', data: EMPTY });
    map.addSource('zonas-demanda', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'zonas-estudio', type: 'fill', source: 'zonas-estudio', paint: { 'fill-color': Z.study, 'fill-opacity': ['interpolate', ['linear'], ['get', 'w'], 0, 0.1, 1, 0.26] } });
    map.addLayer({ id: 'zonas-estudio-borde', type: 'line', source: 'zonas-estudio', paint: { 'line-color': Z.study, 'line-opacity': 0.45, 'line-width': 1, 'line-dasharray': [2, 2] } });
    map.addLayer({ id: 'zonas-demanda', type: 'fill', source: 'zonas-demanda', paint: { 'fill-color': Z.demand, 'fill-opacity': ['interpolate', ['linear'], ['get', 'w'], 0, 0.22, 1, 0.5] } });
    map.addLayer({ id: 'zonas-demanda-borde', type: 'line', source: 'zonas-demanda', paint: { 'line-color': Z.demand, 'line-opacity': 0.9, 'line-width': 1.5 } });
  } else {
    for (const [id, prop, v] of [['zonas-estudio', 'fill-color', Z.study], ['zonas-estudio-borde', 'line-color', Z.study], ['zonas-demanda', 'fill-color', Z.demand], ['zonas-demanda-borde', 'line-color', Z.demand]]) {
      try { map.setPaintProperty(id, prop, v); } catch { /* sin la capa */ }
    }
  }
}

function pin(b, onPick, named = false) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `mapp-pin is-${b.status ?? 'live'}${named ? ' is-named' : ''}`;
  el.textContent = b.n ?? initials(b.name);
  if (named) {
    const tag = document.createElement('span');
    tag.className = 'mapp-pin-name';
    tag.textContent = b.name;
    el.append(tag);
  }
  el.setAttribute('aria-label', `Ver a ${b.name}`);
  el.addEventListener('click', (e) => { e.stopPropagation(); onPick(b.id); });
  return el;
}

/**
 * `zones` ({ demand, study } en GeoJSON, de liveMap.zonesGeoJSON) pinta las
 * zonas del mapa en vivo; `named` pone el nombre junto al pin; `label` es el
 * nombre del mapa para los lectores de pantalla.
 */
export default function MicraMap({ baristas, me, theme, onPick, big = false, zones = null, named = false, label = 'Mapa de los baristas', testId = 'micra-map' }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const markers = useRef([]);
  const [state, setState] = useState('loading');
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const themeRef = useRef(theme);
  themeRef.current = theme;

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
        applyTheme(map, themeRef.current);
        // El respaldo de OSM cambia el estilo y borra las capas: se vuelven a poner
        if (zonesRef.current) {
          ensureZones(map, themeRef.current);
          map.getSource('zonas-estudio').setData(zonesRef.current.study ?? EMPTY);
          map.getSource('zonas-demanda').setData(zonesRef.current.demand ?? EMPTY);
        }
        mapRef.current = map;
        if (box.current) box.current.__map = map;
        setState('ready');
      });
    })();
    return () => { cancelled = true; clearTimeout(timer); markers.current.forEach((m) => m.remove()); map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state !== 'ready') return;
    applyTheme(mapRef.current, theme);
    if (zonesRef.current) ensureZones(mapRef.current, theme);
  }, [theme, state]);

  // Las zonas se actualizan sin volver a crear el mapa (cada refresco del mapa en vivo)
  const zonesKey = zones ? JSON.stringify([zones.demand?.features?.map((f) => [f.geometry.coordinates[0][0], f.properties.n]), zones.study?.features?.length]) : '';
  useEffect(() => {
    const map = mapRef.current;
    if (state !== 'ready' || !map || !zonesRef.current) return;
    ensureZones(map, themeRef.current);
    map.getSource('zonas-estudio').setData(zonesRef.current.study ?? EMPTY);
    map.getSource('zonas-demanda').setData(zonesRef.current.demand ?? EMPTY);
    if (box.current) box.current.__zones = zonesRef.current; // para las pruebas: lo que se pintó
  }, [zonesKey, state]);

  // Pines y encuadre cada vez que cambia la lista
  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current?.default;
    if (state !== 'ready' || !map || !ml) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const placed = (baristas ?? []).filter((b) => b.lat != null && b.lng != null);
    for (const b of placed) {
      markers.current.push(new ml.Marker({ element: pin(b, (id) => pickRef.current?.(id), named), anchor: 'center' }).setLngLat([Number(b.lng), Number(b.lat)]).addTo(map));
    }
    if (me) {
      const dot = document.createElement('span');
      dot.className = 'mapp-me';
      dot.setAttribute('aria-label', 'Tú');
      markers.current.push(new ml.Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(map));
    }
    // El encuadre: baristas, tú y, en el mapa en vivo, las zonas con demanda
    const zonePts = (zonesRef.current?.demand?.features ?? []).flatMap((f) => [f.geometry.coordinates[0][0], f.geometry.coordinates[0][2]]);
    const pts = [...placed.map((b) => [Number(b.lng), Number(b.lat)]), ...(me ? [[me.lng, me.lat]] : []), ...zonePts];
    if (pts.length === 1) map.jumpTo({ center: pts[0], zoom: 15 });
    else if (pts.length > 1) {
      const lngs = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: big ? { top: 76, bottom: 40, left: 40, right: 40 } : 48, maxZoom: 15, duration: 0 }); // en el grande, las bebidas van arriba
    }
    // Los baristas se refrescan cada 30 s: solo se reencuadra si cambió quién está, no a cada vuelta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey(baristas, me), zonesKey, state, big]);

  if (state === 'off') return null;
  return <div className={`mapp-map${big ? ' is-big' : ''}`} ref={box} data-testid={testId} aria-label={label} role="region" />;
}
