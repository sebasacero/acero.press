// Falso color térmico (escala «ironbow»): de la luminancia de una imagen a la
// escala de las cámaras térmicas. Lo usan los filtros SVG de ThermalDefs.jsx.
// El rojo de la marca (#DE1B1B) es un tramo de la escala, no un color aparte.

/** De lo más caliente a lo más frío. */
export const THERMAL_STOPS = ['#FFF3B0', '#FFC23C', '#F2542D', '#DE1B1B', '#B0127A', '#5A1E9E', '#22125A', '#0D0820'];

/** Canal 0..2 (R, G, B) de un color #RRGGBB, de 0 a 1 con tres decimales. */
export function channel(hex, i) {
  if (!/^#[0-9a-f]{6}$/i.test(hex) || i < 0 || i > 2) throw new Error(`color o canal inválido: ${hex} ${i}`);
  return Math.round((parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255) * 1000) / 1000;
}

/**
 * Valores de `feFunc{R,G,B} tableValues` para un canal. La entrada es la
 * luminancia (0 = negro, 1 = blanco).
 * - `inkHot` (dibujos a tinta): lo oscuro queda caliente y el papel frío.
 * - si no (fotos): lo claro queda caliente, como una cámara de verdad.
 */
export function thermalTable(i, { inkHot = false, stops = THERMAL_STOPS } = {}) {
  const vals = stops.map((h) => channel(h, i));
  return (inkHot ? vals : vals.reverse()).join(' ');
}
