// Viste el mapa real (estilo Liberty de OpenFreeMap, esquema OpenMapTiles)
// con la paleta del mapa ilustrado de Micra: «plano» (papel y tinta azul, como
// la portada) y «noche» (el celular de la app). No es un estilo nuevo: se
// recolorean las capas que ya trae, así se reusan sus teselas y fuentes.
// Solo datos (capa → propiedades), sin MapLibre: corre en node --test.

export const THEMES = {
  plano: {
    bg: '#EDE6D3', land: '#E6DEC8', park: 'rgba(46,139,87,.18)', water: '#C9D3DC', building: 'rgba(42,53,80,.07)',
    hw: '#2A3550', major: 'rgba(42,53,80,.6)', road: 'rgba(42,53,80,.32)', minor: 'rgba(42,53,80,.14)', rail: 'rgba(42,53,80,.25)',
    label: 'rgba(42,53,80,.85)', labelSoft: 'rgba(42,53,80,.55)', halo: '#EDE6D3', boundary: 'rgba(42,53,80,.3)',
    raster: { 'raster-saturation': -0.85, 'raster-contrast': -0.15, 'raster-brightness-min': 0.12 },
  },
  noche: {
    bg: '#141518', land: '#17191d', park: 'rgba(46,139,87,.2)', water: '#0f1a24', building: 'rgba(255,255,255,.04)',
    hw: 'rgba(255,255,255,.42)', major: 'rgba(255,255,255,.26)', road: 'rgba(255,255,255,.14)', minor: 'rgba(255,255,255,.06)', rail: 'rgba(255,255,255,.12)',
    label: 'rgba(255,255,255,.62)', labelSoft: 'rgba(255,255,255,.38)', halo: '#141518', boundary: 'rgba(255,255,255,.18)',
    raster: { 'raster-saturation': -1, 'raster-brightness-max': 0.32, 'raster-contrast': 0.1 },
  },
};

// Capas nuestras que no se tocan: las del piloto (ventas-) y las zonas del mapa en vivo de Micra (zonas-)
const OURS = /^(ventas|zonas)-/;
const has = (id, ...words) => words.some((w) => id.includes(w));

function roadColor(id, T) {
  if (has(id, 'motorway', 'trunk')) return T.hw;
  if (has(id, 'primary')) return T.major;
  if (has(id, 'secondary', 'tertiary')) return T.road;
  if (has(id, 'rail', 'transit')) return T.rail;
  return T.minor;
}

/**
 * Cambios para una capa del estilo base: { paint, layout } con solo las
 * propiedades válidas para su tipo, o null si la capa se deja como está.
 */
export function themeLayer(layer, theme) {
  const T = THEMES[theme];
  if (!T || !layer || OURS.test(layer.id)) return null;
  const id = String(layer.id).toLowerCase();
  const src = layer['source-layer'] ?? '';
  const hide = { paint: {}, layout: { visibility: 'none' } };

  switch (layer.type) {
    case 'background':
      return { paint: { 'background-color': T.bg }, layout: {} };
    case 'raster':
      return { paint: { ...T.raster }, layout: {} };
    case 'hillshade':
      return hide;
    case 'fill': {
      let color = T.land;
      if (src === 'water' || has(id, 'water', 'ocean', 'lake')) color = T.water;
      else if (src === 'park' || has(id, 'park', 'wood', 'grass', 'forest', 'garden', 'pitch', 'cemetery')) color = T.park;
      else if (src === 'building' || has(id, 'building')) color = T.building;
      else if (has(id, 'ice', 'glacier')) color = T.bg;
      const paint = { 'fill-color': color, 'fill-outline-color': color, 'fill-opacity': 1 };
      // Texturas (pantanos, arena…) fuera: el plano es de tintas planas
      if (layer.paint && 'fill-pattern' in layer.paint) paint['fill-pattern'] = undefined;
      return { paint, layout: {} };
    }
    case 'fill-extrusion':
      return hide; // edificios en 3D no van en un plano
    case 'line': {
      if (src === 'waterway' || has(id, 'waterway', 'river', 'stream', 'canal')) return { paint: { 'line-color': T.water }, layout: {} };
      if (src === 'boundary' || has(id, 'boundary', 'admin')) return { paint: { 'line-color': T.boundary }, layout: {} };
      // Los bordes («casing») de las vías se apagan: en el plano cada vía es un solo trazo
      if (has(id, 'casing', 'outline')) return { paint: { 'line-opacity': 0 }, layout: {} };
      const paint = { 'line-color': roadColor(id, T) };
      if (layer.paint && 'line-pattern' in layer.paint) paint['line-pattern'] = undefined;
      return { paint, layout: {} };
    }
    case 'symbol': {
      // Sin íconos ni números de casa: solo nombres de vías, barrios y lugares
      if (src === 'poi' || src === 'housenumber' || src === 'aerodrome_label' || src === 'mountain_peak' || has(id, 'poi', 'housenumber', 'shield', 'oneway')) return hide;
      const soft = src === 'transportation_name' || src === 'water_name' || has(id, 'road', 'highway', 'water');
      return {
        paint: { 'text-color': soft ? T.labelSoft : T.label, 'text-halo-color': T.halo, 'text-halo-width': 1.4, 'text-halo-blur': 0 },
        layout: {},
      };
    }
    case 'circle':
    case 'heatmap':
      return null;
    default:
      return null;
  }
}

/** Todos los cambios de un estilo: [[layerId, 'paint'|'layout', prop, value], …] */
export function themeChanges(layers, theme) {
  const out = [];
  for (const layer of layers ?? []) {
    const ch = themeLayer(layer, theme);
    if (!ch) continue;
    for (const [k, v] of Object.entries(ch.paint)) out.push([layer.id, 'paint', k, v]);
    for (const [k, v] of Object.entries(ch.layout)) out.push([layer.id, 'layout', k, v]);
  }
  return out;
}
