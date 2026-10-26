// El mapa del estudio de calle: lo que micra_street_map devuelve (cuadras con
// tazas vendidas y tinteros, sin datos de nadie) convertido en lo que
// drawBogotaMap dibuja. Solo matemáticas, sin Supabase: así corre en
// node --test (la llamada a la base vive en useStreetMap.js).
import { toCuadra } from './bogotaGeo.js';

// Una coordenada ausente (null, '') no es la cuadra 0: `+null` daría 0 y pasaría por número
const coord = (v) => (v === null || v === undefined || v === '' ? NaN : +v);
const placed = (r) => Number.isFinite(coord(r.carrera)) && Number.isFinite(coord(r.calle));

/** Radio del calor por cuadra: una venta aislada calienta poco; muchas, más lejos. */
const radius = (cups, max) => 2.5 + 3.5 * Math.sqrt(cups / max);

/**
 * Puntos de calor [carrera, calle, peso 0–1, radio] a partir de las ventas por
 * cuadra. El peso es relativo a la cuadra que más vendió. Vacío si no hay ventas.
 */
export function heatFromSales(sales) {
  const rows = (sales ?? []).filter((r) => placed(r) && +r.cups > 0);
  if (!rows.length) return [];
  const max = Math.max(...rows.map((r) => +r.cups));
  return rows.map((r) => [+r.carrera, +r.calle, +r.cups / max, radius(+r.cups, max)]);
}

const STAGE_TAG = { prospecto: 'T', piloto: 'P', activo: 'A', pausa: 'T' };

/**
 * La cuadra de un tintero: la que se escribió en la ficha o, si solo tiene el
 * punto del GPS (la ficha en la calle ya no pide cuadra), la más cercana a
 * ese punto. null en el sur y donde la cuadrícula no llega.
 */
export function tinteroBlock(t) {
  if (placed(t)) return { carrera: +t.carrera, calle: +t.calle };
  const lat = coord(t.lat);
  const lng = coord(t.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? toCuadra(lng, lat) : null;
}

/**
 * Pines [carrera, calle, etiqueta, destacado] de los tinteros: la etiqueta es
 * corta («T · 25/h») y nunca lleva nombre. Los activos van destacados en rojo.
 */
export function pinsFromTinteros(tinteros) {
  return (tinteros ?? []).flatMap((t) => {
    const at = tinteroBlock(t);
    if (!at) return [];
    const tag = STAGE_TAG[t.stage] ?? 'T';
    const rate = t.cups_per_hour != null && Number.isFinite(+t.cups_per_hour) ? ` · ${Math.round(+t.cups_per_hour)}/h` : '';
    return [[at.carrera, at.calle, `${tag}${rate}`, t.stage === 'activo']];
  });
}

/** Resumen para contar en pantalla: cuadras con ventas, tazas, tinteros. */
export function summarize(map) {
  const sales = map?.sales ?? [];
  const tinteros = map?.tinteros ?? [];
  return {
    blocks: sales.length,
    cups: sales.reduce((n, r) => n + (+r.cups || 0), 0),
    tinteros: tinteros.length,
    zones: [...new Set([...sales, ...tinteros].map((r) => r.zone).filter(Boolean))],
    days: map?.days ?? 90,
  };
}

/** Lo que se le pasa a la vista del mapa (heatPoints/pinPoints) o nada si el estudio está vacío. */
export function mapLayers(map) {
  const heatPoints = heatFromSales(map?.sales);
  const pinPoints = pinsFromTinteros(map?.tinteros);
  return { heatPoints, pinPoints, real: heatPoints.length > 0 || pinPoints.length > 0 };
}
