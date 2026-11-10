import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  sortBaristas, pickBaristas, menuOf, extrasOf, paymentsOf, cartTotal, bump, cartItems, itemsLabel, cupsLabel,
  money, windowLabel, distanceLabel, STATUS_TEXT, initials, baristaPath, hourLabel, MAX_CUPS, holdStage, HOLD_STAGES, greeting, DRINK_CHOICES, drinkCounts,
  searchBaristas, drinkFromQuery, nearZone,
  recordBaristaHistory, myBaristas,
  listPage, STORIES_MAX,
} from './micraApp.js';
import * as api from './api.js';
import { StampsCard, PayBarista } from './Loyalty.jsx';
import platform from './platform.js';
import Figure from './Elenco.jsx';
import { IconThermo, IconCheck, IconOut, IconToday, IconPin, IconSearch, IconChevron, IconTrophy, IconCup } from './icons.jsx';
import { Cargando } from './Animado.jsx';
import { figureFor } from './motivation.js';
import Beans from './Beans.jsx';
import { needsRating, paidChoices, ratePayload } from './rating.js';
// Los anuncios «Patrocinado»: la burbuja en las historias y la historia a pantalla completa
import { useAds, AdStoryBubble, AdStoryView } from './Ads.jsx';
import { stageAlert, outAlert, POLL_MS } from './alerts.js';
import Globito, { ping } from './Globito.jsx';

// Los motivos de cancelar (los mismos que acepta micra_hold_cancel)
const CANCEL_REASONS = [['tarde', 'Se demoró'], ['no_llego', 'No llegó'], ['cambie', 'Ya no quiero'], ['otro', 'Otro motivo']];

// Modo cliente: quién pasa con café cerca, su ficha y «apártame». Sin cuenta:
// el celular guarda su identificador, el nombre y los favoritos.

// «Busco café» y su aviso llegan aparte: la app ya está al borde del límite del bundle
const SeekNote = lazy(() => import('./SeekNote.jsx'));
// El muro de Hoy, debajo de los baristas en el inicio del cliente (cargado aparte)
const HoyFeed = lazy(() => import('./HoyFeed.jsx'));
const GustosIntro = lazy(() => import('./Gustos.jsx').then((m) => ({ default: m.GustosIntro })));
const GustosHead = lazy(() => import('./Gustos.jsx').then((m) => ({ default: m.GustosHead })));
const seek = (pos, drink) => import('./seek.js').then((m) => m.seekCoffee(pos, drink)).catch(() => null);
// Los baristas del cliente (a quién le apartó), guardados solo en su celular
const HIST_KEY = 'micra_mis_baristas_v1';
const readHist = () => { try { return JSON.parse(localStorage.getItem(HIST_KEY) ?? '{}') || {}; } catch { return {}; } };
const saveHist = (holds) => {
  const prev = readHist();
  const next = recordBaristaHistory(prev, holds ?? []);
  if (next !== prev) { try { localStorage.setItem(HIST_KEY, JSON.stringify(next)); } catch { /* sin memoria */ } }
  return next;
};
// Con baristas suyos, se mira cada minuto (con la app a la vista) si alguno salió a vender
const OUT_POLL_MS = 60000;
const today = () => new Date().toLocaleDateString('en-CA');

// «Quiero un café» es un sí explícito a compartir la zona: quita el «No mostrar mi zona» antes de avisar
const wantCoffee = (pos, drink) => import('./seek.js').then((m) => { m.setSeekOff(false); return m.seekCoffee(pos, drink); }).catch(() => null);

/**
 * «Quiero un café» (pedido del usuario, 7 nov 2026): un solo botón fijo abajo, al pulgar,
 * que solo dice «aquí quieren café». No aparta a ningún barista ni se paga nada: manda la
 * misma señal anónima del «busco café» (la zona de ~440 m y la bebida, se borra a los 60 min).
 */
