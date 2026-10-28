import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  sortBaristas, filterBaristas, menuOf, extrasOf, paymentsOf, cartTotal, bump, cartItems, itemsLabel, cupsLabel,
  money, windowLabel, distanceLabel, STATUS_TEXT, initials, baristaPath, hourLabel, MAX_CUPS, holdStage, HOLD_STAGES, greeting,
} from './micraApp.js';
import * as api from './api.js';
import platform from './platform.js';
import Figure from './Elenco.jsx';
import { IconThermo, IconCheck, IconOut } from './icons.jsx';
import { Cargando } from './Animado.jsx';

// Modo cliente: quién pasa con café cerca, su ficha y «apártame». Sin cuenta:
// el celular guarda su identificador, el nombre y los favoritos.

const MicraMap = lazy(() => import('./MicraMap.jsx'));

const FILTERS = [
  ['all', 'Todos'],
  ['live', 'Ahora'],
  ['tinto', 'Tinto'],
  ['perico', 'Perico'],
  ['aromatica', 'Aromática'],
];

function useBaristas() {
  const [state, setState] = useState({ list: null, error: null, missing: false });
  const load = useCallback(() => {
    api.listBaristas()
      .then((list) => setState({ list: list ?? [], error: null, missing: false }))
      .catch((e) => setState({ list: [], error: e.missing ? null : e.message, missing: !!e.missing }));
  }, []);
  useEffect(() => {
    load();
    // Quién salió cambia durante la mañana: se refresca cada minuto con la app abierta
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);
  return [state, load];
}

/** Ubicación del celular solo si la persona la pide (botón «Cerca de mí»). */
function useMe() {
  const [me, setMe] = useState(null);
  const [asking, setAsking] = useState(false);
  const ask = async () => {
    setAsking(true);
    setMe(await api.onePosition());
    setAsking(false);
  };
  return { me, ask, asking };
}

function Avatar({ b, big = false }) {
  return b.photo_url
    ? <img className={`mapp-av ${big ? 'is-big' : ''}`} src={b.photo_url} alt="" />
    : <span className={`mapp-av ${big ? 'is-big' : ''} ${b.n && !big ? `is-${b.status}` : ''}`} aria-hidden="true">{b.n && !big ? b.n : initials(b.name)}</span>;
}

/** Lo que está pasando con el apartado de hoy: las cuatro etapas y el termito en la actual. */
function HoldCard({ hold, barista, go }) {
  const stage = holdStage(hold, barista);
  if (stage == null || !barista) return null;
  const win = windowLabel(barista.hora_inicio, barista.hora_fin);
  return (
    <section className="mapp-now" aria-label="Tu apartado de hoy">
      <p className="mapp-now-kicker">Tu apartado{barista.status === 'live' && <span className="mapp-now-live">Salió</span>}</p>
      <button type="button" className="mapp-now-go" onClick={() => go(baristaPath(barista.id))} aria-label={`Ver a ${barista.name}`}><IconOut /></button>
      <h2 className="mapp-now-title">{itemsLabel(hold.items)} con {barista.name}</h2>
      <p className="mapp-now-sub">{stage === 3 ? 'Ya te lo entregó. Mañana puedes volver a apartar.' : barista.referencia ? `Pasa por ${barista.referencia}${win ? ` ${win}` : ''}` : win ? `Pasa ${win}` : 'Te entrega cuando pase'}</p>
      <ol className="mapp-stages" aria-label="Etapas">
        {HOLD_STAGES.map((label, i) => (
          <li key={label} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''} aria-current={i === stage ? 'step' : undefined}>
            <i>{i < stage ? <IconCheck /> : i === stage ? <IconThermo /> : null}</i>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Filas grises mientras llega la lista, para que la pantalla ya tenga forma. */
function Skeleton({ rows = 3 }) {
  return (
    <ul className="mapp-list is-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} style={{ '--i': i }}><span className="mapp-row"><span className="mapp-av mapp-skel" /><span className="mapp-row-main"><span className="mapp-skel" style={{ width: '55%' }} /><span className="mapp-skel" style={{ width: '80%' }} /></span><span className="mapp-skel" style={{ width: 56 }} /></span></li>
      ))}
    </ul>
  );
}

function StatusBadge({ s }) {
  return <span className={`mapp-badge is-${s}`}>{s === 'live' && <i aria-hidden="true" />}{STATUS_TEXT[s]}</span>;
}

function shareBarista(b) {
  const url = platform.siteUrl(baristaPath(b.id));
  const text = `${b.name} vende café ${b.referencia ? `en ${b.referencia}` : 'en la calle'}. Apártale en Micra:`;
  platform.share({ title: `${b.name} en Micra`, text, url });
}

function inviteText() {
  const url = platform.siteUrl('/micra');
  return `¿Vendes café en la calle? Con Micra tus clientes te apartan los tintos antes de que llegues. Escríbele al equipo: ${url}`;
}

function BaristaRow({ b, onOpen, i = 0 }) {
  const menu = menuOf(b);
  return (
    <li style={{ '--i': i }}>
      <button type="button" className="mapp-row" onClick={() => onOpen(b.id)}>
        <Avatar b={b} />
        <span className="mapp-row-main">
          <b>{b.name}{b.favorite && <span className="mapp-fav" aria-label="Tu barista"> ★</span>}</b>
          <span>{b.referencia || b.localidad || 'En la calle'}{b.distance != null ? ` · ${distanceLabel(b.distance)}` : ''}</span>
          <span className="mapp-row-meta">
            <StatusBadge s={b.status} />
            {windowLabel(b.hora_inicio, b.hora_fin) && <em>{windowLabel(b.hora_inicio, b.hora_fin)}</em>}
          </span>
        </span>
        <span className="mapp-row-side">
          {menu[0] && <span className="mapp-price"><small>{menu[0].label}</small>{money(menu[0].price)}</span>}
          {b.waiting > 0 && <span className="mapp-waiting">{b.waiting} lo esperan</span>}
        </span>
      </button>
    </li>
  );
}

export function ClientHome({ go, night }) {
  const [{ list, error, missing }, reload] = useBaristas();
  const { me, ask, asking } = useMe();
  const [filter, setFilter] = useState('all');
  const [favs] = useState(api.favorites);
  // Cada barista lleva el número de su fila, el mismo que su pin en el mapa
  const sorted = useMemo(() => sortBaristas(list ?? [], { me, favorites: favs }).map((b, i) => ({ ...b, n: i + 1 })), [list, me, favs]);
  const shown = filterBaristas(sorted, filter);
  const live = sorted.filter((b) => b.status === 'live').length;
  const open = (id) => go(baristaPath(id));
  // Si ya apartó hoy, arriba va cómo va eso, no la bienvenida
  const [hold, setHold] = useState(null);
  useEffect(() => {
    api.myHolds().then((h) => setHold((h ?? []).find((x) => x.status === 'waiting' || x.status === 'served') ?? null)).catch(() => {});
  }, []);
  const holdBarista = hold ? sorted.find((b) => b.id === hold.tintero_id) : null;
  const name = api.savedName();

  return (
    <div className="mapp-client">
      {hold && holdBarista ? (
        <>
          <p className="mapp-kicker is-hello">{greeting()}{name ? `, ${name.split(/[ ·,]/)[0]}` : ''}.</p>
          <h1 className="mapp-visually-hidden">¿Quién pasa con café cerca?</h1>
          <HoldCard hold={hold} barista={holdBarista} go={go} />
        </>
      ) : (
        <section className="mapp-hero">
          <div>
            <p className="mapp-kicker">Café de la calle · Bogotá</p>
            <h1 className="mapp-title is-home">¿Quién pasa con café <span className="mapp-script">cerca?</span></h1>
            <p className="mapp-lede">Aparta tus tintos con el barista de tu cuadra y recógelos cuando pase.</p>
          </div>
          <Figure name="caminando" className="is-hero" />
        </section>
      )}

      {sorted.length > 0 && (
        <Suspense fallback={<div className="mapp-map is-loading" />}>
          <MicraMap baristas={sorted} me={me} theme={night ? 'noche' : 'plano'} onPick={open} />
        </Suspense>
      )}

      <div className="mapp-bar">
        <div className="mapp-chips" role="group" aria-label="Filtrar">
          {!me && (
            <button type="button" className="mapp-near" onClick={ask} disabled={asking}>{asking ? 'Buscando…' : '◎ Cerca de mí'}</button>
          )}
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'on' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}{id === 'live' && live > 0 ? ` · ${live}` : ''}
            </button>
          ))}
        </div>
      </div>

      {list === null && <Skeleton />}
      {error && (
        <p className="mapp-error" role="alert">No se pudo cargar la lista. <button type="button" className="mapp-link" onClick={reload}>Reintentar</button></p>
      )}
      {list && shown.length > 0 && (
        <ul className="mapp-list" aria-label="Baristas">
          {shown.map((b, i) => <BaristaRow key={b.id} b={b} onOpen={open} i={i} />)}
        </ul>
      )}
      {list && !error && shown.length === 0 && (
        <div className="mapp-empty">
          <Figure name="entrega" className="is-empty" />
          <b>{missing ? 'Micra abre muy pronto.' : sorted.length ? 'Nadie con ese filtro ahora.' : 'Todavía no hay baristas en Micra cerca de ti.'}</b>
          <p>Estamos sumando a quienes ya venden café en la calle en Chapinero, Kennedy y Bosa. Si tienes un barista de confianza, invítalo.</p>
          <a className="mapp-btn is-ghost" href={`https://wa.me/?text=${encodeURIComponent(inviteText())}`} target="_blank" rel="noopener noreferrer">Invitar a mi barista</a>
        </div>
      )}

      <section className="mapp-join">
        <div>
          <b>¿Vendes café en la calle?</b>
          <p>Que tus clientes te aparten antes de que llegues, lleva tu cuenta y tus fiados en el celular.</p>
        </div>
        <button type="button" className="mapp-btn is-ghost" onClick={() => go('/micra/barista')}>Soy barista</button>
      </section>
    </div>
  );
}

