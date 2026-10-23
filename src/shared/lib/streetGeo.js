// El estudio de calle como GeoJSON para MapLibre: ventas agrupadas por cuadra
// (el peso del calor son las tazas) y tinteros como puntos. Solo datos, sin
// MapLibre ni Supabase: corre en node --test.
import { toLngLat } from './bogotaGeo.js';

const STAGE_LABEL = { prospecto: 'Prospecto', piloto: 'Piloto', activo: 'Activo', pausa: 'En pausa', salio: 'Salió' };

/** Ventas → un punto por cuadra con sus tazas, ventas y peso relativo (0–1) para el calor. */
export function salesGeoJSON(sales) {
  const blocks = new Map();
  for (const s of sales ?? []) {
    const at = toLngLat(s.carrera, s.calle);
    const cups = Number(s.cups) || 0;
    if (!at || cups <= 0) continue;
    const key = `${Math.round(s.carrera)}|${Math.round(s.calle)}`;
    const b = blocks.get(key) ?? { carrera: Math.round(s.carrera), calle: Math.round(s.calle), cups: 0, sales: 0, zone: s.zone ?? null, at: toLngLat(Math.round(s.carrera), Math.round(s.calle)) };
    b.cups += cups;
    b.sales += Number(s.sales) || 1;
    blocks.set(key, b);
  }
  const max = Math.max(1, ...[...blocks.values()].map((b) => b.cups));
  return {
    type: 'FeatureCollection',
    features: [...blocks.values()].map((b) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: b.at },
      properties: { carrera: b.carrera, calle: b.calle, cups: b.cups, sales: b.sales, zone: b.zone, weight: b.cups / max },
    })),
  };
}

/**
 * Tinteros → puntos. `withNames` solo en el panel: en una vista pública la
 * etiqueta lleva etapa y tazas por hora, nunca el nombre de la persona.
 */
export function tinterosGeoJSON(tinteros, { withNames = false } = {}) {
  return {
    type: 'FeatureCollection',
    features: (tinteros ?? []).flatMap((t) => {
      // El GPS de la ficha manda; si no hay, la cuadra (con su margen de una o dos cuadras)
      const gps = t.lat != null && t.lng != null && Number.isFinite(+t.lat) && Number.isFinite(+t.lng) ? [+t.lng, +t.lat] : null;
      const at = gps ?? toLngLat(t.carrera, t.calle);
      if (!at) return [];
      const rate = t.cups_per_hour != null && Number.isFinite(+t.cups_per_hour) ? `${Math.round(+t.cups_per_hour)}/h` : null;
      const tag = STAGE_LABEL[t.stage] ?? 'Tintero';
      return [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: at },
        properties: {
          id: t.id ?? null,
          label: [withNames ? t.name : tag, rate].filter(Boolean).join(' · '),
          stage: t.stage ?? 'prospecto',
          active: t.stage === 'activo',
          detail: [STAGE_LABEL[t.stage] ?? t.stage, t.tinto_price ? `tinto a $${Math.round(t.tinto_price).toLocaleString('es-CO')}` : null, rate ? `${rate.replace('/h', ' tazas/h')}` : null].filter(Boolean).join(' · '),
          place: placeText(t, !!gps),
          gps: !!gps,
          ...(withNames ? { name: t.name ?? null, notes: t.notes ?? null } : {}),
        },
      }];
    }),
  };
}

/** Dónde está, en palabras: la referencia o la cuadra, con la localidad. */
function placeText(t, gps) {
  const where = t.referencia || (t.carrera != null && t.calle != null ? `Calle ${Math.round(t.calle)} con ${Math.round(t.carrera)}` : null);
  const area = t.localidad && t.localidad !== where ? t.localidad : t.zone !== where ? t.zone : null;
  const acc = gps && t.gps_accuracy_m != null ? `GPS ±${t.gps_accuracy_m} m` : gps ? 'GPS' : null;
  return [where, area, acc].filter(Boolean).join(' · ');
}

/** [[oeste, sur], [este, norte]] que encierra todos los puntos, o null si no hay. */
export function boundsOf(...collections) {
  const pts = collections.flatMap((c) => c.features.map((f) => f.geometry.coordinates));
  if (!pts.length) return null;
  const lng = pts.map((p) => p[0]);
  const lat = pts.map((p) => p[1]);
  return [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]];
}

const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });

/**
 * Recorridos de la app Mi ruta → una línea por recorrido y un punto por
 * parada. Solo para el panel: lleva el nombre del tintero si se le pasa la
 * lista de tinteros. Un trazo con menos de dos puntos no se dibuja.
 */
export function routesGeoJSON(routes, tinteros = []) {
  const names = new Map((tinteros ?? []).map((t) => [t.id, t.name]));
  const lines = [];
  const stops = [];
  for (const r of routes ?? []) {
    const path = (r.path ?? []).filter((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
    const who = names.get(r.tintero_id) ?? 'Tintero';
    if (path.length >= 2) {
      lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: path }, properties: { id: r.id, who, open: !r.ended_at } });
    }
    (r.stops ?? []).forEach((s, i) => {
      if (!Number.isFinite(s?.lng) || !Number.isFinite(s?.lat)) return;
      stops.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { route: r.id, who, n: i + 1, minutes: s.minutes ?? 0, label: `${who} · parada ${i + 1} · ${hhmm(s.from)} · ${s.minutes ?? 0} min${s.calle ? ` · Calle ${s.calle} con ${s.carrera}` : ''}` },
      });
    });
  }
  return { lines: { type: 'FeatureCollection', features: lines }, stops: { type: 'FeatureCollection', features: stops } };
}
