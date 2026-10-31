import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor, SystemBars, SystemBarsStyle, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Geolocation } from '@capacitor/geolocation';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { setApiBase } from '../../../shared/lib/apiBase.js';
import { SITE, markLogin, setPlatform } from '../platform.js';
import { printCanvas } from '../../admin/micra/printer.js';
import { SERVICE, WRITE, NOTIFY } from '../../admin/micra/phomemo.js';
import { AUTH_REDIRECT, authFromUrl, micraPathFromUrl, startPath } from './deepLink.js';
import MicraApp from '../MicraApp.jsx';
import '../../../index.css';

// Micra instalada en Android e iOS (Capacitor, micra.html → dist-micra/). Son las
// mismas pantallas de /micra; aquí solo se cambia lo que en el celular se hace
// distinto: GPS, compartir, salir a WhatsApp o al sitio y entrar con Google.

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// Actualizar sin reinstalar: al abrir, la app mira /micra-app/latest.json del sitio y, si hay
// una web más nueva para esta misma app instalada (llave nativa igual), la baja y la aplica la
// próxima vez que se abra o vuelva del fondo. Si una versión nueva falla, se vuelve sola a la anterior.
const UPDATE_URL = `${SITE}/micra-app/latest.json`;
async function checkUpdate() {
  try {
    await CapacitorUpdater.notifyAppReady();
    const res = await fetch(UPDATE_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = await res.json();
    if (!latest?.version || latest.native !== __MICRA_NATIVE__) return; // otra app instalada: hay que reinstalar
    const { bundle } = await CapacitorUpdater.current();
    if (bundle?.version === latest.version) return;
    if (bundle?.id === 'builtin' && latest.at && latest.at <= __MICRA_BUILT_AT__) return;
    const next = await CapacitorUpdater.download({ version: latest.version, url: latest.url });
    await CapacitorUpdater.next({ id: next.id });
  } catch { /* sin red o sin plugin: sigue la versión que hay */ }
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(new Error('No se pudo leer la imagen.'));
  r.readAsDataURL(blob);
});

// La Phomemo por el Bluetooth del celular (plugin BLE). `printerId` es la de la última
// vez: se intenta conectar directo y, si no está, se abre el selector del sistema.
function bleTransport(printerId) {
  let id = null;
  return {
    async connect(onNotify) {
      await BleClient.initialize({ androidNeverForLocation: true });
      let name = null;
      if (printerId) {
        try { await BleClient.connect(printerId); id = printerId; } catch { id = null; }
      }
      if (!id) {
        const d = await BleClient.requestDevice({ services: [SERVICE] });
        await BleClient.connect(d.deviceId);
        id = d.deviceId;
        name = d.name ?? null;
      }
      await BleClient.startNotifications(id, SERVICE, NOTIFY, (v) => onNotify(new Uint8Array(v.buffer))).catch(() => { /* sin avisos */ });
      return { id, name };
    },
    write: (bytes) => BleClient.write(id, SERVICE, WRITE, new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)),
    async disconnect() { if (id) await BleClient.disconnect(id); },
  };
}

const go = (path) => {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

// La API de Acero (estudio de calle) vive en el sitio, no dentro de la app
setApiBase(SITE);

setPlatform({
  native: true,
  siteUrl: (path = '/') => SITE + path,
  // Capacitor abre fuera de la app (WhatsApp, Safari, Chrome) todo lo que no es localhost
  openExternal: (url) => { window.location.href = url; },
  share: ({ title, text, url }) => Share.share({ title, text, url, dialogTitle: title }).catch(() => {}),
  // `background`: el recorrido de «Salí a vender» sigue con la pantalla apagada (plugin de
  // segundo plano; Android muestra una notificación fija mientras graba)
  watch: (onFix, onError = () => {}, { background = false } = {}) => {
    if (background) {
      let bgId = null;
      let bgStopped = false;
      BackgroundGeolocation.addWatcher(
        { backgroundTitle: 'Micra · Salí a vender', backgroundMessage: 'Tus clientes te ven en el mapa mientras vendes.', requestPermissions: true, stale: false, distanceFilter: 10 },
        (loc, err) => {
          if (err) { onError(err); return; }
          if (loc) onFix({ coords: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy }, timestamp: loc.time ?? Date.now() });
        },
      ).then((w) => { bgId = w; if (bgStopped) BackgroundGeolocation.removeWatcher({ id: w }); }).catch(onError);
      return () => { bgStopped = true; if (bgId) BackgroundGeolocation.removeWatcher({ id: bgId }); };
    }
    let id = null;
    let stopped = false;
    Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }, (p, err) => {
      if (err) onError(err); else if (p) onFix(p);
    }).then((w) => { id = w; if (stopped) Geolocation.clearWatch({ id }); }).catch(onError);
    return () => { stopped = true; if (id) Geolocation.clearWatch({ id }); };
  },
  // El ticket como archivo: el menú del celular lo lleva a WhatsApp, a la app de Phomemo o a Imprimir
  shareImage: async ({ blob, fileName, title, text }) => {
    const { uri } = await Filesystem.writeFile({ path: fileName, data: await blobToBase64(blob), directory: Directory.Cache });
    await Share.share({ title, text, files: [uri], dialogTitle: title }).catch(() => {});
    return true;
  },
  printer: {
    available: () => true,
    print: (canvas, { dots, onStatus, printerId }) => printCanvas(canvas, bleTransport(printerId), { dots, onStatus }),
  },
  position: async (timeout = 8000, precise = false) => {
    try {
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: precise, timeout, maximumAge: precise ? 0 : 120000 });
      return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
    } catch { return null; }
  },
  // Google no deja entrar desde una vista web dentro de la app: se abre el navegador
  // del sistema y Supabase vuelve a la app por el esquema propio (AUTH_REDIRECT)
  signIn: async () => {
    markLogin();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) throw error;
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
  },
  // Letras de la barra del sistema claras de noche y sobre el rojo de la salida, oscuras de día
  setNight: (night, red = false) => { SystemBars.setStyle({ style: night || red ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {}); },
});

async function openUrl(url) {
  const auth = authFromUrl(url);
  if (auth) {
    Browser.close().catch(() => { /* Android cierra la pestaña solo */ });
    if (auth.code) await supabase.auth.exchangeCodeForSession(auth.code);
    else if (auth.access_token) await supabase.auth.setSession(auth);
    else window.alert(`No se pudo entrar: ${auth.error}`);
    // A qué panel ir lo decide MicraApp cuando sabe si es del equipo o barista
    return;
  }
  const path = micraPathFromUrl(url);
  if (path) go(path);
}

App.addListener('appUrlOpen', ({ url }) => { openUrl(url); });
checkUpdate();
App.addListener('appStateChange', ({ isActive }) => { if (isActive) checkUpdate(); });
App.getLaunchUrl().then((r) => r?.url && openUrl(r.url)).catch(() => {});
// Atrás en Android: primero dentro de Micra; en el inicio, la app se va al fondo
App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack && window.location.pathname !== '/micra') window.history.back();
  else App.minimizeApp();
});

document.documentElement.classList.add(`is-${Capacitor.getPlatform()}`);
window.history.replaceState(null, '', startPath(window.location.pathname) + window.location.search);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MicraApp />
  </React.StrictMode>
);
