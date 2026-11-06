import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { landingAfterLogin, parseRoute, initials, redTop } from './micraApp.js';
import * as api from './api.js';
import platform, { takeLogin } from './platform.js';
import { ClientHome, BaristaPage, MyHolds } from './ClientViews.jsx';
import { BaristaHome, BaristaJoin } from './BaristaViews.jsx';
import OwnerView from './OwnerView.jsx';
import Splash from './Splash.jsx';
import Termo from './Termo.jsx';
import PullRefresh from './PullRefresh.jsx';
import { IconCup, IconToday, IconClipboard, IconCamera, IconUser, IconPin, IconBars, IconHome, IconCompass, IconPlus, IconSend, IconBell } from './icons.jsx';
import './micra-app.css';
import './termico-app.css';
import ThermalDefs from '../../shared/layout/ThermalDefs.jsx';
import { Cargando } from './Animado.jsx';

// Lo del equipo en la calle se descarga solo al abrirlo: quien busca café no lo paga
const StudyView = lazy(() => import('./StudyView.jsx'));
// La cámara de Micra del panel (filtros, tarjetas, venta y ficha del estudio), la misma pieza
const MicraStudio = lazy(() => import('../admin/micra/MicraStudio.jsx'));
// La ficha rápida del estudio (mapear primero), también aparte
const FichaFlow = lazy(() => import('./FichaFlow.jsx'));
// «Mi perfil» y «Cerrar sesión» del cliente y del equipo (el del barista vive en BaristaHome)
const ClientProfile = lazy(() => import('./Perfil.jsx').then((m) => ({ default: m.ClientProfile })));
const OwnerProfile = lazy(() => import('./Perfil.jsx').then((m) => ({ default: m.OwnerProfile })));
// Hoy del cliente: el mismo muro del barista (cargado aparte), sin logros ni ideas de foto
const HoyFeed = lazy(() => import('./HoyFeed.jsx'));
const ClientPublish = lazy(() => import('./HoyFeed.jsx').then((m) => ({ default: m.ClientPublish })));
// Competencia: el reto de la semana (el cliente califica; el barista lo tiene en su modo)
const Competencia = lazy(() => import('./Competencia.jsx'));

/** El avión de papel de arriba (como los mensajes de Instagram): el WhatsApp del equipo. */
function TeamChat() {
  const [number, setNumber] = useState(null);
  useEffect(() => { api.teamWhatsApp().then(setNumber).catch(() => setNumber('573152125327')); }, []);
  const href = number ? `https://wa.me/${number}?text=${encodeURIComponent('Hola, equipo de Micra. ')}` : undefined;
  return <a className="mapp-topicon" href={href} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp" title="Escríbenos"><IconSend /></a>;
}

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

