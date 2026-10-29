import { supabase } from '../../shared/lib/supabaseClient.js';
import { newRef } from './micraApp.js';
import platform from './platform.js';

// Llamadas de la app Micra a la base (supabase/migrations/20261026210000_micra_app.sql).
// Todas por funciones: la base pone precios y decide quién puede qué. `as` es el
// barista por el que actúa el equipo (null = el de la sesión).

const DEVICE_KEY = 'micra_device_v1';
const NAME_KEY = 'micra_name_v1';
const FAV_KEY = 'micra_favs_v1';

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado: se vive sin recordar */ } };

/** El identificador de este celular para sus apartados (sin cuenta). */
export function deviceRef() {
  let ref = read(DEVICE_KEY, null);
  if (!ref) { ref = newRef('cel'); write(DEVICE_KEY, ref); }
  return ref;
}
export const savedName = () => read(NAME_KEY, '');
export const saveName = (n) => write(NAME_KEY, n);
export const favorites = () => read(FAV_KEY, []);
export function toggleFavorite(id) {
  const now = favorites();
  const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
  write(FAV_KEY, next);
  return next;
}

// La migración aún no se aplicó: la app lo dice en vez de mostrar un error técnico
export const isMissing = (error) => error?.code === 'PGRST202' || error?.code === '42883' || /Could not find the function/.test(error?.message || '');

async function call(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code, missing: isMissing(error) });
  return data;
}

// Cliente
export const listBaristas = () => call('micra_baristas');
export const hold = (tinteroId, name, items) => call('micra_hold', { p_tintero_id: tinteroId, p_client_ref: deviceRef(), p_name: name, p_items: items });
export const myHolds = () => call('micra_my_holds', { p_client_ref: deviceRef() });
export const cancelHold = (id) => call('micra_hold_cancel', { p_client_ref: deviceRef(), p_hold_id: id });

// Barista
const as = (id) => (id ? { p_tintero_id: id } : {});
export const baristaDay = (asId) => call('micra_barista_day', as(asId));
export const goOut = (minutes, pos, asId) => call('micra_barista_out', { p_minutes: minutes, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, ...as(asId) });
export const setPrices = (p, asId) => call('micra_barista_prices', { p_tinto: p.tinto ?? null, p_perico: p.perico ?? null, p_aromatica: p.aromatica ?? null, ...as(asId) });
export const sell = (ref, product, qty, fiado, asId) => call('micra_barista_sale', { p_client_ref: ref, p_product: product, p_qty: qty, p_fiado_name: fiado || null, ...as(asId) });
export const undoSale = (id, asId) => call('micra_barista_undo', { p_sale_id: id, ...as(asId) });
export const closeHold = (id, served, asId) => call('micra_hold_close', { p_hold_id: id, p_served: served, ...as(asId) });
// Sellos (cada 10 tazas entregadas, un tinto gratis) y cómo pagarle al barista
export const myStamps = () => call('micra_my_stamps', { p_client_ref: deviceRef() });
export const holdRewards = (asId) => call('micra_hold_rewards', as(asId));
export const redeemReward = (holdId, asId) => call('micra_reward_redeem', { p_hold_id: holdId, ...as(asId) });
export const baristaPay = (id) => call('micra_barista_pay', { p_tintero_id: id });
export const setPay = (p, asId) => call('micra_barista_pay_set', { p_nequi: p.nequi || null, p_daviplata: p.daviplata || null, ...as(asId) });
export const fiadoPaid = (name, asId) => call('micra_fiado_paid', { p_name: name, ...as(asId) });
export const claim = (code) => call('tintero_claim', { p_code: code });
export const me = () => call('tintero_me');

// Equipo
export const ownerDay = () => call('micra_owner_day');
export const invite = (id) => call('tintero_invite', { p_tintero_id: id });

// El panel del equipo (estudio, encuestas, cámara con filtros) es solo del dueño:
// otro rol de admin_users entra a Micra como cualquier barista
export async function isAdmin(userId) {
  const { data, error } = await supabase.from('admin_users').select('id, role').eq('auth_user_id', userId).maybeSingle();
  return !error && data?.role === 'owner';
}

// En el celular instalado se entra por el navegador del sistema y se vuelve por enlace (native/)
export const signIn = (next) => platform.signIn(next);
export const signOut = () => supabase.auth.signOut();

/** Un punto del GPS, una sola vez (para «Salí»). Sin permiso o sin señal: null. */
export const onePosition = (timeout) => platform.position(timeout);
