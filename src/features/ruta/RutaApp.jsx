import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { useTracker } from './useTracker.js';
import { elapsed, km } from './track.js';
import './ruta.css';

// Micra · Mi ruta (/ruta): la app del tintero. Entra con su cuenta de Google,
// la enlaza con el código que le da el equipo, acepta compartir su ubicación
// y, cada mañana, toca «Empezar recorrido» y «Terminar». Ve su recorrido y
// sus paradas; nadie más que él y el equipo de Micra los ve.
//
// Se instala como app desde el navegador («Agregar a pantalla de inicio»):
// el manifiesto (public/ruta.webmanifest) la abre a pantalla completa.

const CODE_KEY = 'micra_ruta_codigo';
const GPS_TEXT = {
  waiting: 'Buscando señal del GPS…',
  ok: 'GPS con señal',
  silent: 'El GPS no responde. ¿Se apagó la pantalla? Déjala encendida mientras caminas.',
  denied: 'El celular no le dio permiso de ubicación a esta página. Actívalo en Ajustes › Ubicación y toca «Reintentar».',
  unavailable: 'No hay señal de ubicación. Sal a cielo abierto y toca «Reintentar».',
  unsupported: 'Este navegador no da ubicación. Abre la página en Chrome.',
};
const hour = (iso) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
const day = (iso) => new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'short' });
const paradas = (n) => `${n} ${n === 1 ? 'parada' : 'paradas'}`;
const minutes = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));

function useManifest() {
  useEffect(() => {
    // index.html ya trae el manifiesto del sitio y el navegador usa el primero: se cambia ese, no se agrega otro
    const existing = document.querySelector('link[rel="manifest"]');
    const link = existing ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'manifest' }));
    const prevHref = existing?.getAttribute('href');
    link.href = '/ruta.webmanifest';
    const prevTitle = document.title;
    document.title = 'Micra · Mi ruta';
    return () => {
      if (existing) existing.setAttribute('href', prevHref);
      else link.remove();
      document.title = prevTitle;
    };
  }, []);
}

/** El código de la invitación: de ?codigo= (el enlace que manda el equipo) o el que quedó guardado. */
const cleanCode = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function readCode() {
  const fromUrl = cleanCode(new URLSearchParams(window.location.search).get('codigo'));
  try {
    if (fromUrl) localStorage.setItem(CODE_KEY, fromUrl);
    return fromUrl || localStorage.getItem(CODE_KEY) || '';
  } catch {
    return fromUrl || '';
  }
}

function Shell({ children, step }) {
  return (
    <div className="ruta">
      <header className="ruta-head">
        <span className="ruta-brand">MICRA</span>
        <span className="ruta-cota">{step}</span>
      </header>
      <main className="ruta-body">{children}</main>
    </div>
  );
}

function SignIn() {
  const go = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/ruta' + window.location.search },
  });
  return (
    <Shell step="1 DE 3 · ENTRAR">
      <h1 className="ruta-title">Tu ruta,<br />en números.</h1>
      <p className="ruta-lede">Micra guarda por dónde caminas y dónde te detienes, para que sepas qué esquinas te rinden más. Tu ruta es tuya: no se le muestra a otro vendedor.</p>
      <button type="button" className="ruta-btn" onClick={go}>Entrar con Google</button>
    </Shell>
  );
}

function Claim({ onDone }) {
  const [code, setCode] = useState(readCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('tintero_claim', { p_code: code });
    setBusy(false);
    if (err) { setError(err.message); return; }
    try { localStorage.removeItem(CODE_KEY); } catch { /* nada que limpiar */ }
    onDone(data);
  };
  return (
    <Shell step="2 DE 3 · TU CÓDIGO">
      <h1 className="ruta-title">Escribe tu código.</h1>
      <p className="ruta-lede">Son seis letras y números que te dio el equipo de Micra. Sirven una sola vez y vencen en 7 días.</p>
      <form onSubmit={submit} className="ruta-form">
        <label htmlFor="ruta-code">Código</label>
        <input
          id="ruta-code"
          className="ruta-code"
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          inputMode="text"
          placeholder="ABC234"
        />
        {error && <p className="ruta-error" role="alert">{error}</p>}
        <button type="submit" className="ruta-btn" disabled={busy || code.length !== 6}>{busy ? 'Revisando…' : 'Enlazar mi cuenta'}</button>
      </form>
      <button type="button" className="ruta-link" onClick={() => supabase.auth.signOut()}>Entrar con otra cuenta</button>
    </Shell>
  );
}

