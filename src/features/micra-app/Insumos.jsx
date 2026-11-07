import { useEffect, useState } from 'react';
import * as api from './api.js';
import platform from './platform.js';
import { CATEGORIES, itemsOf, iconOf, bumpInsumo, orderLines, orderCount, insumosText, readLastOrder, writeLastOrder } from './insumos.js';

// Insumos en Mi perfil del barista (6 nov 2026, pedido del usuario): una sección con las
// categorías y una hoja para armar el pedido; sale por WhatsApp al equipo. Lo puro en insumos.js.

/** La sección del perfil: las categorías a la vista y, si hay, repetir el último pedido. */
export function InsumosSection({ onOpen }) {
  const last = readLastOrder();
  return (
    <section className="mapp-pgroup mapp-insumos" aria-labelledby="mapp-insumos-t" data-testid="insumos">
      <h2 className="mapp-pgroup-t" id="mapp-insumos-t">Insumos</h2>
      <p className="mapp-insumos-lead">Pide lo que se te acaba y el equipo te lo lleva.</p>
      <div className="mapp-insumos-cats">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" onClick={() => onOpen(c.id)} data-testid={`insumos-${c.id}`}>
            <span aria-hidden="true">{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      {last && (
        <button type="button" className="mapp-link" onClick={() => onOpen(null, last.cart)} data-testid="insumos-repeat">
          Repetir mi último pedido · {orderCount(last.cart)} {orderCount(last.cart) === 1 ? 'cosa' : 'cosas'}
        </button>
      )}
    </section>
  );
}

/** La hoja del pedido: categorías arriba, cada insumo con − y +, una nota y el WhatsApp. */
export function InsumosSheet({ name, where, cat = 'cafe', cart: startCart = null, onClose }) {
  const [tab, setTab] = useState(cat ?? 'cafe');
  const [cart, setCart] = useState(startCart ?? {});
  const [note, setNote] = useState('');
  const [number, setNumber] = useState(null);
  useEffect(() => { api.teamWhatsApp().then(setNumber).catch(() => setNumber('573152125327')); }, []);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const lines = orderLines(cart);
  const count = orderCount(cart);
  const ready = number && (lines.length > 0 || note.trim());
  const send = () => {
    if (!ready) return;
    writeLastOrder(cart);
    platform.openExternal(`https://wa.me/${number}?text=${encodeURIComponent(insumosText({ name, where, cart, note }))}`);
  };
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Pedir insumos" data-testid="insumos-sheet">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section className="mapp-sheet is-scroll mapp-insumos-sheet">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <header className="mapp-sheet-head">
          <h2 className="mapp-title is-small">Pedir insumos</h2>
          <button type="button" className="mapp-link" onClick={onClose}>Cerrar</button>
        </header>
        <div className="mapp-insumos-tabs" role="tablist" aria-label="Categorías">
          {CATEGORIES.map((c) => {
            const n = itemsOf(c.id).reduce((s, i) => s + (cart[i.id] || 0), 0);
            return (
              <button key={c.id} type="button" role="tab" aria-selected={tab === c.id} className={tab === c.id ? 'on' : ''} onClick={() => setTab(c.id)}>
                <span aria-hidden="true">{c.icon}</span>{c.label}{n > 0 && <b>{n}</b>}
              </button>
            );
          })}
        </div>
        {/* Como una góndola de las apps de domicilios (pedido del usuario, 7 nov 2026): el
            producto en su repisa, el «+» encima y, al agregar, el contador en su lugar */}
        <ul className="mapp-gondola">
          {itemsOf(tab).map((i) => {
            const q = cart[i.id] || 0;
            return (
              <li key={i.id} className={q ? 'on' : ''}>
                <span className="mapp-gondola-shelf" aria-hidden="true"><span>{iconOf(i)}</span></span>
                <span className={`mapp-gondola-add ${q ? 'is-open' : ''}`}>
                  {q > 0 && <button type="button" onClick={() => setCart((c) => bumpInsumo(c, i.id, -1))} aria-label={`Quitar ${i.label}`}>−</button>}
                  {q > 0 && <output aria-live="polite" data-testid={`insumo-${i.id}`}>{q}</output>}
                  <button type="button" onClick={() => setCart((c) => bumpInsumo(c, i.id, 1))} aria-label={`Agregar ${i.label}`}>+</button>
                </span>
                <b>{i.label}</b>
                <small>{i.unit}</small>
                {i.note && <small className="mapp-gondola-note">{i.note}</small>}
              </li>
            );
          })}
        </ul>
        <label className="mapp-field">
          <span>¿Algo más?</span>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Ej.: vasos rojos, pitillos" />
        </label>
        {lines.length > 0 && (
          <p className="mapp-insumos-sum" data-testid="insumos-sum">
            Tu pedido: {lines.map((l) => l.text).join(' · ')}
          </p>
        )}
        <p className="mapp-fine">El equipo te confirma el precio y cuándo te llega. Pagas al recibir.</p>
        {/* La canasta abajo, siempre a la mano */}
        <div className="mapp-gondola-cart">
          <button type="button" className="mapp-btn is-cta" onClick={send} disabled={!ready} data-testid="insumos-send">
            {count ? <><i aria-hidden="true">{count}</i>Pedir por WhatsApp</> : 'Pedir por WhatsApp'}
          </button>
        </div>
      </section>
    </div>
  );
}
