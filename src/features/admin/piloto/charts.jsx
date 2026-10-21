import { money } from './fmt.js';

// Gráficas del informe: pocas y legibles impresas en blanco y negro. Una sola
// tinta por gráfica (no hay series que distinguir), cada barra dice «4 de 9»
// y la mediana va marcada en rojo. Sin datos, lo dicen en vez de dibujar ceros.

/** Barras horizontales de una pregunta: el largo es la parte de quienes respondieron. */
export function Bars({ tally, label, empty = 'Aún no hay respuestas.' }) {
  if (tally.suppressed) {
    return <p className="rep-muted">Respondieron {tally.n}: con menos de 5 no se muestra, para que nadie se pueda reconocer.</p>;
  }
  if (!tally.n) return <p className="rep-muted">{empty}</p>;
  return (
    <div className="rep-bars-wrap">
      <ul className="rep-bars" aria-label={label}>
        {tally.rows.map((r) => (
          <li key={String(r.value)}>
            <span className="rep-bar-label">{r.label}</span>
            <span className="rep-bar-track" aria-hidden="true"><i style={{ '--w': `${Math.max(2, (r.count / tally.n) * 100)}%` }} /></span>
            <b>{r.count} de {tally.n}</b>
          </li>
        ))}
      </ul>
      {tally.hidden > 0 && (
        <p className="rep-fine">{tally.hidden} {tally.hidden === 1 ? 'respuesta queda' : 'respuestas quedan'} en grupos de menos de 5 y no se {tally.hidden === 1 ? 'muestra' : 'muestran'}.</p>
      )}
    </div>
  );
}

/**
 * Precio del tinto, un punto por puesto sobre una línea de precios; los
 * iguales se apilan. La mediana en rojo. Al pasar el cursor: zona y tazas.
 */
export function PriceStrip({ price }) {
  const { dots, median, min, max, n } = price;
  if (!n) return <p className="rep-muted">Aún no hay precios observados: se anotan en la ficha de cada tintero.</p>;
  let lo = Math.floor((min * 0.85) / 100) * 100;
  let hi = Math.ceil((max * 1.15) / 100) * 100;
  if (hi - lo < 1000) { lo = Math.max(0, lo - 500); hi += 500; }
  const W = 640;
  const pad = 40;
  const x = (v) => pad + ((v - lo) / (hi - lo)) * (W - 2 * pad);
  const stacks = new Map();
  const placed = dots.map((d) => {
    const k = stacks.get(d.price) ?? 0;
    stacks.set(d.price, k + 1);
    return { ...d, k };
  });
  const tall = Math.max(...stacks.values());
  const axisY = 34 + tall * 15;
  const H = axisY + 34;
  const ticks = [...new Set([min, median, max])];
  return (
    <svg className="rep-strip" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Precio del tinto en ${n} ${n === 1 ? 'puesto' : 'puestos'}: mediana ${money(median)}${n > 1 ? `, de ${money(min)} a ${money(max)}` : ''}.`}>
      <line x1={pad - 12} x2={W - pad + 12} y1={axisY} y2={axisY} className="rep-strip-axis" />
      <line x1={x(median)} x2={x(median)} y1={14} y2={axisY} className="rep-strip-median" />
      <text x={x(median)} y={10} textAnchor="middle" className="rep-strip-mtext">mediana {money(median)}</text>
      {placed.map((d, i) => (
        <circle key={i} cx={x(d.price)} cy={axisY - 10 - d.k * 15} r={6} className="rep-strip-dot">
          <title>{`${money(d.price)}${d.zone ? ` · ${d.zone}` : ''}${d.cupsDay ? ` · ${d.cupsDay} tazas al día` : ''}`}</title>
        </circle>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={axisY} y2={axisY + 5} className="rep-strip-axis" />
          <text x={x(t)} y={axisY + 20} textAnchor="middle" className="rep-strip-tick">{money(t)}</text>
        </g>
      ))}
    </svg>
  );
}

/** Una cifra con su etiqueta y de dónde sale (n, observado/declarado, supuesto). */
export function Figure({ label, value, foot, accent = false }) {
  return (
    <div className={`rep-fig ${accent ? 'is-accent' : ''}`}>
      <span className="rep-fig-label">{label}</span>
      <strong className="rep-fig-num">{value}</strong>
      {foot && <span className="rep-fig-foot">{foot}</span>}
    </div>
  );
}
