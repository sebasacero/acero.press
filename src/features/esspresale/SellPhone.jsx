import { useRef, useState } from 'react';
import { useClock } from './parts.jsx';

// Vender, la pantalla del barista en Micra, dentro del celular de la portada (pedido del usuario,
// 6 nov 2026). Se puede tocar: cada +1 suma la taza, la plata del día y llena la taza de la meta,
// con las monedas que saltan como en la app. Es un ejemplo: no escribe nada en ninguna parte.
const GOAL = 12;
const DRINKS = [
  { id: 'tinto', name: 'Tinto', price: 1500 },
  { id: 'perico', name: 'Perico', price: 2000 },
  { id: 'aromatica', name: 'Aromática', price: 1000 },
  { id: 'leche', name: 'Con leche', price: 2500 },
];
// La barra de abajo de la app, con la cámara al centro
const TABS = ['☕', '▦', '📷', '🎓', '💵'];
const money = (n) => `$${n.toLocaleString('es-CO')}`;

function Cup({ pct }) {
  const top = 22 + (1 - pct) * 78;
  return (
    <svg className="sellp-cup" viewBox="0 0 110 118" aria-hidden="true">
      <defs>
        <clipPath id="sellp-cup-in"><path d="M10 22h72v44a34 34 0 0 1-34 34h-4a34 34 0 0 1-34-34z" /></clipPath>
        <linearGradient id="sellp-coffee" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--t-3)" /><stop offset=".55" stopColor="var(--t-4)" /><stop offset="1" stopColor="var(--t-5)" />
        </linearGradient>
      </defs>
      <g clipPath="url(#sellp-cup-in)">
        <path className="sellp-coffee" fill="url(#sellp-coffee)" d={`M0 ${top} q12 -6 24 0 t24 0 t24 0 t24 0 V120 H0z`} />
      </g>
      <path d="M10 22h72v44a34 34 0 0 1-34 34h-4a34 34 0 0 1-34-34z" className="is-line" />
      <path d="M82 34h8a14 14 0 0 1 0 28h-8" className="is-line" />
      <path d="M34 4c-4 6 4 8 0 14M50 2c-4 6 4 8 0 14" className="is-steam" />
      <path d="M2 108h96" className="is-line" />
    </svg>
  );
}

export default function SellPhone({ className = '' }) {
  const { time } = useClock();
  const [sold, setSold] = useState({ tinto: 2, perico: 1, aromatica: 1, leche: 0 });
  const [pops, setPops] = useState([]);
  const seq = useRef(0);
  const cups = Object.values(sold).reduce((a, b) => a + b, 0);
  const cash = DRINKS.reduce((s, d) => s + sold[d.id] * d.price, 0);
  const pct = Math.min(1, cups / GOAL);
  const left = Math.max(0, GOAL - cups);

  const add = (d) => {
    setSold((s) => ({ ...s, [d.id]: s[d.id] + 1 }));
    const id = ++seq.current;
    // Una sola explosión por tarjeta: la nueva reemplaza la anterior y no se enciman
    setPops((p) => [...p.filter((x) => x.drink !== d.id), { id, drink: d.id, label: `+${money(d.price)}` }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1100);
  };

  return (
    <div className={`essp-phone sellp ${className}`} role="group" aria-label="Ejemplo de Micra: el panel de vender del barista. Toca +1.">
      <div className="sellp-top">
        <div className="essp-phone-status"><span>{time}</span><span>5G ▮▮▮</span></div>
        <div className="sellp-where">
          <span className="sellp-pin" aria-hidden="true">📍</span>
          <div><small>Vendiendo en</small><b>Cl. 57 con Cra. 7</b></div>
        </div>
        <div className="sellp-goal">
          <Cup pct={pct} />
          <div>
            <p className="sellp-count" aria-live="polite"><b>{cups}</b><span>/{GOAL}</span></p>
            <p className="sellp-cash">tazas · {money(cash)} hoy</p>
            <p className="sellp-left">{left > 0 ? `${left} más y cumples tu meta` : '¡Meta cumplida! 🎉'}</p>
          </div>
        </div>
        <div className="sellp-bar" aria-hidden="true"><i style={{ width: `${pct * 100}%` }} /></div>
      </div>
      <div className="sellp-grid">
        {DRINKS.map((d) => (
          <div className="sellp-card" key={d.id}>
            <b>{d.name}</b>
            <small>{money(d.price)} · {sold[d.id]} hoy</small>
            <button type="button" className="sellp-plus" onClick={() => add(d)} aria-label={`Vendí un ${d.name.toLowerCase()}`}>+1</button>
            {pops.filter((p) => p.drink === d.id).map((p) => (
              <span className="sellp-pop" key={p.id} aria-hidden="true">
                <em>{p.label}</em>
                <i>🪙</i><i>🪙</i><i>🪙</i>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="sellp-tabs" aria-hidden="true">
        {TABS.map((ic, i) => <span key={ic} className={i === 0 ? 'is-on' : i === 2 ? 'is-cam' : ''}>{ic}</span>)}
      </div>
    </div>
  );
}
