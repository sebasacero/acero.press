import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import * as api from './api.js';
import platform from './platform.js';
import { money, sortBaristas } from './micraApp.js';
import { ORIGEN_KEY, KINDS, readOrigen, sellersOf, sellerById, monogram, cupsPerKilo, shopItems, filterShop, shopItemById, SHOP_CATEGORIES, bumpCart, cartLines, cartCount, cartTotal, shopText, DELIVERY } from './origen.js';

// El café de origen para el cliente (7 nov 2026, pedido del usuario): el directorio de marcas y
// fincas (/micra/origen), el perfil de cada una (/micra/origen/<id>) y la tienda con la góndola
// (/micra/tienda), como la de Insumos. Lo puro en origen.js; los pedidos van por WhatsApp.

/** app_config `micra_origen`, leído una vez por pantalla. */
export function useOrigen() {
  const [origen, setOrigen] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.from('app_config').select('value').eq('key', ORIGEN_KEY).maybeSingle()
      .then(({ data }) => alive && setOrigen(readOrigen(data?.value)))
      .catch(() => alive && setOrigen(readOrigen(null)));
    return () => { alive = false; };
  }, []);
  return origen;
}

/** El logo de una marca (monograma sobre su color) o las iniciales de quien tiene la finca. */
export function SellerMark({ s, big = false }) {
  const finca = s.kind === 'finca';
  return (
    <span className={`mapp-omark ${finca ? 'is-finca' : ''} ${big ? 'is-big' : ''}`} style={!finca && s.color ? { background: s.color } : undefined} aria-hidden="true">
      {finca ? '🫘' : monogram(s.name)}
    </span>
  );
}

/** La cabecera naranja de estas pantallas, con el gradiente de la ficha del barista. */
function OHead({ kicker, title, pill, cold = false, back, go, testid }) {
  return (
    <section className={`mapp-ohead ${cold ? 'is-cold' : ''}`} data-testid={testid}>
      {back && <button type="button" className="mapp-back" onClick={() => go(back.to)}>‹ {back.label}</button>}
      <div className="mapp-ohead-row">
        <div><p className="mapp-ohead-kicker">{kicker}</p><h1 className="mapp-ohead-title">{title}</h1></div>
        {pill && <span className="mapp-ohead-pill">{pill}</span>}
      </div>
    </section>
  );
}

export function SellerRow({ s, go }) {
  return (
    <li>
      <button type="button" className="mapp-orow" onClick={() => go(`/micra/origen/${s.id}`)} data-testid={`seller-${s.id}`}>
        <SellerMark s={s} />
        <span className="mapp-orow-txt">
          <b>{s.name}</b>
          <small>{[s.city, `${s.lots.length} ${s.lots.length === 1 ? 'café' : 'cafés'}`, s.baristas ? `${s.baristas} ${s.baristas === 1 ? 'barista prepara' : 'baristas preparan'} con ${s.kind === 'finca' ? 'ella' : 'ella'}` : null].filter(Boolean).join(' · ')}</small>
        </span>
        {s.verified && <span className="mapp-oseal">✓</span>}
        <span className="mapp-orow-go" aria-hidden="true">›</span>
      </button>
    </li>
  );
}

/** Marcas y fincas dentro de la pestaña Café (12 nov 2026, pedido del usuario): las primeras
 *  de cada clase ahí mismo, «Ver todas» abre /micra/origen y el caficultor tiene su camino. */
export function OrigenStrip({ go, max = 4 }) {
  const origen = useOrigen();
  const list = origen ? sellersOf(origen).slice(0, max) : [];
  const more = origen ? Math.max(0, sellersOf(origen).length - list.length) : 0;
  return (
    <section className="mapp-glass mapp-ogroup mapp-ostrip" aria-labelledby="cafe-origen-h" data-testid="cafe-origen-strip">
      <div className="mapp-ostrip-head">
        <h2 id="cafe-origen-h" className="mapp-kicker">Marcas y fincas</h2>
        <button type="button" className="mapp-link" onClick={() => go('/micra/origen')} data-testid="cafe-origen">{more > 0 ? `Ver todas (${more + list.length}) ›` : 'Ver todas ›'}</button>
      </div>
      {!origen && <p className="mapp-fine">Cargando…</p>}
      {origen && list.length > 0 && <ul className="mapp-olist">{list.map((s) => <SellerRow key={s.id} s={s} go={go} />)}</ul>}
      {origen && list.length === 0 && <p className="mapp-fine" data-testid="cafe-origen-empty">Todavía no hay marcas ni fincas en Micra. Las primeras salen aquí cuando firmen.</p>}
      <button type="button" className="mapp-link mapp-origen-finca" onClick={() => go('/micra/fincas')} data-testid="cafe-to-finca">Soy caficultor: quiero vender mi café</button>
    </section>
  );
}