function Stepper({ item, qty, onBump, full }) {
  return (
    <div className="mapp-step">
      <span className="mapp-step-name"><b>{item.label}</b><small>{money(item.price)}</small></span>
      <span className="mapp-step-ctl">
        <button type="button" onClick={() => onBump(-1)} disabled={!qty} aria-label={`Quitar un ${item.one}`}>−</button>
        <output aria-label={`${item.label}: ${qty}`}>{qty}</output>
        <button type="button" onClick={() => onBump(1)} disabled={full} aria-label={`Sumar un ${item.one}`}>+</button>
      </span>
    </div>
  );
}

/** Las horas del día con su franja marcada (6 a. m. a 8 p. m.). */
function HoursBar({ from, to }) {
  if (from == null || to == null) return null;
  const hours = Array.from({ length: 15 }, (_, i) => i + 6);
  return (
    <div className="mapp-hours" aria-label={`Suele pasar ${windowLabel(from, to)}`}>
      {hours.map((h) => <span key={h} className={h >= from && h < to ? 'on' : ''} />)}
      <small>{hourLabel(6)}</small><small>12 m.</small><small>{hourLabel(20)}</small>
    </div>
  );
}

export function BaristaPage({ id, go }) {
  const [{ list, missing }] = useBaristas();
  const [favs, setFavs] = useState(api.favorites);
  const b = useMemo(() => sortBaristas((list ?? []).filter((x) => x.id === id), { favorites: favs })[0] ?? null, [list, id, favs]);
  const [mine, setMine] = useState(null);
  const [cart, setCart] = useState({});
  const [name, setName] = useState(api.savedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Si ya apartó hoy con este barista, se ve su apartado (y puede cambiarlo)
  useEffect(() => {
    api.myHolds().then((h) => {
      const x = (h ?? []).find((y) => y.tintero_id === id && y.status !== 'cancelled');
      setMine(x ?? null);
      if (x?.status === 'waiting') setCart(Object.fromEntries(x.items.map((i) => [i.product, i.qty])));
    }).catch(() => {});
  }, [id]);

  if (list === null) return <Cargando fig="caminando" />;
  if (!b) {
    return (
      <div className="mapp-empty">
        <b>{missing ? 'Micra abre muy pronto.' : 'Este barista no está en Micra.'}</b>
        <p>Puede que haya dejado de aparecer en público.</p>
        <button type="button" className="mapp-btn" onClick={() => go('/micra')}>Ver baristas cerca</button>
      </div>
    );
  }

  const menu = menuOf(b);
  const { cups, total } = cartTotal(cart, menu);
  const extras = extrasOf(b);
  const pays = paymentsOf(b);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const h = await api.hold(b.id, name.trim(), cartItems(cart));
      api.saveName(name.trim());
      setMine(h);
    } catch (err) {
      setError(err.missing ? 'Los apartados abren muy pronto.' : err.message);
    }
    setBusy(false);
  };
  const cancel = async () => {
    setBusy(true);
    try { await api.cancelHold(mine.id); setMine(null); setCart({}); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const editing = mine?.status === 'waiting' && cartItems(cart).length && (cups !== mine.cups || total !== Number(mine.total));

  return (
    <article className="mapp-card" aria-labelledby="mapp-b-name">
      <button type="button" className="mapp-back" onClick={() => go('/micra')}>‹ Baristas</button>
      <header className="mapp-card-head">
        <Avatar b={b} big />
        <div>
          <h1 id="mapp-b-name" className="mapp-card-name">{b.name}</h1>
          <p>{b.referencia || b.localidad}{b.localidad && b.referencia ? ` · ${b.localidad}` : ''}</p>
          <StatusBadge s={b.status} />
        </div>
        <button
          type="button"
          className={`mapp-star ${b.favorite ? 'on' : ''}`}
          aria-pressed={b.favorite}
          aria-label={b.favorite ? 'Quitar de mis baristas' : 'Es mi barista'}
          onClick={() => setFavs(api.toggleFavorite(b.id))}
        >★</button>
      </header>

      <section className="mapp-glass">
        <p className="mapp-cota">Suele pasar</p>
        <p className="mapp-big">{windowLabel(b.hora_inicio, b.hora_fin) ?? 'Pregúntale su horario'}</p>
        <HoursBar from={b.hora_inicio} to={b.hora_fin} />
        {b.waiting > 0 && <p className="mapp-muted">{b.waiting === 1 ? '1 persona lo espera hoy' : `${b.waiting} personas lo esperan hoy`}</p>}
      </section>

      {mine && mine.status !== 'waiting' ? (
        <section className="mapp-done" role="status">
          <b>{mine.status === 'served' ? '¡Entregado!' : 'Hoy no se pudo.'}</b>
          <p>{mine.status === 'served' ? `${b.name} ya te entregó ${itemsLabel(mine.items)}. Mañana puedes volver a apartar.` : `${b.name} marcó que no se encontraron. Mañana puedes volver a apartar.`}</p>
        </section>
      ) : !b.takes_holds ? (
        <section className="mapp-glass">
          <p className="mapp-cota">Lo que vende</p>
          <ul className="mapp-menu">
            {menu.map((m) => <li key={m.id}><span>{m.label}</span><b>{money(m.price)}</b></li>)}
            {extras.length > 0 && <li className="mapp-extras">También: {extras.join(', ')}</li>}
          </ul>
          <p className="mapp-muted">{b.name} todavía no recibe apartados por Micra. Búscalo{b.referencia ? ` en ${b.referencia}` : ''}{windowLabel(b.hora_inicio, b.hora_fin) ? ` ${windowLabel(b.hora_inicio, b.hora_fin)}` : ''}.</p>
        </section>
      ) : (
        <form className="mapp-glass mapp-order" onSubmit={submit}>
          <p className="mapp-cota">{mine ? 'Tu apartado de hoy' : 'Apártame'}</p>
          {mine && !editing && (
            <p className="mapp-mine" role="status" data-testid="micra-hold-done">
              <b>Listo: {itemsLabel(mine.items)}.</b> {b.name} sabe que lo esperas. Págale {money(mine.total)} al recibir{pays.length ? ` (${pays.join(', ')})` : ''}.
            </p>
          )}
          {menu.map((m) => (
            <Stepper key={m.id} item={m} qty={cart[m.id] || 0} full={cups >= MAX_CUPS} onBump={(d) => setCart((c) => bump(c, m.id, d))} />
          ))}
          {extras.length > 0 && <p className="mapp-extras">También lleva {extras.join(', ')}: pídeselo cuando llegue.</p>}
          <label className="mapp-field">
            <span>Tu nombre (así te llama)</span>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} autoComplete="given-name" placeholder="Ej.: Sebas, oficina 302" required />
          </label>
          {error && <p className="mapp-error" role="alert">{error}</p>}
          {(!mine || editing) && (
            <button type="submit" className="mapp-btn is-cta" disabled={busy || cups === 0 || !name.trim()}>
              {busy ? 'Apartando…' : cups ? `${mine ? 'Cambiar a' : 'Apartar'} ${cupsLabel(cups)} · ${money(total)}` : 'Elige qué quieres'}
            </button>
          )}
          <p className="mapp-fine">No es domicilio: {b.name} sigue su ruta y te entrega cuando pase. Pagas al recibir{pays.length ? `: ${pays.join(', ')}` : ''}.</p>
          {mine && <button type="button" className="mapp-link" onClick={cancel} disabled={busy}>Ya no lo necesito</button>}
        </form>
      )}

      <button type="button" className="mapp-btn is-ghost" onClick={() => shareBarista(b)}>Compartir a {b.name}</button>
    </article>
  );
}

