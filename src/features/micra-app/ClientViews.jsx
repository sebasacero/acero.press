import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  sortBaristas, pickBaristas, menuOf, extrasOf, paymentsOf, cartTotal, bump, cartItems, itemsLabel, cupsLabel,
  money, windowLabel, distanceLabel, STATUS_TEXT, initials, baristaPath, hourLabel, MAX_CUPS, holdStage, HOLD_STAGES, greeting, DRINK_CHOICES, drinkCounts,
} from './micraApp.js';
import * as api from './api.js';
import { StampsCard, PayBarista } from './Loyalty.jsx';
import platform from './platform.js';
import Figure from './Elenco.jsx';
import { IconThermo, IconCheck, IconOut, IconToday } from './icons.jsx';
import { Cargando } from './Animado.jsx';
import { figureFor } from './motivation.js';
// Los anuncios «Patrocinado»: la burbuja en las historias y la historia a pantalla completa
import { useAds, AdStoryBubble, AdStoryView } from './Ads.jsx';
import { stageAlert, POLL_MS } from './alerts.js';
import Globito, { ping } from './Globito.jsx';

// Modo cliente: quién pasa con café cerca, su ficha y «apártame». Sin cuenta:
// el celular guarda su identificador, el nombre y los favoritos.

// «Busco café» y su aviso llegan aparte: la app ya está al borde del límite del bundle
const SeekNote = lazy(() => import('./SeekNote.jsx'));
// El muro de Hoy, debajo de los baristas en el inicio del cliente (cargado aparte)
const HoyFeed = lazy(() => import('./HoyFeed.jsx'));
const seek = (pos, drink) => import('./seek.js').then((m) => m.seekCoffee(pos, drink)).catch(() => null);


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
    const p = await api.onePosition();
    setMe(p);
    setAsking(false);
    return p;
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

/** Cada barista en su tarjeta: su personaje, si está en la calle, dónde y su tinto. */
function BaristaRow({ b, onOpen, i = 0 }) {
  const menu = menuOf(b);
  return (
    <li style={{ '--i': i }} className={`is-${b.status}`}>
      <button type="button" className="mapp-row mapp-bcard" onClick={() => onOpen(b.id)}>
        <span className="mapp-bcard-top">
          <StatusBadge s={b.status} />
          <Avatar b={b} />
        </span>
        <Figure name={figureFor(b.id)} className="is-card" />
        <span className="mapp-row-main">
          <b>{b.name}{b.favorite && <span className="mapp-fav" aria-label="Tu barista"> ★</span>}</b>
          <span>{b.referencia || b.localidad || 'En la calle'}{b.distance != null ? ` · ${distanceLabel(b.distance)}` : ''}</span>
          <span className="mapp-row-meta">
            {windowLabel(b.hora_inicio, b.hora_fin) && <em>{windowLabel(b.hora_inicio, b.hora_fin)}</em>}
          </span>
        </span>
        <span className="mapp-row-side">
          {menu[0] && <span className="mapp-price"><small>{menu[0].label}</small>{money(menu[0].price)}</span>}
          {b.waiting > 0 && <span className="mapp-waiting">{b.waiting} lo esperan</span>}
        </span>
        <span className={`mapp-bcard-cta ${b.takes_holds ? '' : 'is-ghost'}`} aria-hidden="true">{b.takes_holds ? 'Apártame' : 'Ver dónde está'}</span>
      </button>
    </li>
  );
}

/**
 * Las historias de arriba, como en Instagram: primero Hoy (el muro del café) y
 * luego los baristas, los que están en la calle primero, con el aro rojo y
 * «AHORA». Tocar uno abre su página para apartar.
 */
