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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isRutaRoute ? (
      <Suspense fallback={null}><RutaApp /></Suspense>
    ) : isMicraRoute ? (
      <Suspense fallback={null}><MicraApp /></Suspense>
    ) : isAdminRoute ? <AdminApp /> : <App />}
  </React.StrictMode>
);