export function MyHolds({ go }) {
  const [holds, setHolds] = useState(null);
  const [{ list }] = useBaristas();
  const [error, setError] = useState(null);
  useEffect(() => {
    api.myHolds().then((h) => setHolds(h ?? [])).catch((e) => { setHolds([]); if (!e.missing) setError(e.message); });
  }, []);
  const nameOf = (id) => (list ?? []).find((b) => b.id === id)?.name ?? 'Tu barista';
  const text = { waiting: 'Te espera', served: 'Entregado', missed: 'No se encontraron', cancelled: 'Cancelado' };
  const live = (holds ?? []).filter((h) => h.status !== 'cancelled');
  return (
    <div className="mapp-client">
      <h1 className="mapp-title is-small">Mis apartados de hoy</h1>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      {holds === null && <Cargando fig="servir" />}
      {holds && live.length === 0 && (
        <div className="mapp-empty">
          <Figure name="caminando" className="is-empty" />
          <b>Hoy no has apartado.</b>
          <p>Busca al barista de tu cuadra y apártale tus tintos.</p>
          <button type="button" className="mapp-btn is-cta" onClick={() => go('/micra')}>Ver baristas cerca</button>
        </div>
      )}
      <ul className="mapp-list">
        {live.map((h) => (
          <li key={h.id}>
            <button type="button" className="mapp-row" onClick={() => go(baristaPath(h.tintero_id))}>
              <span className="mapp-av" aria-hidden="true">{initials(nameOf(h.tintero_id))}</span>
              <span className="mapp-row-main">
                <b>{nameOf(h.tintero_id)}</b>
                <span>{itemsLabel(h.items)} · {money(h.total)}</span>
              </span>
              <span className={`mapp-badge is-${h.status === 'waiting' ? 'live' : 'off'}`}>{text[h.status]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
