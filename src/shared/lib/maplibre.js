// MapLibre se carga solo cuando una pantalla lo pide (import dinámico): pesa
// más que todo el sitio y el público no lo necesita.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// El worker de MapLibre importa otro archivo de su paquete y lo busca junto al
// chunk: Vite no lo copia. `?worker&url` lo empaqueta entero y da su URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;

// Teselas: OpenFreeMap (vector, sin clave ni cuenta). Si no responde, el mapa
// cae a las teselas raster de OpenStreetMap para no quedarse en blanco.
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/** ¿Puede este navegador dibujar MapLibre? (sin WebGL se usa el mapa ilustrado) */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
