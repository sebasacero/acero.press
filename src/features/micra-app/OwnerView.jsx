import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { money, cupsLabel, weekBars, weekdayLetter, baristaPath, isNight } from './micraApp.js';
import * as api from './api.js';
import platform from './platform.js';
import { Cargando } from './Animado.jsx';
import { formatCoPhone, normalizeCoPhone } from './phone.js';
import { teamSummary, findBaristas, missingStep, BARISTA_STEPS, CLIENT_RULES, LEVEL_LABEL } from './activation.js';

const LivePanel = lazy(() => import('./LiveMap.jsx'));
// Lo que los baristas mandaron para Hoy y espera revisión
const PostReview = lazy(() => import('./PostReview.jsx'));
// Los anuncios «Patrocinado»: cargarlos, pausarlos y sus cifras
const AdsPanel = lazy(() => import('./AdsPanel.jsx'));

// Modo equipo: el día de todos (tazas, plata, apartados, quién está en la
// calle) y la activación automática: nadie aprueba a mano (activation.js y
// 20261031120000_micra_auto_activation.sql). En vez de la lista de todas las
// fichas, el resumen: cuántos hay en cada paso, lo que pide una mano, los
// clientes en cifras y un buscador. Cada barista sigue con su celular, su
// código y «Actuar como».

