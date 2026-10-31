import { useState } from 'react';
import * as api from './api.js';
import platform from './platform.js';
import { money } from './micraApp.js';
import Animado from './Animado.jsx';
import { OUT_MODES, PAY_METHODS, cleanMethods, toggleMethod, newProduct, MAX_EXTRAS } from './flow.js';

// Piezas del flujo del barista: cómo sale, el permiso para salir (mapa y
// ubicación en una sola hoja), cómo le pagan (solo el medio) y el «+» para
// agregar sus propios productos junto a tinto, perico y aromática.

/** Puesto fijo, sombrilla o caminando, con los iconos del logo de Micra. */
export function ModePicker({ mode, onPick, disabled = false }) {
  return (
    <section className="mapp-outmodes" aria-label="¿Cómo sales hoy?" data-testid="out-modes">
      <p className="mapp-cota">¿Cómo sales hoy?</p>
      <div role="radiogroup" aria-label="Cómo sales">
        {OUT_MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => onPick(m.id)} disabled={disabled} data-testid={`mode-${m.id}`}>
            {m.anim ? <Animado name={m.anim} className="is-mode" /> : <img src={platform.siteUrl(m.icon)} alt="" width="64" height="64" />}
            <b>{m.label}</b>
            <small>{m.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Lo que falta para salir, en una hoja: aparecer en el mapa público y usar la
 * ubicación (Ley 1581). Al aceptar, el celular pide su propio permiso de GPS.
 */
export function GoOutConsent({ needs, mode, busy, onAccept, onCancel }) {
  const [pub, setPub] = useState(!needs.public);
  const [loc, setLoc] = useState(!needs.location);
  const walking = mode === 'caminando';
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Permisos para salir" data-testid="location-consent">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={onCancel} />
      <section className="mapp-sheet">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <p className="mapp-cota">Antes de salir</p>
        <h2 className="mapp-title is-small">Para que tus clientes te encuentren</h2>
        {needs.public && (
          <label className="mapp-check">
            <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} data-testid="consent-public" />
            <span><b>Salir en el mapa de Micra.</b> Los clientes ven tu nombre de pila, tu punto y tus precios, y te pueden apartar café.</span>
          </label>
        )}
        {needs.location && (
          <label className="mapp-check">
            <input type="checkbox" checked={loc} onChange={(e) => setLoc(e.target.checked)} data-testid="consent-location" />
            <span><b>Usar mi ubicación mientras vendo.</b> {walking ? 'Caminando, grabamos tu recorrido' : 'Marcamos dónde estás'} para que te encuentren y para mejorar la app. Al volver con la flecha (←) deja de usarla.</span>
          </label>
        )}
        <p className="mapp-fine">Después, tu celular te pide permiso para la ubicación: toca «Permitir». Puedes retirar estos permisos en Mi perfil. <a className="mapp-link" href={platform.siteUrl('/privacidad#ubicacion')} target="_blank" rel="noreferrer">Cómo usamos tu ubicación</a></p>
        <button type="button" className="mapp-btn is-cta" disabled={busy || !pub || !loc} onClick={() => onAccept({ public: needs.public, location: needs.location })} data-testid="consent-accept">{busy ? 'Un momento…' : 'Aceptar y salir'}</button>
        <button type="button" className="mapp-link" onClick={onCancel}>Ahora no</button>
      </section>
    </div>
  );
}

/** Cómo le pagan: solo se escoge el medio; el número se lo da al cliente en persona. */
export function PayMethods({ methods, asId, onSaved, onCancel }) {
  const [pick, setPick] = useState(() => cleanMethods(methods?.length ? methods : ['efectivo']));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try { await api.setPayMethods(pick, asId); onSaved?.(pick); } catch (e) { setError(e.missing ? 'Esto abre muy pronto.' : e.message); }
    setBusy(false);
  };
  return (
    <div className="mapp-paymethods" data-testid="pay-settings">
      <p className="mapp-muted">Escoge con qué te pueden pagar. Tus clientes lo ven en tu tarjeta.</p>
      <div className="mapp-chips is-big is-wrap" role="group" aria-label="Medios de pago">
        {PAY_METHODS.map((m) => (
          <button key={m.id} type="button" className={pick.includes(m.id) ? 'on' : ''} aria-pressed={pick.includes(m.id)} onClick={() => setPick((p) => toggleMethod(p, m.id))}>{pick.includes(m.id) ? '✓ ' : ''}{m.label}</button>
        ))}
      </div>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <span className="mapp-row-btns">
        <button type="button" className="mapp-btn is-small" onClick={save} disabled={busy || pick.length === 0} data-testid="pay-save">{busy ? 'Guardando…' : 'Guardar'}</button>
        {onCancel && <button type="button" className="mapp-link" onClick={onCancel}>Cancelar</button>}
      </span>
    </div>
  );
}

