import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  PRODUCTS, menuOf, daySummary, weekBars, weekdayLetter, money, itemsLabel, cupsLabel, greeting, fiadoMessage,
  baristaPath, newRef, recentFiados, outProgress, scoreboard, initials, bogota,
} from './micraApp.js';
import { streakOf, streakLabel, goalOf, milestone, stepText, lessonPath, figureFor, fillOf, GOAL_CHOICES } from './motivation.js';
import { lessonsFor } from '../school/lessons.js';
import { readSeen } from '../school/progress.js';
import * as api from './api.js';
import platform from './platform.js';
import Figure from './Elenco.jsx';
import { IconThermo, IconHome, IconCup, IconCap, IconWallet } from './icons.jsx';
import { Cargando } from './Animado.jsx';
import { useSaliTracking } from './useSaliTracking.js';
import { PaySettings } from './Loyalty.jsx';
import { km } from '../ruta/track.js';

// Modo barista en cuatro pestañas: Hoy (la racha, salir, la meta, quién te
// espera), Vender (+1 por taza y fiados), Aprende (las lecciones) y Mi plata.
// Pensado para una mano, al sol y con mala señal: los +1 se guardan en el
// celular y suben cuando hay red (el mismo client_ref no cuenta dos veces).

const MicraMap = lazy(() => import('./MicraMap.jsx'));
// Aprender, la fiesta de la meta y la tarjeta del día llegan solo al abrirlos
const Aprende = lazy(() => import('./Aprende.jsx'));
const Party = lazy(() => import('./Celebrate.jsx').then((m) => ({ default: m.Party })));
const DayStory = lazy(() => import('./Celebrate.jsx').then((m) => ({ default: m.DayStory })));

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