function Stories({ baristas, go, ads = [], onAd }) {
  return (
    <ul className="mapp-hists" aria-label="Historias" data-testid="stories">
      <li>
        <button type="button" className="mapp-hist is-hoy" onClick={() => go('/micra/hoy')} aria-label="Hoy en el café">
          <span className="mapp-hist-ring"><span className="mapp-hist-av"><IconToday /></span></span>
          <small>Hoy</small>
        </button>
      </li>
      {/* Lo patrocinado después de Hoy, marcado como tal */}
      {ads.map((ad) => <AdStoryBubble key={ad.id} ad={ad} onOpen={onAd} />)}
      {baristas.map((b) => {
        const live = b.status === 'live';
        const first = String(b.name ?? '').split(' ')[0];
        return (
          <li key={b.id}>
            <button type="button" className={`mapp-hist ${live ? 'is-live' : ''}`} onClick={() => go(baristaPath(b.id))} aria-label={`${first}${live ? ', en la calle ahora' : ''}`}>
              <span className="mapp-hist-ring">
                <span className="mapp-hist-av"><Figure name={figureFor(b.id)} className="is-avatar" /></span>
                {live && <i className="mapp-hist-tag" aria-hidden="true">AHORA</i>}
              </span>
              <small>{first}</small>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ClientHome({ go }) {
  const ads = useAds('client');
  const [adStory, setAdStory] = useState(null);
  const [{ list, error, missing }, reload] = useBaristas();
  const { me, ask, asking } = useMe();
  const [drink, setDrink] = useState('all');
  const [nowOnly, setNowOnly] = useState(false);
  const [favs] = useState(api.favorites);
  // «Busco café»: con la ubicación dada, la zona aproximada (no el punto) y la bebida
  // le dicen a los baristas dónde quieren café; una vez cada 15 min (api.seekCoffee)
  const askNear = async () => { const p = await ask(); if (p) seek(p, drink); };
  const pickDrink = (id) => { setDrink(id); if (me) seek(me, id); };
  const sorted = useMemo(() => sortBaristas(list ?? [], { me, favorites: favs }), [list, me, favs]);
  const counts = drinkCounts(sorted);
  const shown = pickBaristas(sorted, { drink, now: nowOnly });
  const live = sorted.filter((b) => b.status === 'live').length;
  const open = (id) => go(baristaPath(id));
  // Si ya apartó hoy, arriba va cómo va eso, no la bienvenida
  const [hold, setHold] = useState(null);
  const loadHold = useCallback(() => api.myHolds().then((h) => setHold((h ?? []).find((x) => x.status === 'waiting' || x.status === 'served') ?? null)).catch(() => {}), []);
  useEffect(() => { loadHold(); }, [loadHold]);
  // Con un apartado en curso, se mira cada 20 s (y al volver a la app) si el barista salió, llegó o entregó
  const waitingHold = hold?.status === 'waiting';
  useEffect(() => {
    if (!waitingHold) return undefined;
    const tick = () => { if (document.visibilityState === 'visible') { loadHold(); reload(); } };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [waitingHold, loadHold, reload]);
  const holdBarista = hold ? sorted.find((b) => b.id === hold.tintero_id) : null;
  const name = api.savedName();
  // El globito cuando el apartado avanza (también lo que pasó con la app cerrada)
  const stage = holdStage(hold, holdBarista);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!hold || !holdBarista) return;
    let store = null;
    try { store = window.localStorage; } catch { /* sin memoria */ }
    const n = stageAlert(store, hold.id, stage, holdBarista.name);
    if (n) { setNotice(n); ping(); }
  }, [hold?.id, stage, holdBarista?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mapp-client">
      <h1 className="mapp-visually-hidden">¿Quién pasa con café cerca?</h1>
      {/* Arriba, como el inicio de una red social: las historias de los baristas */}
      {notice && <Globito {...notice} onClose={() => setNotice(null)} onOpen={() => { setNotice(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
      <Stories baristas={sorted} go={go} ads={ads.story} onAd={setAdStory} />
      {adStory && <AdStoryView ad={adStory} onClose={() => setAdStory(null)} />}
      {hold && holdBarista ? (
        <>
          <p className="mapp-kicker is-hello">{greeting()}{name ? `, ${name.split(/[ ·,]/)[0]}` : ''}.</p>
          <HoldCard hold={hold} barista={holdBarista} go={go} />
        </>
      ) : (
        <p className="mapp-feedline" data-testid="home-line">
          <b>{greeting()}{name ? `, ${name.split(/[ ·,]/)[0]}` : ''}.</b>{' '}
          {live > 0 ? `${live === 1 ? '1 barista está' : `${live} baristas están`} en la calle ahora: apártale y recoge cuando pase.` : 'Aparta tus tintos con el barista de tu cuadra y recógelos cuando pase.'}
        </p>
      )}

      {/* Sin mapa: qué quiere tomar, en botones grandes; la lista de abajo muestra solo a quien lo vende */}
      <section className="mapp-drinks" aria-labelledby="mapp-drinks-q">
        <h2 className="mapp-drinks-q" id="mapp-drinks-q">¿Qué te gustaría tomar <span className="mapp-script">hoy?</span></h2>
        <div className="mapp-drinks-grid" role="group" aria-label="¿Qué te gustaría tomar hoy?">
          {DRINK_CHOICES.map((d) => (
            <button key={d.id} type="button" className={drink === d.id ? 'on' : ''} aria-pressed={drink === d.id} onClick={() => pickDrink(d.id)} data-testid={`drink-${d.id}`}>
              <span className="mapp-drink-ico" aria-hidden="true">{d.icon}</span>
              <b>{d.label}</b>
              {list && <small>{counts[d.id] === 1 ? '1 barista' : `${counts[d.id]} baristas`}</small>}
            </button>
          ))}
        </div>
      </section>

      <div className="mapp-bar">
        <div className="mapp-chips" role="group" aria-label="Filtrar">
          {!me && (
            <button type="button" className="mapp-near" onClick={askNear} disabled={asking}>{asking ? 'Buscando…' : '◎ Cerca de mí'}</button>
          )}
          <button type="button" className={nowOnly ? 'on' : ''} aria-pressed={nowOnly} onClick={() => setNowOnly((v) => !v)}>
            Ahora{live > 0 ? ` · ${live}` : ''}
          </button>
        </div>
      </div>
      <Suspense fallback={null}><SeekNote /></Suspense>

      {list === null && <Skeleton />}
      {error && (
        <p className="mapp-error" role="alert">No se pudo cargar la lista. <button type="button" className="mapp-link" onClick={reload}>Reintentar</button></p>
      )}
      {list && shown.length > 0 && (
        <ul className="mapp-list is-cards" aria-label="Baristas">
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
      {list && !error && shown.length === 0 && !missing && (
        // Sin nadie cerca, el café se lleva a casa: la tienda de ACERO.press
        <a className="mapp-glass mapp-takehome" href={platform.siteUrl('/#beans')} data-testid="take-home">
          <span aria-hidden="true">☕</span>
          <span><b>Llévatelo a casa</b><small>Café de origen y AeroPress de la tienda de ACERO.press</small></span>
          <i aria-hidden="true">›</i>
        </a>
      )}

      <StampsCard />

      <section className="mapp-join">
        <div>
          <b>¿Vendes café en la calle?</b>
          <p>Que tus clientes te aparten antes de que llegues, lleva tu cuenta y tus fiados en el celular.</p>
        </div>
        <button type="button" className="mapp-btn is-ghost" onClick={() => go('/micra/barista')}>Soy barista</button>
      </section>

      {/* Como Instagram: debajo de todo sigue el muro (los puestos de los baristas, el precio, el café de Colombia, recetas y videos) */}
      <Suspense fallback={null}><HoyFeed go={go} audience="client" embedded list={list ? sorted : null} ads={ads.rows} /></Suspense>
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

      {mine?.status === 'waiting' && <PayBarista id={b.id} name={b.name} total={money(mine.total)} />}
      <StampsCard />

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
      <StampsCard />
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
