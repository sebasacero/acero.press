import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { isNight, parseRoute } from './micraApp.js';
import * as api from './api.js';
import platform from './platform.js';
import { ClientHome, BaristaPage, MyHolds } from './ClientViews.jsx';
import { BaristaHome, BaristaJoin } from './BaristaViews.jsx';
import OwnerView from './OwnerView.jsx';
import './micra-app.css';

// Micra (/micra): la app que abre el botón «Micra» del sitio. Es la misma para
// todos y cambia según quién entra:
//   · cualquiera (sin cuenta): los baristas cerca y «apártame» → modo cliente
//   · un barista con su cuenta enlazada: su día (salí, te esperan, +1, fiados)
//   · el equipo (admin_users): además, el resumen del día y actuar como un barista
// Se instala desde el navegador (public/micra.webmanifest).

const MODE_KEY = 'micra_mode_v1';

function useManifest() {
  useEffect(() => {
    // Instalada en el celular no hay nada que instalar ni pestaña que titular
    if (platform.native) return undefined;
    // El navegador usa el primer manifiesto: si el sitio ya trae uno, se le cambia el href y se devuelve al salir
    const existing = document.querySelector('link[rel="manifest"]');
    const link = existing ?? document.createElement('link');
    const prevHref = existing?.getAttribute('href');
    link.rel = 'manifest';
    link.href = '/micra.webmanifest';
    if (!existing) document.head.appendChild(link);
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevColor = meta?.content;
    const prevTitle = document.title;
    document.title = 'Micra · café en la calle';
    return () => { if (existing) link.setAttribute('href', prevHref); else link.remove(); document.title = prevTitle; if (meta && prevColor) meta.content = prevColor; };
  }, []);
}

function useNight() {
  const [night, setNight] = useState(() => isNight());
  useEffect(() => {
    const id = setInterval(() => setNight(isNight()), 60000);
    return () => clearInterval(id);
  }, []);
  return night;
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const go = useCallback((path) => {
    if (path !== window.location.pathname) window.history.pushState(null, '', path);
    setRoute(parseRoute(path));
    window.scrollTo(0, 0);
  }, []);
  return [route, go];
}

/** Quién entra: sesión, si es del equipo y si es un barista enlazado. */
function useWho() {
  const [who, setWho] = useState({ loading: true, session: null, admin: false, barista: null });
  const load = useCallback(async (session) => {
    if (!session) { setWho({ loading: false, session: null, admin: false, barista: null }); return; }
    const [admin, barista] = await Promise.all([
      api.isAdmin(session.user.id),
      api.me().catch(() => null),
    ]);
    setWho({ loading: false, session, admin, barista });
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED') return;
      load(s ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);
  return [who, () => supabase.auth.getSession().then(({ data }) => load(data.session ?? null))];
}

function ModeSwitch({ modes, mode, onChange }) {
  if (modes.length < 2) return null;
  const label = { client: 'Cliente', barista: 'Barista', owner: 'Equipo' };
  return (
    <div className="mapp-modes" role="tablist" aria-label="Ver Micra como">
      {modes.map((m) => (
        <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => onChange(m)}>
          {label[m]}
        </button>
      ))}
    </div>
  );
}

export default function MicraApp() {
  useManifest();
  const night = useNight();
  const [route, go] = useRoute();
  const [who, reloadWho] = useWho();
  // El equipo puede actuar como cualquier barista (para probar o ayudar en la calle)
  const [actAs, setActAs] = useState(null);

  const modes = ['client', ...(who.barista || who.admin ? ['barista'] : []), ...(who.admin ? ['owner'] : [])];
  const viewMode = route.view === 'owner' ? 'owner' : route.view === 'barista' ? 'barista' : 'client';

  // Al entrar a /micra, el barista y el equipo caen en su modo de siempre
  useEffect(() => {
    if (who.loading || route.view !== 'home') return;
    let saved = null;
    try { saved = localStorage.getItem(MODE_KEY); } catch { /* sin memoria */ }
    if (saved === 'owner' && who.admin) go('/micra/equipo');
    else if (saved !== 'client' && who.barista) go('/micra/barista');
    // Solo al cargar: después cada quien navega
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who.loading]);

  const switchMode = (m) => {
    try { localStorage.setItem(MODE_KEY, m); } catch { /* sin memoria */ }
    go(m === 'owner' ? '/micra/equipo' : m === 'barista' ? '/micra/barista' : '/micra');
  };

  useEffect(() => {
    platform.setNight(night);
  }, [night]);

  let body;
  if (route.view === 'barista-card') body = <BaristaPage id={route.id} go={go} night={night} />;
  else if (route.view === 'holds') body = <MyHolds go={go} />;
  else if (route.view === 'barista') {
    if (who.loading) body = <p className="mapp-muted">Cargando…</p>;
    else if (who.admin && (actAs || !who.barista)) body = <BaristaHome asId={actAs} onPickAs={setActAs} admin go={go} />;
    else if (who.barista) body = <BaristaHome go={go} />;
    else body = <BaristaJoin session={who.session} onLinked={reloadWho} />;
  } else if (route.view === 'owner') {
    if (who.loading) body = <p className="mapp-muted">Cargando…</p>;
    else if (!who.admin) body = <BaristaJoin session={who.session} onLinked={reloadWho} team />;
    else body = <OwnerView go={go} onActAs={(id) => { setActAs(id); switchMode('barista'); }} />;
  } else body = <ClientHome go={go} night={night} />;

  return (
    <div className={`mapp ${night ? 'is-night' : 'is-day'} is-${viewMode}`}>
      <header className="mapp-top">
        <button type="button" className="mapp-brand" onClick={() => go(viewMode === 'client' ? '/micra' : route.view === 'owner' ? '/micra/equipo' : '/micra/barista')} aria-label="Micra, inicio">
          micra<i>.</i>
        </button>
        <ModeSwitch modes={modes} mode={viewMode} onChange={switchMode} />
        {modes.length < 2 && viewMode === 'client' && (
          <button type="button" className="mapp-toplink" onClick={() => go('/micra/barista')}>Soy barista</button>
        )}
        {modes.length < 2 && viewMode !== 'client' && (
          <button type="button" className="mapp-toplink" onClick={() => go('/micra')}>Busco café</button>
        )}
      </header>
      <main className="mapp-main">{body}</main>
      {viewMode === 'client' && (
        <nav className="mapp-tabs" aria-label="Micra">
          <button type="button" className={route.view === 'home' || route.view === 'barista-card' ? 'on' : ''} onClick={() => go('/micra')}>
            <span aria-hidden="true">◎</span>Cerca
          </button>
          <button type="button" className={route.view === 'holds' ? 'on' : ''} onClick={() => go('/micra/apartados')}>
            <span aria-hidden="true">☕</span>Mis apartados
          </button>
          <a href={platform.siteUrl('/')}><span aria-hidden="true">↗</span>aceropress</a>
        </nav>
      )}
    </div>
  );
}
