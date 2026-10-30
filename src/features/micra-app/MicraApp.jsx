import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { isNight, landingAfterLogin, parseRoute } from './micraApp.js';
import * as api from './api.js';
import platform, { takeLogin } from './platform.js';
import { ClientHome, BaristaPage, MyHolds } from './ClientViews.jsx';
import { BaristaHome, BaristaJoin } from './BaristaViews.jsx';
import OwnerView from './OwnerView.jsx';
import Splash from './Splash.jsx';
import { IconNear, IconCup, IconOut, IconToday, IconClipboard, IconCamera } from './icons.jsx';
import './micra-app.css';
import { Cargando } from './Animado.jsx';

// Lo del equipo en la calle se descarga solo al abrirlo: quien busca café no lo paga
const StudyView = lazy(() => import('./StudyView.jsx'));
// La cámara de Micra del panel (filtros, tarjetas, venta y ficha del estudio), la misma pieza
const MicraStudio = lazy(() => import('../admin/micra/MicraStudio.jsx'));
// La ficha rápida del estudio (mapear primero), también aparte
const FichaFlow = lazy(() => import('./FichaFlow.jsx'));

// Micra (/micra): la app que abre el botón «Micra» del sitio. Es la misma para
// todos y cambia según quién entra:
//   · cualquiera (sin cuenta): los baristas cerca y «apártame» → modo cliente
//   · un barista con su cuenta enlazada: su día (salí, te esperan, +1, fiados)
//   · el equipo (admin_users): además, el resumen del día y actuar como un barista,
//     el estudio de calle (ficha, encuesta, foto con GPS) y la cámara con filtros
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
    // La pestaña y el inicio del iPhone llevan el termo de Micra; el sitio vuelve a su lata al salir
    const icons = [...document.querySelectorAll('link[rel="icon"]')].map((el) => [el, el.getAttribute('href')]);
    icons.forEach(([el]) => el.setAttribute('href', '/image/micra-icon-32.png'));
    const touch = document.createElement('link');
    touch.rel = 'apple-touch-icon';
    touch.href = '/image/micra-icon-180.png';
    document.head.appendChild(touch);
    return () => {
      if (existing) link.setAttribute('href', prevHref); else link.remove();
      document.title = prevTitle;
      if (meta && prevColor) meta.content = prevColor;
      icons.forEach(([el, href]) => el.setAttribute('href', href));
      touch.remove();
    };
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
  const teamView = route.view === 'owner' || route.view === 'study' || route.view === 'camera' || route.view === 'ficha';
  // /micra/video: la cámara con filtros para un barista de la app (o el equipo); vive en el modo barista
  const videoView = route.view === 'video';
  const viewMode = teamView ? 'owner' : route.view === 'barista' || videoView ? 'barista' : 'client';

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

  // Recién entrado con Google: cada quien a su panel (el equipo al suyo, no al del barista)
  useEffect(() => {
    if (who.loading || !who.session || !takeLogin()) return;
    const to = landingAfterLogin(who);
    try { localStorage.setItem(MODE_KEY, to === '/micra/equipo' ? 'owner' : 'barista'); } catch { /* sin memoria */ }
    go(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who.loading, who.session]);

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
    if (who.loading) body = <Cargando />;
    // «Cambiar de barista» vuelve a Equipo, donde está «Actuar como»
    else if (who.admin && actAs) body = <BaristaHome asId={actAs} onPickAs={(id) => { setActAs(id); if (!id) switchMode('owner'); }} admin go={go} night={night} tab={route.tab} />;
    else if (who.barista) body = <BaristaHome go={go} night={night} tab={route.tab} />;
    // El equipo sin ficha propia ve la entrada de los baristas (sin mandar SMS)
    else if (who.admin) body = <BaristaJoin session={who.session} preview night={night} go={go} />;
    else body = <BaristaJoin session={who.session} onLinked={reloadWho} night={night} go={go} />;
  } else if (videoView) {
    if (who.loading) body = <Cargando />;
    else if (who.barista || who.admin) body = <Cargando fig="caminando">Abriendo la cámara…</Cargando>;
    else body = <BaristaJoin session={who.session} onLinked={reloadWho} night={night} go={go} />;
  } else if (teamView) {
    if (who.loading) body = <Cargando />;
    else if (!who.admin) body = <BaristaJoin session={who.session} onLinked={reloadWho} team />;
    else if (route.view === 'ficha') body = <Suspense fallback={<Cargando fig="caminando" />}><FichaFlow go={go} /></Suspense>;
    else if (route.view === 'study' || route.view === 'camera') body = <Suspense fallback={<Cargando fig="caminando" />}><StudyView go={go} /></Suspense>;
    else body = <OwnerView go={go} onActAs={(id) => { setActAs(id); switchMode('barista'); }} />;
  } else body = <ClientHome go={go} night={night} />;
  const teamTabs = teamView && who.admin;

  return (
    <div className={`mapp ${night ? 'is-night' : 'is-day'} is-${viewMode}${teamTabs ? ' has-tabs' : ''}`}>
      <header className="mapp-top">
        <button type="button" className="mapp-brand" onClick={() => go(viewMode === 'client' ? '/micra' : viewMode === 'owner' ? '/micra/equipo' : '/micra/barista')} aria-label="Micra, inicio">
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
            <IconNear />Cerca
          </button>
          <button type="button" className={route.view === 'holds' ? 'on' : ''} onClick={() => go('/micra/apartados')}>
            <IconCup />Mis apartados
          </button>
          <a href={platform.siteUrl('/')}><IconOut />aceropress</a>
        </nav>
      )}
      {teamTabs && (
        <nav className="mapp-tabs" aria-label="Equipo">
          <button type="button" className={route.view === 'owner' ? 'on' : ''} onClick={() => go('/micra/equipo')}>
            <IconToday />Hoy
          </button>
          <button type="button" className={route.view === 'study' ? 'on' : ''} onClick={() => go('/micra/estudio')}>
            <IconClipboard />Estudio
          </button>
          <button type="button" className={route.view === 'camera' ? 'on' : ''} onClick={() => go('/micra/camara')}>
            <IconCamera />Cámara
          </button>
        </nav>
      )}
      {((route.view === 'camera' && who.admin) || (videoView && (who.barista || who.admin))) && (
        // A pantalla completa sobre el estudio (equipo) o sobre el inicio del barista; `lite`: sin venta, ficha ni publicar
        <Suspense fallback={null}>
          <MicraStudio key={route.view} lite={videoView && !who.admin} onExit={() => go(videoView ? '/micra/barista' : '/micra/estudio')} />
        </Suspense>
      )}
      {platform.native && <Splash />}
    </div>
  );
}