/** El formulario del «+»: nombre y precio. */
function AddForm({ asId, onAdded, onCancel }) {
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const p = newProduct(label, price);
    if (p.error) { setError(p.error); return; }
    setBusy(true);
    setError(null);
    try { const r = await api.addProduct(p.label, p.price, asId); onAdded?.(r); } catch (err) { setError(err.missing ? 'Agregar productos abre muy pronto.' : err.message); }
    setBusy(false);
  };
  return (
    <form className="mapp-glass mapp-addprod" onSubmit={submit} data-testid="product-form">
      <p className="mapp-cota">Otro producto</p>
      <label className="mapp-field"><span>¿Qué vendes?</span><input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 24))} placeholder="Ej.: Empanada, pan de bono, agua" autoFocus /></label>
      <label className="mapp-field is-row">
        <span>Precio</span>
        <span className="mapp-money"><i>$</i><input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="—" aria-label="Precio" /></span>
      </label>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <span className="mapp-row-btns">
        <button type="submit" className="mapp-btn is-small" disabled={busy}>{busy ? 'Guardando…' : 'Agregar'}</button>
        <button type="button" className="mapp-link" onClick={onCancel}>Cancelar</button>
      </span>
    </form>
  );
}

/** La tarjeta con «+» que va junto a tinto, perico y aromática. */
export function AddProductTile({ asId, count = 0, onAdded, compact = false }) {
  const [open, setOpen] = useState(false);
  if (count >= MAX_EXTRAS) return null;
  if (open) return <AddForm asId={asId} onCancel={() => setOpen(false)} onAdded={(r) => { setOpen(false); onAdded?.(r); }} />;
  return (
    <button type="button" className={`mapp-tile mapp-addtile ${compact ? 'is-compact' : ''}`} onClick={() => setOpen(true)} data-testid="product-add">
      <span className="mapp-addtile-plus" aria-hidden="true">+</span>
      <span><b>Otro producto</b><small>Empanada, pan, agua…</small></span>
    </button>
  );
}

/** Los productos en tarjetas, como en Vender, con el «+» al final (Mi perfil). */
export function ProductGrid({ menu, asId, extrasCount = 0, onChanged }) {
  const [busy, setBusy] = useState(null);
  const remove = async (id) => {
    setBusy(id);
    try { await api.removeProduct(id, asId); onChanged?.(); } catch { /* sigue en la lista */ }
    setBusy(null);
  };
  return (
    <div className="mapp-pgrid" data-testid="product-grid">
      {menu.map((m) => (
        <div key={m.id} className="mapp-tile is-mini">
          <b>{m.label}</b>
          <span>{money(m.price)}</span>
          {m.custom && <button type="button" className="mapp-link" onClick={() => remove(m.id)} disabled={busy === m.id} aria-label={`Quitar ${m.label}`}>Quitar</button>}
        </div>
      ))}
      <AddProductTile asId={asId} count={extrasCount} onAdded={onChanged} compact />
    </div>
  );
}
