// Lo que cambia entre Micra en el navegador (/micra) y Micra instalada en Android
// e iOS (native/, Capacitor). Las pantallas solo llaman a estas funciones; en la
// web hacen lo de siempre y la app nativa las reemplaza al arrancar con
// setPlatform(), para que el sitio nunca descargue código de Capacitor.

import { supabase } from '../../shared/lib/supabaseClient.js';

// Dentro de la app no hay «origen» público (es capacitor://localhost): los enlaces
// que se comparten y los que salen de Micra apuntan al sitio
export const SITE = 'https://www.aceropress.com';

const web = {
  native: false,
  /** Dirección completa de una ruta del sitio, para compartir o salir de Micra. */
  siteUrl: (path = '/') => window.location.origin + path,
  /** Abre algo fuera de Micra (WhatsApp, el sitio). */
  openExternal: (url) => { window.open(url, '_blank', 'noopener'); },
  /** Compartir con la hoja del sistema; sin ella, por WhatsApp. */
  share: ({ title, text, url }) => {
    if (navigator.share) return navigator.share({ title, text, url }).catch(() => {});
    platform.openExternal(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`);
    return Promise.resolve();
  },
  /** Un punto del GPS, una sola vez (para «Salí»). Sin permiso o sin señal: null. */
  position: (timeout = 8000) => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout, maximumAge: 120000 },
    );
  }),
  signIn: (next) => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + (next || window.location.pathname) + window.location.search },
  }),
  /** El color de la barra de arriba del sistema, de día o de noche. */
  setNight: (night) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = night ? '#0E0F12' : '#FFFFFF';
  },
};

const platform = { ...web };

export function setPlatform(overrides) { Object.assign(platform, overrides); }

export default platform;
