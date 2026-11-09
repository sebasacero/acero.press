// MapLibre se carga solo cuando una pantalla lo pide (import dinámico): pesa
// más que todo el sitio y el público no lo necesita.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// El worker de MapLibre importa otro archivo de su paquete y lo busca junto al
// chunk: Vite no lo copia. `?worker&url` lo empaqueta entero y da su URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { backupStyle } from './mapBackup.js';
import { apiUrl } from './apiBase.js';

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;

// Teselas: OpenFreeMap (vector, sin clave ni cuenta). Si no responde, el mapa
// cae a Bogotá servida por el propio sitio (Protomaps en un archivo PMTiles):
// las teselas de openstreetmap.org bloquean sin aviso a las apps comerciales.
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

maplibregl.addProtocol('pmtiles', new Protocol().tile);

// En el navegador, el mismo sitio; en la app instalada, el sitio público (apiBase)
const origin = apiUrl('') || (typeof location !== 'undefined' ? location.origin : '');
// El nombre se queda (OSM_STYLE) para no tocar cada mapa: sigue siendo OpenStreetMap
export const OSM_STYLE = backupStyle(layers('protomaps', namedFlavor('light'), { lang: 'es' }), origin);

/** ¿Puede este navegador dibujar MapLibre? (sin WebGL se usa el mapa ilustrado) */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
