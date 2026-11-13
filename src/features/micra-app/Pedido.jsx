import { useEffect, useRef, useState } from 'react';
import { orderOf, bump, fitsTermos, orderText, DISCOUNTS, HOLD_MAX } from './pedido.js';
import { money } from './micraApp.js';
import platform from './platform.js';

// «Pedido» (13 nov 2026, pedido del usuario): la hoja sube como una calculadora
// y dice cuánto cobrar cuando llega un grupo. No anota ventas: solo cuenta.
// Lo puro está en pedido.js.

/** El total sube contando, como el visor de una calculadora. */
function useCountUp(value) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof requestAnimationFrame !== 'function') { setShown(value); from.current = value; return undefined; }
    const start = performance.now(), a = from.current, ms = 420;
    let raf = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms);
      const v = Math.round(a + (value - a) * (1 - (1 - k) ** 3));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

export default function Pedido({ menu, termos, onClose }) {
  const [qty, setQty] = useState({});
  const [pct, setPct] = useState(0);
  const o = orderOf(menu, qty, pct);
  const shown = useCountUp(o.total);
  const fit = termos ? fitsTermos(o.fromTermo, termos.leftTotal, termos.per) : null;

  const send = () => platform.share({ title: 'Pedido', text: orderText(o, money) });

  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Pedido de grupo" data-testid="pedido">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={onClose} />
      <section className="mapp-sheet mapp-pedido">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <p className="mapp-cota">Pedido de grupo</p>
        <div className="mapp-pedido-screen" aria-live="polite">
          <small>{o.cups ? `${o.cups} ${o.cups === 1 ? 'taza' : 'tazas'}${o.disc ? ` · −${money(o.disc)}` : ''}` : 'Toca lo que piden'}</small>
          <b data-testid="pedido-total">{money(shown)}</b>
          <small>{o.cups > 1 ? `Cobra esto · sale a ${money(o.each)} cada una` : 'Cobra esto'}</small>
        </div>

        {menu.length === 0 ? <p className="mapp-muted">Pon primero tus precios en Vender.</p> : (
          <ul className="mapp-pedido-rows">
            {menu.map((m) => {
              const n = qty[m.id] || 0;
              return (
                <li key={m.id} className={n ? 'is-on' : ''}>
                  <span><b>{m.label}</b><small>{money(m.price)}</small></span>
                  <button type="button" onClick={() => setQty((q) => bump(q, m.id, -1))} disabled={!n} aria-label={`${m.label}: uno menos`}>−</button>
                  <output data-testid={`pedido-n-${m.id}`}>{n}</output>
                  <button type="button" className="is-plus" onClick={() => setQty((q) => bump(q, m.id, 1))} aria-label={`${m.label}: uno más`} data-testid={`pedido-plus-${m.id}`}>+</button>
                  <button type="button" className="is-five" onClick={() => setQty((q) => bump(q, m.id, 5))} aria-label={`${m.label}: cinco más`}>+5</button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mapp-pedido-disc" role="group" aria-label="Descuento de grupo">
          <span>Descuento</span>
          {DISCOUNTS.map((d) => (
            <button key={d} type="button" aria-pressed={pct === d} onClick={() => setPct(d)} data-testid={`pedido-pct-${d}`}>{d ? `${d} %` : 'No'}</button>
          ))}
        </div>

        {o.cups > 0 && (
          <div className="mapp-pedido-notes">
            {fit && o.fromTermo > 0 && (
              <p className={fit.ok ? 'is-ok' : 'is-short'} data-testid="pedido-termos">
                {fit.ok
                  ? `Te alcanza: te quedan ~${fit.left} tintos en los termos después.`
                  : `Te faltan ${fit.short} tintos: necesitas ${fit.more} ${fit.more === 1 ? 'termo' : 'termos'} más.`}
              </p>
            )}
            {o.cups > HOLD_MAX && <p>Por Micra serían {o.holds} apartados de hasta {HOLD_MAX} tazas.</p>}
          </div>
        )}

        <span className="mapp-row-btns">
          <button type="button" className="mapp-btn is-ghost is-small" onClick={() => { setQty({}); setPct(0); }} disabled={!o.cups}>Borrar</button>
          <button type="button" className="mapp-btn is-ghost is-small" onClick={send} disabled={!o.cups}>Mandar el pedido</button>
          <button type="button" className="mapp-btn is-small" onClick={onClose}>Listo</button>
        </span>
        <p className="mapp-fine">Solo calcula: las ventas se anotan con +1.</p>
      </section>
    </div>
  );
}
