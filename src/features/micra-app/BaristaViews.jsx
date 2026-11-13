import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { TermoNow, TermosRow, useTermos } from './Termos.jsx';
import { termosOf } from './termos.js';
import { shiftWarnings, shiftClose } from './turno.js';
import {
  PRODUCTS, daySummary, weekBars, weekdayLetter, money, itemsLabel, cupsLabel, greeting, fiadoMessage,
  baristaPath, newRef, recentFiados, outProgress, scoreboard, initials, bogota, joinStats,
} from './micraApp.js';
import { streakOf, streakLabel, goalOf, milestone, stepText, lessonPath, figureFor, fillOf, GOAL_CHOICES, dayTrail, dayChallenge } from './motivation.js';
import { lessonsFor } from '../school/lessons.js';
import { readSeen } from '../school/progress.js';
import * as api from './api.js';
import platform from './platform.js';
import { IconToday, IconCup, IconCap, IconWallet, IconBack, IconPin, IconCamera } from './icons.jsx';
import { coffeeOrderText } from './feed.js';
import { Cargando } from './Animado.jsx';
import { useSaliTracking } from './useSaliTracking.js';
import { km } from '../ruta/track.js';
import { menuWith, consentNeeds, recordsTrip, isMode, modeOf, outPoint, FIXED_KEY, untilChoices } from './flow.js';
import { ModePicker, SlideToGo, GoOutConsent, AddProductTile } from './BaristaFlow.jsx';
import { formatCoPhone } from './phone.js';
import { firstSaleMoment, dayTripOf, storyFigure } from './daycard.js';
import { seenHolds, rememberHolds, hasHoldMemory, newHolds, holdAlert, POLL_MS } from './alerts.js';
import Globito, { ping } from './Globito.jsx';
import MiPlata from './MiPlata.jsx';

const PostComposer = lazy(() => import('./PostComposer.jsx'));

// Modo barista en cuatro pestañas: Vender, su inicio (la racha, salir, la meta,
// +1 por taza, fiados y quién te espera), Hoy (el muro del barismo), Aprende
// (las lecciones) y Mi plata. «Mi perfil» (/micra/barista/perfil) se abre con
// el botón de sus iniciales arriba, no con una quinta pestaña.
// Pensado para una mano, al sol y con mala señal: los +1 se guardan en el
// celular y suben cuando hay red (el mismo client_ref no cuenta dos veces).

const MicraMap = lazy(() => import('./MicraMap.jsx'));
// El mapa en vivo llega aparte (la app ya pesa cerca del límite del bundle)
const LivePanel = lazy(() => import('./LiveMap.jsx'));
// Aprender, la fiesta de la meta y la tarjeta del día llegan solo al abrirlos
const Aprende = lazy(() => import('./Aprende.jsx'));
// El muro de Hoy (precios, videos, puestos, recetas, noticias)
const HoyFeed = lazy(() => import('./HoyFeed.jsx'));

// El punto con que sale según cómo sale (flow.js): el puesto fijo se guarda en el celular
const readSpot = () => { try { return JSON.parse(localStorage.getItem(FIXED_KEY)); } catch { return null; } };
async function outPosition(mode) {
  // Lectura nueva (sin la guardada de hace minutos): es el punto donde está ahora
  const { pos, save } = outPoint(mode, await api.onePosition(8000, true), readSpot());
  if (save) { try { localStorage.setItem(FIXED_KEY, JSON.stringify(save)); } catch { /* sin memoria */ } }
  return pos;
}
const Competencia = lazy(() => import('./Competencia.jsx'));
const Party = lazy(() => import('./Celebrate.jsx').then((m) => ({ default: m.Party })));
const DayStory = lazy(() => import('./Celebrate.jsx').then((m) => ({ default: m.DayStory })));
const Moment = lazy(() => import('./Celebrate.jsx').then((m) => ({ default: m.Moment })));
// La entrada por SMS solo la descarga quien va a entrar (no el cliente que busca café)
const PhoneLogin = lazy(() => import('./PhoneLogin.jsx'));
// «Mi perfil» y «Cerrar sesión» (Perfil.jsx), solo al abrirlo
const BaristaProfile = lazy(() => import('./Perfil.jsx').then((m) => ({ default: m.BaristaProfile })));
// El QR «Pídeme por Micra» (con su librería), solo al abrirlo
const QrPage = lazy(() => import('./QrPage.jsx'));
const Pedido = lazy(() => import('./Pedido.jsx'));
const TeamWhatsApp = lazy(() => import('./PhoneLogin.jsx').then((m) => ({ default: m.TeamWhatsApp })));

const QUEUE_KEY = 'micra_sales_queue_v1';
const OUT_MINUTES = 240;

const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) ?? []; } catch { return []; } };
const writeQueue = (q) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* sin memoria: sube de una */ } };
const time = (iso) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });

/** Lo primero al entrar: el mapa con dónde estás y los baristas de alrededor. */
function NearMap({ selfId = null, night = false, go }) {
  const [list, setList] = useState(null);
  const [me, setMe] = useState(null);
  useEffect(() => {
    let alive = true;
    api.listBaristas().then((l) => alive && setList(l ?? [])).catch(() => alive && setList([]));
    api.onePosition().then((p) => alive && setMe(p));
    return () => { alive = false; };
  }, []);
  const others = (list ?? []).filter((b) => b.id !== selfId);
  return (
    <section className="mapp-glass mapp-nearby" aria-labelledby="mapp-nearby">
      <p className="mapp-cota" id="mapp-nearby">Cerca de ti{list ? ` · ${others.length === 1 ? '1 barista' : `${others.length} baristas`}` : ''}</p>
      <Suspense fallback={<div className="mapp-map" aria-hidden="true" />}>
        <MicraMap baristas={others} me={me} theme={night ? 'noche' : 'plano'} onPick={(id) => go?.(baristaPath(id))} />
      </Suspense>
    </section>
  );
}

/**
 * La cabecera de la entrada del barista (6 nov 2026, pedido del usuario): el gradiente con el
 * dibujo, el título y las cifras reales de Micra (baristas, en la calle, el tinto típico).
 */
