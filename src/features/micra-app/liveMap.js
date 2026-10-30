// El mapa en vivo del barista (como Uber al ponerse «en línea»): quién más
// está vendiendo, dónde quieren café y dónde suelen estar los puestos.
// Lógica pura (sin React ni MapLibre), con tests: la cuadrícula, el freno
// del «busco café», el umbral de las zonas y la leyenda.
//
// Privacidad: el celular del cliente manda solo la celda (unos 440 m) y la
// bebida; la base vuelve a ajustar a la celda, guarda el celular con hash y
// borra la señal a la hora. El barista ve zonas con 2 señales o más, nunca
// puntos sueltos (supabase/migrations/20261030180000_micra_live_map.sql).

import { meters } from './micraApp.js';

/** Lado de la celda en grados: 0,004° ≈ 445 m de norte a sur y 444 m de este a oeste en Bogotá. */
export const CELL_DEG = 0.004;
/** Una zona sale con al menos tantas señales (las de menos no se dibujan ni se cuentan). */
export const MIN_SIGNALS = 2;
/** Un «busco café» por celular cada tanto. */
export const SEEK_GAP_MS = 15 * 60 * 1000;
/** Cuánto dura una señal. */
export const SEEK_TTL_MIN = 45;
/** Cada cuánto se refresca el mapa mientras está a la vista. */
export const POLL_MS = 30 * 1000;
/** «Cerca» para la leyenda. */
export const NEAR_M = 2000;

const DRINKS = ['tinto', 'perico', 'aromatica'];
const round4 = (n) => Math.round(n * 1e4) / 1e4;
const inBogota = (lat, lng) => lat >= 3.7 && lat <= 4.85 && lng >= -74.5 && lng <= -73.95;

/**
 * El centro de la celda que contiene el punto (lo único que sale del celular).
 * Fuera de Bogotá o sin número: null (no se manda nada).
 */
export function cellOf(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(a) || !Number.isFinite(b) || !inBogota(a, b)) return null;
  // El 1e-9 corrige la coma flotante en el borde (4,644 / 0,004 = 1160,9999…); la base hace lo mismo con numeric, exacto
  const snap = (v) => round4(Math.floor(v / CELL_DEG + 1e-9) * CELL_DEG + CELL_DEG / 2);
  return { lat: snap(a), lng: snap(b) };
}

/** ¿Ya puede mandar otro «busco café»? `last`: ms del último o null. */
export const canSeek = (last, now = Date.now(), gap = SEEK_GAP_MS) => last == null || !Number.isFinite(Number(last)) || now - Number(last) >= gap || now < Number(last);

/** La bebida que se manda: una de las tres o «all» (lo que sea). */
export const drinkOf = (d) => (DRINKS.includes(d) ? d : 'all');

/**
 * Lo que va a la base: la celda, la bebida y la llave del celular (aleatoria,
 * distinta a la de los apartados; la base guarda solo su hash). Sin nombre ni
 * posición exacta. null si no hay celda.
 */
export function seekPayload(ref, pos, drink) {
  const cell = cellOf(pos?.lat, pos?.lng);
  if (!cell || !ref) return null;
  return { p_ref: String(ref), p_cell_lat: cell.lat, p_cell_lng: cell.lng, p_drink: drinkOf(drink) };
}

/** Las zonas que se pueden mostrar: con al menos `min` señales. */
export const visibleCells = (cells, min = MIN_SIGNALS) => (cells ?? []).filter((c) => Number(c?.n) >= min && c.lat != null && c.lng != null);

/** El cuadrado de una celda, para pintarlo (GeoJSON: [lng, lat]). */
export function cellSquare(c, deg = CELL_DEG) {
  const h = deg / 2;
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  return [[[lng - h, lat - h], [lng + h, lat - h], [lng + h, lat + h], [lng - h, lat + h], [lng - h, lat - h]]];
}

/**
 * Las capas del mapa: demanda (quieren café) y estudio (suelen vender), cada
 * celda con su intensidad 0–1 contra la más llena de su capa.
 */
export function zonesGeoJSON(data, min = MIN_SIGNALS) {
  const layer = (cells, kind) => {
    const shown = visibleCells(cells, min);
    const top = Math.max(1, ...shown.map((c) => Number(c.n)));
    return shown.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: cellSquare(c) },
      properties: { kind, n: Number(c.n), w: Math.round((Number(c.n) / top) * 100) / 100 },
    }));
  };
  return {
    demand: { type: 'FeatureCollection', features: layer(data?.demand, 'demand') },
    study: { type: 'FeatureCollection', features: layer(data?.study, 'study') },
  };
}

/** Plural de la leyenda. */
export function legendLabel(online, seeking) {
  const a = online === 1 ? '1 barista en línea' : `${online} baristas en línea`;
  const b = seeking === 1 ? '1 persona busca café cerca' : `${seeking} personas buscan café cerca`;
  return `${a} · ${b}`;
}

/**
 * Las cuentas de la leyenda: baristas en línea (sin contarse a sí mismo),
 * personas que buscan café en las zonas visibles a menos de `near` metros
 * (todas si no hay posición) y las tazas que esperan a este barista.
 */
export function legendCounts(data, { me = null, selfId = null, near = NEAR_M, min = MIN_SIGNALS } = {}) {
  const online = (data?.baristas ?? []).filter((b) => !b.me && b.id !== selfId).length;
  const cells = visibleCells(data?.demand, min).filter((c) => !me || meters(me, { lat: Number(c.lat), lng: Number(c.lng) }) <= near);
  const seeking = cells.reduce((a, c) => a + Number(c.n), 0);
  const waiting = Number(data?.waiting_cups) || 0;
  return { online, seeking, waiting, label: legendLabel(online, seeking) };
}

/** Lo más pedido en una celda (para el texto): la bebida con más señales, o null. */
export function topDrink(cell) {
  const d = cell?.drinks ?? {};
  let best = null;
  for (const k of DRINKS) if ((d[k] || 0) > 0 && (!best || d[k] > d[best])) best = k;
  return best;
}

/** ¿Se refresca ahora? Solo con la pantalla a la vista y el mapa encendido. */
export const shouldPoll = ({ enabled, visible }) => !!enabled && visible !== false;
