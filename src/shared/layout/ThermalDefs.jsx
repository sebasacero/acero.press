import { THERMAL_STOPS, thermalTable } from '../lib/thermal.js';

const LUMA = '.3 .59 .11 0 0  .3 .59 .11 0 0  .3 .59 .11 0 0  0 0 0 1 0';
const funcs = (inkHot) => ['R', 'G', 'B'].map((c, i) => {
  const Tag = `feFunc${c}`;
  return <Tag key={c} type="table" tableValues={thermalTable(i, { inkHot })} />;
});

/**
 * Filtros y degradé de la piel térmica, una vez por página: `#t-thermal` (las
 * personas a tinta, la línea caliente sobre fondo frío), `#t-thermal-photo`
 * (fotos, lo claro caliente) y `#t-heat` (el café de la taza de la meta).
 * Fuera de pantalla, sin `display:none` (el navegador no aplicaría los filtros).
 */
export default function ThermalDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <filter id="t-thermal" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={LUMA} />
        <feComponentTransfer>{funcs(true)}</feComponentTransfer>
      </filter>
      <filter id="t-thermal-photo" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={LUMA} />
        <feGaussianBlur stdDeviation="1.2" />
        <feComponentTransfer>{funcs(false)}</feComponentTransfer>
      </filter>
      <linearGradient id="t-heat" x1="0" y1="1" x2="0" y2="0">
        {[0, 0.25, 0.55, 0.8, 1].map((o, k) => <stop key={o} offset={o} stopColor={THERMAL_STOPS[k]} />)}
      </linearGradient>
    </svg>
  );
}
