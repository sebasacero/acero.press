// El panel del mapa del equipo (/micra/mapa): en un solo mapa quién está
// conectado, qué ruta lleva cada barista y lo que levantó el estudio de calle.
// Lógica pura (sin React ni MapLibre), con tests.
//
// Privacidad: los clientes nunca salen como personas, solo como las zonas del
// «busco café» (2 señales o más, micra_live_map). Los baristas salen con su
// nombre porque el panel es solo del equipo (admin_users) y ellos aceptaron
// compartir su ubicación al salir (tintero_consent, Ley 1581).

import { meters } from './micraApp.js';

/** Cada cuánto se refresca el panel con la pantalla a la vista. */
export const PANEL_POLL_MS = 20 * 1000;
/** «Con Micra abierta»: la app anota app_seen_at cada 20 s; con 3 min de margen. */
export const ONLINE_MS = 3 * 60 * 1000;
/** Un punto de la ruta abierta más viejo que esto ya no es «ahora». */
export const FRESH_MS = 30 * 60 * 1000;
/** Lo que se lee de los puntos de una ruta abierta (PostgREST corta en 1000). */
export const LIVE_POINTS_MAX = 1000;

export const WINDOWS = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
];

export const LAYERS = [
  { key: 'vivo', label: 'En vivo', hint: 'Baristas en la calle y con Micra abierta' },
  { key: 'rutas', label: 'Rutas', hint: 'Los recorridos al salir a vender y los de Mi ruta' },
  { key: 'estudio', label: 'Estudio', hint: 'Fichas del estudio de calle, con o sin encuesta' },
  { key: 'demanda', label: 'Buscan café', hint: 'Zonas de unos 400 m con 2 o más personas' },
  { key: 'avistamientos', label: 'Tomando tinto', hint: 'Avistamientos del equipo' },
];

export const DEFAULT_LAYERS = { vivo: true, rutas: true, estudio: true, demanda: true, avistamientos: false };

export const STATUS_LABEL = {
  calle: 'En la calle',
  app: 'Con Micra abierta',
  hoy: 'Activo hoy',
  off: 'Sin conexión',
};
const STATUS_ORDER = { calle: 0, app: 1, hoy: 2, off: 3 };

const BOGOTA_MS = -5 * 3600 * 1000; // Bogotá no cambia de hora

const ms = (v) => {
  if (v == null || v === '') return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};
const num = (v) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const okPoint = (lat, lng) => lat != null && lng != null && lat >= 3.7 && lat <= 5 && lng >= -74.5 && lng <= -73.8;

/** Las 0:00 de Bogotá del día de `now`, en ms. */
export function startOfBogotaDay(now = Date.now()) {
  const local = now + BOGOTA_MS;
  return local - (((local % 864e5) + 864e5) % 864e5) - BOGOTA_MS;
}

/** Desde cuándo cuenta la ventana elegida. */
export function windowSince(key, now = Date.now()) {
  const day = startOfBogotaDay(now);
  if (key === '7d') return day - 6 * 864e5;
  if (key === '30d') return day - 29 * 864e5;
  return day;
}

/** Días que se le piden a la API de BI para cubrir la ventana. */
export const windowDays = (key) => (key === '30d' ? 30 : key === '7d' ? 7 : 1);

/**
 * El color de un trazo según su edad, en la escala térmica de la app:
 * lo de ahora caliente, lo viejo frío (termico.css: --t-1…--t-5).
 */
export function heatOf(endMs, now = Date.now(), live = false) {
  if (live) return '#F2542D';
  const h = (now - (endMs ?? 0)) / 3600e3;
  if (h <= 3) return '#DE1B1B';
  if (h <= 24) return '#B0127A';
  if (h <= 7 * 24) return '#5A1E9E';
  return '#22125A';
}

/** «hace 3 min», «hace 2 h», «ayer 6:10 p. m.»… corto para la lista. */
export function agoLabel(t, now = Date.now()) {
  const at = ms(t);
  if (at == null) return 'nunca';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 24 * 3600) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/** Kilómetros con una cifra decimal («3,4 km») o metros si es poco. */
export function kmLabel(m) {
  const v = num(m);
  if (v == null) return '—';
  if (v < 1000) return `${Math.round(v)} m`;
  return `${(Math.round(v / 100) / 10).toLocaleString('es-CO')} km`;
}

