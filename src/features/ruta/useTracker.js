import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { acceptFix, distanceOf, detectStops, fromPosition, newRef, simplifyPath, summarize, TUNING } from './track.js';

// El recorrido en el celular: lee el GPS mientras la pantalla está encendida,
// guarda cada punto en el teléfono primero (la señal en la calle va y viene)
// y lo sube en lotes. Si la página se recarga o se cierra, al volver retoma
// el mismo recorrido con lo que quedó guardado.
//
// Límite de la web: con la pantalla apagada o la app en segundo plano, el
// navegador deja de dar ubicación. Por eso se pide mantener la pantalla
// encendida (Wake Lock) y se avisa cuando el GPS calla.

const KEY = 'micra_ruta_v1';
const FLUSH_MS = 20_000;
const SILENT_MS = 90_000; // sin lecturas en este tiempo: avisar

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
};
const save = (s) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch { /* sin almacenamiento: el recorrido sigue en memoria */ }
};

const GPS_ERROR = { 1: 'denied', 2: 'unavailable', 3: 'waiting' };

// `watch` (opcional): otra fuente de GPS, la de la app instalada que sigue con la
// pantalla apagada. Recibe (onFix, onError) y devuelve cómo pararla.
export function useTracker(me, { watch = null } = {}) {
  const state = useRef(null); // { routeId, clientRef, startedAt, points, queue, ending }
  const watchId = useRef(null);
  const wake = useRef(null);
  const flushing = useRef(false);
  const lastFixAt = useRef(0);
  const [status, setStatus] = useState('idle'); // idle · starting · tracking · ending · pending-end
  const [gps, setGps] = useState('waiting'); // waiting · ok · silent · denied · unavailable · unsupported
  const [view, setView] = useState({ points: 0, pending: 0, distance: 0, stops: 0, accuracy: null, startedAt: null, path: [] });
  const [error, setError] = useState(null);

  const refresh = useCallback((acc) => {
    const s = state.current;
    if (!s) { setView({ points: 0, pending: 0, distance: 0, stops: 0, accuracy: null, startedAt: null, path: [] }); return; }
    setView((v) => ({
      points: s.points.length,
      pending: s.queue.length,
      distance: distanceOf(s.points),
      stops: detectStops(s.points).length,
      accuracy: acc ?? v.accuracy,
      startedAt: s.startedAt,
      // El trazo corto, para dibujar «Mi día en la calle»
      path: simplifyPath(s.points, 48),
    }));
  }, []);

  const flush = useCallback(async ({ all = false } = {}) => {
    const s = state.current;
    if (!s || flushing.current || !s.queue.length) return true;
    flushing.current = true;
    try {
      do {
        const batch = s.queue.slice(0, TUNING.batch);
        const { error: err } = await supabase.rpc('tintero_route_add_points', { p_route_id: s.routeId, p_points: batch });
        if (err) {
          // Permiso retirado o recorrido ajeno: no tiene sentido reintentar
          if (err.code === '42501') { setError(err.message); s.queue = []; save(s); return false; }
          return false;
        }
        s.queue.splice(0, batch.length);
        save(s);
      } while (all && s.queue.length);
      return true;
    } catch {
      return false; // sin red: queda en el teléfono para el próximo intento
    } finally {
      flushing.current = false;
      refresh();
    }
  }, [refresh]);

  const lockScreen = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') wake.current = await navigator.wakeLock.request('screen');
    } catch { /* sin Wake Lock (iPhone viejo, ahorro de batería): queda el aviso */ }
  }, []);

  const stopWatch = useCallback(() => {
    if (typeof watchId.current === 'function') watchId.current();
    else if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    wake.current?.release?.().catch(() => {});
    wake.current = null;
  }, []);

  const startWatch = useCallback(() => {
    if (!watch && !('geolocation' in navigator)) { setGps('unsupported'); return; }
    stopWatch();
    setGps('waiting');
    lastFixAt.current = Date.now();
    const onFix = (pos) => {
        lastFixAt.current = Date.now();
        setGps('ok');
        const s = state.current;
        if (!s || s.ending) return;
        const fix = fromPosition(pos);
        const { keep } = acceptFix(s.points.at(-1) ?? null, fix);
        if (keep) {
          s.points.push(fix);
          s.queue.push(fix);
          save(s);
          if (s.queue.length >= TUNING.batch) flush();
        }
        refresh(fix?.acc ?? null);
    };
    const onError = (err) => setGps(GPS_ERROR[err?.code] ?? (err?.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable'));
    if (watch) { watchId.current = watch(onFix, onError); return; }
    watchId.current = navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    lockScreen();
  }, [flush, lockScreen, refresh, stopWatch, watch]);

  // Retomar: lo guardado en el teléfono manda si es el recorrido abierto de la base
  useEffect(() => {
    if (!me) return;
    const saved = load();
    const open = me.open_route;
    if (saved?.ending) {
      state.current = saved;
      setStatus('pending-end');
      refresh();
      return;
    }
    if (open && saved?.routeId === open.id) {
      state.current = saved;
    } else if (open) {
      // Abierto desde otro celular o con el almacenamiento borrado: sigue sin los puntos viejos
      state.current = { routeId: open.id, clientRef: open.client_ref, startedAt: open.started_at, points: [], queue: [] };
      save(state.current);
    } else {
      if (saved) save(null);
      state.current = null;
      setStatus('idle');
      refresh();
      return;
    }
    setStatus('tracking');
    refresh();
    startWatch();
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subir cada 20 s, avisar si el GPS calla, y volver a pedir el Wake Lock al volver a la app
  useEffect(() => {
    if (status !== 'tracking') return undefined;
    const t = setInterval(() => {
      flush();
      if (Date.now() - lastFixAt.current > SILENT_MS) setGps((g) => (g === 'ok' ? 'silent' : g));
    }, FLUSH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') { lockScreen(); flush(); } else save(state.current);
    };
    const onOnline = () => flush();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [status, flush, lockScreen]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('starting');
    const clientRef = newRef();
    const { data, error: err } = await supabase.rpc('tintero_route_start', { p_client_ref: clientRef, p_started_at: new Date().toISOString() });
    if (err || !data?.id) {
      setError(err?.message || 'No se pudo empezar. Revisa la señal e inténtalo otra vez.');
      setStatus('idle');
      return;
    }
    state.current = { routeId: data.id, clientRef: data.client_ref, startedAt: data.started_at, points: [], queue: [] };
    save(state.current);
    setStatus('tracking');
    refresh();
    startWatch();
  }, [refresh, startWatch]);

  const finish = useCallback(async () => {
    const s = state.current;
    if (!s) return null;
    setError(null);
    stopWatch();
    s.ending = s.ending ?? new Date().toISOString();
    save(s);
    setStatus('ending');
    const sent = await flush({ all: true });
    const { data, error: err } = sent
      ? await supabase.rpc('tintero_route_end', { p_route_id: s.routeId, p_ended_at: s.ending, p_summary: summarize(s.points) })
      : { data: null, error: { message: 'Sin señal: el recorrido quedó guardado en el teléfono.' } };
    if (err) {
      setError(`${err.message} Toca «Terminar» otra vez cuando tengas señal.`);
      setStatus('pending-end');
      return null;
    }
    state.current = null;
    save(null);
    setStatus('idle');
    refresh();
    return data;
  }, [flush, refresh, stopWatch]);

  return { status, gps, view, error, start, finish, retryGps: startWatch };
}
