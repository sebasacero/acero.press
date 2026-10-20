import { useEffect, useState } from 'react';
import { parseRecipe } from '../espresaleCard.js';
import { money, PAY_METHODS } from './captions.js';
import Sheet from './Sheet.jsx';
import { IconMinus, IconPlus } from './icons.jsx';

const specsOf = (variety) => {
  const r = parseRecipe(variety?.recipe_text || '');
  const parts = [r.dose && `${r.dose} g`, r.water && `${r.water} ml`, r.temp && `${r.temp} °C`, r.time].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
};

/**
 * Venta en barra. Por defecto: el café del filtro, su presentación más barata,
 * una unidad y el último método de pago. `context` = 'camera' | 'editor'
 * (en el editor también está «Registrar y publicar»).
 */
export default function SaleSheet({ sale, varieties, context, docked, linked, onClose, onRegistered, onRegisterAndSend, sendLabel, onSend, sendOnlyLabel, sendBusy = false, onError }) {
  const [open, setOpen] = useState(0); // línea abierta
  const [phoneOpen, setPhoneOpen] = useState(!!sale.phone);
  const [askStock, setAskStock] = useState(null); // 'sale' | 'send'
  const [done, setDone] = useState(null); // venta registrada (solo acoplada)
  const [fresh, setFresh] = useState(false); // «Nueva venta» sobre una tarjeta ya vendida
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState(null);
  const { lines, total, priced, busy, error } = sale;

  // Stock: se carga la primera vez que se abre la venta (y otra vez cuando llegan las variedades)
  useEffect(() => { if (!sale.stock) sale.loadStock(); }, [sale.loadStock]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open >= lines.length) setOpen(lines.length - 1); }, [lines.length, open]);

  const run = async (mode, force = false) => {
    setVoidError(null);
    if (!force && sale.shortages().length) { setAskStock(mode); return; }
    setAskStock(null);
    try {
      if (mode === 'send') { await onRegisterAndSend(); return; }
      const rec = await sale.register({ attach: context === 'editor' });
      if (!rec) return;
      setFresh(false);
      if (docked) setDone(rec);
      onRegistered?.(rec);
    } catch (e) {
      onError?.(e);
    }
  };

  const short = askStock && sale.shortages()[0];

  if (varieties && !varieties.length) {
    return (
      <Sheet title="Venta" onClose={onClose} docked={docked}>
        <p className="msheet-empty">No hay cafés activos en el catálogo (categoría coffee_bag).</p>
      </Sheet>
    );
  }

  // La venta ya registrada (la recién hecha en el inspector o la de esta tarjeta), si no se anuló
  const candidate = done ?? (!fresh && context === 'editor' ? linked : null);
  // Mientras se anula, la venta sigue a la vista con «Anulando…»
  const shown = candidate && (voiding || !sale.isVoided(candidate.orderId)) ? candidate : null;
  if (shown) {
    const undo = async () => {
      setVoiding(true);
      setVoidError(null);
      try {
        await sale.voidLast(shown);
        setDone(null);
      } catch (e) {
        setVoidError(e.message);
      } finally {
        setVoiding(false);
      }
    };
    return (
      <Sheet title="Venta" aside={<span className="msheet-total">{money(shown.total)}</span>} onClose={onClose} docked={docked}>
        <div className="msheet-success" role="status">
          <p>✓ Venta registrada: {money(shown.total)}. Suma al contador, al dashboard y al inventario.</p>
          <ul className="msheet-sold">
            {shown.lines.map((l, i) => <li key={i}>{l.label} × {l.qty}</li>)}
          </ul>
          {shown.stockError && <p className="msheet-notice is-warn">El inventario no se actualizó: {shown.stockError}</p>}
          {voidError && <p className="msheet-notice is-err" role="alert">{/se anuló/.test(voidError) ? voidError : `No se anuló: ${voidError}`}</p>}
          <div className="msheet-row">
            {!sale.isVoided(shown.orderId) || voiding ? (
              <button type="button" className="msheet-btn" disabled={voiding} onClick={undo}>{voiding ? 'Anulando…' : 'Deshacer'}</button>
            ) : null}
            <button type="button" className="msheet-btn" disabled={voiding} onClick={() => { setDone(null); setFresh(true); }}>Nueva venta</button>
          </div>
          {context === 'editor' && onSend && (
            <button type="button" className="msheet-btn is-primary is-big" disabled={voiding || sendBusy} onClick={onSend}>{sendOnlyLabel}</button>
          )}
        </div>
      </Sheet>
    );
  }

  const footer = (
    <>
      {voidError && /se anuló/.test(voidError) && <p className="msheet-notice is-warn" role="alert">{voidError}</p>}
      {short && (
        <div className="msheet-notice is-warn" role="alert">
          <p>No hay stock de {short.variant.label} en el inventario. ¿Registrar igual?</p>
          <div className="msheet-row">
            <button type="button" className="msheet-btn" onClick={() => run(askStock, true)}>Registrar igual</button>
            <button type="button" className="msheet-btn is-ghost" onClick={() => setAskStock(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="msheet-notice is-err" role="alert">No se registró la venta: {error}</p>}
      <button type="button" className="msheet-btn is-primary is-big" disabled={!priced || busy} onClick={() => run('sale')}>
        {busy ? 'Registrando…' : `Registrar venta · ${money(total)}`}
      </button>
      {context === 'editor' && onRegisterAndSend && (
        <button type="button" className="msheet-btn is-ghost" disabled={!priced || busy} onClick={() => run('send')}>{sendLabel}</button>
      )}
    </>
  );

  return (
    <Sheet
      title="Venta"
      aside={<span className="msheet-total">{money(total)}</span>}
      onClose={onClose}
      docked={docked}
      size="tall"
      footer={footer}
    >
      {varieties === null && <p className="msheet-empty">Cargando variedades…</p>}
      <ol className="msheet-lines">
        {lines.map((l, i) => {
          const isOpen = i === open || lines.length === 1;
          const st = l.variant ? sale.stockFor(l.variant.id) : null;
          return (
            <li key={l.key} className={`msheet-line ${isOpen ? 'is-open' : ''}`}>
              <div className="msheet-line-head">
                <button type="button" className="msheet-line-name" onClick={() => setOpen(i)} aria-expanded={isOpen}>
                  {l.variety?.image_url ? <img src={l.variety.image_url} alt="" loading="lazy" /> : <i aria-hidden="true">{(l.variety?.name || '?').slice(0, 1)}</i>}
                  <span>{l.variety?.name ?? 'Café'}{l.variant ? ` · ${l.variant.label}` : ''}</span>
                </button>
                <div className="msheet-stepper" role="group" aria-label="Cantidad">
                  <button type="button" onClick={() => sale.setLine(i, { qty: l.qty - 1 })} disabled={l.qty <= 1} aria-label="Una menos"><IconMinus size={18} /></button>
                  <output aria-live="polite">{l.qty}</output>
                  <button type="button" onClick={() => sale.setLine(i, { qty: l.qty + 1 })} aria-label="Una más"><IconPlus size={18} /></button>
                </div>
                <b className="msheet-line-price">{l.variant ? money(l.subtotal) : '—'}</b>
                {lines.length > 1 && <button type="button" className="msheet-line-x" onClick={() => sale.removeLine(i)} aria-label={`Quitar ${l.variety?.name ?? 'línea'}`}>×</button>}
              </div>
              {isOpen && (
                <div className="msheet-line-body">
                  <div className="msheet-chips" role="listbox" aria-label="Café">
                    {(varieties ?? []).map((v) => (
                      <button key={v.id} type="button" role="option" aria-selected={String(v.id) === String(l.varietyId)} className={`msheet-chip ${String(v.id) === String(l.varietyId) ? 'on' : ''}`} onClick={() => sale.setLine(i, { varietyId: v.id })}>
                        {v.name}
                      </button>
                    ))}
                  </div>
                  <p className="msheet-specs">{specsOf(l.variety) ?? 'Esta variedad no tiene receta — agrégala en Catálogo.'}</p>
                  {l.variants.length === 0 ? (
                    <p className="msheet-empty">Sin presentaciones con precio activas (Catálogo).</p>
                  ) : (
                    <div className="msheet-chips" role="listbox" aria-label="Presentación">
                      {l.variants.map((x) => {
                        const s = sale.stockFor(x.id);
                        return (
                          <button key={x.id} type="button" role="option" aria-selected={x.id === l.variantId} className={`msheet-chip ${x.id === l.variantId ? 'on' : ''}`} onClick={() => sale.setLine(i, { variantId: x.id })}>
                            {x.label} · {money(x.price)}
                            {s && <small className={`msheet-stock ${s.qty <= 0 ? 'is-out' : s.qty <= s.low ? 'is-low' : ''}`}>{s.qty <= 0 ? 'sin stock' : `quedan ${s.qty}`}</small>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {st && st.qty < l.qty && st.qty > 0 && <p className="msheet-fine">Solo quedan {st.qty} en el inventario.</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {(varieties ?? []).length > 0 && (
        <button type="button" className="msheet-add" onClick={() => { sale.addLine(); setOpen(lines.length); }}>+ Otro café</button>
      )}

      <div className="msheet-group">
        <span className="msheet-label">Pago</span>
        <div className="msheet-chips is-grid" role="radiogroup" aria-label="Método de pago">
          {PAY_METHODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={sale.payMethod === m.id} className={`msheet-chip ${sale.payMethod === m.id ? 'on' : ''}`} onClick={() => sale.setPayMethod(m.id)}>{m.label}</button>
          ))}
        </div>
      </div>

      {phoneOpen ? (
        <label className="msheet-group">
          <span className="msheet-label">WhatsApp del cliente (opcional)</span>
          <input className="msheet-input" type="tel" inputMode="tel" autoComplete="off" placeholder="300 123 4567" value={sale.phone} onChange={(e) => sale.setPhone(e.target.value)} />
          <small className="msheet-fine">Va con la venta y la tarjeta</small>
        </label>
      ) : (
        <button type="button" className="msheet-add" onClick={() => setPhoneOpen(true)}>+ WhatsApp del cliente (opcional)</button>
      )}
    </Sheet>
  );
}
