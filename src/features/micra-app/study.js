// Estudio de calle dentro de la app Micra (modo equipo): qué le falta a cada
// ficha y cómo se dice. Las fichas y encuestas son las mismas del panel
// (tabla `tinteros`, API /api/v1/bi); aquí solo se ordena lo pendiente. Puro.

import { latestByTintero } from '../admin/survey/survey.js';

/** Lo que le falta a una ficha, en el orden en que se completa en la calle. */
export function pendingOf(t, survey) {
  const out = [];
  if (!survey) out.push('encuesta');
  if (t?.lat == null || t?.lng == null) out.push('gps');
  if (!t?.photo_url) out.push('foto');
  return out;
}

export const PENDING_LABEL = { encuesta: 'Sin encuesta', gps: 'Sin GPS', foto: 'Sin foto' };

/** Las fichas con su encuesta más reciente y lo pendiente; primero las que más faltan, luego las más nuevas. */
export function studyRows(tinteros, surveys) {
  const last = latestByTintero(surveys);
  return (tinteros ?? [])
    .map((t, i) => {
      const survey = last.get(t.id) ?? null;
      return { ...t, survey, pending: pendingOf(t, survey), i };
    })
    .sort((a, b) => b.pending.length - a.pending.length || a.i - b.i)
    .map(({ i, ...r }) => r);
}

/** Cuántas fichas hay y cuántas tienen cada cosa. */
export function studyCounts(rows) {
  const has = (k) => rows.filter((r) => !r.pending.includes(k)).length;
  return { total: rows.length, encuesta: has('encuesta'), gps: has('gps'), foto: has('foto'), done: rows.filter((r) => r.pending.length === 0).length };
}

/** Dónde está, como se entiende en la calle: «Salida de la 72 · Chapinero · GPS ±9 m». */
export function whereLine(t) {
  const place = t.referencia || (t.carrera != null ? `Calle ${t.calle} con ${t.carrera}` : null);
  const gps = t.lat != null ? `GPS${t.gps_accuracy_m != null ? ` ±${t.gps_accuracy_m} m` : ''}` : null;
  return [place, t.localidad || t.zone, gps].filter(Boolean).join(' · ') || 'Sin lugar';
}

/** El punto del celular → lo que guarda la ficha (PATCH /tinteros/{id}), o { error }. */
export function gpsPatch(pos, now = new Date()) {
  if (!pos) return { error: 'El celular no dio la ubicación. Revisa el permiso y que el GPS esté encendido.' };
  const lat = Number(pos.lat);
  const lng = Number(pos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: 'El celular no dio la ubicación. Intenta otra vez.' };
  if (lat < 3.7 || lat > 4.85 || lng < -74.5 || lng > -73.95) return { error: 'Esa ubicación queda fuera de Bogotá. Espera unos segundos con buena señal y vuelve a marcar.' };
  const acc = Number(pos.accuracy);
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    gps_accuracy_m: Number.isFinite(acc) ? Math.min(5000, Math.round(acc)) : null,
    located_at: now.toISOString(),
  };
}

/**
 * Las fichas con punto de GPS como GeoJSON para el mapa de calor del estudio.
 * El peso es lo que vende el puesto (tazas por hora vistas, hasta 40 = 1);
 * sin ese dato, 0.5: cada vendedor mapeado ya suma calor.
 */
export function heatPoints(rows) {
  const features = (rows ?? [])
    .filter((r) => r.lat != null && r.lng != null && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)))
    .map((r) => {
      const cups = Number(r.cups_per_hour);
      const weight = Number.isFinite(cups) && cups > 0 ? Math.min(1, Math.max(0.3, cups / 40)) : 0.5;
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] }, properties: { id: r.id, weight } };
    });
  return { type: 'FeatureCollection', features };
}

/**
 * Las fotos de venta (la cámara de la barra del barista) como puntos para el mapa de Estudio.
 * La base ya las redondea a ~55 m; aquí solo se descartan las que no traen un punto válido.
 */
export function salePhotoPoints(list) {
  const features = (list ?? [])
    .filter((r) => r && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)) && r.lat !== null && r.lng !== null)
    .map((r, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] }, properties: { id: i, weight: 1, at: r.at ?? null } }));
  return { type: 'FeatureCollection', features };
}

// ── Volver a las fichas que ya están en el mapa ──────────────────────────────

/** Metros entre dos puntos { lat, lng } (haversine); null si alguno no sirve. */
export function distanceM(a, b) {
  const n = [a?.lat, a?.lng, b?.lat, b?.lng].map((v) => (v === null || v === undefined || v === '' ? NaN : Number(v)));
  if (n.some((v) => !Number.isFinite(v))) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(n[2] - n[0]) / 2) ** 2 + Math.cos(rad(n[0])) * Math.cos(rad(n[2])) * Math.sin(rad(n[3] - n[1]) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** «a 120 m», «a 1,2 km»: redondeado a lo que se camina. */
export function distLabel(m) {
  if (m === null || m === undefined) return null;
  if (m < 1000) return `a ${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `a ${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}

/** Las fichas con su distancia al celular, la más cercana primero; las que no tienen GPS, al final en su orden. */
export function nearRows(rows, pos) {
  return (rows ?? [])
    .map((r, i) => ({ ...r, dist: distanceM(pos, r), i }))
    .sort((a, b) => (a.dist === null) - (b.dist === null) || (a.dist ?? 0) - (b.dist ?? 0) || a.i - b.i)
    .map(({ i, ...r }) => r);
}

/** Los filtros de la lista: lo que falta por hacer en la calle. */
export const STUDY_FILTERS = [['todas', 'Todas'], ['encuesta', 'Sin encuesta'], ['gps', 'Sin GPS'], ['foto', 'Sin foto']];

export function filterRows(rows, filter) {
  if (!filter || filter === 'todas') return rows ?? [];
  return (rows ?? []).filter((r) => r.pending.includes(filter));
}

/** Cuántas fichas deja cada filtro, para el número de cada botón. */
export function filterCounts(rows) {
  return Object.fromEntries(STUDY_FILTERS.map(([id]) => [id, filterRows(rows, id).length]));
}