/** /micra/origen: quién hace el café. Marcas con acuerdo y fincas verificadas. */
export function OrigenDirectory({ go }) {
  const origen = useOrigen();
  const [filter, setFilter] = useState('todas');
  const [team, setTeam] = useState(null);
  useEffect(() => { api.teamWhatsApp().then(setTeam).catch(() => setTeam('573152125327')); }, []);
  const list = sellersOf(origen, filter);
  const marcas = sellersOf(origen, 'marcas');
  const fincas = sellersOf(origen, 'fincas');
  const ask = `https://wa.me/${team}?text=${encodeURIComponent('Hola, equipo de Micra. Tengo una marca o una finca de café y quiero venderlo con ustedes.')}`;
  return (
    <div className="mapp-client mapp-origen" data-testid="origen">
      <OHead kicker="Quién hace el café que tomas" title="Marcas y fincas" pill="Café de Colombia" back={{ to: '/micra', label: 'Inicio' }} go={go} testid="origen-head" />
      <div className="mapp-chips is-scroll mapp-origen-chips" role="tablist" aria-label="Filtrar">
        {[['todas', 'Todas'], ['marcas', 'Marcas'], ['fincas', 'Fincas']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
        <button type="button" className="mapp-origen-shop" onClick={() => go('/micra/tienda')} data-testid="to-shop">🛍 Tienda</button>
      </div>
      {!origen && <p className="mapp-fine">Cargando…</p>}
      {origen && (filter !== 'fincas') && marcas.length > 0 && (
        <section className="mapp-glass mapp-ogroup" aria-labelledby="o-marcas">
          <h2 id="o-marcas" className="mapp-kicker">Marcas · con acuerdo</h2>
          <ul className="mapp-olist">{(filter === 'todas' ? marcas : list).map((s) => <SellerRow key={s.id} s={s} go={go} />)}</ul>
        </section>
      )}
      {origen && (filter !== 'marcas') && fincas.length > 0 && (
        <section className="mapp-glass mapp-ogroup" aria-labelledby="o-fincas">
          <h2 id="o-fincas" className="mapp-kicker">Fincas · verificadas por el equipo</h2>
          <ul className="mapp-olist">{(filter === 'todas' ? fincas : list).map((s) => <SellerRow key={s.id} s={s} go={go} />)}</ul>
        </section>
      )}
      {origen && list.length === 0 && (
        <section className="mapp-glass mapp-ogroup"><p className="mapp-fine" data-testid="origen-empty">Todavía no hay {filter === 'marcas' ? 'marcas con acuerdo' : filter === 'fincas' ? 'fincas verificadas' : 'marcas ni fincas'} en Micra. Las primeras salen aquí cuando firmen.</p></section>
      )}
      <a className="mapp-btn is-ghost" href={ask} target="_blank" rel="noopener noreferrer" data-testid="origen-ask">¿Tienes una marca o una finca? Escríbenos</a>
      <button type="button" className="mapp-link mapp-origen-finca" onClick={() => go('/micra/fincas')} data-testid="to-finca">Soy caficultor: quiero vender mi café</button>
    </div>
  );
}

/** /micra/origen/<id>: el perfil de una marca o una finca con sus cafés. */
export function SellerPage({ id, go }) {
  const origen = useOrigen();
  const s = sellerById(origen, id);
  if (!origen) return <p className="mapp-fine">Cargando…</p>;
  if (!s) {
    return (
      <div className="mapp-client mapp-origen"><button type="button" className="mapp-back" onClick={() => go('/micra/origen')}>‹ Marcas y fincas</button><p className="mapp-fine" data-testid="seller-missing">Esta marca o finca ya no está en Micra.</p></div>
    );
  }
  const finca = s.kind === 'finca';
  const meta = finca
    ? [s.city, s.altitude ? `${s.altitude.toLocaleString('es-CO')} m` : null].filter(Boolean).join(' · ')
    : [KINDS.marca, s.city, s.since ? `desde ${s.since}` : null].filter(Boolean).join(' · ');
  return (
    <div className="mapp-client mapp-origen" data-testid="seller">
      <OHead kicker={meta} title={s.name} pill={s.verified ? '✓ Verificada' : finca ? 'Finca' : '✓ Aliada'} cold={!finca} back={{ to: '/micra/origen', label: 'Marcas y fincas' }} go={go} testid="seller-head" />
      <section className={`mapp-ocover ${finca ? 'is-finca' : ''}`} style={!finca && s.color ? { '--o-color': s.color } : undefined} aria-hidden="true"><SellerMark s={s} big /></section>
      {(s.owner || s.desc) && (
        <div className="mapp-orow is-static">
          {s.owner && <span className="mapp-omark is-finca is-ini" aria-hidden="true">{monogram(s.owner)}</span>}
          <span className="mapp-orow-txt">
            {s.owner && <b>{s.owner}</b>}
            <small>{s.desc || [finca ? 'Caficultora' : null, s.hectares ? `${s.hectares.toLocaleString('es-CO')} ha` : null, s.since ? `desde ${s.since}` : null].filter(Boolean).join(' · ')}</small>
          </span>
        </div>
      )}
      <dl className="mapp-okv">
        <div><dd>{s.lots.length}</dd><dt>{s.lots.length === 1 ? 'café' : 'cafés'}</dt></div>
        <div><dd>{s.baristas}</dd><dt>baristas</dt></div>
        {s.points.length > 0 ? <div><dd>{s.points.length}</dd><dt>{s.points.length === 1 ? 'tienda' : 'tiendas'}</dt></div> : <div><dd>{cupsPerKilo()}</dd><dt>tazas por kilo</dt></div>}
      </dl>
      <p className="mapp-kicker">{finca ? 'Lotes disponibles' : 'Sus cafés'}</p>
      <ul className="mapp-olots" data-testid="lots">
        {s.lots.map((l) => (
          <li key={l.id}>
            <span className="mapp-obag" aria-hidden="true">{l.bags.map((b) => `${b.g} g`).join(' · ') || '1 kg'}</span>
            <span className="mapp-orow-txt">
              <b>{l.name}{l.kg ? ` · ${l.kg} kg` : ''}</b>
              <small>{[l.notes, l.process && !l.name.toLowerCase().includes(l.process.toLowerCase()) ? l.process : null].filter(Boolean).join(' · ')}</small>
              {l.roasted && <small className="mapp-oroast">Tostado el {new Date(`${l.roasted}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</small>}
              {s.verified && <span className="mapp-oseal is-text">✓ Probado por el equipo</span>}
            </span>
            <span className="mapp-oprice">
              {l.bags[0] ? <><b>{money(l.bags[0].price)}</b><small>la bolsa de {l.bags[0].g} g</small></> : <><b>{money(l.kilo)}</b><small>por kilo</small></>}
            </span>
          </li>
        ))}
      </ul>
      {s.points.length > 0 && <p className="mapp-fine">Dónde se consigue: {s.points.join(', ')}.</p>}
      <button type="button" className="mapp-btn is-cta" onClick={() => go('/micra/tienda')} data-testid="seller-shop">Pedir café de {finca ? 'esta finca' : 'esta marca'}</button>
      <p className="mapp-fine">Los baristas lo piden por kilo desde Insumos y su ficha dice «Prepara con {s.name}».</p>
    </div>
  );
}

/** La ficha de un producto de la góndola, en una hoja. */
function ProductSheet({ item, qty, grind, onGrind, onAdd, onClose, go }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const lot = item.lot;
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label={item.name} data-testid="product-sheet">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section className="mapp-sheet is-scroll mapp-oproduct">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <div className="mapp-gondola-shelf is-wide" aria-hidden="true"><span>{item.icon}</span></div>
        <p className="mapp-kicker">{item.seller}{item.kind === 'finca' ? ' · finca verificada' : item.kind === 'marca' ? ' · marca aliada' : ''}</p>
        <h2 className="mapp-title is-small">{item.name}</h2>
        {lot?.notes && <p className="mapp-oproduct-notes">{lot.notes}{lot.roasted ? ` · Tostado el ${new Date(`${lot.roasted}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : ''}.</p>}
        {!lot && <p className="mapp-oproduct-notes">{item.sub}.</p>}
        {lot?.grind?.length > 1 && (
          <div className="mapp-chips" role="radiogroup" aria-label="Molienda">
            {lot.grind.map((g) => <button key={g} type="button" role="radio" aria-checked={grind === g} className={grind === g ? 'on' : ''} onClick={() => onGrind(g)}>{g}</button>)}
          </div>
        )}
        <div className="mapp-oproduct-add">
          <span className="mapp-oprice"><b>{money(item.price)}</b><small>{item.kind === 'acero' ? 'ACERO.press' : 'con tu barista o a domicilio'}</small></span>
          <span className={`mapp-gondola-add is-open is-inline`}>
            <button type="button" onClick={() => onAdd(-1)} aria-label={`Quitar ${item.name}`} disabled={!qty}>−</button>
            <output aria-live="polite" data-testid="product-qty">{qty}</output>
            <button type="button" onClick={() => onAdd(1)} aria-label={`Agregar ${item.name}`}>+</button>
          </span>
        </div>
        {item.sellerId && <button type="button" className="mapp-link" onClick={() => { onClose(); go(`/micra/origen/${item.sellerId}`); }}>Ver {item.kind === 'finca' ? 'la finca' : 'la marca'}</button>}
        <button type="button" className="mapp-btn is-cta" onClick={onClose} data-testid="product-done">{qty ? `Listo · ${qty} en mi pedido` : 'Listo'}</button>
      </section>
    </div>
  );
}

/** Cómo lo recibe: con su barista, a domicilio o recogiendo; manda el pedido por WhatsApp. */
function DeliverySheet({ lines, baristas, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const favs = api.favorites();
  const mine = sortBaristas(baristas.filter((b) => favs.includes(b.id)));
  const near = mine[0] ?? sortBaristas(baristas)[0] ?? null;
  const [how, setHow] = useState(near ? 'barista' : 'domicilio');
  const [team, setTeam] = useState(null);
  useEffect(() => { api.teamWhatsApp().then(setTeam).catch(() => setTeam('573152125327')); }, []);
  const text = shopText({ name: api.savedName(), zone: near?.localidad, lines, delivery: how, barista: near?.name?.split(/\s+/)[0] });
  const href = team ? `https://wa.me/${team}?text=${encodeURIComponent(text)}` : null;
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Cómo lo recibes" data-testid="delivery-sheet">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section className="mapp-sheet is-scroll mapp-odelivery">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <header className="mapp-sheet-head">
          <div><p className="mapp-kicker">{cartCount(lines)} {cartCount(lines) === 1 ? 'cosa' : 'cosas'} · {money(cartTotal(lines))}</p><h2 className="mapp-title is-small">¿Cómo lo recibes?</h2></div>
          <button type="button" className="mapp-link" onClick={onClose}>Cerrar</button>
        </header>
        <div className="mapp-odelivery-opts" role="radiogroup" aria-label="Entrega">
          {DELIVERY.map((d) => {
            if (d.id === 'barista' && !near) return null;
            const on = how === d.id;
            return (
              <button key={d.id} type="button" role="radio" aria-checked={on} className={`mapp-oopt ${on ? 'on' : ''}`} onClick={() => setHow(d.id)} data-testid={`delivery-${d.id}`}>
                <b>{d.id === 'barista' ? `🧍 Con ${near.name.split(/\s+/)[0]}, en tu cuadra` : d.id === 'domicilio' ? '🛵 A domicilio' : '🏪 Recoger en ACERO.press'}</b>
                <small>{d.text}</small>
                {d.id === 'barista' && near.status === 'live' && <em className="mapp-oopt-now">Está en la calle ahora</em>}
              </button>
            );
          })}
        </div>
        <p className="mapp-fine">Pagas al recibir, como el café. Cada compra suma un sello en tu tarjeta.</p>
        <a className={`mapp-btn is-cta ${href ? '' : 'is-off'}`} href={href ?? '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!href) e.preventDefault(); }} data-testid="shop-send">
          {how === 'barista' ? `Apartar con ${near.name.split(/\s+/)[0]}` : 'Pedir por WhatsApp'}
        </a>
      </section>
    </div>
  );
}

/** /micra/tienda: la góndola de bolsas, cold brew, AeroPress y kits. */
export function Tienda({ go }) {
  const origen = useOrigen();
  const items = useMemo(() => shopItems(origen), [origen]);
  const [cat, setCat] = useState('todo');
  const [cart, setCart] = useState({});
  const [grinds, setGrinds] = useState({}); // la molienda escogida por producto
  const [open, setOpen] = useState(null);
  const [checkout, setCheckout] = useState(false);
  const [baristas, setBaristas] = useState([]);
  useEffect(() => { api.listBaristas().then((l) => setBaristas(l ?? [])).catch(() => {}); }, []);
  const lines = cartLines(items, cart, grinds);
  const count = cartCount(lines);
  const shown = filterShop(items, cat);
  const bump = (id, d) => setCart((c) => bumpCart(c, id, d));
  return (
    <div className="mapp-client mapp-origen mapp-tienda" data-testid="tienda">
      <OHead kicker="Café de la calle en Bogotá" title="Llévate el café a casa" pill="🛍 Tienda" back={{ to: '/micra', label: 'Inicio' }} go={go} testid="tienda-head" />
      <div className="mapp-chips is-scroll" role="tablist" aria-label="Categorías">
        {SHOP_CATEGORIES.map((c) => <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.label}</button>)}
        <button type="button" className="mapp-origen-shop" onClick={() => go('/micra/origen')} data-testid="to-origen">Marcas y fincas ›</button>
      </div>
      {!origen && <p className="mapp-fine">Cargando…</p>}
      <ul className="mapp-gondola mapp-shop" data-testid="shop">
        {shown.map((i) => {
          const q = cart[i.id] || 0;
          return (
            <li key={i.id} className={q ? 'on' : ''}>
              <button type="button" className="mapp-gondola-shelf is-btn" onClick={() => setOpen(i.id)} aria-label={`Ver ${i.name}`} data-testid={`shop-${i.id}`}>
                <em className="mapp-gondola-tag">{i.kind === 'acero' ? 'ACERO' : i.kind === 'finca' ? 'FINCA' : 'MARCA'}</em>
                <span>{i.icon}</span>
              </button>
              <span className={`mapp-gondola-add ${q ? 'is-open' : ''}`}>
                {q > 0 && <button type="button" onClick={() => bump(i.id, -1)} aria-label={`Quitar ${i.name}`}>−</button>}
                {q > 0 && <output aria-live="polite" data-testid={`qty-${i.id}`}>{q}</output>}
                <button type="button" onClick={() => bump(i.id, 1)} aria-label={`Agregar ${i.name}`}>+</button>
              </span>
              <b>{i.name}</b>
              <small>{money(i.price)} · {i.sub}</small>
            </li>
          );
        })}
      </ul>
      {origen && shown.length === 0 && <p className="mapp-fine">Nada en esta repisa todavía.</p>}
      <div className="mapp-gondola-cart is-shop">
        <button type="button" className="mapp-btn is-cta" disabled={!count} onClick={() => setCheckout(true)} data-testid="shop-cart">
          {count ? <><i aria-hidden="true">{count}</i>Pedir · {money(cartTotal(lines))}</> : 'Escoge algo de la góndola'}
        </button>
      </div>
      {open && <ProductSheet item={shopItemById(items, open)} qty={cart[open] || 0} grind={grinds[open] ?? shopItemById(items, open)?.lot?.grind?.[0] ?? null} onGrind={(g) => setGrinds((m) => ({ ...m, [open]: g }))} onAdd={(d) => bump(open, d)} onClose={() => setOpen(null)} go={go} />}
      {checkout && count > 0 && <DeliverySheet lines={lines} baristas={baristas} onClose={() => setCheckout(false)} />}
    </div>
  );
}

export default OrigenDirectory;
