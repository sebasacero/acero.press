import './home.css';

// Franja que corre de lado a lado y separa una sección de la anterior. El texto va dos veces
// para que el bucle no tenga salto; la copia es solo decorado (aria-hidden). Con «menos
// movimiento» queda quieta (CSS).
export default function Marquee({ items, tone = 'red' }) {
  const row = (copy) => (
    <span className="marquee-row" aria-hidden={copy || undefined}>
      {items.map((it, i) => <span key={i} className="marquee-item">{it}</span>)}
    </span>
  );
  return (
    <div className={`marquee is-${tone}`} role="note" aria-label={items.join(' · ')}>
      <div className="marquee-track" aria-hidden="true">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