export function BaristaJoin({ session, onLinked, team = false, night = false, go }) {
  const fromUrl = new URLSearchParams(window.location.search).get('codigo') ?? '';
  const [code, setCode] = useState(fromUrl.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (team && session) {
    return (
      <div className="mapp-empty">
        <b>Esta parte es del equipo de Micra.</b>
        <p>Tu cuenta no está en el equipo.</p>
      </div>
    );
  }
  if (!session) {
    return (
      <section className="mapp-join-page">
        <Figure name="sombrilla" className="is-join" />
        <p className="mapp-kicker">Para baristas</p>
        <h1 className="mapp-title">Vende más en <span className="mapp-script">tu misma ruta.</span></h1>
        <ul className="mapp-perks">
          <li><b>Te apartan antes de que llegues.</b> Tus clientes ven a qué hora pasas y te dicen «guárdame dos».</li>
          <li><b>Cuentas con un dedo.</b> +1 por taza, y al final del día sabes cuánto hiciste.</li>
          <li><b>Tus fiados en orden.</b> Quién te debe y cuánto, y se lo cobras por WhatsApp.</li>
        </ul>
        <button type="button" className="mapp-btn is-cta" onClick={() => api.signIn('/micra/barista')}>Entrar con Google</button>
        <p className="mapp-fine">Necesitas el código de seis letras que te da el equipo de Micra. ¿No lo tienes? Escríbenos por WhatsApp desde aceropress.com.</p>
      </section>
    );
  }
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await api.claim(code); onLinked(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <form className="mapp-join-page" onSubmit={submit}>
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
      <button type="button" className="mapp-link" onClick={api.signOut}>Entrar con otra cuenta</button>
    </form>
  );
}

function Picker({ onPick }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.ownerDay().then((d) => setList(d?.baristas ?? [])).catch(() => setList([])); }, []);
  return (
    <section className="mapp-glass">
      <p className="mapp-cota">Modo barista · equipo</p>
      <h1 className="mapp-title is-small">¿Como quién entras?</h1>
      <p className="mapp-muted">Lo que hagas aquí queda en la libreta de ese barista. Para probar, usa una ficha de prueba.</p>
      {list === null && <Cargando />}
      <ul className="mapp-list">
        {(list ?? []).map((b) => (
          <li key={b.id}>
            <button type="button" className="mapp-row" onClick={() => onPick(b.id)}>
              <span className="mapp-row-main"><b>{b.name}</b><span>{b.referencia || b.localidad || '—'} · {b.stage}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
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

/** El permiso de ubicación de «Salí a vender», con lo que se informa (Ley 1581). */
function LocationConsent({ onAccept, onSkip, busy }) {
  return (
    <section className="mapp-glass mapp-consent" role="dialog" aria-label="Permiso de ubicación" data-testid="location-consent">
      <p className="mapp-cota">Tu ubicación</p>
      <p>Mientras tengas activo <b>Salí a vender</b>, Micra usa tu ubicación para que tus clientes te encuentren en el mapa y para mejorar la app. Al tocar «Ya volví» deja de usarla.</p>
      <label className="mapp-check">
        <input type="checkbox" id="mapp-consent-box" />
        <span>Permito que Micra use mi ubicación mientras estoy vendiendo, para que mis clientes me encuentren y para mejorar la app.</span>
      </label>
      <p className="mapp-fine">Puedes retirar este permiso cuando quieras. <a className="mapp-link" href={platform.siteUrl('/privacidad#ubicacion')} target="_blank" rel="noreferrer">Cómo usamos tu ubicación</a></p>
      <span className="mapp-row-btns">
        <button type="button" className="mapp-btn is-cta" disabled={busy} onClick={() => { if (document.getElementById('mapp-consent-box')?.checked) onAccept(); else document.getElementById('mapp-consent-box')?.focus(); }} data-testid="consent-accept">{busy ? 'Guardando…' : 'Aceptar y salir'}</button>
        <button type="button" className="mapp-link" onClick={onSkip}>Salir sin compartir mi recorrido</button>
      </span>
    </section>
  );
}

/** La taza de la meta: se llena a medida que vende (pct 0–1). */
function GoalCup({ pct }) {
  const top = 22 + (1 - pct) * 78; // el nivel del café: de 100 (vacía) a 22 (llena)
  return (
    <svg className="mapp-goalcup" viewBox="0 0 110 118" aria-hidden="true">
      <defs><clipPath id="mapp-cup-in"><path d="M10 22h72v44a34 34 0 0 1-34 34h-4a34 34 0 0 1-34-34z" /></clipPath></defs>
      <g clipPath="url(#mapp-cup-in)">
        <rect x="0" y="0" width="100" height="120" className="is-empty" />
        <path className="is-coffee" d={`M0 ${top} q12 -6 24 0 t24 0 t24 0 t24 0 V120 H0z`} />
      </g>
      <path d="M10 22h72v44a34 34 0 0 1-34 34h-4a34 34 0 0 1-34-34z" className="is-line" />
      <path d="M82 34h8a14 14 0 0 1 0 28h-8" className="is-line" />
      <path d="M34 4c-4 6 4 8 0 14M50 2c-4 6 4 8 0 14" className="is-steam" />
      <path d="M2 108h96" className="is-line" />
    </svg>
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

/** Lo primero del día sin haber salido: la racha, el personaje en su andén. */
function StreakCard({ streak, fig }) {
  return (
    <section className="mapp-streak" aria-label="Tu racha" data-testid="streak">
      <div className="mapp-streak-copy">
        <p className="mapp-cota is-red">Tu racha</p>
        <p className="mapp-streak-n">{streak.count > 0 ? streakLabel(streak) : '¡A empezar!'}</p>
        <p className="mapp-streak-sub">
          {streak.todayDone ? 'saliendo a vender seguidos. ¡Hoy ya cuenta!'
            : streak.count > 0 ? <>saliendo a vender seguidos. Hoy cumples <b>{streak.ifToday}</b>.</>
              : 'Vende hoy y empieza tu racha de días seguidos.'}
        </p>
        <WeekCups streak={streak} />
      </div>
      <Figure name={fig} className="is-streak" />
      <i className="mapp-anden" aria-hidden="true" />
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
          <b>{board.cups >= goal ? `¡${goal} tazas, cumplida!` : `${goal} tazas`}</b>
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
function Waiting({ waiting, sum, rewards, busy, onClose, onRedeem, compact = false }) {
  return (
    <section className={`mapp-glass ${compact ? 'is-compact' : ''}`} aria-labelledby="mapp-wait">
      <p className="mapp-cota" id="mapp-wait">{compact ? 'Te esperan' : 'Solicitudes cerca · Te esperan'} · {waiting.length ? `${sum.waitingCups} ${sum.waitingCups === 1 ? 'taza' : 'tazas'}` : 'nadie todavía'}</p>
      {waiting.length === 0 && !compact && (
        <p className="mapp-muted">Cuando un cliente te aparte, sale aquí. Comparte tu enlace para que te encuentren.</p>
      )}
      <ul className="mapp-holds">
        {waiting.map((h) => (
          <li key={h.id}>
            <span className="mapp-av" aria-hidden="true">{initials(h.name)}</span>
            <div>
              <b>{h.name}</b><span>{itemsLabel(h.items)} · {money(h.total)}</span>
              {rewards[h.id] > 0 && <span className="mapp-reward">🎁 Tiene un tinto gratis <button type="button" className="mapp-link" onClick={() => onRedeem(h)} disabled={busy === `r-${h.id}`}>Canjear</button></span>}
              {rewards[`done-${h.id}`] && <span className="mapp-reward">✓ Tinto gratis canjeado</span>}
            </div>
            <span className="mapp-hold-act">
              <button type="button" className="mapp-btn is-small" onClick={() => onClose(h, true)} disabled={busy === h.id}>Entregado</button>
              <button type="button" className="mapp-link" onClick={() => onClose(h, false)} disabled={busy === h.id}>No vino</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** La siguiente lección, para que aprender quede a un toque. */
function NextLesson({ go }) {
  const lessons = lessonsFor('es');
  const path = lessonPath(lessons, readSeen());
  if (path.ready) {
    return (
      <button type="button" className="mapp-glass mapp-nextlesson" onClick={() => go('/micra/barista/aprende')}>
        <span className="mapp-nextlesson-ico" aria-hidden="true">🏅</span>
        <span><b>Viste las {path.total} lecciones</b><small>Graba tu video para subir a Barista de calle</small></span>
        <i aria-hidden="true">›</i>
      </button>
    );
  }
  const l = lessons[path.nextIdx];
  return (
    <button type="button" className="mapp-glass mapp-nextlesson" onClick={() => go('/micra/barista/aprende')} data-testid="next-lesson">
      <span className="mapp-nextlesson-ico" aria-hidden="true"><IconCap /></span>
      <span><b>Lección {path.nextIdx + 1} · {l.title}</b><small>{l.mins} min · {path.done} de {path.total} vistas</small></span>
      <i aria-hidden="true">›</i>
    </button>
  );
}

const TABS = [
  ['hoy', 'Hoy', IconHome, '/micra/barista'],
  ['vender', 'Vender', IconCup, '/micra/barista/vender'],
  ['aprende', 'Aprende', IconCap, '/micra/barista/aprende'],
  ['cuenta', 'Mi plata', IconWallet, '/micra/barista/cuenta'],
];

function BaristaTabs({ tab, go, waiting }) {
  return (
    <nav className="mapp-tabs is-four" aria-label="Barista">
      {TABS.map(([id, label, Icon, path]) => (
        <button key={id} type="button" className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => go(path)}>
          <Icon />{label}
          {id === 'vender' && waiting > 0 && <span className="mapp-tabs-badge" aria-label={`${waiting} te esperan`}>{waiting}</span>}
        </button>
      ))}
    </nav>
  );
}

const GOAL_KEY = 'micra_goal_v1';
const PARTY_KEY = 'micra_party_v1';
const readGoal = (id) => { try { return JSON.parse(localStorage.getItem(GOAL_KEY))?.[id] ?? null; } catch { return null; } };
const writeGoal = (id, n) => { try { localStorage.setItem(GOAL_KEY, JSON.stringify({ ...(JSON.parse(localStorage.getItem(GOAL_KEY)) ?? {}), [id]: n })); } catch { /* sin memoria: vale por hoy */ } };
// La fiesta de la meta sale una vez al día por barista
const partied = (key) => { try { return localStorage.getItem(PARTY_KEY) === key; } catch { return false; } };
const markParty = (key) => { try { localStorage.setItem(PARTY_KEY, key); } catch { /* sin memoria */ } };

export function BaristaHome({ asId = null, onPickAs, admin = false, go, night = false, tab = 'hoy' }) {
  const [day, setDay] = useState(null);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  // El recorrido de «Salí a vender»: solo en su propia cuenta (el equipo «actuando como» no graba)
  const trip = useSaliTracking({ enabled: !asId });
  const [asking, setAsking] = useState(false);
  const [rewards, setRewards] = useState({}); // { holdId: tintos gratis por canjear }
  const [showPay, setShowPay] = useState(false);
  // Quién de los que esperan tiene un tinto gratis (arriba de los returns: los hooks van siempre en el mismo orden)
  useEffect(() => {
    if (!day) return;
    api.holdRewards(asId).then((r) => setRewards(r ?? {})).catch(() => setRewards({}));
  }, [day, asId]);
  const [pending, setPending] = useState(() => readQueue().length);
  const [fiadoFor, setFiadoFor] = useState(null); // producto que espera el nombre del fiado
  const [fiadoName, setFiadoName] = useState('');
  const [last, setLast] = useState(null); // la última venta, para deshacer
  const [busy, setBusy] = useState(null);
  const [showPrices, setShowPrices] = useState(false);
  const [needsPick, setNeedsPick] = useState(false);
  const [goalPick, setGoalPick] = useState(null); // la meta que escogió en esta sesión
  const [toast, setToast] = useState(null);
  const [party, setParty] = useState(false);
  const [story, setStory] = useState(false);
  const prevCups = useRef(null);
  const flushing = useRef(false);

  const load = useCallback(async () => {
    try {
      setDay(await api.baristaDay(asId));
      setError(null);
      setNeedsPick(false);
    } catch (e) {
      if (e.missing) setMissing(true);
      else if (admin && !asId) setNeedsPick(true);
      else setError(e.message);
    }
  }, [asId, admin]);
  useEffect(() => { setDay(null); prevCups.current = null; load(); }, [load]);

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
  const board = day ? scoreboard(day, queued, day.prices ?? {}) : null;
  const goal = day ? goalOf(day.week, goalPick ?? readGoal(day.id)) : 0;
  const partyKey = day ? `${day.id}:${bogota().day}` : '';
  useEffect(() => {
    if (!board) return;
    const prev = prevCups.current;
    prevCups.current = board.cups;
    if (prev == null) return;
    const m = milestone(prev, board.cups, goal);
    if (m?.kind === 'goal' && !partied(partyKey)) { markParty(partyKey); setParty(true); }
    else if (m?.kind === 'step' || m?.kind === 'goal') setToast(m.kind === 'goal' ? `¡Meta de ${goal} cumplida!` : stepText(m));
  }, [board?.cups, goal, partyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  if (needsPick) return <Picker onPick={onPickAs} />;
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

  const menu = menuOf(day);
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
  const out = async (on, { share = true } = {}) => {
    // La primera vez, el permiso de ubicación antes de salir
    if (on && trip.ready && !trip.consented && !asking) { setAsking(true); return; }
    setAsking(false);
    setBusy('out');
    try {
      const pos = on ? await api.onePosition() : null;
      await api.goOut(on ? OUT_MINUTES : 0, pos, asId);
      if (on && share && trip.ready && !trip.recording) await trip.start();
      if (!on && (trip.recording || trip.pendingEnd)) await trip.finish();
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const acceptLocation = async () => {
    setBusy('out');
    try { await trip.consent(true); } catch (e) { setError(e.message); setBusy(null); return; }
    setBusy(null);
    setAsking(false);
    await out(true);
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
  const shareLink = () => {
    const url = platform.siteUrl(baristaPath(day.id));
    const text = `Apártame tus tintos en Micra y te los tengo listos cuando pase:`;
    platform.share({ title: `${first} en Micra`, text, url });
  };
  const waiting = day.holds.filter((h) => h.status === 'waiting');
  const bars = weekBars(day.week);
  const recent = recentFiados(day);
  const waitingProps = { waiting, sum, rewards, busy, onClose: closeHold, onRedeem: redeem };
  const consent = asking && <LocationConsent busy={busy === 'out'} onAccept={acceptLocation} onSkip={() => out(true, { share: false })} />;
  const errorBox = error && <p className="mapp-error" role="alert">{error} <button type="button" className="mapp-link" onClick={() => setError(null)}>Cerrar</button></p>;
  const storyData = { name: first, cups: board.cups, total: board.total, streak: streak.count, goal, fig, km: trip.view?.distance ?? 0, url: platform.siteUrl(baristaPath(day.id)) };

  let body;
  if (tab === 'aprende') {
    body = <Suspense fallback={<Cargando fig="aeropress" />}><Aprende go={go} night={night} /></Suspense>;
  } else if (tab === 'vender') {
    body = menu.length === 0 ? <Prices day={day} asId={asId} onSaved={load} first /> : (
      <>
        <section className={`mapp-sellhead ${live ? 'is-live' : ''}`} aria-label="Tus tazas de hoy" data-testid="sell-head">
          <GoalCup pct={fillOf(board.cups, goal)} />
          <div>
            <p className="mapp-sellhead-n"><b data-testid="sell-cups">{board.cups}</b><small>/{goal}</small></p>
            <p className="mapp-sellhead-sub">{cupsLabel(board.cups).replace(/^\d+ /, '')} · {money(board.total)} hoy</p>
            <p className="mapp-sellhead-cota">{board.cups < goal ? `${goal - board.cups} más y cumples tu meta` : '¡Meta cumplida!'}</p>
          </div>
          {!live && <button type="button" className="mapp-btn is-small is-onred" onClick={() => out(true)} disabled={busy === 'out' || !day.public}>{busy === 'out' ? 'Avisando…' : 'Avisar que salí'}</button>}
        </section>
        {consent}
        {errorBox}
        <section className="mapp-count" aria-label="Contar ventas">
          {menu.map((m) => (
            <div key={m.id} className="mapp-tile">
              <span className="mapp-tile-name">{m.label} <small>{money(m.price)}</small></span>
              <span className="mapp-tile-n"><b data-testid={`micra-count-${m.id}`}>{counts[m.id] || 0}</b> hoy</span>
              <button type="button" className="mapp-plus" onClick={() => plusOne(m.id)} aria-label={`Vendí un ${m.one}`}>+1</button>
              <button type="button" className="mapp-tile-fiado" onClick={() => setFiadoFor(m.id)} aria-label={`Fié un ${m.one}`}>Fiado</button>
            </div>
          ))}
        </section>
        {fiadoFor && (
          <form className="mapp-glass mapp-fiado" onSubmit={(e) => { e.preventDefault(); if (fiadoName.trim()) plusOne(fiadoFor, fiadoName.trim()); }}>
            <p className="mapp-cota">¿A quién le fiaste el {PRODUCTS.find((p) => p.id === fiadoFor).one}?</p>
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
        {waiting.length > 0 && <Waiting {...waitingProps} compact />}
      </>
    );
  } else if (tab === 'cuenta') {
    body = (
      <>
        <section className="mapp-glass mapp-today">
          <p className="mapp-cota">Hoy llevas · {cupsLabel(board.cups)}</p>
          <Digits value={money(board.total)} label="Vendido hoy" />
          {sum.fiado > 0 && <p className="mapp-muted">{money(sum.cash)} cobrado · {money(sum.fiado)} fiado</p>}
          <p className="mapp-muted">Esta semana: {money(board.weekMoney)} · {cupsLabel(board.weekCups)}</p>
          <div className="mapp-week" aria-label="Tazas por día, esta semana">
            {bars.map((d) => (
              <span key={d.day} className={d.today ? 'is-today' : ''} title={`${d.cups} tazas`}>
                <i style={{ height: `${Math.max(4, d.h * 100)}%` }} />
                <small>{weekdayLetter(d.day)}</small>
              </span>
            ))}
          </div>
          <button type="button" className="mapp-btn is-cta" onClick={() => setStory(true)} disabled={board.cups === 0} data-testid="story-open">Compartir mi día</button>
        </section>

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

        <section className="mapp-glass mapp-share">
          <p className="mapp-cota">Tu enlace</p>
          <p>Mándalo a tus clientes fijos o pégalo en tu termo: con él te apartan.</p>
          <code>{platform.siteUrl(baristaPath(day.id)).replace(/^https?:\/\//, '')}</code>
          <span className="mapp-row-btns">
            <button type="button" className="mapp-btn is-small" onClick={shareLink}>Compartir</button>
            <button type="button" className="mapp-link" onClick={() => go(baristaPath(day.id))}>Ver como cliente</button>
          </span>
        </section>

        {showPrices
          ? <Prices day={day} asId={asId} onSaved={() => { setShowPrices(false); load(); }} />
          : <button type="button" className="mapp-link" onClick={() => setShowPrices(true)}>Cambiar mis precios</button>}
        {showPay
          ? <PaySettings day={day} asId={asId} onSaved={() => setShowPay(false)} />
          : <button type="button" className="mapp-link" onClick={() => setShowPay(true)} data-testid="pay-open">Cómo te pagan (Nequi, Daviplata)</button>}
        <section className="mapp-glass">
          <p className="mapp-cota">Para tus redes</p>
          <p>Un video o una foto con los filtros de Micra: tu café, tu puesto, la app. Lo compartes donde quieras.</p>
          <button type="button" className="mapp-btn is-small" onClick={() => go('/micra/video')} data-testid="barista-video">🎥 Hacer un video con filtro</button>
        </section>
        {!asId && <a className="mapp-link" href={platform.siteUrl('/ruta')}>Medir mi recorrido (Mi ruta)</a>}
      </>
    );
  } else {
    body = (
      <>
        {live ? (
          <section className="mapp-now is-out" aria-label="Tu salida">
            <p className="mapp-now-kicker">Saliste a las {time(prog.start)}<span className="mapp-now-live">En la calle</span></p>
            <h1 className="mapp-now-hello">{greeting()}, {first}.</h1>
            <p className="mapp-now-title">Hasta las {time(day.live_until)}</p>
            <div className="mapp-outbar" role="progressbar" aria-valuenow={Math.round(prog.pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Tu salida">
              <i style={{ width: `${prog.pct * 100}%` }} /><em style={{ left: `${prog.pct * 100}%` }}><IconThermo /></em>
            </div>
            <p className="mapp-now-sub">quedan {prog.leftLabel}</p>
            <dl className="mapp-now-kpis">
              <div><dd>{sum.waitingCups}</dd><dt>te esperan</dt></div>
              <div><dd>{money(board.total)}</dd><dt>hoy llevas</dt></div>
              <div><dd>{money(sum.owed)}</dd><dt>te deben</dt></div>
            </dl>
            {trip.recording && (
              <p className="mapp-now-sub mapp-trip" role="status" data-testid="trip-recording">
                📍 Grabando tu recorrido · {km(trip.view.distance)}{trip.gps === 'denied' ? ' · sin permiso de ubicación' : trip.gps === 'silent' ? ' · el GPS no responde' : ''}
              </p>
            )}
            <span className="mapp-now-btns">
              <button type="button" className="mapp-btn is-onwhite" onClick={() => go('/micra/barista/vender')}>Vender · +1</button>
              <button type="button" className="mapp-btn is-onred" onClick={() => out(false)} disabled={busy === 'out'}>Ya volví</button>
            </span>
          </section>
        ) : (
          <>
            <section className="mapp-hello">
              <p className="mapp-kicker">{new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long' })}{day.localidad ? ` · ${day.localidad}` : ''}</p>
              <h1 className="mapp-title is-small">{greeting()}, {first}.</h1>
            </section>
            <StreakCard streak={streak} fig={fig} />
            <button type="button" className="mapp-btn is-cta is-big is-go" onClick={() => out(true)} disabled={busy === 'out' || !day.public}>
              {busy === 'out' ? 'Avisando…' : 'Salí a vender'}
            </button>
            {consent}
            {trip.pendingEnd && <p className="mapp-fine">Tu último recorrido no ha subido: se envía solo cuando haya señal.</p>}
            {!day.public && <p className="mapp-fine">Aún no apareces para los clientes: el equipo te activa cuando aceptes salir en Micra.</p>}
            {day.public && <p className="mapp-fine is-center">{waiting.length ? <><b>{waiting.length === 1 ? '1 cliente' : `${waiting.length} clientes`}</b> ya te apartaron para hoy.</> : 'Tus clientes ven que saliste y te apartan. Se apaga solo en 4 horas.'}</p>}
          </>
        )}
        {errorBox}
        {menu.length === 0 ? <Prices day={day} asId={asId} onSaved={load} first /> : (
          <>
            <GoalCard board={board} goal={goal} onGoal={setGoal} week={day.week} />
            <Waiting {...waitingProps} />
          </>
        )}
        <NearMap selfId={day.id} night={night} go={go} />
        <NextLesson go={go} />
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
      {toast && <p className="mapp-toast" role="status" data-testid="toast"><span aria-hidden="true">✨</span>{toast}</p>}
      {party && (
        <Suspense fallback={null}>
          <Party {...storyData} onShare={() => { setParty(false); setStory(true); }} onClose={() => setParty(false)} />
        </Suspense>
      )}
      {story && (
        <Suspense fallback={null}>
          <DayStory {...storyData} onClose={() => setStory(false)} />
        </Suspense>
      )}
      <BaristaTabs tab={tab} go={go} waiting={waiting.length} />
    </div>
  );
}