/** Duración «2 h 05 min» o «12 min». */
export function durationLabel(fromMs, toMs) {
  if (fromMs == null || toMs == null || toMs < fromMs) return '—';
  const min = Math.round((toMs - fromMs) / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** Puntos de una ruta abierta, en orden y sin lecturas imposibles. */
export function cleanPoints(points) {
  return (points ?? [])
    .map((p) => ({ lat: num(p.lat), lng: num(p.lng), t: ms(p.recorded_at ?? p.t) }))
    .filter((p) => okPoint(p.lat, p.lng) && p.t != null)
    .sort((a, b) => a.t - b.t);
}

/** Distancia de una lista de puntos {lat,lng}, en metros. */
export function pathMeters(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i += 1) d += meters(pts[i - 1], pts[i]);
  return d;
}

/**
 * Las rutas de la ventana como trazos: las terminadas con su `path` guardado
 * ([lng, lat]) y las abiertas con sus puntos crudos. Cada una con su color
 * térmico, su barista, si está en curso y su distancia.
 */
export function routeTracks({ routes, livePoints, since, now = Date.now() }) {
  const byRoute = new Map();
  for (const p of livePoints ?? []) {
    if (!byRoute.has(p.route_id)) byRoute.set(p.route_id, []);
    byRoute.get(p.route_id).push(p);
  }
  const out = [];
  for (const r of routes ?? []) {
    const start = ms(r.started_at);
    const end = ms(r.ended_at);
    const open = end == null;
    let coords = [];
    let lastT = end;
    let dist = num(r.distance_m);
    if (open) {
      const pts = cleanPoints(byRoute.get(r.id));
      coords = pts.map((p) => [p.lng, p.lat]);
      lastT = pts.at(-1)?.t ?? start;
      dist = Math.round(pathMeters(pts));
    } else if (Array.isArray(r.path)) {
      coords = r.path.map((p) => (Array.isArray(p) ? [num(p[0]), num(p[1])] : [null, null])).filter(([lng, lat]) => okPoint(lat, lng));
    }
    if ((lastT ?? start ?? 0) < since) continue;
    const live = open && lastT != null && now - lastT <= FRESH_MS;
    out.push({
      id: r.id,
      tinteroId: r.tintero_id,
      source: r.source ?? 'gps',
      start,
      end: open ? null : end,
      lastT,
      open,
      live,
      distance: dist,
      stops: Array.isArray(r.stops) ? r.stops.length : 0,
      coords,
      color: heatOf(lastT, now, live),
      head: coords.length ? coords.at(-1) : null,
    });
  }
  return out.sort((a, b) => (b.lastT ?? 0) - (a.lastT ?? 0));
}

/**
 * Las personas del panel: los baristas con cuenta, los que están en la calle
 * y los que tienen una ruta en la ventana. Las fichas del estudio sin nada de
 * eso van como puntos del mapa, no en la lista.
 */
export function panelPeople({ tinteros, tracks, live, since, now = Date.now() }) {
  const liveIds = new Set((live?.baristas ?? []).map((b) => b.id));
  const liveById = new Map((live?.baristas ?? []).map((b) => [b.id, b]));
  const tracksBy = new Map();
  for (const t of tracks ?? []) {
    if (!tracksBy.has(t.tinteroId)) tracksBy.set(t.tinteroId, []);
    tracksBy.get(t.tinteroId).push(t);
  }
  const people = [];
  for (const t of tinteros ?? []) {
    if (t.stage === 'salio') continue;
    const mine = tracksBy.get(t.id) ?? [];
    const outUntil = ms(t.out_until);
    const inStreet = (outUntil != null && outUntil > now) || liveIds.has(t.id);
    const seen = ms(t.app_seen_at);
    if (!t.linked && !inStreet && mine.length === 0 && !(seen != null && seen >= since)) continue;
    const today = startOfBogotaDay(now);
    const activeToday = (seen != null && seen >= today) || mine.some((r) => (r.lastT ?? 0) >= today);
    const status = inStreet ? 'calle' : seen != null && now - seen <= ONLINE_MS ? 'app' : activeToday ? 'hoy' : 'off';
    // Dónde ponerlo: el último punto de su ruta en curso (exacto), el punto al salir
    // (~110 m) o, si no, el de su ficha
    const running = mine.find((r) => r.live && r.head);
    const lb = liveById.get(t.id);
    let pos = null;
    let posKind = null;
    if (running) { pos = { lng: running.head[0], lat: running.head[1] }; posKind = 'gps'; }
    else if (inStreet && okPoint(num(t.out_lat ?? lb?.lat), num(t.out_lng ?? lb?.lng))) { pos = { lat: num(t.out_lat ?? lb?.lat), lng: num(t.out_lng ?? lb?.lng) }; posKind = 'salida'; }
    else if (okPoint(num(t.lat), num(t.lng))) { pos = { lat: num(t.lat), lng: num(t.lng) }; posKind = 'ficha'; }
    const lastAct = Math.max(seen ?? 0, ...mine.map((r) => r.lastT ?? 0)) || null;
    people.push({
      id: t.id,
      name: t.name || 'Sin nombre',
      where: t.referencia || t.zone || t.localidad || '',
      localidad: t.localidad || null,
      stage: t.stage,
      linked: !!t.linked,
      mode: t.out_mode || null,
      status,
      pos,
      posKind,
      lastSeen: lastAct,
      routes: mine.length,
      distance: mine.reduce((a, r) => a + (num(r.distance) ?? 0), 0),
      tracking: !!running,
    });
  }
  return people.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.lastSeen ?? 0) - (a.lastSeen ?? 0) || a.name.localeCompare(b.name, 'es'));
}

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Busca por nombre, lugar, localidad o estado («en la calle»). */
export function searchPeople(people, q) {
  const f = fold(q);
  if (!f) return people;
  return people.filter((p) => [p.name, p.where, p.localidad, STATUS_LABEL[p.status]].some((x) => fold(x).includes(f)));
}

