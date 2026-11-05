import { heatStops } from '../lib/thermal.js';

/**
 * Degradé térmico para un `<defs>`: mancha de calor centrada en cada figura
 * (objectBoundingBox), así cada pieza de la AeroPress o el termo tiene la suya.
 * `cy` sube o baja el punto caliente; `from` quita lo más blanco.
 */
export default function HeatGradient({ id, cx = 0.5, cy = 0.6, r = 0.75, from = 0 }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r} fx={cx} fy={cy}>
      {heatStops({ from }).map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
    </radialGradient>
  );
}
