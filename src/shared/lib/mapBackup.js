// Respaldo del mapa: Bogotá cortada de Protomaps (datos de OpenStreetMap) en un
// solo archivo PMTiles servido por el sitio, con sus letras al lado. Si
// OpenFreeMap no responde, el mapa sigue sin depender de nadie más: las teselas
// de openstreetmap.org no se pueden usar en una app comercial.
// Solo datos (sin MapLibre): corre en node --test.

export const BACKUP_FILE = '/mapa/bogota.pmtiles';
export const BACKUP_GLYPHS = '/mapa/fonts/{fontstack}/{range}.pbf';
// Lo que cubre el archivo (oeste, sur, este, norte): de Bosa a Usaquén
export const BACKUP_BOUNDS = [-74.23, 4.47, -73.99, 4.83];

// Capas que piden íconos (no se sirven) o que el plano de Micra no muestra
const DROP = /^(pois|roads_shields|roads_oneway|address_label)$/;

// Los lugares llevan un punto como ícono en zoom bajo: sin él, solo el nombre
function noIcon(layer) {
  if (!layer.layout || !('icon-image' in layer.layout)) return layer;
  const { 'icon-image': _drop, ...layout } = layer.layout;
  return { ...layer, layout };
}

/**
 * Estilo de MapLibre para el respaldo. `layers` sale de @protomaps/basemaps con
 * la fuente 'protomaps'; `origin` es el sitio (en la app instalada, el público),
 * porque las letras necesitan una dirección completa.
 */
export function backupStyle(layers, origin) {
  const site = String(origin || '').replace(/\/+$/, '');
  return {
    version: 8,
    glyphs: site + BACKUP_GLYPHS,
    sources: {
      protomaps: {
        type: 'vector',
        url: 'pmtiles://' + site + BACKUP_FILE,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Protomaps',
      },
    },
    layers: (layers ?? []).filter((l) => !DROP.test(l.id)).map(noIcon),
  };
}
