import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { useTracker } from '../ruta/useTracker.js';
import * as api from './api.js';
import platform from './platform.js';

// El recorrido del barista mientras está en «Salí a vender»: con su permiso de
// ubicación (una vez, en la hoja de permiso), se empieza a grabar al salir y se
// cierra al volver. Mismas tablas y funciones que Mi ruta (tintero_route_*). En
// la app instalada sigue con la pantalla apagada; en la web, mientras esté abierta.
// `enabled`: solo el barista en su propia cuenta (no el equipo «actuando como»).

const watchBg = (onFix, onError) => platform.watch(onFix, onError, { background: true });

export function useSaliTracking({ enabled }) {
  const [me, setMe] = useState(null); // tintero_me: { consent_at, open_route, ... }
  const tracker = useTracker(enabled ? me : null, { watch: platform.native ? watchBg : null });

  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve(null);
    return api.me().then((m) => { setMe(m); return m; }).catch(() => null);
  }, [enabled]);
  useEffect(() => { reload(); }, [reload]);

  const consent = useCallback(async (accept) => {
    const { data, error } = await supabase.rpc('tintero_consent', { p_accept: accept });
    if (error) throw new Error(error.message);
    setMe(data);
    return data;
  }, []);

  return {
    ready: enabled && !!me,
    consented: !!me?.consent_at,
    consentAt: me?.consent_at ?? null,
    recording: tracker.status === 'tracking' || tracker.status === 'starting',
    pendingEnd: tracker.status === 'pending-end',
    gps: tracker.gps,
    view: tracker.view,
    error: tracker.error,
    consent,
    start: tracker.start,
    finish: tracker.finish,
  };
}
