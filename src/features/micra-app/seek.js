import { call } from './api.js';
import { newRef } from './micraApp.js';
import { canSeek, seekPayload } from './liveMap.js';

// «Busco café» (supabase/migrations/20261030180000_micra_live_map.sql): solo la
// celda (~440 m) y la bebida, con una llave aleatoria distinta a la de los
// apartados; uno cada 15 min por celular. Sin nombre ni posición exacta.
// Llega aparte (import dinámico): la app ya está al borde del límite del bundle.

const SEEK_REF_KEY = 'micra_seek_ref_v1';
const SEEK_AT_KEY = 'micra_seek_at_v1';
const SEEK_OFF_KEY = 'micra_seek_off_v1';
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado: no se recuerda */ } };

export const seekOff = () => read(SEEK_OFF_KEY, false) === true;
export const setSeekOff = (off) => write(SEEK_OFF_KEY, !!off);

export async function seekCoffee(pos, drink) {
  if (seekOff() || !canSeek(read(SEEK_AT_KEY, null))) return { sent: false };
  let ref = read(SEEK_REF_KEY, null);
  if (!ref) { ref = newRef('busco'); write(SEEK_REF_KEY, ref); }
  const payload = seekPayload(ref, pos, drink);
  if (!payload) return { sent: false };
  write(SEEK_AT_KEY, Date.now());
  try { return { sent: true, ...(await call('micra_seek', payload)) }; } catch { return { sent: false }; } // sin señal o sin migración: no pasa nada
}