function Consent({ me, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const accept = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('tintero_consent', { p_accept: true });
    setBusy(false);
    if (err) { setError(err.message); return; }
    onDone(data);
  };
  return (
    <Shell step="3 DE 3 · TU PERMISO">
      <h1 className="ruta-title">Hola, {me.name.split(' ')[0]}.</h1>
      <p className="ruta-lede">Antes de empezar, esto es lo que Micra guarda y para qué:</p>
      <ul className="ruta-terms">
        <li><b>Qué:</b> la ubicación de tu celular, solo entre «Empezar recorrido» y «Terminar». Fuera de eso, nada.</li>
        <li><b>Para qué:</b> mostrarte tu recorrido, tus paradas y cuánto caminas, y estudiar con el equipo de Micra cómo vender más en la misma ruta.</li>
        <li><b>Quién lo ve:</b> tú y el equipo de Micra. Nunca otro vendedor. Si se publica algo, son cifras de muchas rutas juntas, sin tu nombre.</li>
        <li><b>Tus derechos:</b> puedes dejar de compartir cuando quieras y borrar cualquier recorrido desde esta app (Ley 1581 de 2012).</li>
      </ul>
      {error && <p className="ruta-error" role="alert">{error}</p>}
      <button type="button" className="ruta-btn" onClick={accept} disabled={busy}>{busy ? 'Guardando…' : 'Acepto compartir mi ubicación'}</button>
    </Shell>
  );
}