export default function OwnerView({ onActAs, go }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [codes, setCodes] = useState({});
  // { id: '573001234567' }; null mientras carga o si falta la migración del SMS (no se muestra)
  const [phones, setPhones] = useState(null);
  const [editing, setEditing] = useState(null); // { id, value }
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const load = useCallback(() => {
    api.ownerDay().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.missing ? 'Falta activar las tablas de Micra en la base (migración 20261026210000_micra_app).' : e.message));
    api.baristaPhones().then((p) => setPhones(p ?? {})).catch(() => setPhones(null));
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const makeCode = async (b) => {
    try {
      const r = await api.invite(b.id);
      setCodes((c) => ({ ...c, [b.id]: r.code }));
    } catch (e) { setError(e.message); }
  };
  const savePhone = async (e) => {
    e.preventDefault();
    try {
      const r = await api.setBaristaPhone(editing.id, normalizeCoPhone(editing.value) ?? editing.value.trim());
      setPhones((p) => ({ ...p, [r.id]: r.phone }));
      setEditing(null);
      setError(null);
    } catch (err) { setError(err.message); }
  };
  const sendCode = (b, code) => {
    const url = platform.siteUrl(`/micra/barista?codigo=${code}`);
    platform.openExternal(`https://wa.me/?text=${encodeURIComponent(`Hola, ${b.name.split(' ')[0]}. Este es tu enlace para entrar a Micra: ${url} (tu código es ${code}, vence en 7 días).`)}`);
  };

  if (error && !data) return <p className="mapp-error" role="alert">{error}</p>;
  if (!data) return <Cargando fig="ruana">Cargando el día…</Cargando>;

  const list = data.baristas;
  const sum = teamSummary(list, { phones, clients: data.clients });
  const tot = list.reduce((a, b) => ({ cups: a.cups + b.cups, total: a.total + Number(b.total), waiting: a.waiting + b.waiting, served: a.served + b.served, live: a.live + (b.live_until ? 1 : 0) }), { cups: 0, total: 0, waiting: 0, served: 0, live: 0 });
  const bars = weekBars(data.week);
  const week = (data.week ?? []).reduce((a, d) => ({ cups: a.cups + (d.cups || 0), total: a.total + Number(d.total || 0), holds: a.holds + (d.holds || 0) }), { cups: 0, total: 0, holds: 0 });
  const found = findBaristas(sum.rows, { q: query, limit: showAll ? 500 : 8 });
  const searching = query.trim() !== '';
  const top = sum.funnel[0].n || 1;
  const c = data.clients;
  const row = (b) => (
    <BaristaRow key={b.id} b={b} phone={phones?.[b.id] ?? null} phonesOn={!!phones} code={codes[b.id] ?? b.invite_code}
      editing={editing} setEditing={setEditing} savePhone={savePhone} makeCode={makeCode} sendCode={sendCode} onActAs={onActAs} go={go} />
  );

  return (
    <div className="mapp-owner">
      <section className="mapp-hello">
        <p className="mapp-kicker">Equipo · hoy</p>
        <h1 className="mapp-title is-small">El día de Micra</h1>
      </section>
      {error && <p className="mapp-error" role="alert">{error}</p>}
      <section className="mapp-pricecard mapp-post" aria-label="Esta semana" data-testid="owner-week">
        <p className="mapp-cota">Esta semana · 7 días</p>
        <dl>
          <div><dd>{week.cups}</dd><dt>tazas</dt></div>
          <div><dd>{money(week.total)}</dd><dt>vendido</dt></div>
          <div><dd>{week.holds}</dd><dt>apartados</dt></div>
        </dl>
      </section>
      <dl className="mapp-kpis">
        <div><dt>Tazas</dt><dd data-testid="owner-cups">{tot.cups}</dd></div>
        <div><dt>Vendido</dt><dd>{money(tot.total)}</dd></div>
        <div><dt>Apartados</dt><dd>{tot.waiting + tot.served}<small> · {tot.served} entregados</small></dd></div>
        <div><dt>En la calle</dt><dd>{tot.live}<small> de {list.length}</small></dd></div>
      </dl>

      <Suspense fallback={null}><PostReview /></Suspense>
      <Suspense fallback={null}><AdsPanel /></Suspense>

      {/* Lo que pide una mano: lo demás se activa solo */}
      {sum.alerts.length > 0 && (
        <section className="mapp-glass mapp-alerts" aria-label="Para revisar" data-testid="owner-alerts">
          <p className="mapp-cota is-red">Para revisar</p>
          <ul>{sum.alerts.map((a) => <li key={a.key} className={`is-${a.tone}`}>{a.text}</li>)}</ul>
        </section>
      )}

      <section className="mapp-glass mapp-funnel" aria-label="Activación de baristas" data-testid="owner-activation">
        <p className="mapp-cota">Baristas · se activan solos</p>
        <p className="mapp-funnel-big"><b>{sum.active}</b> activos <span>de {sum.total} fichas</span></p>
        <ol>
          {sum.funnel.map((f) => (
            <li key={f.key}>
              <span>{f.label}</span>
              {/* Raíz: con 60 fichas y 2 activos la barra de los activos aún se ve */}
              <i style={{ width: `${Math.max(3, Math.sqrt(f.n / top) * 100)}%` }} />
              <b>{f.n}</b>
            </li>
          ))}
        </ol>
        <details className="mapp-rules">
          <summary>Reglas de activación</summary>
          <ol>{BARISTA_STEPS.map((st) => <li key={st.key}><b>{st.label}.</b> {st.rule}</li>)}</ol>
          <p className="mapp-cota">Clientes</p>
          <ul>{CLIENT_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        </details>
      </section>

      {c && (
        <section className="mapp-pricecard mapp-post" aria-label="Clientes" data-testid="owner-clients">
          <p className="mapp-cota">Clientes · 30 días</p>
          <dl>
            <div><dd>{c.total}</dd><dt>apartaron</dt></div>
            <div><dd>{c.new_7d}</dd><dt>nuevos (7 d)</dt></div>
            <div><dd>{c.active}</dd><dt>activos</dt></div>
            <div><dd>{c.frequent}</dd><dt>frecuentes</dt></div>
            <div><dd>{c.paused}</dd><dt>frenados</dt></div>
          </dl>
        </section>
      )}

      {/* Lo mismo que ve un barista en la calle: todos los que salieron y dónde quieren café */}
      <Suspense fallback={null}><LivePanel mode="team" night={isNight()} go={go} /></Suspense>

      <section className="mapp-glass">
        <p className="mapp-cota">Tazas por día · 7 días</p>
        <div className="mapp-week">
          {bars.map((d) => (
            <span key={d.day} className={d.today ? 'is-today' : ''} title={`${d.cups} tazas · ${d.holds} apartados`}>
              <i style={{ height: `${Math.max(4, d.h * 100)}%` }} />
              <small>{weekdayLetter(d.day)}</small>
            </span>
          ))}
        </div>
      </section>

      <section className="mapp-glass" data-testid="owner-find">
        <label className="mapp-cota" htmlFor="owner-q">Buscar un barista</label>
        <input id="owner-q" className="mapp-search" type="search" placeholder="Nombre, lugar o paso (activo…)" value={query}
          onChange={(e) => { setQuery(e.target.value); setShowAll(false); }} />
        {/* Sin lista por defecto: lo que se necesite se busca aquí (nombre, lugar o paso) */}
        {searching && (
          <>
            <p className="mapp-muted" role="status">
              {(() => { const n = found.items.length + found.more; return n === 0 ? 'Nadie con eso.' : `${n} ${n === 1 ? 'barista' : 'baristas'}`; })()}
            </p>
            <ul className="mapp-team" aria-label="Baristas encontrados">{found.items.map(row)}</ul>
            {found.more > 0 && <button type="button" className="mapp-link" onClick={() => setShowAll(true)}>Ver {found.more} más</button>}
          </>
        )}
      </section>
      <a className="mapp-link" href={platform.siteUrl('/admin')}>Abrir el panel completo</a>
    </div>
  );
}

function BaristaRow({ b, phone, phonesOn, code, editing, setEditing, savePhone, makeCode, sendCode, onActAs, go }) {
  const step = missingStep(b, phonesOn ? !!phone : b.has_phone);
  return (
    <li>
      <div className="mapp-team-head">
        <b>{b.name}</b>
        <span className={`mapp-badge is-${b.live_until ? 'live' : 'off'}`}>{b.live_until ? 'En la calle' : LEVEL_LABEL[b.level] ?? b.stage}</span>
      </div>
      <span className="mapp-muted">{b.referencia || b.localidad || 'Sin lugar'} · {cupsLabel(b.cups)} · {money(b.total)}{b.waiting ? ` · ${b.waiting} esperando` : ''}</span>
      {step && <span className="mapp-todo">{step}</span>}
      {phonesOn && (editing?.id === b.id ? (
        <form className="mapp-team-phone" onSubmit={savePhone}>
          <input type="tel" inputMode="tel" placeholder="300 123 4567" aria-label={`Celular de ${b.name}`} value={editing.value} onChange={(e) => setEditing({ id: b.id, value: formatCoPhone(e.target.value) })} autoFocus />
          <button type="submit" className="mapp-btn is-small" disabled={editing.value.trim() !== '' && !normalizeCoPhone(editing.value)}>Guardar</button>
          <button type="button" className="mapp-link" onClick={() => setEditing(null)}>Cancelar</button>
        </form>
      ) : (
        <span className="mapp-row-btns">
          {phone && <span className="mapp-muted">Cel. {formatCoPhone(phone)}</span>}
          <button type="button" className="mapp-link" onClick={() => setEditing({ id: b.id, value: phone ? formatCoPhone(phone) : '' })}>{phone ? 'Cambiar celular' : 'Poner su celular'}</button>
        </span>
      ))}
      <span className="mapp-row-btns">
        {!b.linked && (code
          ? <><code className="mapp-code-chip">{code}</code><button type="button" className="mapp-link" onClick={() => sendCode(b, code)}>Enviar por WhatsApp</button></>
          : <button type="button" className="mapp-link" onClick={() => makeCode(b)}>Generar código</button>)}
        <button type="button" className="mapp-link" onClick={() => onActAs(b.id)}>Actuar como</button>
        {b.public && <button type="button" className="mapp-link" onClick={() => go(baristaPath(b.id))}>Su página</button>}
      </span>
    </li>
  );
}
