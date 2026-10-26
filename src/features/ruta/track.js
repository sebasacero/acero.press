// Recorrido del tintero: qué puntos del GPS se guardan, cuánto caminó, dónde
// se detuvo y el resumen que se manda al terminar. Solo datos, sin React ni
// Supabase: corre en node --test. Los límites son los mismos de la base
// (supabase/migrations/20261023120000_tintero_routes.sql).
import { meters, toCuadra } from '../../shared/lib/bogotaGeo.js';

// toCuadra vive con toLngLat (el mapa público también la usa); se re-exporta para quien la buscaba aquí
export { toCuadra };

/** Bogotá con margen, igual que el check de tintero_route_points. */
export const BOGOTA_BOX = { lat: [4.3, 5.0], lng: [-74.4, -73.8] };

export const TUNING = {
  maxAccuracy: 50, // m: un punto peor no sirve para saber en qué esquina está
  maxSpeed: 12, // m/s: caminando o en bus; más es un salto del GPS
  minMove: 8, // m: quieto no se guarda cada lectura…
  keepAlive: 60, // s: …pero sí una por minuto (para medir cuánto se quedó)
  stopRadius: 35, // m: una parada es una esquina, no una cuadra entera
  stopMinutes: 3, // min: detenerse menos es un semáforo, no un cliente
  batch: 50, // puntos por envío
  pathMax: 400, // puntos del trazo que se guarda en el resumen
};

const inBox = (lat, lng) => lat >= BOGOTA_BOX.lat[0] && lat <= BOGOTA_BOX.lat[1] && lng >= BOGOTA_BOX.lng[0] && lng <= BOGOTA_BOX.lng[1];
const at = (p) => [p.lng, p.lat];
const secs = (a, b) => (Date.parse(b.t) - Date.parse(a.t)) / 1000;

/** Una lectura de navigator.geolocation → punto del recorrido ({t, lat, lng, acc}). */
export function fromPosition(pos) {
  const c = pos?.coords;
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null;
  return {
    t: new Date(pos.timestamp || Date.now()).toISOString(),
    lat: Math.round(c.latitude * 1e6) / 1e6,
    lng: Math.round(c.longitude * 1e6) / 1e6,
    acc: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
  };
}

/**
 * ¿Se guarda este punto? Devuelve { keep, reason }. `prev` es el último que
 * se guardó (o null). Las razones sirven para el aviso en pantalla.
 */
export function acceptFix(prev, fix, tune = TUNING) {
  if (!fix) return { keep: false, reason: 'sin-dato' };
  if (!inBox(fix.lat, fix.lng)) return { keep: false, reason: 'fuera-de-bogota' };
  if (fix.acc !== null && fix.acc > tune.maxAccuracy) return { keep: false, reason: 'impreciso' };
  if (!prev) return { keep: true, reason: 'primero' };
  const dt = secs(prev, fix);
  if (!(dt > 0)) return { keep: false, reason: 'repetido' };
  const d = meters(at(prev), at(fix));
  if (d / dt > tune.maxSpeed) return { keep: false, reason: 'salto' };
  if (d < tune.minMove && dt < tune.keepAlive) return { keep: false, reason: 'quieto' };
  return { keep: true, reason: 'ok' };
}

/** Metros caminados, sumando tramo a tramo. */
export function distanceOf(points) {
  let d = 0;
  for (let i = 1; i < points.length; i += 1) d += meters(at(points[i - 1]), at(points[i]));
  return d;
}

const centroid = (pts) => ({
  lat: pts.reduce((n, p) => n + p.lat, 0) / pts.length,
  lng: pts.reduce((n, p) => n + p.lng, 0) / pts.length,
});

/**
 * Paradas: tramos donde se quedó a menos de `stopRadius` metros durante
 * `stopMinutes` o más. Devuelve [{lat, lng, from, to, minutes, n}] en orden.
 */
export function detectStops(points, tune = TUNING) {
  const stops = [];
  let i = 0;
  while (i < points.length) {
    const group = [points[i]];
    let j = i + 1;
    while (j < points.length) {
      const c = centroid(group);
      if (meters([c.lng, c.lat], at(points[j])) > tune.stopRadius) break;
      group.push(points[j]);
      j += 1;
    }
    const minutes = secs(group[0], group.at(-1)) / 60;
    if (minutes >= tune.stopMinutes) {
      const c = centroid(group);
      const prev = stops.at(-1);
      // Se movió un poco y volvió a la misma esquina: es la misma parada
      if (prev && meters([prev.lng, prev.lat], [c.lng, c.lat]) <= tune.stopRadius) {
        prev.to = group.at(-1).t;
        prev.minutes = Math.round(secs({ t: prev.from }, { t: prev.to }) / 60);
        prev.n += group.length;
      } else {
        stops.push({ lat: round6(c.lat), lng: round6(c.lng), from: group[0].t, to: group.at(-1).t, minutes: Math.round(minutes), n: group.length });
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return stops;
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/** Distancia de un punto al segmento a–b, en metros (para simplificar el trazo). */
function segDist(p, a, b) {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110574;
  const [px, py, ax, ay, bx, by] = [p[0] * kx, p[1] * ky, a[0] * kx, a[1] * ky, b[0] * kx, b[1] * ky];
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function rdp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let best = -1;
    let far = tol;
    for (let i = s + 1; i < e; i += 1) {
      const d = segDist(pts[i], pts[s], pts[e]);
      if (d > far) { far = d; best = i; }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([s, best], [best, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Trazo [[lng, lat], …] con a lo sumo `max` puntos (Douglas–Peucker, tolerancia creciente). */
export function simplifyPath(points, max = TUNING.pathMax) {
  let path = points.map((p) => [round6(p.lng), round6(p.lat)]);
  for (let tol = 5; path.length > max && tol < 2000; tol *= 2) path = rdp(path, tol);
  return path;
}

/** Lo que se guarda al terminar (tintero_route_end): distancia, paradas con su cuadra y el trazo. */
export function summarize(points, tune = TUNING) {
  const stops = detectStops(points, tune).map((s) => ({ ...s, ...(toCuadra(s.lng, s.lat) ?? { carrera: null, calle: null }) }));
  return { distance_m: Math.round(distanceOf(points)), stops, path: simplifyPath(points, tune.pathMax) };
}

/** Minutos y segundos (o horas) desde el inicio, para el reloj de la pantalla. */
export function elapsed(fromIso, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Kilómetros con una cifra decimal y coma, como se dice en Colombia. */
export const km = (m) => `${(Math.round((m || 0) / 100) / 10).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

/** Un client_ref nuevo para «Empezar» (único por celular y momento). */
export const newRef = (rand = Math.random) => `ruta-${Date.now().toString(36)}-${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')}`;
