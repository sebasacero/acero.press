// Lo que cambia entre Micra en el navegador (/micra) y Micra instalada en Android
// e iOS (native/, Capacitor). Las pantallas solo llaman a estas funciones; en la
// web hacen lo de siempre y la app nativa las reemplaza al arrancar con
// setPlatform(), para que el sitio nunca descargue código de Capacitor.

import { supabase } from '../../shared/lib/supabaseClient.js';
import { hasWebBluetooth, printCanvas, webBluetoothTransport } from '../admin/micra/printer.js';

// Dentro de la app no hay «origen» público (es capacitor://localhost): los enlaces
// que se comparten y los que salen de Micra apuntan al sitio
export const SITE = 'https://www.aceropress.com';

// Marca que la persona pidió entrar: al volver con la sesión, MicraApp la lleva
// a su panel (equipo o barista). Vive en localStorage porque en el celular la
// vuelta de Google puede abrir la app de nuevo.
export const LOGIN_KEY = 'micra_login_pending';
export function markLogin() {
  try { localStorage.setItem(LOGIN_KEY, String(Date.now())); } catch { /* sin memoria */ }
}
/** ¿Se acaba de entrar? (marca de menos de 15 min). La consume. */
export function takeLogin(now = Date.now()) {
  let at = null;
  try { at = Number(localStorage.getItem(LOGIN_KEY)); localStorage.removeItem(LOGIN_KEY); } catch { /* sin memoria */ }
  return Boolean(at) && now - at < 15 * 60 * 1000;
}

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
  /** Un punto del GPS, una sola vez (para «Salí»; `precise` para marcar un puesto). Sin permiso o sin señal: null. */
  position: (timeout = 8000, precise = false) => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: precise, timeout, maximumAge: precise ? 0 : 120000 },
    );
  }),
  /** El GPS seguido (para acompañar un recorrido): `onFix(position)` en cada lectura. Devuelve cómo pararlo. */
  watch: (onFix, onError = () => {}) => {
    if (!navigator.geolocation) { onError(new Error('Este celular no tiene GPS en el navegador.')); return () => {}; }
    const id = navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    return () => navigator.geolocation.clearWatch(id);
  },
  signIn: (next) => {
    markLogin();
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + (next || window.location.pathname) + window.location.search },
    });
  },
  /**
   * Compartir una imagen (el ticket) con el menú del celular: desde ahí va a WhatsApp,
   * a la app de Phomemo o a Imprimir. Sin menú, se descarga. Devuelve si se abrió el menú.
   */
  shareImage: async ({ blob, fileName, title, text }) => {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text }).catch(() => {});
      return true;
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return false;
  },
  /** La impresora Phomemo por Bluetooth: en la web solo donde hay Web Bluetooth (Chrome). */
  printer: {
    available: () => hasWebBluetooth(),
    print: (canvas, { dots, onStatus }) => printCanvas(canvas, webBluetoothTransport(), { dots, onStatus }),
  },
  /** El color de la barra de arriba del sistema, de día o de noche. */
  setNight: (night) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = night ? '#0E0F12' : '#FFFFFF';
  },
};

const platform = { ...web };

export function setPlatform(overrides) { Object.assign(platform, overrides); }

export default platform;