/** Las fichas del estudio como puntos: con encuesta o sin ella (sin notas ni fotos). */
export function studyPoints(tinteros, surveys = []) {
  const surveyed = new Set((surveys ?? []).map((s) => s.tintero_id));
  const features = (tinteros ?? [])
    .filter((t) => t.stage !== 'salio' && okPoint(num(t.lat), num(t.lng)))
    .map((t) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [num(t.lng), num(t.lat)] },
      properties: {
        id: t.id,
        name: t.name || 'Sin nombre',
        where: t.referencia || t.zone || t.localidad || '',
        survey: surveyed.has(t.id) || !!t.surveyed_at,
        price: num(t.tinto_price),
        linked: !!t.linked,
      },
    }));
  return { type: 'FeatureCollection', features };
}

/** Avistamientos de la ventana. */
export function sightingPoints(list, since) {
  const features = (list ?? [])
    .filter((s) => okPoint(num(s.lat), num(s.lng)) && (ms(s.at) ?? 0) >= since)
    .map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [num(s.lng), num(s.lat)] }, properties: { people: num(s.people) ?? 1, at: s.at } }));
  return { type: 'FeatureCollection', features };
}

/** Los trazos como GeoJSON (solo los que tienen 2 puntos o más); `focus` resalta a un barista. */
export function tracksGeoJSON(tracks, focus = null) {
  return {
    type: 'FeatureCollection',
    features: (tracks ?? []).filter((t) => t.coords.length >= 2).map((t) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: t.coords },
      properties: { id: t.id, tintero: t.tinteroId, color: t.color, live: t.live ? 1 : 0, team: t.source !== 'gps' ? 1 : 0, dim: focus && focus !== t.tinteroId ? 1 : 0 },
    })),
  };
}

/** Las cifras de arriba del panel. */
export function panelKpis({ people, tracks, study, live, sightings }) {
  const demand = (live?.demand ?? []).filter((c) => Number(c.n) >= (live?.min_count ?? 2));
  return {
    calle: people.filter((p) => p.status === 'calle').length,
    online: people.filter((p) => p.status === 'calle' || p.status === 'app').length,
    rutas: tracks.length,
    km: tracks.reduce((a, t) => a + (num(t.distance) ?? 0), 0),
    fichas: study.features.length,
    encuestas: study.features.filter((f) => f.properties.survey).length,
    buscan: demand.reduce((a, c) => a + Number(c.n), 0),
    zonas: demand.length,
    avistamientos: sightings.features.length,
  };
}

/** Los límites [[oeste, sur], [este, norte]] que encuadran lo visible, o null. */
export function boundsOf(coords) {
  const pts = (coords ?? []).filter((c) => Array.isArray(c) && okPoint(c[1], c[0]));
  if (!pts.length) return null;
  const lngs = pts.map((c) => c[0]);
  const lats = pts.map((c) => c[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

/** Lo de una persona para la tarjeta de detalle: sus rutas de la ventana y su ficha. */
export function personDetail(person, tracks, now = Date.now()) {
  if (!person) return null;
  const mine = (tracks ?? []).filter((t) => t.tinteroId === person.id);
  return {
    ...person,
    statusLabel: STATUS_LABEL[person.status],
    seenLabel: agoLabel(person.lastSeen, now),
    tracks: mine.map((t) => ({
      id: t.id,
      live: t.live,
      color: t.color,
      when: t.start,
      dur: durationLabel(t.start, t.end ?? t.lastT),
      km: kmLabel(t.distance),
      stops: t.stops,
      team: t.source !== 'gps',
    })),
    coords: mine.flatMap((t) => t.coords).concat(person.pos ? [[person.pos.lng, person.pos.lat]] : []),
  };
}