function Routes({ refreshKey }) {
  const [rows, setRows] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const load = useCallback(() => {
    supabase.from('tintero_routes').select('id,started_at,ended_at,distance_m,points_n,stops')
      .not('ended_at', 'is', null).order('started_at', { ascending: false }).limit(14)
      .then(({ data }) => setRows(data ?? []));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  const remove = async (id) => {
    await supabase.rpc('tintero_route_delete', { p_route_id: id });
    setConfirm(null);
    load();
  };
  if (!rows) return null;
  if (!rows.length) return <p className="ruta-muted">Aquí van a aparecer tus recorridos.</p>;
  return (
    <section className="ruta-routes" aria-label="Mis recorridos">
      <h2 className="ruta-h2">Mis recorridos</h2>
      <ul>
        {rows.map((r) => (
          <li key={r.id} className="ruta-route">
            <div>
              <b>{day(r.started_at)}</b>
              <span>{hour(r.started_at)} a {hour(r.ended_at)} · {minutes(r.started_at, r.ended_at)} min · {km(r.distance_m)} · {paradas((r.stops ?? []).length)}</span>
              {(r.stops ?? []).length > 0 && (
                <ol className="ruta-stops">
                  {r.stops.map((s, i) => (
                    <li key={i}>{hour(s.from)} · {s.minutes} min{s.calle ? ` · Calle ${s.calle} con ${s.carrera}` : ''}</li>
                  ))}
                </ol>
              )}
            </div>
            {confirm === r.id ? (
              <span className="ruta-confirm">
                <button type="button" className="ruta-link is-danger" onClick={() => remove(r.id)}>Sí, borrar</button>
                <button type="button" className="ruta-link" onClick={() => setConfirm(null)}>No</button>
              </span>
            ) : (
              <button type="button" className="ruta-link" onClick={() => setConfirm(r.id)} aria-label={`Borrar el recorrido del ${day(r.started_at)}`}>Borrar</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tracker({ me, onChange }) {
  const t = useTracker(me);
  const [, tick] = useState(0);
  const [done, setDone] = useState(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (t.status !== 'tracking') return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [t.status]);

  const finish = async () => {
    const r = await t.finish();
    if (r) { setDone(r); onChange(); }
  };
  const revoke = async () => {
    const { data } = await supabase.rpc('tintero_consent', { p_accept: false });
    onChange(data);
  };

  const live = t.status === 'tracking' || t.status === 'ending' || t.status === 'pending-end';
  return (
    <Shell step={live ? 'RECORRIDO EN CURSO' : 'MI RUTA'}>
      {!live && (
        <>
          <h1 className="ruta-title">{done ? '¡Listo!' : `Buen día, ${me.name.split(' ')[0]}.`}</h1>
          {done ? (
            <p className="ruta-lede" role="status">Recorrido guardado: {km(done.distance_m)} y {paradas(done.stops)}.</p>
          ) : (
            <p className="ruta-lede">Toca «Empezar» cuando salgas con los termos y deja la pantalla encendida mientras caminas.</p>
          )}
          {t.error && <p className="ruta-error" role="alert">{t.error}</p>}
          <button type="button" className="ruta-btn ruta-btn-big" onClick={() => { setDone(null); t.start(); }} disabled={t.status === 'starting'}>
            {t.status === 'starting' ? 'Empezando…' : 'Empezar recorrido'}
          </button>
          <Routes refreshKey={done?.id} />
          <footer className="ruta-foot">
            {leaving ? (
              <p>
                ¿Dejar de compartir tu ubicación? Tus recorridos guardados se quedan hasta que los borres.{' '}
                <button type="button" className="ruta-link is-danger" onClick={revoke}>Sí, dejar de compartir</button>{' '}
                <button type="button" className="ruta-link" onClick={() => setLeaving(false)}>No</button>
              </p>
            ) : (
              <button type="button" className="ruta-link" onClick={() => setLeaving(true)}>Dejar de compartir mi ubicación</button>
            )}
          </footer>
        </>
      )}

      {live && (
        <>
          <div className="ruta-clock" aria-label="Tiempo de recorrido">{t.view.startedAt ? elapsed(t.view.startedAt) : '00:00'}</div>
          <dl className="ruta-stats">
            <div><dt>Caminado</dt><dd data-testid="ruta-km">{km(t.view.distance)}</dd></div>
            <div><dt>Paradas</dt><dd data-testid="ruta-stops">{t.view.stops}</dd></div>
            <div><dt>Puntos</dt><dd data-testid="ruta-points">{t.view.points}</dd></div>
          </dl>
          <p className={`ruta-gps is-${t.gps}`} role="status">
            {GPS_TEXT[t.gps]}{t.gps === 'ok' && t.view.accuracy ? ` · ±${t.view.accuracy} m` : ''}
            {['denied', 'unavailable', 'silent'].includes(t.gps) && t.status === 'tracking' && (
              <> <button type="button" className="ruta-link" onClick={t.retryGps}>Reintentar</button></>
            )}
          </p>
          <p className="ruta-muted" data-testid="ruta-pending">{t.view.pending ? `${t.view.pending} puntos esperando señal para subir` : 'Todo subido'}</p>
          {t.error && <p className="ruta-error" role="alert">{t.error}</p>}
          <button type="button" className="ruta-btn ruta-btn-stop" onClick={finish} disabled={t.status === 'ending'}>
            {t.status === 'ending' ? 'Guardando…' : 'Terminar recorrido'}
          </button>
          <p className="ruta-muted">Con la pantalla apagada el celular deja de dar la ubicación. Bájale el brillo, pero no la apagues.</p>
        </>
      )}
    </Shell>
  );
}

export default function RutaApp() {
  useManifest();
  // Guardar el código del enlace antes de ir a Google (la vuelta puede perderlo)
  useEffect(() => { readCode(); }, []);
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [me, setMe] = useState(undefined); // undefined = cargando · null = sin enlazar
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadMe = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('tintero_me');
    if (err) { setError(err.message); setMe(null); return; }
    setError(null);
    setMe(data ?? null);
  }, []);
  const userId = session?.user?.id;
  useEffect(() => {
    if (userId) loadMe();
    else setMe(undefined);
  }, [userId, loadMe]);

  if (session === undefined || (session && me === undefined)) {
    return <Shell step="MI RUTA"><p className="ruta-muted">Cargando…</p></Shell>;
  }
  if (!session) return <SignIn />;
  if (error) {
    return (
      <Shell step="MI RUTA">
        <p className="ruta-error" role="alert">No se pudo leer tu cuenta: {error}</p>
        <button type="button" className="ruta-btn" onClick={loadMe}>Reintentar</button>
      </Shell>
    );
  }
  if (!me) return <Claim onDone={setMe} />;
  if (!me.consent_at) return <Consent me={me} onDone={setMe} />;
  return <Tracker me={me} onChange={(next) => (next ? setMe(next) : loadMe())} />;
}
