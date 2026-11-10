import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminApp from './features/admin/AdminApp.jsx';
import './index.css';

const isAdminRoute = window.location.pathname.startsWith('/admin');
// La app del tintero (Mi ruta) va en su propio pedazo: el sitio no la descarga
const isRutaRoute = window.location.pathname.startsWith('/ruta');
const RutaApp = lazy(() => import('./features/ruta/RutaApp.jsx'));
// La app Micra (cliente, barista y equipo), también aparte: lo que abre el botón «Micra»
const isMicraRoute = /^\/micra(\/|$)/.test(window.location.pathname);
const MicraApp = lazy(() => import('./features/micra-app/MicraApp.jsx'));
// En computador /micra es el centro de control (la app del celular queda en /micra?app)
const isPanelRoute = isMicraRoute && (/^\/micra\/panel\/?$/.test(window.location.pathname)
  || (/^\/micra\/?$/.test(window.location.pathname) && window.matchMedia?.('(min-width: 1024px)').matches && !new URLSearchParams(window.location.search).has('app')));
const MicraPanelPage = lazy(() => import('./features/home/sections/MicraPanelPage.jsx'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isRutaRoute ? (
      <Suspense fallback={null}><RutaApp /></Suspense>
    ) : isPanelRoute ? (
      <Suspense fallback={null}><MicraPanelPage /></Suspense>
    ) : isMicraRoute ? (
      <Suspense fallback={null}><MicraApp /></Suspense>
    ) : isAdminRoute ? <AdminApp /> : <App />}
  </React.StrictMode>
);
