import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PRODUCTS, menuOf, daySummary, weekBars, weekdayLetter, money, itemsLabel, cupsLabel, greeting, fiadoMessage,
  baristaPath, newRef, recentFiados, outProgress,
} from './micraApp.js';
import * as api from './api.js';
import platform from './platform.js';
import Figure from './Elenco.jsx';
import { IconThermo } from './icons.jsx';
import { Cargando } from './Animado.jsx';

// Modo barista: salí, quién me espera, +1 por taza, fiados y el día. Pensado
// para una mano, al sol y con mala señal: los +1 se guardan en el celular y
// suben cuando hay red (el mismo client_ref no cuenta dos veces).

const QUEUE_KEY = 'micra_sales_queue_v1';
const OUT_MINUTES = 240;

const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) ?? []; } catch { return []; } };
const writeQueue = (q) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* sin memoria: sube de una */ } };
const time = (iso) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });

export function BaristaJoin({ session, onLinked, team = false }) {
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

export function BaristaHome({ asId = null, onPickAs, admin = false, go }) {
  const [day, setDay] = useState(null);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState(() => readQueue().length);
  const [fiadoFor, setFiadoFor] = useState(null); // producto que espera el nombre del fiado
  const [fiadoName, setFiadoName] = useState('');
  const [last, setLast] = useState(null); // la última venta, para deshacer
  const [busy, setBusy] = useState(null);
  const [showPrices, setShowPrices] = useState(false);
  const [needsPick, setNeedsPick] = useState(false);
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
  useEffect(() => { setDay(null); load(); }, [load]);

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
  // Lo que todavía no subió también se ve contado
  const queued = readQueue().filter((s) => (s.asId ?? null) === asId);
  const counts = { ...sum.byProduct };
  for (const s of queued) counts[s.product] = (counts[s.product] || 0) + s.qty;
  const prog = outProgress(day.live_until, new Date(), OUT_MINUTES);
  const live = !!prog;
  const first = day.name.split(' ')[0];

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
  const out = async (on) => {
    setBusy('out');
    try {
      const pos = on ? await api.onePosition() : null;
      await api.goOut(on ? OUT_MINUTES : 0, pos, asId);
      await load();
    } catch (e) { setError(e.message); }
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

  return (
    <div className="mapp-barista">
      {admin && (
        <p className="mapp-acting">
          Actuando como <b>{day.name}</b>
          <button type="button" className="mapp-link" onClick={() => onPickAs?.(null)}>Cambiar de barista</button>
        </p>
      )}
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
            <div><dd>{money(sum.total)}</dd><dt>hoy llevas</dt></div>
            <div><dd>{money(sum.owed)}</dd><dt>te deben</dt></div>
          </dl>
          <button type="button" className="mapp-btn is-onred" onClick={() => out(false)} disabled={busy === 'out'}>Ya volví</button>
        </section>
      ) : (
        <section className="mapp-hello">
          <p className="mapp-kicker">Hoy</p>
          <h1 className="mapp-title is-small">{greeting()}, {first}.</h1>
          <button type="button" className="mapp-btn is-cta is-big" onClick={() => out(true)} disabled={busy === 'out' || !day.public}>
            {busy === 'out' ? 'Avisando…' : 'Salí a vender'}
          </button>
          {!day.public && <p className="mapp-fine">Aún no apareces para los clientes: el equipo te activa cuando aceptes salir en Micra.</p>}
          {day.public && <p className="mapp-fine">Tus clientes ven que saliste y te apartan. Se apaga solo en 4 horas.</p>}
        </section>
      )}

      {error && <p className="mapp-error" role="alert">{error} <button type="button" className="mapp-link" onClick={() => setError(null)}>Cerrar</button></p>}

      {menu.length === 0 ? <Prices day={day} asId={asId} onSaved={load} first /> : (
        <>
          <section className="mapp-glass" aria-labelledby="mapp-wait">
            <p className="mapp-cota" id="mapp-wait">Te esperan · {waiting.length ? `${sum.waitingCups} ${sum.waitingCups === 1 ? 'taza' : 'tazas'}` : 'nadie todavía'}</p>
            {waiting.length === 0 && (
              <p className="mapp-muted">Cuando un cliente te aparte, sale aquí. Comparte tu enlace para que te encuentren.</p>
            )}
            <ul className="mapp-holds">
              {waiting.map((h) => (
                <li key={h.id}>
                  <div><b>{h.name}</b><span>{itemsLabel(h.items)} · {money(h.total)}</span></div>
                  <span className="mapp-hold-act">
                    <button type="button" className="mapp-btn is-small" onClick={() => closeHold(h, true)} disabled={busy === h.id}>Entregado</button>
                    <button type="button" className="mapp-link" onClick={() => closeHold(h, false)} disabled={busy === h.id}>No vino</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mapp-count" aria-label="Contar ventas">
            {menu.map((m) => (
              <div key={m.id} className="mapp-tile">
                <span className="mapp-tile-name">{m.label} <small>{money(m.price)}</small></span>
                <span className="mapp-tile-n" data-testid={`micra-count-${m.id}`}>{counts[m.id] || 0}</span>
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

          <section className="mapp-glass mapp-today">
            <p className="mapp-cota">Hoy llevas · {cupsLabel(sum.cups)}</p>
            <Digits value={money(sum.total)} label="Vendido hoy" />
            {sum.fiado > 0 && <p className="mapp-muted">{money(sum.cash)} cobrado · {money(sum.fiado)} fiado</p>}
            <div className="mapp-week" aria-label="Tazas por día, esta semana">
              {bars.map((d) => (
                <span key={d.day} className={d.today ? 'is-today' : ''} title={`${d.cups} tazas`}>
                  <i style={{ height: `${Math.max(4, d.h * 100)}%` }} />
                  <small>{weekdayLetter(d.day)}</small>
                </span>
              ))}
            </div>
          </section>

          <section className="mapp-glass" aria-labelledby="mapp-fiados">
            <p className="mapp-cota" id="mapp-fiados">Te deben · {money(sum.owed)}</p>
            {day.fiados.length === 0 && <p className="mapp-muted">Nadie te debe. Para anotar un fiado, toca «Fiado» en el producto.</p>}
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
          <section className="mapp-glass">
            <p className="mapp-cota">Para tus redes</p>
            <p>Un video o una foto con los filtros de Micra: tu café, tu puesto, la app. Lo compartes donde quieras.</p>
            <button type="button" className="mapp-btn is-small" onClick={() => go('/micra/video')} data-testid="barista-video">🎥 Hacer un video con filtro</button>
          </section>
          {!asId && <a className="mapp-link" href={platform.siteUrl('/ruta')}>Medir mi recorrido (Mi ruta)</a>}
        </>
      )}
    </div>
  );
}