// Solo el modo blanco (pedido del usuario, 5 nov 2026): la app ya no cambia a noche con la hora.
function useNight() {
  return false;
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

/** La meta del día en la barra de arriba del barista: la taza que se llena y «4/25». */
function TopGoal({ board, onClick }) {
  const pct = board.goal > 0 ? Math.min(1, board.cups / board.goal) : 0;
  const met = board.goal > 0 && board.cups >= board.goal;
  const top = 22 + (1 - pct) * 78;
  return (
    <button type="button" className={`mapp-topgoal${met ? ' is-met' : ''}`} onClick={onClick} aria-label={`Tu meta de hoy: ${board.cups} de ${board.goal} tazas`} data-testid="top-goal">
      <svg viewBox="0 0 110 118" aria-hidden="true">
        <defs><clipPath id="mapp-topcup"><path d="M10 22h72v44a34 34 0 0 1-34 34h-4a34 34 0 0 1-34-34z" /></clipPath></defs>
        <g clipPath="url(#mapp-topcup)"><path fill="var(--t-5)" d={`M0 ${top} q12 -6 24 0 t24 0 t24 0 t24 0 V120 H0z`} /></g>
        <path d="M10 22h72v44a34 34 0 0 1-34 34h-4a34 34 0 0 1-34-34zM82 34h8a14 14 0 0 1 0 28h-8" fill="none" stroke="#fff" strokeWidth="8" strokeLinejoin="round" />
      </svg>
      <span><b>{board.cups}</b>/{board.goal}<small> {met ? '¡meta!' : 'meta'}</small></span>
    </button>
  );
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
  // Si el barista está en la calle (lo avisa BaristaHome): la barra va en rojo en Vender y su círculo lleva el punto verde
  const [live, setLive] = useState(false);
  // La meta del día (la avisa BaristaHome): en la barra de arriba, en vez de «Cliente / Barista»
  const [board, setBoard] = useState(null);
  const [publishing, setPublishing] = useState(false);
  // «Desliza para recargar»: el cliente y el equipo vuelven a montar la pantalla; el barista
  // relee su día sin desmontarse (lleva el GPS de la salida y la cola de ventas)
  const [refreshKey, setRefreshKey] = useState(0);
  // La campana del cliente (como en las apps de domicilios): punto rojo si tiene un apartado en curso
  const [holdOn, setHoldOn] = useState(false);

  const modes = ['client', ...(who.barista || who.admin ? ['barista'] : []), ...(who.admin ? ['owner'] : [])];
  const teamView = route.view === 'owner' || route.view === 'study' || route.view === 'camera' || route.view === 'ficha';
  // /micra/video: la cámara con filtros en modo barista, solo para el equipo
  const videoView = route.view === 'video';
  const viewMode = teamView ? 'owner' : route.view === 'barista' || videoView ? 'barista' : 'client';
  // La cabecera roja de domicilios: el inicio del cliente y Vender del barista
  const red = redTop(route);

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

  useEffect(() => {
    if (viewMode !== 'client') return;
    api.myHolds().then((h) => setHoldOn((h ?? []).some((x) => x.status === 'waiting'))).catch(() => setHoldOn(false));
  }, [viewMode, route.view, refreshKey]);

  const switchMode = (m) => {
    try { localStorage.setItem(MODE_KEY, m); } catch { /* sin memoria */ }
    go(m === 'owner' ? '/micra/equipo' : m === 'barista' ? '/micra/barista' : '/micra');
  };

  // Un barista que llega a /micra/video (un enlace viejo) vuelve a su inicio
  useEffect(() => {
    if (videoView && !who.loading && who.barista && !who.admin) go('/micra/barista');
  }, [videoView, who.loading, who.barista, who.admin, go]);

  useEffect(() => {
    platform.setNight(night, red);
  }, [night, red]);

  let body;
  if (route.view === 'barista-card') body = <BaristaPage id={route.id} go={go} night={night} />;
  else if (route.view === 'holds') body = <MyHolds go={go} />;
  else if (route.view === 'feed') body = <Suspense fallback={<Cargando />}><HoyFeed go={go} audience="client" /></Suspense>;
  else if (route.view === 'reto') body = <Suspense fallback={<Cargando />}><Competencia go={go} audience="client" /></Suspense>;
  else if (route.view === 'me') body = who.loading ? <Cargando /> : <Suspense fallback={<Cargando />}><ClientProfile go={go} who={who} /></Suspense>;
  else if (route.view === 'barista') {
    if (who.loading) body = <Cargando />;
    // «Cambiar de barista» vuelve a Equipo, donde está «Actuar como»
    else if (who.admin && actAs) body = <BaristaHome asId={actAs} onPickAs={(id) => { setActAs(id); if (!id) switchMode('owner'); }} admin go={go} night={night} tab={route.tab} onLive={setLive} onBoard={setBoard} refreshKey={refreshKey} />;
    else if (who.barista) body = <BaristaHome go={go} night={night} tab={route.tab} onLive={setLive} onBoard={setBoard} refreshKey={refreshKey} />;
    // El equipo sin ficha propia ve la entrada de los baristas (sin mandar SMS)
    else if (who.admin) body = <BaristaJoin session={who.session} preview night={night} go={go} />;
    else body = <BaristaJoin session={who.session} onLinked={reloadWho} night={night} go={go} />;
  } else if (videoView) {
    if (who.loading) body = <Cargando />;
    // La cámara con filtros es solo del equipo (pedido del usuario, 6 nov 2026): el barista tiene su
    // perfil aparte, con la cámara de su barra para la foto de la venta
    else if (who.admin) body = <Cargando fig="caminando">Abriendo la cámara…</Cargando>;
    else if (who.barista) body = <Cargando />;
    else body = <BaristaJoin session={who.session} onLinked={reloadWho} night={night} go={go} />;
  } else if (teamView) {
    if (who.loading) body = <Cargando />;
    else if (!who.admin) body = <BaristaJoin session={who.session} onLinked={reloadWho} team />;
    else if (route.view === 'ficha') body = <Suspense fallback={<Cargando fig="caminando" />}><FichaFlow go={go} /></Suspense>;
    else if (route.view === 'study' || route.view === 'camera') body = <Suspense fallback={<Cargando fig="caminando" />}><StudyView go={go} focus={route.tab} /></Suspense>;
    else if (route.tab === 'perfil') body = <Suspense fallback={<Cargando />}><OwnerProfile go={go} onSignedOut={() => setActAs(null)} /></Suspense>;
    else body = <OwnerView go={go} onActAs={(id) => { setActAs(id); switchMode('barista'); }} />;
  } else body = <ClientHome go={go} />;
  const teamTabs = teamView && who.admin;
  // La entrada de los baristas (sin ficha enlazada) lleva la barra del cliente: toda la app tiene barra abajo
  const joinTabs = route.view === 'barista' && !who.loading && !who.barista && !who.admin;
  const clientTabs = viewMode === 'client' || joinTabs;
  // «Mi perfil», arriba a la derecha: las iniciales del barista, o la silueta (cliente, equipo, actuando como)
  const acting = who.admin && actAs;
  const meTo = viewMode === 'client' ? null
    : viewMode === 'barista' && !who.loading && (who.barista || acting) ? '/micra/barista/perfil'
      : viewMode === 'owner' && who.admin ? '/micra/equipo/perfil' : null;
  const meOn = route.view === 'me' || route.tab === 'perfil' || route.tab === 'qr';
  const meInitials = viewMode === 'barista' && who.barista && !acting ? initials(who.barista.name) : null;
  // El círculo de la barra de abajo del cliente: sus iniciales si dejó su nombre en el celular
  const clientName = clientTabs ? api.savedName() : '';

  return (
    <div className={`mapp ${night ? 'is-night' : 'is-day'} is-${viewMode}${teamTabs || joinTabs ? ' has-tabs' : ''}${red ? ' is-redtop' : ''}`}>
      <ThermalDefs />
      <header className={`mapp-top${modes.length > 2 ? ' has-3' : ''}`} data-testid="topbar">
        {/* El termo del icono en su baldosa crema (se ve igual sobre blanco, noche o rojo) y la palabra */}
        <button type="button" className="mapp-brand" onClick={() => go(viewMode === 'client' ? '/micra' : viewMode === 'owner' ? '/micra/equipo' : '/micra/barista')} aria-label="Micra, inicio">
          <span className="mapp-brand-mark"><Termo /></span>
          <span className="mapp-brand-word">micra<i>.</i></span>
        </button>
        {viewMode === 'barista' && route.view === 'barista' && board
          ? <TopGoal board={board} onClick={() => go('/micra/barista')} />
          : <ModeSwitch modes={modes} mode={viewMode} onChange={switchMode} />}
        {viewMode === 'client' && (
          <button type="button" className="mapp-topicon is-bell" onClick={() => go('/micra/apartados')} aria-label={holdOn ? 'Mis apartados: tienes uno en curso' : 'Mis apartados'} title="Mis apartados" data-testid="top-bell">
            <IconBell />{holdOn && <i className="mapp-topicon-dot" aria-hidden="true" />}
          </button>
        )}
        {viewMode === 'client' && <TeamChat />}
        {modes.length < 2 && viewMode !== 'client' && (
          <button type="button" className="mapp-toplink" onClick={() => go('/micra')}>Busco café</button>
        )}
        {meTo && (
          <button type="button" className={`mapp-mebtn ${meOn ? 'on' : ''}`} onClick={() => go(meTo)} aria-label="Mi perfil" aria-current={meOn ? 'page' : undefined} data-testid="me-button">
            {meInitials ? <span>{meInitials}</span> : <IconUser />}
            {live && viewMode === 'barista' && <i className="mapp-mebtn-live" aria-hidden="true" />}
          </button>
        )}
      </header>
      <PullRefresh onRefresh={() => setRefreshKey((k) => k + 1)} disabled={videoView || route.view === 'camera' || route.view === 'ficha' || route.view === 'study'} />
      <main className="mapp-main" key={route.view === 'barista' ? 'barista' : refreshKey}>{body}</main>
      {clientTabs && (
        // Como Instagram: inicio, explorar (Hoy), crear, lo tuyo (apartados) y tu perfil; solo íconos
        <nav className="mapp-tabs is-ig" aria-label="Micra">
          <button type="button" className={route.view === 'home' || route.view === 'barista-card' ? 'on' : ''} aria-current={route.view === 'home' ? 'page' : undefined} onClick={() => go('/micra')} aria-label="Inicio" title="Inicio">
            <IconHome />
          </button>
          <button type="button" className={route.view === 'feed' ? 'on' : ''} aria-current={route.view === 'feed' ? 'page' : undefined} onClick={() => go('/micra/hoy')} aria-label="Hoy en el café" title="Hoy en el café">
            <IconCompass />
          </button>
          <button type="button" className="mapp-tabs-cam" onClick={() => setPublishing(true)} aria-label="Publicar" title="Publicar" data-testid="tab-publish">
            <IconPlus />
          </button>
          <button type="button" className={route.view === 'holds' ? 'on' : ''} aria-current={route.view === 'holds' ? 'page' : undefined} onClick={() => go('/micra/apartados')} aria-label="Mis apartados" title="Mis apartados">
            <IconCup />
          </button>
          <button type="button" className={`is-me ${route.view === 'me' ? 'on' : ''}`} aria-current={route.view === 'me' ? 'page' : undefined} onClick={() => go('/micra/perfil')} aria-label="Mi perfil" title="Mi perfil" data-testid="me-button">
            <span className="mapp-tab-av">{clientName ? initials(clientName) : <IconUser />}</span>
          </button>
        </nav>
      )}
      {teamTabs && (
        // El equipo en la calle (6 nov 2026): Hoy, el mapa, la cámara al centro, la encuesta y el estudio; con el mismo diseño de la del cliente
        <nav className="mapp-tabs is-ig" aria-label="Equipo">
          <button type="button" className={route.view === 'owner' && !route.tab ? 'on' : ''} onClick={() => go('/micra/equipo')} aria-label="Hoy" title="Hoy">
            <IconToday />
          </button>
          <button type="button" className={route.view === 'study' && route.tab === 'mapa' ? 'on' : ''} onClick={() => go('/micra/mapa')} aria-label="Mapa" title="Mapa" data-testid="tab-map">
            <IconPin />
          </button>
          <button type="button" className={`mapp-tabs-cam ${route.view === 'camera' ? 'on' : ''}`} onClick={() => go('/micra/camara')} aria-label="Cámara" title="Cámara" data-testid="tab-camera">
            <IconCamera />
          </button>
          <button type="button" className={route.view === 'ficha' ? 'on' : ''} onClick={() => go('/micra/ficha')} aria-label="Encuesta" title="Encuesta" data-testid="tab-survey">
            <IconClipboard />
          </button>
          <button type="button" className={route.view === 'study' && route.tab !== 'mapa' ? 'on' : ''} onClick={() => go('/micra/estudio')} aria-label="Estudio" title="Estudio">
            <IconBars />
          </button>
        </nav>
      )}
      {((route.view === 'camera' && who.admin) || (videoView && who.admin)) && (
        // A pantalla completa sobre el estudio (equipo) o sobre el inicio del barista; `lite`: sin venta, ficha ni publicar.
        // En modo barista es `lite` para todos, también para el dueño: la encuesta y la ficha viven solo en Equipo
        <Suspense fallback={null}>
          <MicraStudio key={route.view} lite={videoView} onExit={() => go(videoView ? '/micra/barista' : '/micra/estudio')} />
        </Suspense>
      )}
      {publishing && clientTabs && <Suspense fallback={null}><ClientPublish onClose={() => setPublishing(false)} /></Suspense>}
      {platform.native && <Splash />}
    </div>
  );
}