function WantCoffee({ me, ask, drink }) {
  const [state, setState] = useState('idle'); // idle · asking · done · nogps
  const tap = async () => {
    setState('asking');
    const p = me ?? await ask();
    if (!p) { setState('nogps'); return; }
    await wantCoffee(p, drink);
    setState('done');
  };
  return (
    <div className={`mapp-want ${state === 'done' ? 'is-done' : ''}`} data-testid="want-coffee">
      {state === 'done' ? (
        <p className="mapp-want-ok" role="status" data-testid="want-ok">
          <b>¡Listo! Tu zona quiere café.</b>
          <span>Los baristas cerca lo ven por una hora. No apartaste nada ni pagas nada.</span>
        </p>
      ) : (
        <>
          {state === 'nogps' && <p className="mapp-want-note" role="alert">Para avisar, Micra necesita saber tu zona: permite la ubicación e inténtalo de nuevo.</p>}
          <button type="button" className="mapp-want-btn" onClick={tap} disabled={state === 'asking'} data-testid="want-btn">
            <IconCup /> {state === 'asking' ? 'Avisando…' : 'Quiero un café'}
          </button>
          <small className="mapp-want-note">Avisa a los baristas de tu zona (~400 m). Sin apartar ni pagar.</small>
        </>
      )}
    </div>
  );
}


