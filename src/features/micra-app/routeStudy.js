// Recorridos de los carritos en el estudio de calle: lo que el equipo levanta
// (lo que cuenta el tintero, o acompañándolo con el GPS) y lo de Mi ruta.
// Puro: convierte recorridos en sectores y en lo que guarda la base.

import { distanceOf, simplifyPath } from '../ruta/track.js';

export const SOURCES = {
  relato: 'Lo que cuenta',
  acompanado: 'Acompañándolo',
  gps: 'Mi ruta',
};

// Un sector es una celda de ~550 m (0,005°): una o dos cuadras largas en Bogotá
export const CELL = 0.005;
const cellOf = (lng, lat) => `${Math.floor(lng / CELL)}:${Math.floor(lat / CELL)}`;

/** Puntos intermedios de un tramo, para que una calle larga marque todos los sectores que cruza. */
function along([lng1, lat1], [lng2, lat2]) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lng2 - lng1), Math.abs(lat2 - lat1)) / (CELL / 2)));
  const out = [];
  for (let i = 0; i <= steps; i += 1) out.push([lng1 + ((lng2 - lng1) * i) / steps, lat1 + ((lat2 - lat1) * i) / steps]);
  return out;
}

/**
 * Sectores recorridos: cada celda con cuántos carritos distintos pasan.
 * Devuelve { cells: GeoJSON de los centros (weight = carritos / el sector con más),
 *            lines: GeoJSON de los trazos, carts, top: [{ lng, lat, carts }] }.
 */
export function routeSectors(routes) {
  const byCell = new Map();
  const lines = [];
  const carts = new Set();
  for (const r of routes ?? []) {
    const path = Array.isArray(r.path) ? r.path.filter((p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))).map(([a, b]) => [Number(a), Number(b)]) : [];
    if (path.length < 2) continue;
    carts.add(r.tintero_id);
    lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: path }, properties: { tintero_id: r.tintero_id, source: r.source ?? 'gps' } });
    for (let i = 1; i < path.length; i += 1) {
      for (const [lng, lat] of along(path[i - 1], path[i])) {
        const k = cellOf(lng, lat);
        if (!byCell.has(k)) byCell.set(k, new Set());
        byCell.get(k).add(r.tintero_id);
      }
    }
  }
  const max = Math.max(1, ...[...byCell.values()].map((s) => s.size));
  const cells = [...byCell.entries()].map(([k, set]) => {
    const [x, y] = k.split(':').map(Number);
    return { lng: (x + 0.5) * CELL, lat: (y + 0.5) * CELL, carts: set.size };
  });
  return {
    cells: {
      type: 'FeatureCollection',
      features: cells.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { carts: c.carts, weight: c.carts / max } })),
    },
    lines: { type: 'FeatureCollection', features: lines },
    carts: carts.size,
    top: cells.sort((a, b) => b.carts - a.carts).slice(0, 5),
  };
}

/**
 * Lo que va a tintero_route_team desde los puntos del equipo.
 * `points`: [{ lng, lat, t? }] (tocados en el mapa o leídos del GPS). Devuelve { body } o { error }.
 */
export function teamRouteBody({ tinteroId, source, points, ref }) {
  if (!tinteroId) return { error: 'Primero guarda la ficha: el recorrido va con ella.' };
  if (!SOURCES[source] || source === 'gps') return { error: 'Elige cómo se levantó el recorrido.' };
  const pts = (points ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
  if (pts.length < 2) return { error: source === 'relato' ? 'Toca al menos dos puntos de su recorrido en el mapa.' : 'Aún no hay recorrido: camina un poco más con el GPS encendido.' };
  const path = simplifyPath(pts, 400);
  const times = pts.map((p) => p.t).filter(Boolean).sort();
  return {
    body: {
      p_tintero_id: tinteroId,
      p_client_ref: ref,
      p_source: source,
      p_path: path,
      p_started_at: times[0] ?? null,
      p_ended_at: times.at(-1) ?? null,
      p_distance_m: Math.min(100000, Math.round(distanceOf(pts))),
    },
  };
}