function JoinHead() {
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    api.listBaristas().then((l) => alive && setList(l ?? [])).catch(() => alive && setList([]));
    return () => { alive = false; };
  }, []);
  const st = joinStats(list);
  const kpis = [
    st.baristas != null && [st.baristas === 1 ? 'barista en Micra' : 'baristas en Micra', st.baristas],
    st.live != null && ['en la calle ahora', st.live],
    st.tinto != null && ['el tinto típico', money(st.tinto)],
  ].filter(Boolean);
  return (
    <section className="mapp-joinhead" aria-labelledby="mapp-join-t" data-testid="join-head">
      {/* El chico que empuja el carrito (pedido del usuario, 6 nov 2026), sobre la hoja crema de la calle */}
      <span className="mapp-joinhead-art" aria-hidden="true"><img src={platform.siteUrl('/image/personas/ruta.webp')} alt="" width="618" height="900" decoding="async" /></span>
      <p className="mapp-kicker">Para baristas</p>
      <h1 className="mapp-title" id="mapp-join-t">Vende más en <span className="mapp-script">tu misma ruta.</span></h1>
      <ul className="mapp-joinhead-perks">
        <li>Te apartan antes de que llegues</li>
        <li>+1 por taza y sabes cuánto hiciste</li>
        <li>Tus fiados en orden</li>
      </ul>
      {kpis.length > 0 && (
        <dl className="mapp-joinhead-kpis" data-testid="join-kpis">
          {kpis.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
    </section>
  );
}

export function BaristaJoin({ session, onLinked, team = false, preview = false, night = false, go }) {
  const fromUrl = new URLSearchParams(window.location.search).get('codigo') ?? '';
  const [code, setCode] = useState(fromUrl.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Entró con su celular: la base busca la ficha con ese número y lo enlaza sola
  const smsPhone = !team && !preview ? session?.user?.phone || null : null;
  const [byPhone, setByPhone] = useState(smsPhone ? 'busy' : null);
  useEffect(() => {
    if (!smsPhone) return undefined;
    let alive = true;
    setByPhone('busy');
    api.claimPhone()
      .then(() => { if (alive) { setByPhone(null); onLinked(); } })
      .catch((e) => alive && setByPhone({ error: e.missing ? 'La entrada por SMS todavía no está activa. Entra con el código de seis letras que te dio el equipo.' : e.message }));
    return () => { alive = false; };
  }, [smsPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  if (team && session) {
    return (
      <div className="mapp-empty">
        <b>Esta parte es del equipo de Micra.</b>
        <p>Tu cuenta no está en el equipo.</p>
      </div>
    );
  }
  if (!session || preview) {
    return (
      <section className="mapp-join-page">
        {preview && (
          <p className="mapp-acting" data-testid="team-preview">
            Así entran los baristas
            <button type="button" className="mapp-link" onClick={() => go?.('/micra/equipo')}>Actuar como › Equipo</button>
          </p>
        )}
        <JoinHead />
        {/* Lo primero después del título: entrar es lo que vino a hacer */}
        <Suspense fallback={<Cargando />}><PhoneLogin preview={preview} /></Suspense>
        {!preview && (
          // El camino de antes (Google + código de seis letras) sigue para quien ya lo tiene
          <div className="mapp-join-alt">
            <p className="mapp-fine">¿Te dieron un código de seis letras?</p>
            <button type="button" className="mapp-link" onClick={() => api.signIn('/micra/barista')}>Entrar con Google</button>
          </div>
        )}
      </section>
    );
  }
  if (byPhone === 'busy') return <Cargando fig="caminando">Buscando tu perfil…</Cargando>;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await api.claim(code); onLinked(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <form className="mapp-join-page" onSubmit={submit}>
      {byPhone?.error && (
        <section className="mapp-glass" aria-labelledby="mapp-not-found" data-testid="phone-not-found">
          <p className="mapp-cota" id="mapp-not-found">Tu celular · {formatCoPhone(smsPhone)}</p>
          <p className="mapp-error" role="alert">{byPhone.error}</p>
          <Suspense fallback={null}><TeamWhatsApp phone={smsPhone} /></Suspense>
        </section>
      )}
      <NearMap night={night} go={go} />
      <section className="mapp-glass" aria-labelledby="mapp-asks">
        <p className="mapp-cota" id="mapp-asks">Solicitudes cerca · nadie todavía</p>
        <p className="mapp-muted">Cuando enlaces tu cuenta, aquí te llegan los clientes que te apartan café.</p>
      </section>
      <p className="mapp-kicker">Para baristas</p>
      <h1 className="mapp-title is-small">Escribe tu código.</h1>
      <p className="mapp-lede">Son seis letras y números que te dio el equipo de Micra. Sirven una vez y vencen en 7 días.</p>
      <label className="mapp-field">
        <span>Código</span>
        <input className="mapp-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} autoCapitalize="characters" autoComplete="one-time-code" placeholder="ABC234" />
      </label>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <button type="submit" className="mapp-btn is-cta" disabled={busy || code.length !== 6}>{busy ? 'Revisando…' : 'Enlazar mi cuenta'}</button>
      <button type="button" className="mapp-link" onClick={api.signOut}>{smsPhone ? 'Entrar con otro número' : 'Entrar con otra cuenta'}</button>
    </form>
  );
}

function Prices({ day, asId, onSaved, first = false }) {
  const [p, setP] = useState(() => Object.fromEntries(PRODUCTS.map((x) => [x.id, day.prices?.[x.id] != null ? String(Math.round(day.prices[x.id])) : ''])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const num = (v) => (v === '' ? null : Number(v));
    try { await api.setPrices({ tinto: num(p.tinto), perico: num(p.perico), aromatica: num(p.aromatica) }, asId); onSaved(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <form className="mapp-glass mapp-prices" onSubmit={submit}>
      <p className="mapp-cota">{first ? 'Primero, tus precios' : 'Tus precios'}</p>
      {first && <p className="mapp-muted">Con estos precios cuentas tus ventas y tus clientes te apartan. Deja vacío lo que no vendes.</p>}
      {PRODUCTS.map((x) => (
        <label key={x.id} className="mapp-field is-row">
          <span>{x.label}</span>
          <span className="mapp-money"><i>$</i><input inputMode="numeric" value={p[x.id]} onChange={(e) => setP((o) => ({ ...o, [x.id]: e.target.value.replace(/\D/g, '').slice(0, 5) }))} placeholder="—" aria-label={`Precio del ${x.one}`} /></span>
        </label>
      ))}
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <button type="submit" className="mapp-btn" disabled={busy || !p.tinto && !p.perico && !p.aromatica}>{busy ? 'Guardando…' : 'Guardar precios'}</button>
    </form>
  );
}

function Digits({ value, label }) {
  return (
    <div className="mapp-digits" aria-label={`${label}: ${value}`}>
      {String(value).split('').map((c, i) => <span key={i} className={/\d/.test(c) ? '' : 'is-sep'}>{c}</span>)}
    </div>
  );
}

/** La semana como tazas: llenas los días que vendió; hoy punteada hasta que venda. */
function WeekCups({ streak }) {
  return (
    <ol className="mapp-weekcups" aria-label="Tu semana">
      {streak.days.map((d) => (
        <li key={d.day} className={`${d.done ? 'is-done' : ''} ${d.today ? 'is-today' : ''}`} aria-label={`${d.today ? 'Hoy' : d.letter}: ${d.done ? `vendiste ${cupsLabel(d.cups)}` : 'sin ventas'}`}>
          <svg viewBox="0 0 24 26" aria-hidden="true"><path d="M3 6h15v9a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7z" /><path d="M18 9h2a3 3 0 0 1 0 6h-2" className="is-handle" /></svg>
          <small>{d.today ? 'Hoy' : d.letter}</small>
        </li>
      ))}
    </ol>
  );
}

/** La racha en una fila: la píldora de días y la semana como tazas. */
function StreakRow({ streak }) {
  return (
    <section className="mapp-streakrow" aria-label="Tu racha" data-testid="streak">
      <span className="mapp-streakpill"><span aria-hidden="true">🔥</span>{streak.count > 0 ? streakLabel(streak) : '¡A empezar!'}</span>
      <WeekCups streak={streak} />
    </section>
  );
}

/** La meta del día: el anillo, cómo va contra ayer y su mejor día, y cambiarla. */
function GoalCard({ board, goal, onGoal, week }) {
  const [open, setOpen] = useState(false);
  const past = (week ?? []).slice(0, -1);
  const yesterday = past.at(-1)?.cups;
  const best = Math.max(0, ...past.map((d) => d.cups || 0));
  const pct = fillOf(board.cups, goal);
  const C = 2 * Math.PI * 24;
  return (
    <section className="mapp-glass mapp-goal" aria-label="Meta de hoy" data-testid="goal">
      <div className="mapp-goal-row">
        <svg className="mapp-ring" viewBox="0 0 58 58" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={board.cups} aria-label={`Meta del día: ${goal} tazas`}>
          <circle cx="29" cy="29" r="24" className="is-track" />
          <circle cx="29" cy="29" r="24" className="is-fill" strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 29 29)" />
          <text x="29" y="33" textAnchor="middle">{board.cups}/{goal}</text>
        </svg>
        <div className="mapp-goal-copy">
          <p className="mapp-cota">Meta de hoy</p>
          <b><span data-testid="sell-cups">{board.cups}</span> de {goal} tazas{board.cups >= goal ? ' ¡cumplida!' : ''}</b>
          <span>{board.cups >= goal ? `Llevas ${board.cups}. Todo lo demás es ganancia.` : yesterday != null || best ? `${yesterday != null ? `Ayer vendiste ${yesterday}.` : ''}${best ? ` Tu mejor día: ${best}.` : ''}` : 'Escoge cuántas tazas quieres vender hoy.'}</span>
        </div>
        <button type="button" className="mapp-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Cambiar</button>
      </div>
      {open && (
        <div className="mapp-chips" role="group" aria-label="Escoge tu meta">
          {GOAL_CHOICES.map((n) => (
            <button key={n} type="button" className={n === goal ? 'on' : ''} aria-pressed={n === goal} onClick={() => { onGoal(n); setOpen(false); }}>{n}</button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Quién le apartó: entregar, no vino y el tinto gratis por canjear. */
// La invitación a los avisos por WhatsApp: una vez, hasta que los active o diga «Ahora no»
const WA_NUDGE_KEY = 'micra_wa_nudge_off_v1';

/** «¿Te avisamos por WhatsApp cuando te aparten?»: solo en su propio celular y si tiene número. */
function WaNudge() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(() => { try { return localStorage.getItem(WA_NUDGE_KEY) === '1'; } catch { return false; } });
  useEffect(() => { if (!off) api.baristaAlerts(null).then(setState).catch(() => setState(null)); }, [off]);
  if (off || !state || state.on || !state.has_phone) return null;
  const later = () => { try { localStorage.setItem(WA_NUDGE_KEY, '1'); } catch { /* sin memoria */ } setOff(true); };
  const on = async () => {
    setBusy(true);
    try { setState(await api.baristaAlerts(true)); } catch { /* sigue la invitación */ }
    setBusy(false);
  };
  return (
    <section className="mapp-glass mapp-wanudge" aria-label="Avisos por WhatsApp" data-testid="wa-nudge">
      <span className="mapp-wanudge-ico" aria-hidden="true">💬</span>
      <div>
        <b>¿Te avisamos por WhatsApp cuando te aparten?</b>
        <p className="mapp-muted">Solo si no tienes Micra abierta, y a lo más uno cada 10 minutos.</p>
        <span className="mapp-row-btns">
          <button type="button" className="mapp-btn is-small is-cta" onClick={on} disabled={busy}>{busy ? 'Un momento…' : 'Activar'}</button>
          <button type="button" className="mapp-link" onClick={later}>Ahora no</button>
        </span>
      </div>
    </section>
  );
}

/** Un apartado que se entrega deslizando a la derecha (o con su botón «Entregado»). */
function SwipeHold({ children, onServe, disabled }) {
  const drag = useRef(null);
  const [dx, setDx] = useState(0);
  const down = (e) => { if (disabled || e.target.closest('button')) return; drag.current = { x: e.clientX, y: e.clientY, on: false }; };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    // Solo si el gesto es horizontal: subir y bajar la página sigue igual
    if (!d.on) { if (Math.abs(e.clientY - d.y) > 12) { drag.current = null; return; } if (mx < 12) return; d.on = true; e.currentTarget.setPointerCapture?.(e.pointerId); }
    setDx(Math.max(0, Math.min(mx, 220)));
  };
  const up = () => { const far = dx > 110; drag.current = null; setDx(0); if (far) onServe(); };
  return (
    <li className={`mapp-swipe ${dx ? 'is-dragging' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="hold-row">
      <i className="mapp-swipe-bg" aria-hidden="true" style={{ opacity: Math.min(1, dx / 110) }}>✓ Entregado</i>
      <div className="mapp-swipe-card" style={dx ? { transform: `translateX(${dx}px)` } : undefined}>{children}</div>
    </li>
  );
}

function Waiting({ waiting, sum, rewards, busy, onClose, onRedeem, compact = false }) {
  return (
    <section className={`mapp-glass ${compact ? 'is-compact' : ''}`} aria-labelledby="mapp-wait">
      {waiting.length > 0 && <p className="mapp-hold-hint">Desliza la tarjeta a la derecha para entregar</p>}
      <p className="mapp-cota" id="mapp-wait">{compact ? 'Te esperan' : 'Solicitudes cerca · Te esperan'} · {waiting.length ? `${sum.waitingCups} ${sum.waitingCups === 1 ? 'taza' : 'tazas'}` : 'nadie todavía'}</p>
      {waiting.length === 0 && !compact && (
        <p className="mapp-muted">Cuando un cliente te aparte, sale aquí. Comparte tu enlace para que te encuentren.</p>
      )}
      <ul className="mapp-holds">
        {waiting.map((h, i) => (
          <SwipeHold key={h.id} onServe={() => onClose(h, true)} disabled={busy === h.id}>
            <span className="mapp-av mapp-hold-n" aria-hidden="true">{i + 1}</span>
            <div>
              <b>{h.name}</b><span>{itemsLabel(h.items)} · {money(h.total)}</span>
              {rewards[h.id] > 0 && <span className="mapp-reward">🎁 Tiene un tinto gratis <button type="button" className="mapp-link" onClick={() => onRedeem(h)} disabled={busy === `r-${h.id}`}>Canjear</button></span>}
              {rewards[`done-${h.id}`] && <span className="mapp-reward">✓ Tinto gratis canjeado</span>}
            </div>
            <span className="mapp-hold-act">
              <button type="button" className="mapp-btn is-small" onClick={() => onClose(h, true)} disabled={busy === h.id}>Entregado</button>
              <button type="button" className="mapp-link" onClick={() => onClose(h, false)} disabled={busy === h.id}>No vino</button>
            </span>
          </SwipeHold>
        ))}
      </ul>
    </section>
  );
}

/** Pedir café por kilos: se escoge cuánto y sale el WhatsApp del equipo (el precio lo da el equipo). */
function CoffeeOrder({ day, onClose }) {
  const [kilos, setKilos] = useState(1);
  const [number, setNumber] = useState(null);
  useEffect(() => { api.teamWhatsApp().then((n) => setNumber(n)).catch(() => setNumber('573152125327')); }, []);
  const text = coffeeOrderText({ name: day.name, kilos, where: day.referencia || day.localidad });
  return (
    <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Pedir café" data-testid="coffee-order">
      <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={onClose} />
      <section className="mapp-sheet">
        <i className="mapp-sheet-handle" aria-hidden="true" />
        <p className="mapp-cota">Tu café</p>
        <h2 className="mapp-title is-small">¿Cuánto café pides?</h2>
        <p className="mapp-muted">Café de origen para la AeroPress. Con un kilo salen unas 80 tazas.</p>
        <div className="mapp-chips is-big" role="group" aria-label="Kilos">
          {[1, 2, 3, 5].map((k) => (
            <button key={k} type="button" className={k === kilos ? 'on' : ''} aria-pressed={k === kilos} onClick={() => setKilos(k)}>{k} kg</button>
          ))}
        </div>
        <a className={`mapp-btn is-cta ${number ? '' : 'is-disabled'}`} href={number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : undefined} target="_blank" rel="noopener noreferrer" data-testid="coffee-order-send">Pedir por WhatsApp</a>
        <p className="mapp-fine">El equipo te confirma el precio y cuándo te llega.</p>
      </section>
    </div>
  );
}

const TABS = [
  ['vender', 'Vender', IconCup, '/micra/barista'],
  ['hoy', 'Hoy', IconToday, '/micra/barista/hoy'],
  ['aprende', 'Aprende', IconCap, '/micra/barista/aprende'],
  ['cuenta', 'Mi cuenta', IconWallet, '/micra/barista/cuenta'],
];

/** La barra del barista: sus cuatro pestañas y, al centro, la cámara para la foto de la venta.
 *  Mismo diseño que la del cliente (pedido del usuario, 6 nov 2026): solo íconos, el centro en rojo. */
function BaristaTabs({ tab, go, waiting, onQuick }) {
  const btn = ([id, label, Icon, path]) => (
    <button key={id} type="button" className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => go(path)} aria-label={label} title={label}>
      <Icon />
      <small className="mapp-tabs-l" aria-hidden="true">{label}</small>
      {id === 'vender' && waiting > 0 && <span className="mapp-tabs-badge" aria-label={`${waiting} te esperan`}>{waiting}</span>}
    </button>
  );
  return (
    <nav className="mapp-tabs is-ig" aria-label="Barista">
      {TABS.slice(0, 2).map(btn)}
      {/* El centro es lo que el barista vino a hacer: anotar una venta desde cualquier pestaña.
          La foto de la venta queda dentro de esa hoja */}
      <button type="button" className="mapp-tabs-cam is-plus" onClick={onQuick} aria-label="Anotar una venta" title="Anotar una venta" data-testid="tab-sale">
        <b aria-hidden="true">+1</b>
      </button>
      {TABS.slice(2).map(btn)}
    </nav>
  );
}

/** Las monedas que saltan al tocar +1: la plata de esa taza sube y se va (gamificado, pedido del usuario). */
function CoinPop({ pop }) {
  if (!pop) return null;
  return (
    <span className="mapp-coinpop" key={pop.id} aria-hidden="true">
      <em>{pop.label}</em>
      <i>🪙</i><i>🪙</i><i>🪙</i><i>🪙</i>
    </span>
  );
}

const GOAL_KEY = 'micra_goal_v1';
const MODE_KEY = 'micra_out_mode_v1';
const readMode = () => { try { const m = localStorage.getItem(MODE_KEY); return isMode(m) ? m : null; } catch { return null; } };
const writeMode = (m) => { try { localStorage.setItem(MODE_KEY, m); } catch { /* sin memoria: vale por hoy */ } };
const PARTY_KEY = 'micra_party_v1';
const readGoal = (id) => { try { return JSON.parse(localStorage.getItem(GOAL_KEY))?.[id] ?? null; } catch { return null; } };
const writeGoal = (id, n) => { try { localStorage.setItem(GOAL_KEY, JSON.stringify({ ...(JSON.parse(localStorage.getItem(GOAL_KEY)) ?? {}), [id]: n })); } catch { /* sin memoria: vale por hoy */ } };
// La fiesta de la meta sale una vez al día por barista
const partied = (key) => { try { return localStorage.getItem(PARTY_KEY) === key; } catch { return false; } };
const markParty = (key) => { try { localStorage.setItem(PARTY_KEY, key); } catch { /* sin memoria */ } };
// La primera taza del día también se celebra una vez (racha que sigue o hito)
const FIRST_KEY = 'micra_first_v1';
const firstDone = (key) => { try { return localStorage.getItem(FIRST_KEY) === key; } catch { return true; } };
const markFirst = (key) => { try { localStorage.setItem(FIRST_KEY, key); } catch { /* sin memoria */ } };
// El recorrido de hoy se queda en el celular al volver de la calle (la flecha), para «Mi día en la calle»
const TRIP_KEY = 'micra_dia_v1';
const readDayTrip = () => { try { return JSON.parse(localStorage.getItem(TRIP_KEY)); } catch { return null; } };
const writeDayTrip = (t) => { try { localStorage.setItem(TRIP_KEY, JSON.stringify(t)); } catch { /* sin memoria */ } };

export function BaristaHome({ asId = null, onPickAs, admin = false, go, night = false, tab = 'vender', onLive, onBoard, refreshKey = 0 }) {
  const [day, setDay] = useState(null);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  // El recorrido de «Salí a vender»: solo en su propia cuenta (el equipo «actuando como» no graba)
  const trip = useSaliTracking({ enabled: !asId });
  const [asking, setAsking] = useState(false);
  const [rewards, setRewards] = useState({}); // { holdId: tintos gratis por canjear }
  // Lo de 20261031130000_micra_barista_flow.sql: productos propios, medios de pago, cómo sale y si es público
  const [extras, setExtras] = useState(null);
  const [mode, setMode] = useState(readMode);
  const loadExtras = useCallback(() => api.baristaExtras(asId).then((x) => {
    setExtras(x ?? {});
    if (x?.out_mode && isMode(x.out_mode)) { setMode(x.out_mode); writeMode(x.out_mode); }
  }).catch(() => setExtras({})), [asId]);
  useEffect(() => { loadExtras(); }, [loadExtras]);
  // Quién de los que esperan tiene un tinto gratis (arriba de los returns: los hooks van siempre en el mismo orden)
  useEffect(() => {
    if (!day) return;
    api.holdRewards(asId).then((r) => setRewards(r ?? {})).catch(() => setRewards({}));
  }, [day, asId]);
  const [pending, setPending] = useState(() => readQueue().length);
  const [fiadoFor, setFiadoFor] = useState(null); // producto que espera el nombre del fiado
  const [fiadoName, setFiadoName] = useState('');
  const [last, setLast] = useState(null); // la última venta, para deshacer
  const [pop, setPop] = useState(null); // las monedas del último +1
  const [untilId, setUntilId] = useState('d'); // «Hasta las»: 4 horas si no escoge
  const [quick, setQuick] = useState(false); // la hoja «+1 Venta» del centro de la barra
  const [pedido, setPedido] = useState(false); // la calculadora de un pedido de grupo
  const [ending, setEnding] = useState(null); // «Terminar turno»: 'ask' antes, 'done' el cierre
  const [shooting, setShooting] = useState(false); // la cámara de la barra: foto de la venta
  const [busy, setBusy] = useState(null);
  const [goalPick, setGoalPick] = useState(null); // la meta que escogió en esta sesión
  const [toast, setToast] = useState(null);
  const [party, setParty] = useState(false);
  const [story, setStory] = useState(false);
  const [moment, setMoment] = useState(null); // la primera taza del día o un hito de racha
  const [ordering, setOrdering] = useState(false);
  // El buscador de la cabecera roja de Vender: un cliente, un fiado o un producto
  const prevCups = useRef(null);
  const flushing = useRef(false);

  const load = useCallback(async () => {
    try {
      setDay(await api.baristaDay(asId));
      setError(null);
    } catch (e) {
      if (e.missing) setMissing(true);
      else setError(e.message);
    }
  }, [asId]);
  useEffect(() => { setDay(null); prevCups.current = null; load(); }, [load]);
  // Avisos: con la app a la vista se mira cada 20 s (y al volver a ella) si llegó un apartado,
  // y se le dice a la base que Micra está abierta (así no le manda WhatsApp: basta el globito)
  useEffect(() => {
    const seen = () => { if (!asId) api.baristaSeen().catch(() => {}); };
    seen();
    const tick = () => { if (document.visibilityState === 'visible') { load(); seen(); } };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [load, asId]);
  // «Desliza para recargar» (MicraApp): vuelve a leer el día y lo propio
  useEffect(() => { if (refreshKey) { load(); loadExtras(); } }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // El globito: los apartados que esperan y no se han avisado (también los que llegaron con la app cerrada)
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!day) return;
    let store = null;
    try { store = window.localStorage; } catch { /* sin memoria */ }
    const scope = `${day.id}:${bogota().day}`;
    const known = hasHoldMemory(store);
    const seen = seenHolds(store, scope);
    const fresh = newHolds(day.holds, seen);
    rememberHolds(store, scope, [...seen, ...day.holds.filter((h) => h.status === 'waiting').map((h) => h.id)]);
    if (fresh.length && known) { setNotice(holdAlert(fresh)); ping(); }
    // Cuánto tarda el barista en ver un apartado: solo él, no el equipo actuando como él
    if (fresh.length && !asId) api.markHoldsSeen(fresh.map((h) => h.id).slice(0, 50)).catch(() => {});
  }, [day]);
  // La barra de arriba (MicraApp) se pinta de rojo mientras está en la calle
  const liveNow = !!day && !!outProgress(day.live_until, new Date(), OUT_MINUTES);
  useEffect(() => { onLive?.(liveNow); }, [liveNow, onLive]);
  useEffect(() => () => onLive?.(false), [onLive]);

  // Sube los +1 que quedaron en el celular (sin señal); el mismo ref no se duplica
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let q = readQueue();
    for (const s of [...q]) {
      try {
        const r = await api.sell(s.ref, s.product, s.qty, s.fiado, s.asId);
        q = q.filter((x) => x.ref !== s.ref);
        writeQueue(q);
        if (s.ref === last?.ref) setLast((l) => (l ? { ...l, id: r.id } : l));
      } catch (e) {
        // Un error de la base (sin precio, sin permiso) no se arregla reintentando
        if (e.code && e.code !== 'PGRST000' && !/fetch|network/i.test(e.message)) { q = q.filter((x) => x.ref !== s.ref); writeQueue(q); setError(e.message); }
        break;
      }
    }
    setPending(q.length);
    flushing.current = false;
    load();
  }, [load, last]);
  useEffect(() => {
    if (readQueue().length) flush();
    const id = setInterval(() => { if (readQueue().length) flush(); }, 15000);
    return () => clearInterval(id);
  }, [flush]);

  // Lo que se cuenta, con lo que aún no sube (arriba de los returns, por los hooks)
  const queued = day ? readQueue().filter((s) => (s.asId ?? null) === asId) : [];
  const ownProducts = extras?.products ?? [];
  const allPrices = { ...(day?.prices ?? {}), ...Object.fromEntries(ownProducts.map((x) => [x.id, x.price])) };
  const board = day ? scoreboard(day, queued, allPrices) : null;
  const goal = day ? goalOf(day.week, goalPick ?? readGoal(day.id)) : 0;
  // Cuántos termos lleva y cuántos tintos saca de cada uno (solo en este celular)
  const [termSet, setTermSet] = useTermos();
  // La meta del día sube a la barra de arriba (donde estaba «Cliente / Barista»)
  const boardCups = board?.cups ?? null;
  useEffect(() => { onBoard?.(boardCups === null ? null : { cups: boardCups, goal }); }, [boardCups, goal, onBoard]);
  useEffect(() => () => onBoard?.(null), [onBoard]);
  const partyKey = day ? `${day.id}:${bogota().day}` : '';
  useEffect(() => {
    if (!board) return;
    const prev = prevCups.current;
    prevCups.current = board.cups;
    if (prev == null) return;
    const m = milestone(prev, board.cups, goal);
    if (prev === 0 && board.cups > 0 && !asId && !firstDone(partyKey)) {
      markFirst(partyKey);
      setMoment(firstSaleMoment({ streak: streakOf(day.week, board.cups).count, goal, name: day.name.split(' ')[0] }));
      return;
    }
    if (m?.kind === 'goal' && !partied(partyKey)) { markParty(partyKey); setParty(true); }
    else if (m?.kind === 'step' || m?.kind === 'goal') setToast(m.kind === 'goal' ? `¡Meta de ${goal} cumplida!` : stepText(m));
  }, [board?.cups, goal, partyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  if (missing) {
    return (
      <div className="mapp-empty">
        <b>El modo barista abre muy pronto.</b>
        <p>Falta activar las tablas de Micra en la base (migración 20261026210000_micra_app).</p>
      </div>
    );
  }
  if (error && !day) return <p className="mapp-error" role="alert">No se pudo leer tu día: {error} <button type="button" className="mapp-link" onClick={load}>Reintentar</button></p>;
  if (!day) return <Cargando fig="aeropress">Cargando tu día…</Cargando>;

  const menu = menuWith(day, ownProducts);
  const isPublic = extras?.public ?? day.public;
  const sum = daySummary(day);
  const counts = { ...sum.byProduct };
  for (const s of queued) counts[s.product] = (counts[s.product] || 0) + s.qty;
  const prog = outProgress(day.live_until, new Date(), OUT_MINUTES);
  const live = !!prog;
  const first = day.name.split(' ')[0];
  const streak = streakOf(day.week, board.cups);
  const fig = figureFor(day.id);
  const setGoal = (n) => { setGoalPick(n); writeGoal(day.id, n); };

  const plusOne = (product, fiado = null) => {
    const s = { ref: newRef('venta'), product, qty: 1, fiado, asId };
    const price = Number(allPrices[product]) || 0;
    const id = Date.now();
    setPop({ id, product, label: fiado ? 'Fiado ✍️' : price ? `+${money(price)}` : '+1 ☕' });
    setTimeout(() => setPop((p) => (p?.id === id ? null : p)), 1100);
    writeQueue([...readQueue(), s]);
    setPending(readQueue().length);
    setLast(s);
    setFiadoFor(null);
    setFiadoName('');
    if (navigator.vibrate) navigator.vibrate(15);
    flush();
  };
  const undo = async () => {
    if (!last) return;
    const q = readQueue();
    if (q.some((x) => x.ref === last.ref)) { writeQueue(q.filter((x) => x.ref !== last.ref)); setPending(q.length - 1); setLast(null); return; }
    setBusy('undo');
    try {
      const id = last.id ?? day.sales.find((x) => x.product === last.product)?.id;
      if (id) await api.undoSale(id, asId);
      setLast(null);
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const pickMode = (m) => {
    setMode(m);
    writeMode(m);
    api.setOutMode(m, asId).catch(() => { /* sin la migración se recuerda en el celular */ });
  };
  // Salir siempre se puede: lo que falta (mapa público, ubicación) se pide en la misma hoja
  const needs = consentNeeds({ isPublic, consented: !trip.ready || trip.consented, own: !asId });
  // «Hasta las»: a qué hora se apaga sola la salida (4 horas si no escoge)
  const nowBog = bogota();
  const untils = untilChoices(nowBog.hour, nowBog.minute);
  const outMinutes = (untils.find((u) => u.id === untilId) ?? untils[0]).minutes;
  const out = async (on, { asked = false, end = false } = {}) => {
    if (on && !mode) { setError('Escoge primero cómo sales hoy: puesto fijo, sombrilla o caminando.'); return; }
    if (on && needs.ask && !asked) { setAsking(true); return; }
    setAsking(false);
    setBusy('out');
    try {
      // Pide el permiso del GPS del celular cada vez que sale (con cualquier forma de salir)
      const pos = on ? await outPosition(mode) : null;
      // Antes de cerrar el recorrido se guarda lo de hoy para «Mi día en la calle»
      const before = !on ? { ...dayTripOf(trip.view, readDayTrip(), bogota().day), day: bogota().day } : null;
      if (before && before.path.length > 1) writeDayTrip(before);
      await api.goOut(on ? outMinutes : 0, pos, asId);
      if (on && recordsTrip(mode) && trip.ready && trip.consented && !trip.recording) await trip.start();
      if (!on && (trip.recording || trip.pendingEnd)) await trip.finish();
      await load();
      // Volver no cierra nada: las ventas son del día, salga como salga
      if (end) setEnding('done');
      else if (!on) setToast(board.cups > 0 ? 'Saliste del mapa. Tus ventas de hoy siguen aquí.' : 'Saliste del mapa.');
    } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const acceptConsent = async (what) => {
    setBusy('out');
    try {
      if (what.public) {
        try { await api.setPublic(true); } catch (e) { if (!e.missing) throw e; }
      }
      if (what.location) await trip.consent(true);
      await loadExtras();
    } catch (e) { setError(e.message); setBusy(null); setAsking(false); return; }
    setBusy(null);
    // trip.consented aún no se refresca en este render: se sale con lo aceptado
    setAsking(false);
    setBusy('out');
    try {
      const pos = await outPosition(mode);
      await api.goOut(outMinutes, pos, asId);
      if (recordsTrip(mode) && trip.ready && !trip.recording) await trip.start();
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const redeem = async (h) => {
    setBusy(`r-${h.id}`);
    try { await api.redeemReward(h.id, asId); setRewards((r) => ({ ...r, [h.id]: 0, [`done-${h.id}`]: 1 })); } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const closeHold = async (h, served) => {
    setBusy(h.id);
    try { await api.closeHold(h.id, served, asId); await load(); } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const paid = async (name) => {
    setBusy(`f-${name}`);
    try { await api.fiadoPaid(name, asId); await load(); } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const waiting = day.holds.filter((h) => h.status === 'waiting');
  const waitingTotal = waiting.reduce((a, h) => a + (Number(h.total) || 0), 0);
  const bars = weekBars(day.week);
  const recent = recentFiados(day);
  const waitingProps = { waiting, sum, rewards, busy, onClose: closeHold, onRedeem: redeem };
  const consent = asking && <GoOutConsent needs={needs} mode={mode} busy={busy === 'out'} onAccept={acceptConsent} onCancel={() => setAsking(false)} />;
  const errorBox = error && <p className="mapp-error" role="alert">{error} <button type="button" className="mapp-link" onClick={() => setError(null)}>Cerrar</button></p>;
  const dayTrip = dayTripOf(trip.view, readDayTrip(), bogota().day);
  const storyData = { name: first, cups: board.cups, total: board.total, streak: streak.count, goal, fig, mode, km: dayTrip.distance, stops: dayTrip.stops, path: dayTrip.path, url: platform.siteUrl(baristaPath(day.id)) };

  // Contar ventas: en la calle va dentro de la cabecera, junto a la meta (pedido del usuario, 10 nov 2026)
  const counter = (
    <>
      <section className="mapp-count" aria-label="Contar ventas">
        {menu.map((m) => (
          <div key={m.id} className="mapp-tile">
            <span className="mapp-tile-name">{m.label}</span>
            <span className="mapp-tile-n">{money(m.price)} · <b data-testid={`micra-count-${m.id}`}>{counts[m.id] || 0}</b> hoy</span>
            <button type="button" className="mapp-plus" onClick={() => plusOne(m.id)} aria-label={`Vendí un ${m.one}`}>+1</button>
            {pop?.product === m.id && <CoinPop pop={pop} />}
            <button type="button" className="mapp-tile-fiado" onClick={() => setFiadoFor(m.id)} aria-label={`Fié un ${m.one}`}>Fiado</button>
          </div>
        ))}
        <AddProductTile asId={asId} count={ownProducts.length} onAdded={loadExtras} />
      </section>
      {fiadoFor && (
        <form className="mapp-glass mapp-fiado" onSubmit={(e) => { e.preventDefault(); if (fiadoName.trim()) plusOne(fiadoFor, fiadoName.trim()); }}>
          <p className="mapp-cota">¿A quién le fiaste {menu.find((x) => x.id === fiadoFor)?.one ?? 'eso'}?</p>
          {recent.length > 0 && (
            <div className="mapp-chips">
              {recent.map((n) => <button key={n} type="button" onClick={() => plusOne(fiadoFor, n)}>{n}</button>)}
            </div>
          )}
          <input value={fiadoName} onChange={(e) => setFiadoName(e.target.value.slice(0, 40))} placeholder="Ej.: Portero Ed. Alcalá" aria-label="Nombre de quien te debe" autoFocus />
          <span className="mapp-row-btns">
            <button type="submit" className="mapp-btn is-small" disabled={!fiadoName.trim()}>Anotar fiado</button>
            <button type="button" className="mapp-link" onClick={() => setFiadoFor(null)}>Cancelar</button>
          </span>
        </form>
      )}
      <p className="mapp-sync" role="status">
        {pending ? `${pending} sin subir: se suben solas cuando haya señal` : 'Todo guardado'}
        {last && <> · <button type="button" className="mapp-link" onClick={undo} disabled={busy === 'undo'}>Deshacer el último</button></>}
      </p>
    </>
  );
  // El camino del día (cada 5 tazas y la meta) y el reto de entregar apartados
  const trail = dayTrail(board.cups, goal);
  const reto = dayChallenge(day.holds);
  const toWaiting = () => document.getElementById('mapp-wait')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // En la calle: el termo que está sirviendo y la meta, arriba de todo
  const termos = termosOf(board.cups, termSet.termos, termSet.per);
  const left = Math.max(0, goal - board.cups);
  const step5 = Math.floor(board.cups / 5) * 5;
  const outCard = live && (
    <>
      <section className="mapp-sellhead" aria-label="Tu salida" data-testid="sellhead">
        <div className="mapp-sellhead-top">
          {/* La flecha vuelve a «¿Cómo sales hoy?» y lo saca del mapa; no cierra las ventas del día */}
          <button type="button" className="mapp-sellhead-back" onClick={() => out(false)} disabled={busy === 'out'} aria-label="Volver" title="Volver a «¿Cómo sales hoy?»" data-testid="sell-back"><IconBack /></button>
          <span className="mapp-now-live">En la calle{mode ? ` · ${modeOf(mode).label}` : ''}</span>
          <span className="mapp-sellhead-until">Hasta las {time(day.live_until)}</span>
        </div>
        <h1 className="mapp-sellhead-hello">{greeting()}, {first}.</h1>
        <TermoNow t={termos} />
        <div className="mapp-sellhead-copy">
          <p className="mapp-sellhead-n" aria-label={`${board.cups} de ${goal} tazas`}>{board.cups}<small>/{goal}</small></p>
          <p className="mapp-sellhead-sub">{board.cups === 1 ? 'taza' : 'tazas'} · {money(board.total)} hoy</p>
          <p className="mapp-sellhead-cota">{left > 0 ? `${left} más y cumples tu meta` : '¡Meta cumplida! Lo demás es ganancia'}</p>
        </div>
        <TermosRow cups={board.cups} setting={termSet} onSetting={setTermSet} />
        <dl className="mapp-sellhead-kpis">
          <div><dd><button type="button" className="mapp-sellhead-kpi" onClick={toWaiting} data-testid="kpi-wait" aria-label={`${sum.waitingCups} te esperan: ver quién`}>{sum.waitingCups} <span aria-hidden="true">↓</span></button></dd><dt>te esperan</dt></div>
          <div><dd>{money(sum.owed)}</dd><dt>te deben</dt></div>
          <div><dd><button type="button" className="mapp-sellhead-kpi is-pedido" onClick={() => setPedido(true)} data-testid="open-pedido" aria-label="Pedido de grupo: calcular cuánto cobrar">Pedido <span aria-hidden="true">↑</span></button></dd><dt>¿cuánto cobro?</dt></div>
        </dl>
        <div className="mapp-sellhead-time">
          <span className="mapp-sellhead-bar" role="progressbar" aria-valuenow={Math.round(prog.pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Tu salida"><i style={{ width: `${prog.pct * 100}%` }} /></span>
          <small>quedan {prog.leftLabel}</small>
        </div>
        {trail.marks.length > 0 && (
          <div className="mapp-trail" data-testid="day-trail">
            <span className="mapp-trail-line" role="img" aria-label={`Logros de hoy: ${trail.marks.filter((m) => m.done).length} de ${trail.marks.length}`}>
              <i style={{ width: `${trail.pct * 100}%` }} />
              {trail.marks.map((m) => <b key={m.at} className={m.done ? 'on' : ''} style={{ left: `${Math.min(100, (m.at / goal) * 100)}%` }}>{m.isGoal ? '★' : m.at}</b>)}
            </span>
            <p>{trail.next ? <>Te {trail.next.left === 1 ? 'falta' : 'faltan'} <b>{cupsLabel(trail.next.left)}</b> para {trail.next.isGoal ? 'tu meta' : `el logro de ${trail.next.at}`}</> : <b>Todos los logros de hoy. Lo demás es ganancia.</b>}</p>
          </div>
        )}
        {menu.length > 0 && <div className="mapp-sellhead-count">{counter}</div>}
        <p className={`mapp-dayreto ${reto.done ? 'is-done' : ''}`} data-testid="day-reto">
          <span aria-hidden="true">★</span>
          <span><b>{reto.done ? 'Reto de hoy cumplido' : 'Reto de hoy: entrega 3 apartados'}</b><small>{reto.done ? 'Tres clientes recibieron su café contigo.' : 'Solo cuentan los apartados que entregas.'}</small></span>
          <span className="mapp-dayreto-dots" role="img" aria-label={`${reto.served} de ${reto.target}`}>{Array.from({ length: reto.target }, (_, i) => <i key={i} className={i < reto.served ? 'on' : ''} />)}</span>
        </p>
        {trip.recording && (
          <p className="mapp-sellhead-cota mapp-trip" role="status" data-testid="trip-recording">
            📍 Grabando tu ruta · {km(trip.view.distance)} · {trip.view.stops === 1 ? '1 parada' : `${trip.view.stops} paradas`}{trip.gps === 'denied' ? ' · sin permiso de ubicación' : trip.gps === 'silent' ? ' · el GPS no responde' : ''}
          </p>
        )}
        <button type="button" className="mapp-sellhead-end" onClick={() => setEnding('ask')} disabled={busy === 'out'} data-testid="end-shift">Terminar turno</button>
      </section>
      {board.cups > 0 && (
        <p className="mapp-sellbar" data-testid="sellbar">
          <span aria-hidden="true">✨</span>
          <span><b>{step5 >= 5 ? `¡Llevas ${step5}!` : '¡Primera venta!'}</b> {streak.count > 1 ? 'tu racha sigue viva' : 'ganaste +1 día de racha'}</span>
          <small>🔥 {streak.count}</small>
        </p>
      )}
    </>
  );

  let body;
  // «Mi cuenta»: Mi plata y Mi perfil en una sola página (pedido del usuario, 12 nov 2026);
  // /micra/barista/perfil y /micra/barista/cuenta abren la misma
  if (tab === 'perfil' || tab === 'cuenta') {
    body = (
      <Suspense fallback={<Cargando fig="caminando" />}>
        <BaristaProfile
          admin={admin || !!asId} day={day} asId={asId} trip={trip} live={live} pending={pending} flush={flush} onReload={load} go={go}
          streak={streak} goal={goal} board={board}
          renderPrices={({ onSaved }) => <Prices day={day} asId={asId} onSaved={onSaved} />}
          extras={extras} menu={menu} onExtras={loadExtras}
          renderPlata={(who) => (
            <MiPlata day={day} board={board} sum={sum} menu={menu} bars={bars} onShare={() => setStory(true)} {...who}>
        <section className="mapp-glass" aria-labelledby="mapp-fiados">
          <p className="mapp-cota" id="mapp-fiados">Te deben · {money(sum.owed)}</p>
          {day.fiados.length === 0 && <p className="mapp-muted">Nadie te debe. Para anotar un fiado, toca «Fiado» en Vender.</p>}
          <ul className="mapp-holds">
            {day.fiados.map((f) => (
              <li key={f.name}>
                <div><b>{f.name}</b><span>{cupsLabel(f.cups)} · {money(f.total)}</span></div>
                <span className="mapp-hold-act">
                  <a className="mapp-link" href={`https://wa.me/?text=${encodeURIComponent(fiadoMessage(f, day.name))}`} target="_blank" rel="noopener noreferrer">Cobrar</a>
                  <button type="button" className="mapp-btn is-small" onClick={() => paid(f.name)} disabled={busy === `f-${f.name}`}>Pagó</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
            </MiPlata>
          )}
        />
        {!asId && <p className="mapp-fine"><a className="mapp-link" href={platform.siteUrl('/ruta')}>Medir mi recorrido (Mi ruta)</a></p>}
      </Suspense>
    );
  } else if (tab === 'reto') {
    body = <Suspense fallback={<Cargando fig="aeropress" />}><Competencia go={go} audience="barista" selfId={day.id} asId={asId} /></Suspense>;
  } else if (tab === 'qr') {
    body = <Suspense fallback={<Cargando fig="caminando" />}><QrPage url={platform.siteUrl(baristaPath(day.id))} name={first} mode={mode} go={go} /></Suspense>;
  } else if (tab === 'aprende') {
    body = <Suspense fallback={<Cargando fig="aeropress" />}><Aprende go={go} night={night} selfId={day.id} asId={asId} /></Suspense>;
  } else if (tab === 'hoy') {
    body = (
      <>
        <Suspense fallback={<Cargando fig="caminando" />}>
          <HoyFeed
            key={refreshKey}
            go={go} selfId={day.id} asId={asId} admin={admin || !!asId} mode={mode} trip={dayTrip}
            me={{ name: first, streak, goalMet: board.cups >= goal && goal > 0, lessonsDone: lessonPath(lessonsFor('es'), readSeen()).done, lessonsTotal: lessonsFor('es').length }}
            canShareDay={board.cups > 0} onShareDay={() => setStory(true)}
          />
        </Suspense>
      </>
    );
  } else {
    // Vender: su inicio. Salir, contar cada taza y ver quién lo espera, en una sola pantalla.
    // Arriba, la cabecera roja como la del cliente (apps de domicilios): su punto y «Mi QR», sin
    // buscador (pedido del usuario, 6 nov 2026); en la calle sigue sin corte en la taza
    const where = day.zone || day.localidad || null;
    const head = (
      <section className={`mapp-chead ${live ? 'is-joined' : ''}`} aria-label="Tu punto" data-testid="barista-head">
        <div className="mapp-chead-row">
          <span className="mapp-chead-loc is-static">
            <span className="mapp-chead-pin" aria-hidden="true"><IconPin /></span>
            <span className="mapp-chead-txt"><small>{live ? 'Vendiendo en' : 'Tu punto'}</small><b>{where ?? 'Sin punto todavía'}</b></span>
          </span>
          <button type="button" className="mapp-chead-near" onClick={() => go('/micra/barista/qr')} data-testid="head-qr">Mi QR</button>
        </div>
        {!live && board && (
          // La plata del día y la meta siempre a la vista, como en las apps de repartidores
          <p className="mapp-chead-day" data-testid="head-day"><b>{money(board.total)}</b> hoy · <b>{board.cups}/{goal}</b> tazas</p>
        )}
      </section>
    );
    body = (
      <>
        {head}
        {live ? outCard : (
          <>
            <Suspense fallback={null}>
              <LivePanel live={false} selfId={day.id} night={night} go={go}>
                <section className="mapp-hello">
                  <p className="mapp-kicker">{new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long' })}{day.localidad ? ` · ${day.localidad}` : ''}</p>
                  <h1 className="mapp-title is-small">{greeting()}, {first}.</h1>
                </section>
                <StreakRow streak={streak} />
              </LivePanel>
            </Suspense>
            {/* «Salí a vender» abajo, al alcance del pulgar (el termo va en la otra mano), con cómo
                sale justo encima: la opción B que eligió el usuario, 6 nov 2026 (DoorDash, Rappi) */}
            <section className="mapp-gosheet" aria-label="Salir a vender" data-testid="go-sheet">
              {/* Lo que motiva a salir va primero y en grande: quién ya apartó (10 nov 2026) */}
              {waiting.length > 0 && (
                <p className="mapp-gowait" data-testid="go-wait">
                  <b>{waiting.length === 1 ? '1 cliente ya te apartó' : `${waiting.length} clientes ya te apartaron`}</b>
                  <span>{cupsLabel(sum.waitingCups)} y {money(waitingTotal)} te esperan en tu punto</span>
                </p>
              )}
              <ModePicker mode={mode} onPick={(m) => { pickMode(m); setError(null); }} disabled={busy === 'out'} />
              <SlideToGo
                label={mode ? `Salí a vender · ${modeOf(mode).label.toLowerCase()}` : 'Salí a vender'}
                hint={mode ? `Desliza para salir · ${modeOf(mode).label.toLowerCase()}` : 'Desliza para salir'}
                busy={busy === 'out'} onGo={() => out(true)}
              />
              {untils.length > 1 && (
                <div className="mapp-until" role="group" aria-label="Hasta qué hora sales" data-testid="until">
                  <span>Hasta</span>
                  {untils.map((u) => <button key={u.id} type="button" className={untilId === u.id ? 'on' : ''} aria-pressed={untilId === u.id} onClick={() => setUntilId(u.id)}>{u.id === 'd' ? u.label : `las ${u.label}`}</button>)}
                </div>
              )}
              <p className="mapp-gosheet-meta">
                <span>{!streak.todayDone && streak.ifToday > 1 ? <>Vende hoy y tu racha llega a <b>{streak.ifToday} días</b></> : isPublic ? 'Sales del mapa sola a esa hora' : 'Te pedimos la ubicación al salir'}</span>
                <span>meta <b>{goal} tazas</b></span>
              </p>
            </section>
            {consent}
            {trip.pendingEnd && <p className="mapp-fine">Tu último recorrido no ha subido: se envía solo cuando haya señal.</p>}
          </>
        )}
        {errorBox}
        {/* En la calle, quién espera y el mapa en vivo van justo debajo de la cabecera: es lo urgente */}
        {live && menu.length > 0 && <Waiting {...waitingProps} />}
        {live && <Suspense fallback={null}><LivePanel live selfId={day.id} night={night} go={go} /></Suspense>}
        {menu.length === 0 ? <Prices day={day} asId={asId} onSaved={load} first /> : (
          <>
            {!live && <GoalCard board={board} goal={goal} onGoal={setGoal} week={day.week} />}
            {/* Antes de salir, debajo de la meta no va nada más: lo que manda es «Salí a vender»
                (pedido del usuario, 7 nov 2026). Las tazas, fiados y el café salen en la calle o
                cuando ya vendió hoy (volvió con la flecha: el día sigue); si no, solo quedan los
                clientes que ya apartaron y lo que falta por subir. */}
            {live || board.cups > 0 || pending > 0 ? (<>
            {!live && counter}
            <button type="button" className="mapp-coffeebar" onClick={() => setOrdering(true)} data-testid="coffee-bar">
              <span aria-hidden="true">☕</span><span><b>Tu café</b> · ¿se te está acabando?</span><u>Pedir</u>
            </button>
            {!asId && <WaNudge />}
            </>) : null}
            {!live && (board.cups > 0 || waiting.length > 0) && <Waiting {...waitingProps} />}
          </>
        )}
      </>
    );
  }

  return (
    <div className="mapp-barista has-tabs">
      {admin && (
        <p className="mapp-acting">
          Actuando como <b>{day.name}</b>
          <button type="button" className="mapp-link" onClick={() => onPickAs?.(null)}>Cambiar de barista</button>
        </p>
      )}
      {body}
      {notice && (
        <Globito
          {...notice} onClose={() => setNotice(null)}
          // Tocarlo lleva a Vender, a la lista de quién te espera
          onOpen={() => { setNotice(null); go('/micra/barista'); setTimeout(() => document.getElementById('mapp-wait')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); }}
        />
      )}
      {toast && <p className="mapp-toast" role="status" data-testid="toast"><span aria-hidden="true">✨</span>{toast}</p>}
      {party && (
        <Suspense fallback={null}>
          <Party {...storyData} onShare={() => { setParty(false); setStory(true); }} onClose={() => setParty(false)} />
        </Suspense>
      )}
      {moment && (
        <Suspense fallback={null}>
          <Moment
            moment={moment} fig={mode ? storyFigure(mode) : fig}
            onPrimary={() => setMoment(null)} onClose={() => setMoment(null)} closeLabel={null}
          />
        </Suspense>
      )}
      {story && (
        <Suspense fallback={null}>
          <DayStory {...storyData} onClose={() => setStory(false)} />
        </Suspense>
      )}
      {ordering && <CoffeeOrder day={day} onClose={() => setOrdering(false)} />}
      {shooting && (
        <Suspense fallback={null}>
          <PostComposer sale selfId={day.id} asId={asId} onClose={() => setShooting(false)} />
        </Suspense>
      )}
      {quick && (
        <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Anotar una venta" data-testid="quick-sale">
          <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={() => setQuick(false)} />
          <section className="mapp-sheet">
            <i className="mapp-sheet-handle" aria-hidden="true" />
            <p className="mapp-cota">Venta rápida</p>
            <h2 className="mapp-title is-small">¿Qué vendiste?</h2>
            {menu.length === 0 ? <p className="mapp-muted">Pon primero tus precios en Vender.</p> : (
              <div className="mapp-quick">
                {menu.map((m) => (
                  <button key={m.id} type="button" onClick={() => plusOne(m.id)} aria-label={`Vendí un ${m.one}`} data-testid={`quick-${m.id}`}>
                    <b>+1</b><span>{m.label}<small>{money(m.price)} · {counts[m.id] || 0} hoy</small></span>
                  </button>
                ))}
              </div>
            )}
            <p className="mapp-sync" role="status">{pending ? `${pending} sin subir: se suben solas cuando haya señal` : 'Todo guardado'}{last && <> · <button type="button" className="mapp-link" onClick={undo} disabled={busy === 'undo'}>Deshacer el último</button></>}</p>
            <p className="mapp-fine">La hoja se queda abierta para la siguiente taza.</p>
            <span className="mapp-row-btns">
              <button type="button" className="mapp-btn is-ghost is-small" onClick={() => { setQuick(false); setPedido(true); }} data-testid="quick-pedido">Pedido de grupo</button>
              <button type="button" className="mapp-btn is-ghost is-small" onClick={() => { setQuick(false); setShooting(true); }} data-testid="tab-camera"><IconCamera /> Foto de la venta</button>
              <button type="button" className="mapp-btn is-small" onClick={() => setQuick(false)}>Listo</button>
            </span>
          </section>
        </div>
      )}
      {ending === 'ask' && (
        <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Terminar turno" data-testid="end-ask">
          <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={() => setEnding(null)} />
          <section className="mapp-sheet mapp-endshift">
            <i className="mapp-sheet-handle" aria-hidden="true" />
            <p className="mapp-cota">Terminar turno</p>
            <h2 className="mapp-title is-small">¿Ya te vas de la calle?</h2>
            <dl className="mapp-endshift-kpis">
              <div><dt>Tazas</dt><dd>{board.cups}</dd></div>
              <div><dt>Hoy</dt><dd>{money(board.total)}</dd></div>
              <div><dt>Te deben</dt><dd>{money(sum.owed)}</dd></div>
            </dl>
            {shiftWarnings({ waiting: sum.waitingCups, pending }).map((w) => <p key={w} className="mapp-endshift-warn">{w}</p>)}
            <p className="mapp-fine">Sales del mapa y se cierra tu recorrido. Tus ventas de hoy no se borran.</p>
            <span className="mapp-row-btns">
              <button type="button" className="mapp-btn is-ghost is-small" onClick={() => setEnding(null)}>Seguir vendiendo</button>
              <button type="button" className="mapp-btn is-small" onClick={() => out(false, { end: true })} disabled={busy === 'out'} data-testid="end-confirm">{busy === 'out' ? 'Cerrando…' : 'Terminar turno'}</button>
            </span>
          </section>
        </div>
      )}
      {ending === 'done' && (() => {
        const c = shiftClose({ cups: board.cups, goal, streak: streak.count });
        return (
          <div className="mapp-sheetwrap" role="dialog" aria-modal="true" aria-label="Turno cerrado" data-testid="end-done">
            <button type="button" className="mapp-sheet-scrim" aria-label="Cerrar" onClick={() => setEnding(null)} />
            <section className="mapp-sheet mapp-endshift">
              <i className="mapp-sheet-handle" aria-hidden="true" />
              <p className="mapp-cota">Fin del turno · {time(new Date().toISOString())}</p>
              <h2 className="mapp-title is-small">{c.title}</h2>
              <p>{c.line}{c.racha ? ` ${c.racha}` : ''}</p>
              <dl className="mapp-endshift-kpis">
                <div><dt>Tazas</dt><dd>{board.cups}</dd></div>
                <div><dt>Vendiste</dt><dd>{money(board.total)}</dd></div>
                <div><dt>Te deben</dt><dd>{money(sum.owed)}</dd></div>
              </dl>
              {dayTrip.distance > 0 && <p className="mapp-fine">Caminaste {km(dayTrip.distance)} con {dayTrip.stops === 1 ? '1 parada' : `${dayTrip.stops} paradas`}.</p>}
              <span className="mapp-row-btns">
                {board.cups > 0 && <button type="button" className="mapp-btn is-ghost is-small" onClick={() => { setEnding(null); setStory(true); }} data-testid="end-share">Compartir mi día</button>}
                <button type="button" className="mapp-btn is-small" onClick={() => setEnding(null)}>Listo</button>
              </span>
            </section>
          </div>
        );
      })()}
      {pedido && (
        <Suspense fallback={null}>
          <Pedido menu={menu} termos={board ? termosOf(board.cups, termSet.termos, termSet.per) : null} onClose={() => setPedido(false)} />
        </Suspense>
      )}
      <BaristaTabs tab={tab === 'perfil' ? 'cuenta' : tab} go={go} waiting={waiting.length} onQuick={() => setQuick(true)} />
    </div>
  );
}