function useBaristas() {
  const [state, setState] = useState({ list: null, error: null, missing: false });
  const load = useCallback(() => {
    api.listBaristas()
      .then((list) => setState({ list: list ?? [], error: null, missing: false }))
      .catch((e) => setState({ list: [], error: e.missing ? null : e.message, missing: !!e.missing }));
  }, []);
  useEffect(() => {
    load();
    // Quién salió cambia durante la mañana: se refresca cada minuto con la app a la vista
    // (escondida no gasta datos; al volver se refresca enseguida)
    const tick = () => { if (document.visibilityState !== 'hidden') load(); };
    const id = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
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
      {stage === 3 && <RateHold hold={hold} baristaName={barista.name} />}
    </section>
  );
}

/**
 * «¿Cómo te fue?»: después de la entrega, granos de 1 a 5 y cuánto pagó.
 * El precio real de la calle es el dato que más le sirve al estudio; lo pagado
 * es opcional para que nadie se quede sin calificar por no acordarse.
 */
function RateHold({ hold, baristaName }) {
  const [rating, setRating] = useState(0);
  const [paid, setPaid] = useState(null);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);
  if (sent) {
    return <p className="mapp-rate-done" role="status">¡Gracias! Le diste {sent} {sent === 1 ? 'grano' : 'granos'} a {baristaName}.</p>;
  }
  if (!needsRating(hold)) return null;
  const choices = paidChoices(hold.total, hold.cups);
  const send = async () => {
    const body = ratePayload(rating, paid === 'otro' ? other : paid);
    if (!body) { setError(rating ? 'Revisa cuánto pagaste.' : 'Escoge de 1 a 5 granos.'); return; }
    setBusy(true); setError(null);
    try {
      const ok = await api.rateHold(hold.id, body.rating, body.paid);
      if (ok === false) throw new Error('Ya no se puede calificar este apartado.');
      setSent(body.rating);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <div className="mapp-rate" data-testid="rate-hold">
      <p className="mapp-rate-q"><b>¿Cómo te fue con {baristaName}?</b></p>
      <Beans value={rating} onPick={setRating} label={`Califica a ${baristaName}`} />
      {rating > 0 && (
        <>
          <p className="mapp-rate-q">¿Cuánto pagaste?</p>
          <div className="mapp-rate-paid" role="radiogroup" aria-label="Cuánto pagaste">
            {choices.map((v) => <button key={v} type="button" role="radio" aria-checked={paid === v} className={paid === v ? 'on' : ''} onClick={() => setPaid(v)}>{money(v)}</button>)}
            <button type="button" role="radio" aria-checked={paid === 'otro'} className={paid === 'otro' ? 'on' : ''} onClick={() => setPaid('otro')}>Otro</button>
            <button type="button" role="radio" aria-checked={paid == null} className={paid == null ? 'on' : ''} onClick={() => setPaid(null)}>No sé</button>
          </div>
          {paid === 'otro' && (
            <label className="mapp-rate-other">Pagué $<input type="number" inputMode="numeric" min="0" max="60000" step="100" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Lo que pagaste" /></label>
          )}
          <button type="button" className="mapp-btn" onClick={send} disabled={busy}>{busy ? 'Enviando…' : 'Enviar'}</button>
        </>
      )}
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <p className="mapp-fine">{baristaName} solo ve el promedio de sus granos, nunca quién calificó.</p>
    </div>
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
function Stories({ baristas, go, ads = [], onAd, reto = null }) {
  return (
    <ul className="mapp-hists" aria-label="Historias" data-testid="stories">
      <li>
        <button type="button" className="mapp-hist is-hoy" onClick={() => go('/micra/hoy')} aria-label="Hoy en el café">
          <span className="mapp-hist-ring"><span className="mapp-hist-av"><IconToday /></span></span>
          <small>Hoy</small>
        </button>
      </li>
      {/* Lo patrocinado después de Hoy, marcado como tal */}
      {reto && (
        <li>
          <button type="button" className="mapp-hist is-reto" onClick={() => go('/micra/reto')} aria-label={`Reto de la semana: ${reto.title}`} data-testid="story-reto">
            <span className="mapp-hist-ring"><span className="mapp-hist-av"><IconTrophy /></span></span>
            <small>Reto</small>
          </button>
        </li>
      )}
      {ads.map((ad) => <AdStoryBubble key={ad.id} ad={ad} onOpen={onAd} />)}
      {baristas.slice(0, STORIES_MAX).map((b) => {
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
  // El reto de la semana (Competencia): la burbuja en las historias y la tarjeta en el muro
  const [reto, setReto] = useState(null);
  useEffect(() => {
    let alive = true;
    api.challenge().then((d) => alive && setReto(d?.challenge ? { ...d.challenge, entries: (d.entries ?? []).length } : null)).catch(() => {});
    return () => { alive = false; };
  }, []);
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
  // El buscador de arriba: una bebida escrita es su filtro; lo demás busca nombre, punto o localidad
  const [q, setQ] = useState('');
  const searching = q.trim().length > 0;
  const qDrink = drinkFromQuery(q);
  const shown = searchBaristas(pickBaristas(sorted, { drink: qDrink ?? drink, now: nowOnly }), qDrink ? '' : q);
  // De a 12; cambiar el filtro o la búsqueda vuelve a la primera página
  const [pages, setPages] = useState(1);
  useEffect(() => { setPages(1); }, [q, drink, nowOnly]);
  const page = listPage(shown, pages);
  const zone = nearZone(sorted, me);
  const live = sorted.filter((b) => b.status === 'live').length;
  const open = (id) => go(baristaPath(id));
  // Si ya apartó hoy, arriba va cómo va eso, no la bienvenida
  const [hold, setHold] = useState(null);
  const loadHold = useCallback(() => api.myHolds().then((h) => { saveHist(h); setHold((h ?? []).find((x) => x.status === 'waiting' || x.status === 'served') ?? null); }).catch(() => {}), []);
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

  // «Tu barista salió a vender»: el globito cuando sale uno de los suyos (♥ o le apartó), uno por día
  const mineIds = useMemo(() => myBaristas(list ?? [], { favorites: favs, history: readHist() }), [list, favs]);
  useEffect(() => {
    if (!mineIds.length) return;
    let store = null;
    try { store = window.localStorage; } catch { /* sin memoria */ }
    const n = outAlert(store, mineIds, today());
    if (n) { setNotice(n); ping(); }
  }, [mineIds]);
  const hasMine = mineIds.length > 0;
  useEffect(() => {
    if (!hasMine || waitingHold) return undefined; // con un apartado en curso ya se mira cada 20 s
    const tick = () => { if (document.visibilityState === 'visible') reload(); };
    const id = setInterval(tick, OUT_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [hasMine, waitingHold, reload]);

  return (
    <div className="mapp-client">
      <h1 className="mapp-visually-hidden">¿Quién pasa con café cerca?</h1>
      {notice && <Globito {...notice} onClose={() => setNotice(null)} onOpen={() => { setNotice(null); if (notice.kind === 'out') open(notice.id); else window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
      {/* Arriba, como las apps de domicilios: dónde estás y el buscador */}
      <section className="mapp-chead" aria-label="Buscar café" data-testid="home-head">
        <button type="button" className="mapp-chead-loc" onClick={me ? undefined : askNear} disabled={asking} aria-label={me ? `Estás cerca de ${zone ?? 'tu cuadra'}` : '◎ Cerca de mí'} data-testid="home-loc">
          <span className="mapp-chead-pin" aria-hidden="true"><IconPin /></span>
          <span className="mapp-chead-txt">
            <small>{asking ? 'Buscando…' : me ? 'Estás cerca de' : 'Café de la calle en'}</small>
            <b>{me ? (zone ?? 'tu cuadra') : 'Bogotá'} {!me && <IconChevron />}</b>
          </span>
          {!me && <span className="mapp-chead-near">Cerca de mí</span>}
        </button>
        <label className="mapp-search">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder="Busca tinto, perico o tu barista" aria-label="Buscar baristas o bebidas" enterKeyHint="search" data-testid="home-search" />
          {searching && <button type="button" className="mapp-search-x" onClick={() => setQ('')} aria-label="Borrar búsqueda">×</button>}
        </label>
      </section>
      {/* Y como una red social: las historias de los baristas (al buscar, solo los resultados) */}
      {!searching && <Stories baristas={sorted} go={go} ads={ads.story} onAd={setAdStory} reto={reto} />}
      {adStory && <AdStoryView ad={adStory} onClose={() => setAdStory(null)} />}
      {searching && <p className="mapp-feedline" role="status" data-testid="search-count"><b>{shown.length === 1 ? '1 barista' : `${shown.length} baristas`}</b> para «{q.trim()}»</p>}
      {searching ? null : hold && holdBarista ? (
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
      {!searching && <section className="mapp-drinks" aria-labelledby="mapp-drinks-q">
        <h2 className="mapp-drinks-q" id="mapp-drinks-q">¿Qué te gustaría probar <span className="mapp-script">hoy?</span></h2>
        <div className="mapp-drinks-grid" role="group" aria-label="¿Qué te gustaría probar hoy?">
          {DRINK_CHOICES.map((d) => (
            <button key={d.id} type="button" className={drink === d.id ? 'on' : ''} aria-pressed={drink === d.id} onClick={() => pickDrink(d.id)} data-testid={`drink-${d.id}`}>
              <span className="mapp-drink-ico" aria-hidden="true">{d.icon}</span>
              <b>{d.label}</b>
              {list && <small>{counts[d.id] === 1 ? '1 barista' : `${counts[d.id]} baristas`}</small>}
            </button>
          ))}
        </div>
      </section>}

      <Suspense fallback={null}><GustosIntro /></Suspense>

      <div className="mapp-bar">
        <div className="mapp-chips" role="group" aria-label="Filtrar">
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
          {page.items.map((b, i) => <BaristaRow key={b.id} b={b} onOpen={open} i={i} />)}
        </ul>
      )}
      {list && page.rest > 0 && (
        <button type="button" className="mapp-btn is-ghost mapp-more" onClick={() => setPages((n) => n + 1)} data-testid="list-more">
          Ver más baristas ({page.rest})
        </button>
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

      {!searching && <StampsCard />}
      {/* Al final del inicio y pegado abajo mientras se baja: siempre al alcance del pulgar */}
      {!searching && <WantCoffee me={me} ask={ask} drink={drink} />}

      {/* La publicidad de ACERO.press salió del inicio (pedido del usuario, 6 nov 2026): queda en Mi perfil › Otros */}
      {!searching && <section className="mapp-join">
        <div>
          <b>¿Vendes café en la calle?</b>
          <p>Que tus clientes te aparten antes de que llegues, lleva tu cuenta y tus fiados en el celular.</p>
        </div>
        <button type="button" className="mapp-btn is-ghost" onClick={() => go('/micra/barista')}>Soy barista</button>
      </section>}

      {/* Como Instagram: debajo de todo sigue el muro (los puestos de los baristas, el precio, el café de Colombia, recetas y videos) */}
      {!searching && <Suspense fallback={null}><HoyFeed go={go} audience="client" embedded list={list ? sorted : null} ads={ads.rows} challenge={reto} /></Suspense>}
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
  const [checked, setChecked] = useState(false); // ya se leyó si tenía un apartado hoy
  const preset = useRef(false);

  // Si ya apartó hoy con este barista, se ve su apartado (y puede cambiarlo)
  useEffect(() => {
    api.myHolds().then((h) => {
      const x = (h ?? []).find((y) => y.tintero_id === id && y.status !== 'cancelled');
      setMine(x ?? null);
      if (x?.status === 'waiting') setCart(Object.fromEntries(x.items.map((i) => [i.product, i.qty])));
      setChecked(true);
    }).catch(() => setChecked(true));
  }, [id]);
  // Apartar arranca con una taza de lo primero del menú (10 nov 2026): antes arrancaba en
  // cero y el botón quedaba gris. Solo la primera vez: si la quita o cancela, no vuelve sola.
  const first = b?.takes_holds ? menuOf(b)[0]?.id : null;
  useEffect(() => {
    if (!checked || !first || preset.current) return;
    preset.current = true;
    if (!mine) setCart((c) => (Object.keys(c).length ? c : { [first]: 1 }));
  }, [checked, first]); // eslint-disable-line react-hooks/exhaustive-deps

  // El motivo al cancelar se pregunta en la misma tarjeta
  const [askWhy, setAskWhy] = useState(false);

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
  // Antes de cancelar, por qué (como Rappi): sirve para saber qué falló, y se puede saltar
  const cancel = async (reason) => {
    setBusy(true);
    try { await api.cancelHold(mine.id, reason); setMine(null); setCart({}); setAskWhy(false); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const editing = mine?.status === 'waiting' && cartItems(cart).length && (cups !== mine.cups || total !== Number(mine.total));

  return (
    <article className="mapp-card" aria-labelledby="mapp-b-name">
      {/* Una sola cabecera en gradiente (6 nov 2026): quién es, dónde y cuándo suele pasar */}
      <section className="mapp-bhead" data-testid="barista-head">
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

      <div className="mapp-bhead-when">
        <p className="mapp-cota">Suele pasar</p>
        <p className="mapp-big">{windowLabel(b.hora_inicio, b.hora_fin) ?? 'Pregúntale su horario'}</p>
        <HoursBar from={b.hora_inicio} to={b.hora_fin} />
        {b.waiting > 0 && <p className="mapp-muted">{b.waiting === 1 ? '1 persona lo espera hoy' : `${b.waiting} personas lo esperan hoy`}</p>}
      </div>
      </section>

      {mine && mine.status !== 'waiting' ? (
        <section className="mapp-done" role="status">
          <b>{mine.status === 'served' ? '¡Entregado!' : 'Hoy no se pudo.'}</b>
          <p>{mine.status === 'served' ? `${b.name} ya te entregó ${itemsLabel(mine.items)}. Mañana puedes volver a apartar.` : `${b.name} marcó que no se encontraron. Mañana puedes volver a apartar.`}</p>
          {mine.status === 'served' && <RateHold hold={mine} baristaName={b.name} />}
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
              {busy ? 'Apartando…' : cups ? `${mine ? 'Cambiar a' : 'Apartar'} ${cupsLabel(cups)} · ${money(total)}` : 'Apartar'}
            </button>
          )}
          <p className="mapp-fine">No es domicilio: {b.name} sigue su ruta y te entrega cuando pase. Pagas al recibir{pays.length ? `: ${pays.join(', ')}` : ''}.</p>
          {mine && !askWhy && <button type="button" className="mapp-link" onClick={() => setAskWhy(true)} disabled={busy}>Ya no lo necesito</button>}
          {mine && askWhy && (
            <fieldset className="mapp-cancel" data-testid="cancel-reasons">
              <legend>¿Por qué lo cancelas?</legend>
              {CANCEL_REASONS.map(([key, label]) => (
                <button key={key} type="button" className="mapp-chip" onClick={() => cancel(key)} disabled={busy}>{label}</button>
              ))}
              <button type="button" className="mapp-link" onClick={() => cancel()} disabled={busy}>Cancelar sin decir</button>
            </fieldset>
          )}
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
  const [hist, setHist] = useState(() => { try { return JSON.parse(localStorage.getItem(HIST_KEY) ?? '{}') || {}; } catch { return {}; } });
  useEffect(() => {
    api.myHolds().then((h) => {
      setHolds(h ?? []);
      // El historial de a quién le ha apartado se queda en su celular (para «Tus baristas»)
      try {
        const prev = JSON.parse(localStorage.getItem(HIST_KEY) ?? '{}');
        const next = recordBaristaHistory(prev, h ?? []);
        if (next !== prev) { localStorage.setItem(HIST_KEY, JSON.stringify(next)); setHist(next); }
      } catch { /* sin memoria */ }
    }).catch((e) => { setHolds([]); if (!e.missing) setError(e.message); });
  }, []);
  const mineList = myBaristas(list, { favorites: api.favorites(), history: hist });
  const availableNow = mineList.filter((b) => b.status === 'live').length;
  const nameOf = (id) => (list ?? []).find((b) => b.id === id)?.name ?? 'Tu barista';
  const text = { waiting: 'Te espera', served: 'Entregado', missed: 'No se encontraron', cancelled: 'Cancelado' };
  const live = (holds ?? []).filter((h) => h.status !== 'cancelled');
  return (
    <div className="mapp-client">
      {/* La cabecera en gradiente con sus gustos y sus sellos (pedido del usuario, 6 nov 2026) */}
      <Suspense fallback={<h1 className="mapp-title is-small">Mis apartados de hoy</h1>}><GustosHead waiting={live.filter((h) => h.status === 'waiting').length} /></Suspense>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <h2 className="mapp-cota">Hoy</h2>
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

      {/* Tus baristas (pedido del usuario): los favoritos y a quienes les ha apartado, primero los disponibles */}
      <section className="mapp-mybaristas" aria-labelledby="mapp-mybaristas-t" data-testid="my-baristas">
        <h2 className="mapp-cota" id="mapp-mybaristas-t">Tus baristas{mineList.length ? ` · ${availableNow} en la calle ahora` : ''}</h2>
        {mineList.length === 0
          ? <p className="mapp-muted">Toca ♡ en un barista o apártale una vez y queda aquí, con si está disponible.</p>
          : (
            <ul className="mapp-list">
              {mineList.map((b) => (
                <li key={b.id}>
                  <button type="button" className="mapp-row" onClick={() => go(baristaPath(b.id))} data-testid={`my-barista-${b.id}`}>
                    <span className={`mapp-av ${b.status === 'live' ? 'is-live' : ''}`} aria-hidden="true">{initials(b.name)}</span>
                    <span className="mapp-row-main">
                      <b>{b.name}{b.fav ? ' ♥' : ''}</b>
                      <span>{[b.referencia || b.localidad, b.times ? `le apartaste ${b.times === 1 ? '1 vez' : `${b.times} veces`}` : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <StatusBadge s={b.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
